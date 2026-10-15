// Customer access is scoped to the authenticated user, never the admin allowlist.
function customerRoot(user){requireValue(validId(user.id)&&user.email_confirmed_at&&user.email,'Verify your email before accessing My Music.',401);return 'customer-accounts/'+user.id+'/';}
async function customerJson(env,key){const o=await env.ADMIN_STAGING.get(key);return o?o.json():null;}
async function customerProfile(env,user){const root=customerRoot(user),profile=await customerJson(env,root+'profile.json'),closed=Boolean(await env.ADMIN_STAGING.get(root+'closed.json'));return {profile:profile?{name:profile.name,email:user.email,marketingOptIn:!closed&&profile.marketingOptIn===true,createdAt:profile.createdAt}:null,closed};}
async function customerActive(env,user){const data=await customerProfile(env,user);requireValue(data.profile,'Finish setting up your Echo Craft account in My Music.',409);requireValue(!data.closed,'Your music account is closed. Restore access in My Music to continue.',403);return data.profile;}
function customerOrderView(order){return {id:order.id,orderReference:'EC-'+order.id.slice(0,8).toUpperCase(),createdAt:order.createdAt,paidAt:order.paidAt||null,amountCents:order.amountCents,status:order.status,environment:order.environment,items:order.items.map(item=>({title:item.title,type:item.type,artist:item.artist,cover:item.cover,files:item.files.map((f,index)=>({index,title:f.title,filename:f.filename}))}))};}
async function customerVerifyOrder(env,order){
 requireValue(env.SQUARE_ENVIRONMENT==='sandbox'&&order.environment==='sandbox','This purchase is not available in the current payment environment.',503);
 const result=await sandboxSquare(env,'orders/'+encodeURIComponent(order.squareOrderId)),squareOrder=result.order;
 requireValue(squareOrder?.id===order.squareOrderId&&squareOrder.location_id===env.SQUARE_LOCATION_ID&&squareOrder.total_money?.amount===order.amountCents&&squareOrder.total_money?.currency==='USD','The payment does not match this purchase.',409);
 if(squareOrder.state==='CANCELED')return false;
 const ids=[...new Set((squareOrder.tenders||[]).map(t=>t.payment_id).filter(id=>typeof id==='string'))];requireValue(ids.length<=10,'Unexpected payment count.',409);
 let paid=0;for(const id of ids){const {payment}=await sandboxSquare(env,'payments/'+encodeURIComponent(id));if(payment?.id===id&&payment.order_id===order.squareOrderId&&payment.location_id===env.SQUARE_LOCATION_ID&&payment.status==='COMPLETED'&&payment.amount_money?.currency==='USD'&&Number.isSafeInteger(payment.amount_money.amount)&&!(payment.refunded_money?.amount>0))paid+=payment.amount_money.amount;}
 return order.amountCents>0&&paid>=order.amountCents;
}
async function customerReadOrder(env,user,id){requireValue(validId(id),'Invalid purchase link.');const key=customerRoot(user)+'orders/'+id+'.json',order=await customerJson(env,key);requireValue(order&&order.customerId===user.id&&order.id===id,'Purchase not found in your account.',404);return {key,order};}
async function customerHandle(request,env,url,headers,user){
 requireValue(env.ADMIN_STAGING,'Customer account storage is not connected.',503);const root=customerRoot(user),path=url.pathname,reply=data=>new Response(JSON.stringify(data),{headers});
 if(path==='/api/customer/profile'&&request.method==='GET')return reply(await customerProfile(env,user));
 if(path==='/api/customer/profile'&&request.method==='POST'){
  const body=await jsonBody(request,2048),current=await customerProfile(env,user);requireValue(!current.closed,'Restore your closed account before making changes.',403);
  requireValue(current.profile||body.acceptAccount===true,'Confirm account registration.');requireValue(typeof body.name==='string'&&body.name.trim().length>0&&body.name.trim().length<=100,'Enter your name (up to 100 characters).');requireValue(typeof body.marketingOptIn==='boolean','Choose your email preference.');
  const now=new Date().toISOString(),profile={name:body.name.trim(),email:user.email,marketingOptIn:body.marketingOptIn,createdAt:current.profile?.createdAt||now,updatedAt:now,accountConsentAt:current.profile?undefined:now};
  if(!current.profile)await env.ADMIN_STAGING.put(root+'registration-consent.json',JSON.stringify({acceptedAt:now,email:user.email}));
  await env.ADMIN_STAGING.put(root+'profile.json',JSON.stringify(profile));return reply(await customerProfile(env,user));
 }
 if(path==='/api/customer/close'&&request.method==='POST'){
  const body=await jsonBody(request,1024);requireValue(body.confirmClose===true,'Confirm that you wish to close your music account.');
  const current=await customerProfile(env,user);requireValue(current.profile,'No music account has been created.',404);await env.ADMIN_STAGING.put(root+'closed.json',JSON.stringify({closedAt:new Date().toISOString()}));
  await env.ADMIN_STAGING.put(root+'profile.json',JSON.stringify({...current.profile,marketingOptIn:false,updatedAt:new Date().toISOString()}));return reply({ok:true,closed:true});
 }
 if(path==='/api/customer/reopen'&&request.method==='POST'){
  const body=await jsonBody(request,1024);requireValue(body.confirmReopen===true,'Confirm that you wish to restore purchase access.');
  const current=await customerProfile(env,user);requireValue(current.profile,'No music account has been created.',404);await env.ADMIN_STAGING.put(root+'profile.json',JSON.stringify({...current.profile,marketingOptIn:false,updatedAt:new Date().toISOString()}));await env.ADMIN_STAGING.delete(root+'closed.json');return reply({ok:true,closed:false});
 }
 await customerActive(env,user);
 if(path==='/api/customer/checkout'&&request.method==='POST'){
  requireValue(env.SQUARE_ENVIRONMENT==='sandbox','Real payments are not enabled yet.',503);requireValue(env.PURCHASE_FILES,'Private music delivery is not connected.',503);
  const body=await jsonBody(request,16*1024);requireValue(body.digitalPurchaseAgreementAccepted===true,'Accept the digital purchase agreement.');requireValue(Array.isArray(body.items)&&body.items.length>0&&body.items.length<=25,'Choose up to 25 releases.');
  const catalog=await catalogFile(env),items=[];let fileCount=0;
  for(const selection of body.items){requireValue(selection&&typeof selection.title==='string'&&['single','album'].includes(selection.type)&&selection.qty===1,'Digital releases must have a quantity of one.');const matches=catalog.items.filter(x=>(x.type==='album'?'album':'single')===selection.type&&normalize(x.title)===normalize(selection.title));requireValue(matches.length===1,'A selected release changed. Refresh your cart.',409);
   const item=matches[0],id=await purchaseId(item),slots=purchaseSlots(item);fileCount+=slots.length;requireValue(slots.length>0&&fileCount<=120,'Choose fewer releases for this checkout.');const files=[];
   for(const slot of slots){const saved=await env.PURCHASE_FILES.get(purchaseRecordKey(id,slot.slot));requireValue(saved,'The full MP3 for '+slot.title+' is not available yet.',409);const file=await saved.json();requireValue(file.title===slot.title&&file.album===item.title&&file.artist===(item.artist||'Echo Craft')&&file.coverSource===(item.cover||'')&&await env.PURCHASE_FILES.head(file.key),'The purchase file for '+slot.title+' needs an update.',409);files.push({key:file.key,filename:file.filename,title:slot.title});}
   items.push({releaseId:id,type:selection.type,title:item.title,artist:item.artist||'Echo Craft',cover:item.cover||'',files});
  }
  const id=uuid(),checkout=await squareSandboxCheckout(new Request(request.url,{method:'POST',body:JSON.stringify({items:body.items,digitalPurchaseAgreementAccepted:true})}),env,'https://echocraftmusic.com/purchase-complete.html?order='+id);
  requireValue(checkout.orderId,'Square did not return an order reference.',502);const order={id,customerId:user.id,squareOrderId:checkout.orderId,amountCents:checkout.totalCents,status:'pending',environment:'sandbox',createdAt:new Date().toISOString(),items};
  await env.ADMIN_STAGING.put(root+'orders/'+id+'.json',JSON.stringify(order));await env.ADMIN_STAGING.put(root+'library/'+String(9999999999999-Date.now()).padStart(13,'0')+'-'+id+'.json',JSON.stringify({id}));return reply({checkoutUrl:checkout.checkoutUrl,orderId:id,environment:'sandbox'});
 }
 if(path==='/api/customer/library'&&request.method==='GET'){
  const cursor=url.searchParams.get('cursor')||undefined;requireValue(!cursor||cursor.length<=2000,'Invalid library page.');const listing=await env.ADMIN_STAGING.list({prefix:root+'library/',limit:12,...(cursor?{cursor}:{})}),orders=[];
  for(const object of listing.objects){const pointer=await customerJson(env,object.key);if(!pointer||!validId(pointer.id))continue;const key=root+'orders/'+pointer.id+'.json',order=await customerJson(env,key);if(!order||order.customerId!==user.id)continue;if(order.status==='pending'){try{if(await customerVerifyOrder(env,order)){order.status='paid';order.paidAt=new Date().toISOString();await env.ADMIN_STAGING.put(key,JSON.stringify(order));}}catch{/* Show a pending order without granting file access when Square is unavailable. */}}orders.push(customerOrderView(order));}
  orders.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));return reply({orders,nextCursor:listing.truncated?listing.cursor:null,environment:'sandbox'});
 }
 if(path==='/api/customer/order'&&request.method==='GET'){
  const {key,order}=await customerReadOrder(env,user,url.searchParams.get('order'));const paid=await customerVerifyOrder(env,order);if(paid&&order.status!=='paid'){order.status='paid';order.paidAt=new Date().toISOString();await env.ADMIN_STAGING.put(key,JSON.stringify(order));}return reply({...customerOrderView(order),verified:paid});
 }
 if(path==='/api/customer/download'&&request.method==='GET'){
  requireValue(env.PURCHASE_FILES,'Music storage is unavailable.',503);const {order}=await customerReadOrder(env,user,url.searchParams.get('order'));requireValue(await customerVerifyOrder(env,order),'This purchase does not have a completed, unrefunded payment.',409);
  const itemId=url.searchParams.get('item'),fileId=url.searchParams.get('file');requireValue(/^\d{1,3}$/.test(itemId||'')&&/^\d{1,3}$/.test(fileId||''),'Choose a purchased music file.');const file=order.items[Number(itemId)]?.files[Number(fileId)];requireValue(file,'This file was not part of your purchase.',404);requireValue(!await env.ADMIN_STAGING.get(root+'closed.json'),'Your music account is closed.',403);const saved=await env.PURCHASE_FILES.get(file.key);requireValue(saved,'Your purchased file is temporarily unavailable. Contact Echo Craft.',404);
  return new Response(saved.body,{headers:{...headers,'Content-Type':'audio/mpeg','Content-Disposition':'attachment; filename="'+file.filename.replace(/[^\x20-\x7e]|["\\]/g,'_')+'"'}});
 }
 return new Response(JSON.stringify({error:'Customer route not found.'}),{status:404,headers});
}
