import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from './music-admin-worker.js';

let destination='https://sandbox.square.link/u/test';
let submitted;
globalThis.fetch=async(url,options={})=>{
  if(url.startsWith('https://api.github.com/'))return new Response(JSON.stringify({encoding:'base64',content:Buffer.from(JSON.stringify({items:[{title:'Test single',type:'single',price:0.99}]})).toString('base64')}));
  assert.equal(url,'https://connect.squareupsandbox.com/v2/online-checkout/payment-links');
  submitted=JSON.parse(options.body);
  return new Response(JSON.stringify({payment_link:{url:destination}}));
};
const env={SQUARE_ENVIRONMENT:'sandbox',SQUARE_ACCESS_TOKEN:'test',SQUARE_LOCATION_ID:'test-location',GITHUB_TOKEN:'test'};
async function checkout(overrides={}){
  return worker.fetch(new Request('https://worker.test/api/checkout/sandbox',{method:'POST',headers:{Origin:'https://echocraftmusic.com'},body:JSON.stringify({digitalPurchaseAgreementAccepted:true,items:[{title:'Test single',type:'single',qty:1,price:0.01}],...overrides})}),env);
}
let response=await checkout();
assert.equal(response.status,200);
assert.equal((await response.json()).checkoutUrl,destination);
assert.equal(submitted.order.line_items[0].base_price_money.amount,99,'Price must come from the server catalog.');
assert.equal((await checkout({digitalPurchaseAgreementAccepted:false})).status,400);
assert.equal((await worker.fetch(new Request('https://worker.test/api/checkout/sandbox',{method:'POST',headers:{Origin:'https://echocraftmusic.com'},body:'{}'}),{...env,SQUARE_ENVIRONMENT:'production'})).status,503);
const cartSource=fs.readFileSync(new URL('../js/cart.js',import.meta.url),'utf8');
const frontendCheck=cartSource.split('\n').find(line=>line.includes('Unexpected Square checkout destination.'));
assert(frontendCheck);
for(const valid of ['https://sandbox.square.link/u/test','https://square.link/u/test','https://checkout.square.site/test']){
  destination=valid;assert.equal((await checkout()).status,200);
  vm.runInNewContext(frontendCheck,{url:new URL(valid)});
}
for(const invalid of ['https://square.link.evil.test/u/test','https://evil.test/u/test','http://sandbox.square.link/u/test','https://user:pass@sandbox.square.link/u/test','https://sandbox.square.link:444/u/test']){
  destination=invalid;assert.equal((await checkout()).status,502);
  assert.throws(()=>vm.runInNewContext(frontendCheck,{url:new URL(invalid)}));
}
console.log('Passed: Square Sandbox URL accepted; exact host checks; unsafe destinations rejected; server pricing; agreement and sandbox-only enforcement.');
