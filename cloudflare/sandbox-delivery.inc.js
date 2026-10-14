// Owner-only Sandbox delivery. This never grants public customer entitlements.
async function sandboxSquare(env,path){
  const r=await boundedFetch('https://connect.squareupsandbox.com/v2/'+path,{headers:{Authorization:'Bearer '+env.SQUARE_ACCESS_TOKEN,'Square-Version':'2026-09-16'}},128*1024);
  requireValue(r.ok,'Square could not verify the test payment. Please retry.',502);return r.json();
}
async function sandboxDelivery(request,env,url,headers){
  requireValue(env.SQUARE_ENVIRONMENT==='sandbox','Delivery testing is available only in Square Sandbox.',503);
  requireValue(env.SQUARE_ACCESS_TOKEN&&env.SQUARE_LOCATION_ID&&env.ADMIN_STAGING&&env.PURCHASE_FILES,'Test delivery needs Square and both private storage bindings.',503);
  const reply=data=>new Response(JSON.stringify(data),{headers});
  if(request.method==='POST'&&url.pathname==='/api/test-delivery/checkout'){
    const input=await jsonBody(request,2048);requireValue(input.digitalPurchaseAgreementAccepted===true,'Confirm the test checkout agreement.');
    requireValue(/^[a-f0-9]{32}$/.test(input.release||''),'Choose a release.');
    const item=await purchaseRelease(env,input.release);requireValue(item.type!=='album','This first delivery test supports singles only.');
    const record=await env.PURCHASE_FILES.get(purchaseRecordKey(input.release,'single'));requireValue(record,'Upload the full MP3 first.',409);
    const file=await record.json();requireValue(file.title===item.title&&file.album===item.title&&file.artist===(item.artist||'Echo Craft')&&file.coverSource===(item.cover||''),'Refresh this MP3 to match the catalog before testing.',409);
    requireValue(await env.PURCHASE_FILES.head(file.key),'The saved MP3 is missing.',409);
    const test=uuid(),redirect='https://echocraftmusic.com/admin/test-delivery.html?test='+test;
    const checkout=await squareSandboxCheckout(new Request(request.url,{method:'POST',body:JSON.stringify({digitalPurchaseAgreementAccepted:true,items:[{title:item.title,type:'single',qty:1}]})}),env,redirect);
    requireValue(typeof checkout.orderId==='string'&&checkout.orderId.length>0,'Square did not return a test order ID.',502);
    await env.ADMIN_STAGING.put('sandbox-delivery/'+test+'.json',JSON.stringify({orderId:checkout.orderId,amount:checkout.totalCents,title:item.title,fileKey:file.key,filename:file.filename,expires:Date.now()+86400000}));
    return reply({checkoutUrl:checkout.checkoutUrl,test,environment:'sandbox'});
  }
  requireValue(request.method==='GET'&&['/api/test-delivery/status','/api/test-delivery/download'].includes(url.pathname),'Test endpoint not found.',404);
  const test=url.searchParams.get('test');requireValue(validId(test),'Invalid test link.');
  const saved=await env.ADMIN_STAGING.get('sandbox-delivery/'+test+'.json');requireValue(saved,'This delivery test was not found. Start a fresh test from Purchase Files.',404);
  const session=await saved.json();requireValue(session.expires>Date.now(),'This test expired. Start a fresh test.',410);
  const {order}=await sandboxSquare(env,'orders/'+encodeURIComponent(session.orderId));
  requireValue(order?.id===session.orderId&&order.location_id===env.SQUARE_LOCATION_ID&&order.total_money?.amount===session.amount&&order.total_money?.currency==='USD'&&order.state!=='CANCELED','The Square test order does not match this delivery.',409);
  let paid=0;const ids=[...new Set((order.tenders||[]).map(t=>t.payment_id).filter(id=>typeof id==='string'))];
  requireValue(ids.length<=10,'Unexpected test payment count.',409);
  for(const id of ids){const {payment}=await sandboxSquare(env,'payments/'+encodeURIComponent(id));if(payment?.id===id&&payment.order_id===session.orderId&&payment.location_id===env.SQUARE_LOCATION_ID&&payment.status==='COMPLETED'&&payment.amount_money?.currency==='USD'&&!(payment.refunded_money?.amount>0)&&Number.isSafeInteger(payment.amount_money.amount))paid+=payment.amount_money.amount;}
  const verified=paid>=session.amount&&session.amount>0;
  if(url.pathname==='/api/test-delivery/status')return reply({title:session.title,filename:session.filename,verified,environment:'sandbox',message:verified?'Square confirmed the test payment. Your full MP3 is ready.':'Square has not confirmed a completed payment yet. Complete Test Payment in the Sandbox panel, then check again.'});
  requireValue(verified,'Complete the Square Sandbox payment before downloading.',409);
  const file=await env.PURCHASE_FILES.get(session.fileKey);requireValue(file,'The test MP3 is no longer available.',404);
  return new Response(file.body,{headers:{...headers,'Content-Type':'audio/mpeg','Content-Disposition':'attachment; filename="'+session.filename.replace(/[^\x20-\x7e]|["\\]/g,'_')+'"'}});
}
