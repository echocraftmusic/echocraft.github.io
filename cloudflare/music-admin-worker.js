// Echo Craft online music manager. Bind ADMIN_STAGING to the private R2 bucket.
const SUPABASE_URL='https://jryqukxridujdqfuqinz.supabase.co';
const SUPABASE_KEY='sb_publishable_1Uyu1Lfzwolx26MvLEHbQg_NXNHzTLW';
const REPO='echocraftmusic/echocraft.github.io';
const EMAILS=new Set(['troy.saha@gmail.com','echocraft.aimusic@gmail.com']);
const ORIGINS=new Set(['https://echocraftmusic.com','https://www.echocraftmusic.com','https://echocraftmusic.github.io']);
class Problem extends Error { constructor(message,status=400){super(message);this.status=status;} }
const requireValue=(condition,message,status=400)=>{if(!condition)throw new Problem(message,status);};
const normalize=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const slug=v=>normalize(v).replace(/ /g,'-').slice(0,100)||'release';
const uuid=()=>crypto.randomUUID();
const validId=id=>/^[a-f0-9-]{36}$/.test(String(id));
const decode64=s=>Uint8Array.from(atob(s.replace(/\s/g,'')),c=>c.charCodeAt(0));
function encode64(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);}
async function boundedFetch(url,options={},max=8*1024*1024){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),25000);
  try{
    const r=await fetch(url,{...options,redirect:'manual',signal:c.signal});
    const reader=r.body?.getReader();let size=0;const chunks=[];
    if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){c.abort();throw new Problem('The downloaded file is too large.');}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    return {status:r.status,ok:r.ok,headers:r.headers,bytes,text:()=>new TextDecoder().decode(bytes),json:()=>JSON.parse(new TextDecoder().decode(bytes))};
  }catch(e){if(c.signal.aborted)throw new Problem('Request timed out. Please retry.',504);throw e;}finally{clearTimeout(timer);}
}
async function gh(env,path,method='GET',body){
  const token=String(env.GITHUB_TOKEN||'').trim();requireValue(/^[A-Za-z0-9_]+$/.test(token),'The GitHub secret is missing or invalid.',503);
  const r=await boundedFetch('https://api.github.com/repos/'+REPO+'/'+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','User-Agent':'EchoCraft-Music-Admin','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})},12*1024*1024);
  if(!r.ok)throw new Problem('GitHub request failed ('+r.status+').'+(r.status===401?' Replace the expired GitHub token.':''),r.status===409||r.status===422?409:502);
  return r.json();
}
async function catalogFile(env,path='music/music.json',ref='main',optional=false){
  try {const file=await gh(env,'contents/'+path+'?ref='+encodeURIComponent(ref));requireValue(file.encoding==='base64'&&typeof file.content==='string','Unexpected GitHub file response.',502);return JSON.parse(new TextDecoder().decode(decode64(file.content)).replace(/^\uFEFF/,''));}
  catch(e){if(optional&&e.message.includes('(404)'))return {items:[]};throw e;}
}
function hyperUrl(value){let u;try{u=new URL(value);}catch{throw new Problem('Paste a valid DistroKid HyperFollow URL.');}requireValue(u.protocol==='https:'&&u.hostname==='distrokid.com'&&u.pathname.startsWith('/hyperfollow/')&&!u.username&&!u.password&&!u.port,'Use an HTTPS DistroKid HyperFollow link.');u.hash='';return u.href;}
async function hyperHtml(url){for(let i=0;i<6;i++){url=hyperUrl(url);const r=await boundedFetch(url,{headers:{'User-Agent':'Mozilla/5.0'}},6*1024*1024);if(r.status>=300&&r.status<400){requireValue(r.headers.get('location'),'HyperFollow redirect has no destination.');url=new URL(r.headers.get('location'),url).href;continue;}requireValue(r.ok,'HyperFollow returned HTTP '+r.status+'. Use the saved-page option if it opens in your browser.',502);return r.text();}throw new Problem('Too many HyperFollow redirects.');}
const mp3=bytes=>bytes.length>3&&((bytes[0]===73&&bytes[1]===68&&bytes[2]===51)||(bytes[0]===255&&(bytes[1]&224)===224));
function imageKind(b){if(b[0]===255&&b[1]===216&&b[2]===255)return 'jpg';if(b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71)return 'png';if(new TextDecoder().decode(b.slice(0,4))==='RIFF'&&new TextDecoder().decode(b.slice(8,12))==='WEBP')return 'webp';return '';}
async function jsonBody(request,max=12*1024*1024){const reader=request.body?.getReader();let size=0;const chunks=[];if(reader)while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;requireValue(size<=max,'Request is too large.',413);chunks.push(r.value);}const b=new Uint8Array(size);let o=0;for(const c of chunks){b.set(c,o);o+=c.length;}try{return JSON.parse(new TextDecoder().decode(b));}catch{throw new Problem('Invalid request data.');}}
async function r2json(env,key){const o=await env.ADMIN_STAGING.get(key);return o?o.json():null;}
async function asset(env,id){requireValue(validId(id),'Invalid preview identifier.');const a=await r2json(env,'assets/'+id+'.json');requireValue(a,'This preview is no longer available. Import it again.',404);return a;}
async function saveAsset(env,bytes,name,kind){
  requireValue(bytes.length<=8*1024*1024,'Use a file smaller than 8 MB.');
  const ext=kind==='preview'?(mp3(bytes)?'mp3':''):imageKind(bytes);requireValue(ext,kind==='preview'?'This file is not an MP3.':'Use JPG, PNG, or WEBP cover art.');
  const id=uuid(),path='music/'+(kind==='preview'?'previews/online/':'covers/')+id+'-'+slug(name.replace(/\.[^.]+$/,''))+'.'+ext;
  const a={id,path,kind,key:'assets/'+id+'.bin',name,contentType:kind==='preview'?'audio/mpeg':'image/'+(ext==='jpg'?'jpeg':ext),created:new Date().toISOString()};
  await env.ADMIN_STAGING.put(a.key,bytes,{httpMetadata:{contentType:a.contentType}});
  await env.ADMIN_STAGING.put('assets/'+id+'.json',JSON.stringify(a));return a;
}
function safePublicPath(value,kind){value=String(value||'').replace(/^\//,'');requireValue(!value.includes('..')&&!value.includes('\\')&&new RegExp('^music/'+(kind==='preview'?'previews':'covers')+'/[A-Za-z0-9_./-]+$').test(value),'Select an imported file or use an existing music file path.');return value;}
function webUrl(value,host){if(!value)return '';let u;try{u=new URL(value);}catch{throw new Problem('One of the release links is invalid.');}requireValue(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(!host||host.test(u.hostname)),'Use a valid HTTPS release link.');return u.href;}
async function publish(env,entry){
  requireValue(entry&&typeof entry==='object','Release information is required.');const title=String(entry.title||'').trim();requireValue(title&&title.length<=250,'Enter a release title (250 characters or fewer).');
  const type=entry.type||'single',status=entry.publicationStatus||'published';requireValue(['single','album'].includes(type),'Invalid release type.');requireValue(['published','scheduled','draft'].includes(status),'Invalid availability setting.');
  const publishAt=status==='scheduled'?easternToISO(String(entry.scheduledLocal||'')):null;
  const treeAssets=new Map(),existingPaths=new Set();
  async function resolve(id,value,kind){if(id){const a=await asset(env,id);requireValue(a.kind===kind&&/^[0-9a-f]{40}$/.test(a.sha||''),'Prepare this file for publishing first.');treeAssets.set(a.path,{path:a.path,mode:'100644',type:'blob',sha:a.sha});return a.path;}if(!value)return '';if(kind==='cover'&&/^https:\/\//.test(value))return webUrl(value);const path=safePublicPath(value,kind);existingPaths.add(path);return path;}
  const tracks=[];
  if(type==='album'){requireValue(Array.isArray(entry.tracks)&&entry.tracks.length>0&&entry.tracks.length<=100,'An album needs 1–100 tracks.');for(const t of entry.tracks){requireValue(String(t.title||'').trim()&&String(t.title).length<=250,'Give each track a title.');const preview=await resolve(t.assetId,t.preview,'preview');requireValue(preview,'Every album track needs a preview.');tracks.push({title:String(t.title).trim(),preview});}}
  const preview=type==='album'?tracks[0].preview:await resolve(entry.previewAssetId,entry.preview,'preview');requireValue(preview,'Add a preview MP3 before publishing.');
  const regularPrice=entry.price===''||entry.price==null?(type==='album'?9.99:0.99):Number(entry.price);
  requireValue(Number.isFinite(regularPrice)&&regularPrice>=0.5&&regularPrice<=1000&&Number.isInteger(Math.round(regularPrice*100)),'Enter a valid regular price.');
  const saleEnabled=entry.saleEnabled===true||entry.saleEnabled==='true';
  const salePrice=entry.salePrice===''||entry.salePrice==null?null:Number(entry.salePrice);
  requireValue(!saleEnabled||(Number.isFinite(salePrice)&&salePrice>=0.5&&salePrice<regularPrice),'Active sale price must be lower than the regular price.');
  requireValue(salePrice===null||(Number.isFinite(salePrice)&&salePrice>=0.5&&salePrice<regularPrice),'Sale price must be less than the regular price.');
  const cover=await resolve(entry.coverAssetId,entry.cover,'cover');
  const finished={type,title,price:regularPrice,salePrice,saleEnabled,artist:String(entry.artist||'Echo Craft').trim().slice(0,250),releaseDate:String(entry.releaseDate||''),cover,preview,description:String(entry.description||'').slice(0,10000),publicationStatus:status,scheduledLocal:status==='scheduled'?entry.scheduledLocal:'',publishAt,hyperfollow:entry.hyperfollow?hyperUrl(entry.hyperfollow):'',spotify:webUrl(entry.spotify,/^open\.spotify\.com$/),apple:webUrl(entry.apple,/^(music|itunes)\.apple\.com$/),itunes:webUrl(entry.itunes,/^(music|itunes)\.apple\.com$/),...(type==='album'?{tracks}:{})};
  for(let attempt=0;attempt<3;attempt++){
    const head=(await gh(env,'git/ref/heads/main')).object.sha;
    const commit=await gh(env,'git/commits/'+head),catalog=await catalogFile(env,'music/music.json',head),pending=await catalogFile(env,'music/pending-releases.json',head,true);
    if(existingPaths.size){const files=await gh(env,'git/trees/'+commit.tree.sha+'?recursive=1');requireValue(!files.truncated,'The repository file list is too large to verify these paths. Import the samples again.',409);const found=new Set(files.tree.filter(f=>f.type==='blob').map(f=>f.path));for(const path of existingPaths)requireValue(found.has(path),'File not found on GitHub: '+path+'. Import or upload its sample before publishing.');}
    requireValue(Array.isArray(catalog.items),'Unexpected music catalog format.',502);
    const matches=catalog.items.map((item,i)=>normalize(item.title)===normalize(entry.originalTitle||title)||normalize(item.title)===normalize(title)||(finished.hyperfollow&&item.hyperfollow===finished.hyperfollow)?i:-1).filter(i=>i>=0);
    requireValue(matches.length<=1,'This title or HyperFollow link matches multiple releases. Choose a unique title.',409);
    const index=matches[0]??-1,old=index>=0?catalog.items[index]:null;
    if(entry.originalTitle)requireValue(old,'The release you are editing changed. Reload the catalog before publishing.',409);
    const now=new Date().toISOString(),saved={...old,...finished,created:old?.created||now,updated:now};if(type!=='album')delete saved.tracks;
    if(index>=0)catalog.items[index]=saved;else catalog.items.push(saved);
    catalog.items.sort((a,b)=>String(a.title).localeCompare(String(b.title),undefined,{sensitivity:'base'}));
    pending.items=(pending.items||[]).filter(item=>!(entry.collectionId&&String(item.collectionId)===String(entry.collectionId))&&normalize(String(item.title||'').replace(/\s*-\s*Single$/i,''))!==normalize(title));
    const tree=await gh(env,'git/trees','POST',{base_tree:commit.tree.sha,tree:[...treeAssets.values(),{path:'music/music.json',mode:'100644',type:'blob',content:JSON.stringify(catalog,null,2)+'\n'},{path:'music/pending-releases.json',mode:'100644',type:'blob',content:JSON.stringify(pending,null,2)+'\n'}]});
    const next=await gh(env,'git/commits','POST',{message:'Publish music release: '+title,tree:tree.sha,parents:[head]});
    try{await gh(env,'git/refs/heads/main','PATCH',{sha:next.sha,force:false});return {ok:true,entry:saved,commit:next.sha,message:title+' saved to GitHub. The website will update after GitHub Pages finishes deploying.'};}
    catch(e){if(e.status!==409||attempt===2)throw e;}
  }
}
// Public Square Sandbox checkout. Catalog prices are always determined server-side.
async function squareSandboxCheckout(request,env){
  requireValue(env.SQUARE_ENVIRONMENT==='sandbox','Checkout is unavailable until the payment configuration is verified.',503);
  requireValue(env.SQUARE_ACCESS_TOKEN&&env.SQUARE_LOCATION_ID,'Square Sandbox is not configured.',503);
  const payload=await jsonBody(request,16*1024);
  requireValue(Array.isArray(payload.items)&&payload.items.length>0&&payload.items.length<=25,'Select up to 25 items.',400);
  const catalog=await catalogFile(env);
  const now=Date.now(),selected=new Map();
  for(const entry of payload.items){
    requireValue(entry&&typeof entry.title==='string'&&['single','album'].includes(entry.type)&&Number.isInteger(entry.qty)&&entry.qty>=1&&entry.qty<=25,'Invalid cart item.',400);
    const key=entry.type+':'+normalize(entry.title);
    requireValue(!selected.has(key),'Duplicate cart item.',400);
    const matches=catalog.items.filter(x=>(x.type==='album'?'album':'single')===entry.type&&normalize(x.title)===normalize(entry.title)&&x.publicationStatus!=='draft'&&(x.publicationStatus!=='scheduled'||Date.parse(x.publishAt||'')<=now));
    requireValue(matches.length===1,'One of your cart items is no longer available.',409);
    const product=matches[0];
    const base=Number(product.price),sale=Number(product.salePrice);
    const regular=Number.isFinite(base)&&base>=0.5&&base<=1000?base:(entry.type==='album'?9.99:0.99);
    const price=product.saleEnabled===true&&Number.isFinite(sale)&&sale>=0.5&&sale<regular?sale:regular;
    requireValue(Number.isInteger(Math.round(price*100))&&price*100>=50,'Invalid product price.',500);
    selected.set(key,{name:String(product.title).slice(0,200),quantity:String(entry.qty),base_price_money:{amount:Math.round(price*100),currency:'USD'},note:entry.type==='album'?'Echo Craft digital album':'Echo Craft digital single'});
  }
  requireValue([...selected.values()].reduce((sum,x)=>sum+Number(x.quantity)*x.base_price_money.amount,0)<=100000,'Order total exceeds checkout limit.',400);
  const square=await boundedFetch('https://connect.squareupsandbox.com/v2/online-checkout/payment-links',{
    method:'POST',
    headers:{'Authorization':'Bearer '+env.SQUARE_ACCESS_TOKEN,'Square-Version':'2026-09-16','Content-Type':'application/json'},
    body:JSON.stringify({idempotency_key:uuid(),order:{location_id:env.SQUARE_LOCATION_ID,line_items:[...selected.values()]},checkout_options:{redirect_url:'https://echocraftmusic.com/thank-you.html'}})
  },64*1024);
  if(!square.ok){console.error(JSON.stringify({event:'square_sandbox_checkout_failed',status:square.status}));throw new Problem('Square Sandbox could not start checkout. Please try again.',502);}
  const data=await square.json(),checkoutUrl=data.payment_link?.url||'';
  requireValue(/^https:\/\/(?:square\.link|checkout\.square\.site)\//.test(checkoutUrl),'Square did not return a valid checkout URL.',502);
  return {checkoutUrl,environment:'sandbox'};
}
export default {async fetch(request,env){
  const origin=request.headers.get('Origin'),headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',Vary:'Origin'};
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&!ORIGINS.has(origin))return reply({error:'Origin not allowed.'},403);if(origin)headers['Access-Control-Allow-Origin']=origin;
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'}});
  const url=new URL(request.url),path=url.pathname;
  if(request.method==='GET'&&(path==='/'||path==='/health'))return reply({service:'EchoCraft Music Admin',version:'online-v1',githubSecretConfigured:Boolean(env.GITHUB_TOKEN),storageConfigured:Boolean(env.ADMIN_STAGING)});
  if(path==='/api/checkout/sandbox'&&request.method==='POST'){
    try{requireValue(origin&&ORIGINS.has(origin),'Checkout must begin on the Echo Craft website.',403);return reply(await squareSandboxCheckout(request,env));}
    catch(e){if(e instanceof Problem)return reply({error:e.message},e.status);console.error(JSON.stringify({event:'checkout_failed',kind:e?.name||'Error'}));return reply({error:'Unable to start Square Sandbox checkout.'},502);}
  }
  let step='Sign-in verification';
  try{
    const authorization=request.headers.get('Authorization')||'';requireValue(/^Bearer [^\s]+$/.test(authorization),'Please sign in.',401);
    const auth=await boundedFetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_KEY,Authorization:authorization}},1024*1024);requireValue(auth.ok,'Please sign in again.',401);
    const user=auth.json();requireValue(user.id&&user.email_confirmed_at&&EMAILS.has(String(user.email||'').toLowerCase()),'This account does not have admin access.',403);
    if(request.method==='GET'&&path==='/api/status'){step='Catalog connection';const c=await catalogFile(env);return reply({ok:true,catalogReadable:true,itemCount:c.items.length,publishingReady:Boolean(env.ADMIN_STAGING),storageConfigured:Boolean(env.ADMIN_STAGING),version:'online-v1'});}
    if(request.method==='GET'&&path==='/api/catalog')return reply(await catalogFile(env));
    if(request.method==='GET'&&path==='/api/pending')return reply(await catalogFile(env,'music/pending-releases.json','main',true));
    requireValue(env.ADMIN_STAGING,'ADMIN_STAGING storage binding is missing.',503);
    step='Private storage';
    if(path==='/api/draft'&&request.method==='GET')return reply({entry:await r2json(env,'drafts/current.json')});
    if(path==='/api/draft'&&request.method==='PUT'){const b=await jsonBody(request,256*1024);await env.ADMIN_STAGING.put('drafts/current.json',JSON.stringify(b.entry||null));return reply({ok:true});}
    if(path==='/api/hyperfollow'&&request.method==='POST'){const b=await jsonBody(request,7*1024*1024),link=hyperUrl(b.url);step='HyperFollow import';const html=typeof b.html==='string'?b.html:await hyperHtml(link);return reply(parseHyperFollow(html,link));}
    if(path==='/api/import'&&request.method==='POST'){
      const b=await jsonBody(request,7*1024*1024),link=hyperUrl(b.url);step='Album track import';const html=typeof b.html==='string'?b.html:await hyperHtml(link),data=parseHyperFollow(html,link);
      requireValue(data.tracks.length&&data.tracks.every(t=>t.title&&t.previewUrl),'This page has no complete downloadable preview list. Try the saved-page option, or wait until the album is released.');
      const id=uuid();await env.ADMIN_STAGING.put('imports/'+id+'.json',JSON.stringify(data));return reply({...data,importId:id});
    }
    if(path==='/api/import-track'&&request.method==='POST'){
      const b=await jsonBody(request,4096);requireValue(validId(b.importId)&&Number.isInteger(b.index),'Invalid import request.');const data=await r2json(env,'imports/'+b.importId+'.json'),t=data?.tracks?.[b.index];requireValue(t&&isPreviewUrl(t.previewUrl),'Track not found.',404);
      step='Preview download';const r=await boundedFetch(t.previewUrl);requireValue(r.ok,'Preview download returned HTTP '+r.status+'.',502);
      const a=await saveAsset(env,r.bytes,String(b.index+1).padStart(2,'0')+'-'+t.title+'.mp3','preview');return reply({title:t.title,preview:a.path,assetId:a.id});
    }
    if(path==='/api/upload'&&request.method==='POST'){const b=await jsonBody(request);requireValue(['preview','cover'].includes(b.kind)&&typeof b.dataBase64==='string'&&typeof b.name==='string','Invalid file upload.');let bytes;try{bytes=decode64(b.dataBase64);}catch{throw new Problem('Invalid file upload.');}const a=await saveAsset(env,bytes,b.name,b.kind);return reply({assetId:a.id,path:a.path});}
    if(path==='/api/asset'&&request.method==='GET'){const a=await asset(env,url.searchParams.get('id')),o=await env.ADMIN_STAGING.get(a.key);requireValue(o,'Preview is unavailable.',404);return new Response(o.body,{headers:{...headers,'Content-Type':a.contentType}});}
    if(path==='/api/prepare'&&request.method==='POST'){
      const b=await jsonBody(request,4096),a=await asset(env,b.assetId);if(!a.sha){const o=await env.ADMIN_STAGING.get(a.key);requireValue(o,'Preview is unavailable.',404);step='Prepare GitHub file';const blob=await gh(env,'git/blobs','POST',{content:encode64(new Uint8Array(await o.arrayBuffer())),encoding:'base64'});requireValue(/^[0-9a-f]{40}$/.test(blob.sha),'GitHub returned an invalid file identifier.',502);a.sha=blob.sha;await env.ADMIN_STAGING.put('assets/'+a.id+'.json',JSON.stringify(a));}return reply({ok:true,path:a.path});
    }
    if(path==='/api/publish'&&request.method==='POST'){const b=await jsonBody(request,256*1024);step='Publish release';return reply(await publish(env,b.entry));}
    return reply({error:'Route not found.'},404);
  }catch(e){if(e instanceof Problem)return reply({error:e.message},e.status);console.error(JSON.stringify({event:'admin_failed',step,kind:e?.name||'Error'}));return reply({error:step+' failed. Please retry.'},502);}
}};

function easternToISO(local) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Problem('Select a valid Eastern release time.');
  const target = Date.parse(local + ':00Z');
  if (!Number.isFinite(target)) throw new Problem('Invalid release time.');
  let instant = target;
  const fmt = new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York', year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  function wallTime(time) { const parts=Object.fromEntries(fmt.formatToParts(new Date(time)).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`; }
  for(let i=0;i<4;i++) instant += target-Date.parse(wallTime(instant)+'Z');
  if(wallTime(instant).slice(0,16)!==local)throw new Problem('This Eastern time does not exist because of daylight saving time. Choose another time.');
  return new Date(instant).toISOString();
}
function htmlDecode(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (entity, code) => {
      const point = code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):parseInt(code,10);
      return point>0 && point<=0x10ffff?String.fromCodePoint(point):entity;
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/');
}

function metaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i')
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return htmlDecode(match[1]);
  }
  return '';
}

function firstMatchingUrl(html, patterns) {
  const decoded = htmlDecode(html);
  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match) return htmlDecode(match[0]).replace(/["'<>\\]+$/g, '');
  }
  return '';
}


function safeDecodeURIComponent(value) {
  let current = String(value || '');
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch { break; }
  }
  return htmlDecode(current);
}

function findServiceUrl(html, hostPattern) {
  const decoded = htmlDecode(html);
  const candidates = new Set();

  // Direct and JSON-escaped URLs.
  const urlMatches = decoded.match(/https?:\\?\/\\?\/[^\\s\"'<>]+/gi) || [];
  for (const raw of urlMatches) candidates.add(safeDecodeURIComponent(raw.replace(/\\\//g, '/')));

  // URLs hidden inside redirect/query parameters such as ?url=https%3A%2F%2F...
  const encodedMatches = decoded.match(/(?:https?%3A%2F%2F|https?%253A%252F%252F)[^\s\"'<>]+/gi) || [];
  for (const raw of encodedMatches) candidates.add(safeDecodeURIComponent(raw));

  for (let candidate of candidates) {
    candidate = candidate.replace(/[),.;\\\"']+$/g, '');
    if (hostPattern.test(candidate)) return candidate;
  }
  return '';
}

function isPreviewUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ((url.hostname === 's3.amazonaws.com' && /^\/audio\.distrokid\.com\/preview_[A-Za-z0-9_-]+\.mp3$/.test(url.pathname)) ||
       (url.hostname === 'audio.distrokid.com' && /^\/preview_[A-Za-z0-9_-]+\.mp3$/.test(url.pathname)));
  } catch { return false; }
}

function parsePreviewTracks(html) {
  const match = html.match(/previewData\.tracks\s*=\s*JSON\.parse\(\s*("(?:\\.|[^"\\])*")\s*\)/);
  if (!match) return [];
  try {
    // Decode the embedded JSON string as data, without executing page scripts.
    const literal = match[1].replace(/\\x([0-9a-f]{2})/gi, (_, hex) => '\\u00' + hex);
    const tracks = JSON.parse(JSON.parse(literal));
    if (!Array.isArray(tracks) || tracks.length > 100) return [];
    return tracks.map(track => ({
      title: htmlDecode(track.title).trim(),
      previewUrl: isPreviewUrl(track.preview) ? track.preview : ''
    }));
  } catch { return []; }
}

function parseHyperFollow(html, originalUrl) {
  const titleRaw = metaContent(html, 'og:title') || metaContent(html, 'twitter:title');
  const description = metaContent(html, 'og:description') || '';
  const cover = metaContent(html, 'og:image') || metaContent(html, 'og:image:url') || metaContent(html, 'twitter:image');

  let title = titleRaw
    .replace(/\s*[-|–—]\s*HyperFollow.*$/i, '')
    .replace(/\s*[-|–—]\s*Echo Craft.*$/i, '')
    .trim();

  // DistroKid pages sometimes use "Artist - Release" as the OG title.
  title = title.replace(/\s+by\s+Echo Craft\s*$/i, '').trim();
  title = title.replace(/^Echo Craft\s*[-|–—:]\s*/i, '').trim();

  const spotify = firstMatchingUrl(html, [
    /https:\/\/open\.spotify\.com\/(?:album|track)\/[A-Za-z0-9]+[^\s"'<>]*/i
  ]) || findServiceUrl(html, /^https?:\/\/open\.spotify\.com\/(?:album|track)\//i);
  const apple = firstMatchingUrl(html, [
    /https:\/\/music\.apple\.com\/[A-Za-z0-9/_?=&.%+-]+/i,
    /https:\/\/itunes\.apple\.com\/[A-Za-z]{2}\/(?:album|song)\/[A-Za-z0-9/_?=&.%+-]+/i
  ]);


  return {
    hyperfollow: originalUrl,
    title,
    artist: 'Echo Craft',
    cover,
    spotify,
    apple,
    description,
    tracks: parsePreviewTracks(html)
  };
}

