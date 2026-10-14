// Private purchase-file manager. Included in music-admin-worker.js for dashboard deployment.
const PURCHASE_MAX=25*1024*1024;
async function purchaseId(item){const key=(item.type==='album'?'album':'single')+':'+(item.hyperfollow||normalize(item.title));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),b=>b.toString(16).padStart(2,'0')).join('').slice(0,32);}
function purchaseSlots(item){return item.type==='album'?(item.tracks||[]).map((track,index)=>({slot:String(index+1),title:track.title,number:index+1,total:item.tracks.length})):[{slot:'single',title:item.title,number:0,total:1}];}
async function purchaseRelease(env,id){const catalog=await catalogFile(env);for(const item of catalog.items){if(await purchaseId(item)===id)return item;}throw new Problem('This release is no longer in the catalog. Refresh the file list.',404);}
function purchaseRecordKey(id,slot){return 'records/'+id+'/'+slot+'.json';}
async function purchaseList(env){
  const catalog=await catalogFile(env),storageReady=Boolean(env.PURCHASE_FILES),items=[];
  for(const item of catalog.items){const id=await purchaseId(item),slots=[];for(const slot of purchaseSlots(item)){const record=storageReady?await env.PURCHASE_FILES.get(purchaseRecordKey(id,slot.slot)):null;const file=record?await record.json():null;const reviewed=!!file&&file.title===slot.title&&file.album===item.title&&file.artist===(item.artist||'Echo Craft')&&file.coverSource===(item.cover||'');slots.push({...slot,file:file?{filename:file.filename,size:file.size,uploadedAt:file.uploadedAt,coverEmbedded:file.coverEmbedded}:null,status:file?(reviewed?'ready':'review'):'missing'});}items.push({id,title:item.title,type:item.type==='album'?'album':'single',artist:item.artist||'Echo Craft',cover:item.cover||'',publicationStatus:item.publicationStatus||'published',slots});}
  return {storageReady,items};
}
function purchaseCoverUrl(item){const url=new URL(String(item.cover||'').replaceAll('\\','/'),'https://echocraftmusic.com/');requireValue(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&['echocraftmusic.com','www.echocraftmusic.com','echocraftmusic.github.io','distrokid.imgix.net'].includes(url.hostname),'This cover source cannot be loaded. Update its catalog artwork first.',400);return url.href;}
async function purchaseBytes(request,max){const reader=request.body?.getReader();requireValue(reader,'Select a file.');let length=0;const parts=[];while(true){const r=await reader.read();if(r.done)break;length+=r.value.length;requireValue(length<=max,'Use an MP3 no larger than 25 MB (cover art: 2 MB).',413);parts.push(r.value);}const result=new Uint8Array(length);let at=0;for(const part of parts){result.set(part,at);at+=part.length;}return result;}
function purchaseJoin(parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const part of parts){out.set(part,at);at+=part.length;}return out;}
function purchaseText(value){const s=String(value||'');const b=new Uint8Array(3+s.length*2);b.set([1,255,254]);for(let i=0;i<s.length;i++){b[3+i*2]=s.charCodeAt(i)&255;b[4+i*2]=s.charCodeAt(i)>>8;}return b;}
function purchaseFrame(id,data){const head=new Uint8Array(10);head.set(new TextEncoder().encode(id));new DataView(head.buffer).setUint32(4,data.length);return purchaseJoin([head,data]);}
function purchaseTag(bytes,metadata,cover){
  let start=0;
  if(new TextDecoder().decode(bytes.subarray(0,3))==='ID3'){
    requireValue(bytes.length>=10&&[2,3,4].includes(bytes[3])&&bytes.subarray(6,10).every(n=>n<128),'The MP3 tag header is invalid. Export the MP3 again.');
    start=10+bytes.subarray(6,10).reduce((n,b)=>n*128+b,0)+(bytes[3]===4&&(bytes[5]&16)?10:0);
  }
  requireValue(start+4<bytes.length&&bytes[start]===255&&(bytes[start+1]&224)===224&&(bytes[start+1]&6)===2&&(bytes[start+2]>>4)!==15&&(bytes[start+2]>>4)!==0,'This is not a valid MP3 audio file. Convert WAV to MP3 before uploading.');
  let end=bytes.length;if(end>=128&&new TextDecoder().decode(bytes.subarray(end-128,end-125))==='TAG')end-=128;
  const frames=[purchaseFrame('TIT2',purchaseText(metadata.title)),purchaseFrame('TPE1',purchaseText(metadata.artist)),purchaseFrame('TALB',purchaseText(metadata.album))];
  if(metadata.number)frames.push(purchaseFrame('TRCK',purchaseText(metadata.number+'/'+metadata.total)));
  if(/^\d{4}/.test(metadata.date||''))frames.push(purchaseFrame('TYER',purchaseText(metadata.date.slice(0,4))));
  if(cover){const kind=imageKind(cover);requireValue(['jpg','png'].includes(kind),'Cover art must be JPEG or PNG.');frames.push(purchaseFrame('APIC',purchaseJoin([new Uint8Array([0]),new TextEncoder().encode(kind==='jpg'?'image/jpeg':'image/png'),new Uint8Array([0,3,0]),cover])));}
  const body=purchaseJoin(frames),head=new Uint8Array([73,68,51,3,0,0,0,0,0,0]);let n=body.length;for(let i=9;i>=6;i--){head[i]=n&127;n>>>=7;}return purchaseJoin([head,body,bytes.subarray(start,end)]);
}
async function purchaseUpload(request,env,id,slotId){
  requireValue(env.PURCHASE_FILES,'Connect the private purchase bucket to enable uploads.',503);
  const item=await purchaseRelease(env,id),slot=purchaseSlots(item).find(x=>x.slot===slotId);requireValue(slot,'This album track changed. Refresh the list.',409);
  const bytes=await purchaseBytes(request,PURCHASE_MAX);let cover;
  const coverId=request.headers.get('X-Cover-Id');
  if(item.cover){requireValue(validId(coverId),'Load the release artwork before uploading.');const o=await env.PURCHASE_FILES.get('covers/'+id+'/'+coverId);requireValue(o,'The prepared cover expired. Retry the upload.');cover=new Uint8Array(await o.arrayBuffer());}
  const tagged=purchaseTag(bytes,{...slot,artist:item.artist||'Echo Craft',album:item.title,date:item.releaseDate},cover);
  const filename=(slot.number?String(slot.number).padStart(2,'0')+' - ':'')+String(slot.title).replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').slice(0,160)+'.mp3';
  const key=(item.type==='album'?'albums':'singles')+'/'+id+'/'+uuid()+'/'+filename;
  await env.PURCHASE_FILES.put(key,tagged,{httpMetadata:{contentType:'audio/mpeg',contentDisposition:'attachment; filename="'+filename.replace(/[^\x20-\x7e]|"/g,'_')+'"'}});
  const record={key,filename,title:slot.title,album:item.title,artist:item.artist||'Echo Craft',coverSource:item.cover||'',coverEmbedded:Boolean(cover),size:tagged.length,uploadedAt:new Date().toISOString()};
  await env.PURCHASE_FILES.put(purchaseRecordKey(id,slotId),JSON.stringify(record));return {ok:true,file:{filename,size:record.size,uploadedAt:record.uploadedAt,coverEmbedded:record.coverEmbedded}};
}
async function purchaseHandle(request,env,url,headers){
  const path=url.pathname;
  if(path==='/api/purchase-files'&&request.method==='GET')return new Response(JSON.stringify(await purchaseList(env)),{headers});
  const id=url.searchParams.get('release'),slot=url.searchParams.get('slot');requireValue(/^[a-f0-9]{32}$/.test(id||''),'Invalid release.');
  if(path==='/api/purchase-cover'&&request.method==='GET'){const item=await purchaseRelease(env,id);const r=await boundedFetch(purchaseCoverUrl(item),{},2*1024*1024);requireValue(r.ok&&imageKind(r.bytes),'Cover art could not be loaded.',502);return new Response(r.bytes,{headers:{...headers,'Content-Type':r.headers.get('Content-Type')||'image/jpeg'}});}
  requireValue(env.PURCHASE_FILES,'Connect the private purchase bucket to enable uploads.',503);
  if(path==='/api/purchase-cover'&&request.method==='POST'){await purchaseRelease(env,id);const b=await purchaseBytes(request,2*1024*1024);requireValue(['jpg','png'].includes(imageKind(b)),'Use JPEG or PNG artwork.');const coverId=uuid();await env.PURCHASE_FILES.put('covers/'+id+'/'+coverId,b);return new Response(JSON.stringify({coverId}),{headers});}
  requireValue(/^(single|[1-9]\d{0,2})$/.test(slot||''),'Invalid track slot.');
  if(path==='/api/purchase-file'&&request.method==='PUT')return new Response(JSON.stringify(await purchaseUpload(request,env,id,slot)),{headers});
  if(path==='/api/purchase-file'&&request.method==='GET'){await purchaseRelease(env,id);const record=await env.PURCHASE_FILES.get(purchaseRecordKey(id,slot));requireValue(record,'No purchase file has been uploaded.',404);const file=await record.json(),o=await env.PURCHASE_FILES.get(file.key);requireValue(o,'The saved file is missing.',404);return new Response(o.body,{headers:{...headers,'Content-Type':'audio/mpeg','Content-Disposition':'attachment; filename="'+file.filename.replace(/[^\x20-\x7e]|"/g,'_')+'"'}});}
  throw new Problem('Purchase file action not found.',404);
}
