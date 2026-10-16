(()=>{'use strict';
const WORKER='https://echocraft-music-admin.echocraft-aimusic.workers.dev';
const root=document.getElementById('purchaseFileList');if(!root)return;
let releases=[],storageReady=false,loading=false,active=false,listRevision=0,purchasePlayback=null,playbackGeneration=0;const urls=new Set(),slotMessages=new Map(),busySlots=new Set(),copyingAlbums=new Set();
const $=id=>document.getElementById(id),message=(text,bad=false)=>{$('purchaseFileStatus').textContent=text;$('purchaseFileStatus').className='status'+(bad?' bad':' good');};
function node(tag,text,className){const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;}
async function request(path,options={}){const {data,error}=await window.echoAdminAuth.auth.getSession();if(error||!data?.session?.access_token)throw Error('Please sign in again.');const r=await fetch(WORKER+path,{cache:'no-store',...options,headers:{Authorization:'Bearer '+data.session.access_token,...options.headers}});if(!r.ok){const data=await r.json().catch(()=>({}));throw Error(data.error||'Purchase Files is not connected yet. Deploy the updated Worker.');}return r;}
function source(value){try{const url=new URL(value,new URL('../',location.href));return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}}
async function coverFor(release){if(!release.cover)return null;const r=await request('/api/purchase-cover?release='+release.id);const bitmap=await createImageBitmap(await r.blob());try{const canvas=document.createElement('canvas'),size=Math.min(1000,Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*size/Math.max(bitmap.width,bitmap.height));canvas.height=Math.round(bitmap.height*size/Math.max(bitmap.width,bitmap.height));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Could not prepare cover art.')),'image/jpeg',.9));}finally{bitmap.close();}}


function stopPurchasePlayback(){
 ++playbackGeneration;const current=purchasePlayback;purchasePlayback=null;if(!current)return;
 current.controller.abort();current.audio.pause();current.audio.removeAttribute('src');current.audio.load();current.audio.hidden=true;
 if(current.url)URL.revokeObjectURL(current.url);current.button.textContent='Play uploaded MP3';current.button.setAttribute('aria-label','Play uploaded MP3: '+current.title);current.status.textContent='';
}
function addPurchasePlayer(info,actions,release,slot){
 const button=node('button','Play uploaded MP3','btn'),audio=node('audio'),status=node('div','','purchase-playback-status');
 button.type='button';button.setAttribute('aria-label','Play uploaded MP3: '+slot.title);audio.controls=true;audio.preload='none';audio.hidden=true;audio.setAttribute('aria-label','Uploaded full MP3: '+slot.title);status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 audio.onplay=()=>{if(purchasePlayback?.audio===audio)status.textContent='Playing saved full MP3.';};
 audio.onpause=()=>{if(purchasePlayback?.audio===audio&&!audio.ended)status.textContent='Paused. Use the player to continue or seek.';};
 audio.onended=()=>{if(purchasePlayback?.audio===audio)status.textContent='Playback finished. You can replay or seek within this file.';};
 audio.onerror=()=>{if(purchasePlayback?.audio===audio){stopPurchasePlayback();status.textContent='This saved file could not be played. Try again or download the tagged copy to check it.';}};
 button.onclick=async()=>{
  if(purchasePlayback?.audio===audio){stopPurchasePlayback();return;}
  stopPurchasePlayback();const generation=playbackGeneration,current={audio,button,status,title:slot.title,url:null,controller:new AbortController()};purchasePlayback=current;
  button.textContent='Cancel loading';button.setAttribute('aria-label','Cancel playback: '+slot.title);status.textContent='Loading saved full MP3…';
  try{
   const r=await request('/api/purchase-file?release='+encodeURIComponent(release.id)+'&slot='+encodeURIComponent(slot.slot),{signal:current.controller.signal}),blob=await r.blob();
   if(generation!==playbackGeneration||!active||!audio.isConnected)return;
   current.url=URL.createObjectURL(blob);audio.src=current.url;audio.hidden=false;button.textContent='Close player';button.setAttribute('aria-label','Close player: '+slot.title);
   try{await audio.play();}catch(e){if(e.name!=='NotAllowedError')throw e;if(generation===playbackGeneration)status.textContent='Full MP3 ready. Press Play in the player below.';}
  }catch(e){if(generation!==playbackGeneration||e.name==='AbortError')return;stopPurchasePlayback();status.textContent='Could not play saved MP3: '+e.message;}
 };
 actions.append(button);info.append(audio,status);
}

function matchTitle(value){return String(value||'').normalize('NFKC').replace(/[’‘]/g,"'").trim().replace(/\s+/g,' ').toLowerCase();}
function savedSingleFor(album,slot){
 const title=matchTitle(slot.title),artist=matchTitle(album.artist||'Echo Craft');
 let matches=releases.filter(item=>item.type==='single'&&matchTitle(item.artist||'Echo Craft')===artist&&matchTitle(item.title)===title);
 // Owner-confirmed title difference between this album and its single.
 if(!matches.length&&matchTitle(album.title)==='heavy & chunky'&&title==='storm of the barbarian')matches=releases.filter(item=>item.type==='single'&&matchTitle(item.artist||'Echo Craft')===artist&&matchTitle(item.title)==='the storm of the barbarian');
 return matches.length===1&&matches[0].slots.length===1&&matches[0].slots[0].file?matches[0]:null;
}
async function fillAlbumFromSingles(id){
 if(copyingAlbums.has(id))return;copyingAlbums.add(id);let copied=0;
 try{
  await refreshFiles();if(!active||!storageReady)throw Error('Sign in and connect private storage before copying files.');
  const album=releases.find(item=>item.id===id);if(!album)throw Error('This album is no longer in the catalog.');
  const planned=album.slots.filter(slot=>!slot.file&&savedSingleFor(album,slot)).map(slot=>slot.slot);
  if(!planned.length){message('No missing album tracks have an unambiguous uploaded single to copy.');return;}
  for(const slotId of planned){
   if(!active)throw Error('Sign in again to continue copying.');
   const current=releases.find(item=>item.id===id),slot=current?.slots.find(item=>item.slot===slotId);if(!slot||slot.file)continue;
   const single=savedSingleFor(current,slot);if(!single)continue;
   message('Copying '+(copied+1)+' of '+planned.length+': '+slot.title+'…');
   const r=await request('/api/purchase-file?release='+encodeURIComponent(single.id)+'&slot='+encodeURIComponent(single.slots[0].slot)),blob=await r.blob();
   // A second refresh avoids replacing a file uploaded while its single was downloading.
   await refreshFiles();const target=releases.find(item=>item.id===id),destination=target?.slots.find(item=>item.slot===slotId);if(!destination||destination.file)continue;
   const status=node('div'),zone=node('div');
   if(!await upload(new File([blob],single.slots[0].file.filename,{type:'audio/mpeg'}),target,destination,status,zone))throw Error('Could not copy '+destination.title+'. Previously saved tracks remain intact.');
   copied++;
  }
  const albumNow=releases.find(item=>item.id===id),remaining=albumNow.slots.filter(slot=>!slot.file).length;
  message(albumNow.title+': '+copied+' album '+(copied===1?'track':'tracks')+' copied from uploaded singles. '+(remaining?remaining+' still need a full MP3.':'All album files are ready.')+' Singles kept unchanged.');
 }catch(e){message('Copy stopped after '+copied+' saved '+(copied===1?'track':'tracks')+': '+e.message,true);}finally{copyingAlbums.delete(id);render();}
}

async function upload(file,release,slot,status,zone){
 const key=release.id+':'+slot.slot;if(busySlots.has(key))return;
 if(!file)return;if(!/\.mp3$/i.test(file.name)){status.textContent='Convert this file to MP3 first. WAV and ZIP files are not uploaded here.';return;}if(file.size>25*1024*1024){status.textContent='Choose an MP3 no larger than 25 MB.';return;}
 if(slot.file&&!confirm('Replace the saved purchase file for '+slot.title+'?'))return;
 busySlots.add(key);zone.inert=true;try{status.textContent='Preparing the catalog artwork…';const cover=await coverFor(release);let coverId='';if(cover){const r=await request('/api/purchase-cover?release='+release.id,{method:'POST',body:cover});coverId=(await r.json()).coverId;}
 status.textContent='Uploading and adding music tags…';const r=await request('/api/purchase-file?release='+release.id+'&slot='+slot.slot,{method:'PUT',body:file,headers:{'Content-Type':'audio/mpeg',...(coverId?{'X-Cover-Id':coverId}:{})}});const result=await r.json();
 ++listRevision;const savedSlot=releases.find(item=>item.id===release.id)?.slots.find(item=>item.slot===slot.slot)||slot;
 savedSlot.file=result.file;savedSlot.status='ready';slotMessages.set(key,'Saved privately: '+result.file.filename);render();
 const savedMessage=slot.title+' saved with catalog tags'+(result.file.coverEmbedded?' and cover artwork.':'.');
 try{await refreshFiles();message(savedMessage+' File status updated.');}catch{message(savedMessage+' The file is saved; storage status could not be rechecked. Use Refresh files to retry.',true);}
 return true;

 }catch(e){slotMessages.set(key,'Not saved: '+e.message);status.textContent='Not saved: '+e.message;message(slot.title+' was not saved: '+e.message,true);}finally{busySlots.delete(key);zone.inert=false;render();}
}
function render(preview=false){
 stopPurchasePlayback();
 const expanded=new Set([...root.querySelectorAll('.purchase-release[data-release-id]')].filter(card=>card.querySelector('details')?.open).map(card=>card.dataset.releaseId));
 root.replaceChildren();const query=$('purchaseFileSearch').value.trim().toLowerCase(),filter=$('purchaseFileFilter').value;
 const visible=releases.filter(r=>(r.title+' '+r.slots.map(s=>s.title).join(' ')).toLowerCase().includes(query)&&(filter==='all'||r.type===filter));
 $('purchaseFileCount').textContent=visible.length+(visible.length===1?' release · ':' releases · ')+releases.reduce((n,r)=>n+r.slots.filter(s=>s.status==='ready').length,0)+' files ready';
 for(const release of visible){const card=node('article','', 'purchase-release');card.dataset.releaseId=release.id;const heading=node('div','','purchase-heading');const image=node('img');image.src=source(release.cover)||'../assets/images/no-cover.webp';image.alt='';image.loading='lazy';const title=node('div');title.append(node('h3',release.title),node('p',(release.type==='album'?'Album · '+release.slots.length+' tracks':'Single')+' · '+release.artist+(release.publicationStatus!=='published'?' · '+release.publicationStatus:'')));const ready=release.slots.filter(s=>s.status==='ready').length,badge=node('span',ready===release.slots.length&&ready?'Files ready':ready+'/'+release.slots.length+' files ready','purchase-badge'+(ready===release.slots.length&&ready?' ready':''));heading.append(image,title,badge);card.append(heading);
 const slots=node('div','','purchase-slots');for(const slot of release.slots){const row=node('div','','purchase-slot'),info=node('div');info.append(node('strong',(slot.number?String(slot.number).padStart(2,'0')+'. ':'')+slot.title));info.append(node('p',slot.file?(slot.status==='review'?'MP3 already saved — refresh its tags to match the current catalog. No new file needed.':slot.file.filename+' · '+(slot.file.size/1024/1024).toFixed(1)+' MB'+(slot.file.coverEmbedded?' · Cover embedded':'')):'Full MP3 needed'));
 if(slot.file&&!preview){const actions=node('div','','purchase-file-actions');info.append(actions);addPurchasePlayer(info,actions,release,slot);const button=node('button','Download tagged copy','btn');button.type='button';button.onclick=async()=>{button.disabled=true;try{const r=await request('/api/purchase-file?release='+release.id+'&slot='+slot.slot),u=URL.createObjectURL(await r.blob());urls.add(u);const a=node('a');a.href=u;a.download=slot.file.filename;a.click();}catch(e){message(e.message,true);}finally{button.disabled=false;}};actions.append(button);}
 const zone=node('div','','purchase-drop'),status=node('div',slotMessages.get(release.id+':'+slot.slot)||'','purchase-upload-status'),input=node('input');zone.inert=busySlots.has(release.id+':'+slot.slot);input.type='file';input.accept='.mp3,audio/mpeg';input.setAttribute('aria-label','Full MP3 for '+slot.title);const browse=node('button',slot.file?'Replace MP3':'Browse MP3','btn');browse.type='button';browse.disabled=!storageReady||preview;browse.onclick=()=>input.click();input.onchange=()=>upload(input.files[0],release,slot,status,zone);zone.append(node('p','Drop the full MP3 here'),browse,input,status);zone.ondragover=e=>{e.preventDefault();if(storageReady&&!preview)zone.classList.add('dragging');};zone.ondragleave=()=>zone.classList.remove('dragging');zone.ondrop=e=>{e.preventDefault();zone.classList.remove('dragging');if(!storageReady||preview)return;if(e.dataTransfer.files.length!==1){status.textContent='Drop one MP3 into this track slot.';return;}upload(e.dataTransfer.files[0],release,slot,status,zone);};if(slot.file&&slot.status==='review'&&!preview){const refresh=node('button','Refresh tags from saved MP3','btn');refresh.type='button';refresh.disabled=!storageReady;refresh.onclick=async()=>{refresh.disabled=true;zone.inert=true;status.textContent='Loading the saved MP3…';try{const r=await request('/api/purchase-file?release='+encodeURIComponent(release.id)+'&slot='+encodeURIComponent(slot.slot));const blob=await r.blob();await upload(new File([blob],slot.file.filename,{type:'audio/mpeg'}),release,slot,status,zone);}catch(e){status.textContent='Could not refresh: '+e.message;}finally{zone.inert=false;refresh.disabled=false;}};info.append(refresh);}row.append(info,zone);slots.append(row);}
 if(!preview&&release.type==='album'){
 const reusable=release.slots.filter(slot=>!slot.file&&savedSingleFor(release,slot)).length;
 if(reusable||copyingAlbums.has(release.id)){const reuse=node('button',copyingAlbums.has(release.id)?'Copying uploaded singles…':'Use uploaded singles ('+reusable+')','btn');reuse.type='button';reuse.disabled=!storageReady||copyingAlbums.has(release.id);reuse.onclick=()=>fillAlbumFromSingles(release.id);card.append(reuse,node('p','Fill missing album tracks from matching full MP3s already uploaded as singles. Album tags and artwork are applied; existing files are kept.','purchase-details'));}
 }
 if(release.type==='album'){const details=node('details'),summary=node('summary','Show album tracks');details.open=expanded.has(release.id);details.append(summary,slots);card.append(details);}else card.append(slots);
 if(!preview&&release.type==='single'&&release.slots[0]?.status==='ready'){const test=node('a','Test checkout & delivery','btn');test.href='test-delivery.html?release='+encodeURIComponent(release.id);card.append(test);}
 card.append(node('p','Tags: title, artist, album'+(release.type==='album'?', track number':'')+' and catalog cover. Files remain private; uploading does not enable customer downloads.','purchase-details'));root.append(card);}
 if(!visible.length)root.append(node('p','No releases match this search.','help'));
}
async function refreshFiles(){const revision=++listRevision,r=await request('/api/purchase-files'),data=await r.json();if(revision!==listRevision)return false;releases=data.items;storageReady=data.storageReady;render();return true;}
async function load(){if(loading||!active)return;loading=true;message('Loading the catalog and purchase files…');try{if(!await refreshFiles())return;message(storageReady?'Private storage connected. Choose a release and drop its full MP3.':'The tab is ready. Connect PURCHASE_FILES to your private downloads bucket to enable uploads.',!storageReady);render();}catch(e){message(e.message,true);if(releases.length)return;storageReady=false;try{const r=await request('/api/catalog'),catalog=await r.json();releases=catalog.items.map((item,index)=>({...item,id:String(index),type:item.type==='album'?'album':'single',artist:item.artist||'Echo Craft',publicationStatus:item.publicationStatus||'published',slots:item.type==='album'?(item.tracks||[]).map((t,i)=>({title:t.title,slot:String(i+1),number:i+1,status:'missing'})):[{title:item.title,slot:'single',status:'missing'}]}));render();}catch{}}finally{loading=false;}}
 $('purchaseFileSearch').oninput=()=>render(Boolean(root.dataset.preview));$('purchaseFileFilter').onchange=()=>render(Boolean(root.dataset.preview));$('refreshPurchaseFiles').onclick=load;
 document.querySelectorAll('[data-admin-tab]').forEach(button=>button.onclick=()=>{const purchase=button.dataset.adminTab==='purchase';$('purchaseWorkspace').hidden=!purchase;$('releaseWorkspace').hidden=purchase;if(!purchase)stopPurchasePlayback();document.querySelectorAll('[data-admin-tab]').forEach(b=>b.setAttribute('aria-selected',String(b===button)));if(purchase)load();});
 window.addEventListener('echo-admin-session',()=>{active=true;if(!$('purchaseWorkspace').hidden)load();});
 $('signOut')?.addEventListener('click',()=>{active=false;stopPurchasePlayback();++listRevision;releases=[];storageReady=false;slotMessages.clear();root.replaceChildren();for(const u of urls)URL.revokeObjectURL(u);urls.clear();});
 if(window.echoAdminAuth)window.echoAdminAuth.auth.getSession().then(({data})=>{active=Boolean(data?.session);if(active&&!$('purchaseWorkspace').hidden)load();});
 if(root.dataset.preview){fetch('../music/music.json').then(r=>r.json()).then(c=>{releases=c.items.map((item,i)=>({...item,id:String(i),artist:item.artist||'Echo Craft',publicationStatus:item.publicationStatus||'published',type:item.type==='album'?'album':'single',slots:item.type==='album'?(item.tracks||[]).map((t,n)=>({slot:String(n+1),number:n+1,title:t.title,status:'missing'})):[{slot:'single',title:item.title,status:'missing'}]}));render(true);});}
})();
