(()=>{'use strict';
const WORKER='https://echocraft-music-admin.echocraft-aimusic.workers.dev',params=new URLSearchParams(location.search),orderId=params.get('order'),access=params.get('access'),$=id=>document.getElementById(id);
let busy=false,urls=new Set(),currentOrder=null;
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;};
function message(text){$('statusMessage').textContent=text;$('statusMessage').hidden=!text;}
function heading(state,title,subtitle){$('successMark').dataset.state=state;$('stateIcon').className='fa-solid '+(state==='success'?'fa-check':state==='pending'?'fa-hourglass-half':'fa-circle-exclamation');$('confirmationTitle').textContent=title;$('confirmationSubtitle').textContent=subtitle;}
function cover(value){if(!value)return 'assets/images/ec-icon.webp';try{const u=new URL(value,location.href);if(u.protocol==='https:'&&(u.origin===location.origin||u.hostname==='distrokid.imgix.net')&&!u.username&&!u.password)return u.href;}catch{}return 'assets/images/ec-icon.webp';}
function clearPurchased(items){try{const purchased=new Set(items.map(x=>x.type+':'+x.title.trim().toLowerCase())),cart=JSON.parse(localStorage.getItem('ec-cart-items-v1')||'[]');if(Array.isArray(cart))localStorage.setItem('ec-cart-items-v1',JSON.stringify(cart.filter(x=>!purchased.has(x.type+':'+String(x.title||'').trim().toLowerCase()))));}catch{}}
async function api(path){const r=await fetch(WORKER+path,{cache:'no-store'});if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.error||'Your purchase could not be verified right now.');}return r;}
async function download(itemIndex,file,button){
 button.disabled=true;
 try{
  message('Verifying your payment and preparing '+file.filename+'…');
  const r=await api('/api/order/download?order='+encodeURIComponent(orderId)+'&access='+encodeURIComponent(access)+'&item='+itemIndex+'&file='+file.fileIndex);
  const url=URL.createObjectURL(await r.blob());urls.add(url);const a=node('a');a.href=url;a.download=file.filename;document.body.append(a);a.click();a.remove();
  file.downloadsRemaining=Math.max(0,Number(r.headers.get('X-Downloads-Remaining')||file.downloadsRemaining-1));
  message('Your browser received '+file.filename+'. '+file.downloadsRemaining+' download'+(file.downloadsRemaining===1?'':'s')+' remaining.');
  render(currentOrder);
 }catch(e){message(e.message);}finally{button.disabled=false;}
}
function render(order){
 currentOrder=order;const paid=order.status==='paid',first=order.items?.[0];if(!first)throw Error('This purchase has no music files. Contact Echo Craft.');
 $('purchaseCard').hidden=false;document.querySelector('.product-kind').textContent=order.items.length>1?'ORDER · '+order.items.length+' RELEASES':first.type==='album'?'DIGITAL ALBUM':'DIGITAL SINGLE';
 $('trackTitle').textContent=first.title+(order.items.length>1?' + '+(order.items.length-1)+' more':'');$('trackArtist').textContent=first.artist||'Echo Craft';$('purchaseCover').src=cover(first.cover);$('purchaseCover').alt=first.title+' artwork';$('purchaseCover').onerror=()=>{$('purchaseCover').onerror=null;$('purchaseCover').src='assets/images/ec-icon.webp';};
 $('purchaseAmount').textContent=(order.items.length>1?'Order total · ':'')+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(order.amountCents/100);$('orderNumber').textContent='Order #'+order.orderReference;$('paymentState').hidden=false;$('paymentStateText').textContent=paid?'Payment confirmed':'Awaiting payment confirmation';$('paymentState').querySelector('i').className='fa-solid '+(paid?'fa-circle-check':'fa-clock');
 const allFiles=order.items.flatMap((item,itemIndex)=>item.files.map(file=>({item,itemIndex,file}))),one=allFiles.length===1;
 $('downloadMusic').hidden=!one;$('downloadMusic').disabled=!paid||!one||allFiles[0].file.downloadsRemaining<=0;if(one){$('downloadMusic').querySelector('span').textContent='Download Your Music';$('downloadMusic').onclick=()=>download(allFiles[0].itemIndex,allFiles[0].file,$('downloadMusic'));$('downloadsRemaining').textContent=allFiles[0].file.downloadsRemaining+' downloads remaining';}
 const list=$('customerOrderItems');list.replaceChildren();list.hidden=one;
 if(!one)for(const item of order.items){const section=node('section','','customer-order-item'),title=node('h3',item.title),buttons=node('div','','customer-order-files');for(const file of item.files){const b=node('button',(item.type==='album'?'Download '+file.title:'Download MP3')+' · '+file.downloadsRemaining+' left','glass-button download-button');b.type='button';b.disabled=!paid||file.downloadsRemaining<=0;b.onclick=()=>download(item.itemIndex,file,b);buttons.append(b);}section.append(title,buttons);list.append(section);}
 if(paid){clearPurchased(order.items);heading('success','Thank you for supporting Echo Craft!','Your payment is confirmed and your music is ready.');$('deliveryNote').textContent='This purchase is automatically saved to My Music. Use the same email from checkout whenever you want to access it again.';message('');}
 else{heading('pending','Confirming your payment…','Your download will appear after Square confirms the completed payment.');$('deliveryNote').textContent='Your purchase is already reserved in My Music. Downloads unlock only after Square confirms payment.';message('Square has not confirmed the payment yet. If you just paid, wait a moment and check again.');}
}
async function check(){if(busy)return;busy=true;$('checkPayment').disabled=true;try{message('Confirming your payment with Square…');const r=await api('/api/order/status?order='+encodeURIComponent(orderId)+'&access='+encodeURIComponent(access)),order=await r.json();render(order);$('checkPayment').hidden=order.status==='paid';}catch(e){heading('attention','Let’s check your music delivery.','Your downloads stay protected until payment is verified.');message(e.message);$('checkPayment').hidden=false;}finally{busy=false;$('checkPayment').disabled=false;}}
$('sidebarControl').onclick=()=>{const mobile=matchMedia('(max-width:600px)').matches;if(mobile){const open=document.body.classList.toggle('mobile-nav-open');$('sidebarControl').setAttribute('aria-expanded',String(open));$('sidebarControl').setAttribute('aria-label',open?'Close navigation':'Open navigation');}else{const collapsed=document.body.classList.toggle('sidebar-collapsed');$('sidebarControl').setAttribute('aria-expanded',String(!collapsed));$('sidebarControl').setAttribute('aria-label',collapsed?'Expand sidebar':'Collapse sidebar');}};
if(matchMedia('(max-width:600px)').matches){$('sidebarControl').setAttribute('aria-expanded','false');$('sidebarControl').setAttribute('aria-label','Open navigation');}
$('checkPayment').onclick=check;window.addEventListener('pagehide',()=>{for(const url of urls)URL.revokeObjectURL(url);});
if(!/^[a-f0-9-]{36}$/.test(orderId||'')||!/^[a-f0-9-]{36}$/.test(access||'')){heading('attention','This purchase link is incomplete.','Return to the store or open My Music for help recovering your purchase.');message('The secure purchase reference is missing or invalid.');$('deliveryNote').textContent='If you completed a payment, use the same checkout email in My Music or contact Echo Craft.';}else{$('modeLabel').textContent='SECURE MUSIC DELIVERY';$('checkPayment').hidden=false;check();}
})();