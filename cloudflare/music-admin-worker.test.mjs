import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from './music-admin-worker.js';

const map=new Map();
const bucket={async put(key,data){map.set(key,typeof data==='string'?new TextEncoder().encode(data):new Uint8Array(data));return {};},async get(key){const bytes=map.get(key);return bytes?{json:async()=>JSON.parse(new TextDecoder().decode(bytes)),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),body:bytes}:null;}};
let email='troy.saha@gmail.com',confirmed=true,published=null,retry=true,head='a'.repeat(40),gitCalls=[],catalog={items:[{title:'Existing single',preview:'music/previews/existing.mp3',custom:'keep',created:'2025-01-01'}]};
let commitCount=0;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
const content=data=>json({encoding:'base64',content:Buffer.from(JSON.stringify(data)).toString('base64')});
const samples=Array.from({length:28},(_,i)=>({title:'Track '+(i+1),preview:'https://s3.amazonaws.com/audio.distrokid.com/preview_'+i+'.mp3'}));
const html='<meta property="og:title" content="Echo Craft - Lo Fi Test"><meta property="og:image" content="https://example.com/cover.jpg"><script>previewData.tracks = JSON.parse('+JSON.stringify(JSON.stringify(samples))+');</script>';
globalThis.fetch=async(url,options={})=>{
  if(url.includes('/auth/v1/user'))return json({id:'user',email,email_confirmed_at:confirmed?'2026-01-01':null});
  if(url.startsWith('https://distrokid.com'))return new Response(html);
  if(url.includes('/audio.distrokid.com/preview_'))return new Response(new Uint8Array([73,68,51,4,0,0,0,0]));
  assert(url.startsWith('https://api.github.com/repos/echocraftmusic/echocraft.github.io/'));
  assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,'Bearer token');
  const path=url.split('echocraft.github.io/')[1];const body=options.body?JSON.parse(options.body):null;gitCalls.push({path,body});
  if(path.startsWith('contents/music/music.json'))return content(catalog);
  if(path.startsWith('contents/music/pending-releases.json'))return content({items:[{title:'Lo Fi Test'}]});
  if(path==='git/ref/heads/main')return json({object:{sha:head}});
  if(path.startsWith('git/commits/'))return json({tree:{sha:'b'.repeat(40)}});
  if(path==='git/blobs')return json({sha:Buffer.from(body.content,'base64').length?'c'.repeat(40):''});
  if(path==='git/trees'){published=body;return json({sha:'d'.repeat(40)});}
  if(path.startsWith('git/trees/'))return json({truncated:false,tree:[{path:'music/previews/existing.mp3',type:'blob'}]});
  if(path==='git/commits')return json({sha:(++commitCount).toString(16).padStart(40,'0')});
  if(path==='git/refs/heads/main'){assert.equal(body.force,false);if(retry){retry=false;catalog.items.push({title:'Concurrent release',custom:'preserve'});head='e'.repeat(40);return json({},422);}return json({ok:true});}
  throw Error('Unexpected '+path);
};
const env={ADMIN_STAGING:bucket,GITHUB_TOKEN:' token '};
async function call(path,body,method=body?'POST':'GET',options={}){const headers={Origin:'https://echocraftmusic.com',Authorization:'Bearer session',...(options.headers||{})};const r=await worker.fetch(new Request('https://worker.test'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})}),options.env||env);return {status:r.status,data:await r.json()};}
assert.equal((await call('/api/status',null,'GET',{headers:{Authorization:''}})).status,401);
email='not-approved@example.com';assert.equal((await call('/api/status')).status,403);
email='echocraft.aimusic@gmail.com';assert.equal((await call('/api/status')).status,200);
confirmed=false;assert.equal((await call('/api/status')).status,403);confirmed=true;
assert.equal((await call('/api/status',null,'GET',{headers:{Origin:'https://evil.test'}})).status,403);
assert.equal((await call('/api/upload',{name:'bad.mp3',kind:'preview',dataBase64:Buffer.from('HTML error').toString('base64')})).status,400);
assert.equal((await call('/api/import',{url:'https://evil.test/hyperfollow/a'})).status,400);
const imported=(await call('/api/import',{url:'https://distrokid.com/hyperfollow/test/lofi'})).data;
assert.equal(imported.tracks.length,28);assert.equal(imported.title,'Lo Fi Test');
const tracks=[];
for(let index=0;index<28;index++){
  const before=gitCalls.length;
  const result=await call('/api/import-track',{importId:imported.importId,index});assert.equal(result.status,200);tracks.push(result.data);assert.equal(gitCalls.length,before);
}
assert.deepEqual(tracks.map(t=>t.title),samples.map(t=>t.title));
let entry={title:'Lo Fi Test',type:'album',tracks,publicationStatus:'published',hyperfollow:'https://distrokid.com/hyperfollow/test/lofi'};
assert.equal((await call('/api/publish',{entry})).status,400);assert.equal(published,null);
assert.equal((await call('/api/draft',{entry},'PUT')).status,200);assert.deepEqual((await call('/api/draft')).data.entry,entry);
for(const t of tracks)assert.equal((await call('/api/prepare',{assetId:t.assetId})).status,200);
const before=gitCalls.length,result=await call('/api/publish',{entry});assert.equal(result.status,200);assert(gitCalls.length-before<30);
assert.equal(published.tree.filter(t=>t.path.startsWith('music/previews/')).length,28);
const finished=JSON.parse(published.tree.find(t=>t.path==='music/music.json').content);
assert.equal(finished.items.length,3);assert(finished.items.some(i=>i.title==='Concurrent release'));
assert.deepEqual(finished.items.find(i=>i.title==='Lo Fi Test').tracks.map(t=>t.title),samples.map(t=>t.title));
assert.equal(finished.items.find(i=>i.title==='Existing single').custom,'keep');
assert.equal(JSON.parse(published.tree.find(t=>t.path==='music/pending-releases.json').content).items.length,0);
const oldPublished=published;
assert.equal((await call('/api/publish',{entry:{title:'Broken',preview:'music/previews/missing.mp3'}})).status,400);assert.equal(published,oldPublished);
assert.equal((await call('/api/publish',{entry:{title:'Bad time',preview:'music/previews/existing.mp3',publicationStatus:'scheduled',scheduledLocal:'2027-03-14T02:30'}})).status,400);
const scheduled=await call('/api/publish',{entry:{title:'Scheduled',preview:'music/previews/existing.mp3',publicationStatus:'scheduled',scheduledLocal:'2026-10-31T00:00'}});
assert.equal(scheduled.status,200);assert.equal(scheduled.data.entry.publishAt,'2026-10-31T04:00:00.000Z');
const frontend=fs.readFileSync(new URL('../admin/index.html',import.meta.url),'utf8');
for(const [,script] of frontend.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script);
assert(!frontend.includes('node scripts/admin-server.js'));assert(!frontend.includes('Publish to Local Site'));
console.log('Passed: 28-track import, private drafts, both allowed emails, unconfirmed/rejected sessions, CORS, invalid uploads, required preparation, atomic publishing, concurrent GitHub retry, preserved catalog, missing-file rejection, schedule conversion, frontend syntax.');
