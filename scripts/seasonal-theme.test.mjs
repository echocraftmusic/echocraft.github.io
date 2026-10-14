import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/seasonal-theme.js',import.meta.url),'utf8');
async function visitor(responses,initial){
 const root={dataset:initial?{siteTheme:initial}:{}};
 const img={dataset:{},src:'assets/images/echo-craft-logo.webp',getAttribute(){return this.src;}};
 const nativity={hidden:true},calls=[],listeners={},intervals=[];
 const context={URL,Set,AbortSignal,document:{documentElement:root,currentScript:{src:'https://echocraftmusic.com/js/seasonal-theme.js'},hidden:false,querySelectorAll:()=>[img],getElementById:()=>nativity,addEventListener:(name,fn)=>listeners[name]=fn},fetch:async url=>{calls.push(String(url));const response=responses.shift();if(response instanceof Error)throw response;return {ok:true,json:async()=>response};},setInterval:fn=>intervals.push(fn)};
 vm.runInNewContext(source,context);
 await new Promise(resolve=>setImmediate(resolve));
 return {root,img,nativity,calls,listeners,intervals};
}
const first=await visitor([{theme:'christmas'},{theme:'fall'},{theme:'original'}]);
assert.equal(first.root.dataset.siteTheme,'christmas');assert.equal(first.nativity.hidden,false);
assert.match(first.img.src,/gold-logo\.png$/);
await first.intervals[0]();assert.equal(first.root.dataset.siteTheme,'fall');assert.equal(first.nativity.hidden,true);
await first.intervals[0]();assert.equal(first.img.src,'assets/images/echo-craft-logo.webp');
const second=await visitor([{theme:'christmas'}]);assert.equal(second.root.dataset.siteTheme,'christmas','New visitors receive the owner-selected theme.');
const offline=await visitor([new Error('offline'),{theme:'original'}]);assert.equal(offline.root.dataset.siteTheme,'original');
const retain=await visitor([new Error('offline')],'fall');assert.equal(retain.root.dataset.siteTheme,'fall');assert.equal(retain.calls.length,1);
const invalid=await visitor([{theme:'not-a-theme'},{theme:'original'}]);assert.equal(invalid.root.dataset.siteTheme,'original');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert(!html.includes('data-site-theme-choice'),'No public theme selector.');
assert.match(html,/The Reason Of The Season/);assert.match(html,/Celebrating the birth of Jesus Christ/);
console.log('Passed: shared theme on independent visitors, live theme refresh, exact Original logo restoration, Christmas-only Nativity, offline fallback, no public selector.');
