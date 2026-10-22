const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>(v<0?"-":"")+"$"+Math.abs(v).toFixed(2);
const pad=n=>String(n).padStart(2,"0");
const ymd=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const ENC=encodeURIComponent;
const amz=k=>"https://www.amazon.com/s?k="+ENC(k)+(AFFILIATE.amazonTag?"&tag="+ENC(AFFILIATE.amazonTag):"");
const tmu=k=>"https://www.temu.com/search_result.html?search_key="+ENC(k)+(AFFILIATE.temuRef?"&_x_ads_sub_channel="+ENC(AFFILIATE.temuRef):"");
const ebi=k=>"https://www.ebay.com/sch/i.html?_nkw="+ENC(k)+(AFFILIATE.ebayCampId?"&campid="+ENC(AFFILIATE.ebayCampId):"");

/* ---------- state ---------- */
let user=null,profile={is_pro:false,since:""},LOG=[],accMsg=null,prefill=null,logErr="";
const paywall=BE.mode==="cloud"&&!!CFG.stripeProLink;
const LIMIT=CFG.freeLogLimit||20;
const isPro=()=>!paywall||profile.is_pro;
const pf=e=>e.rev-e.cost-e.ship-e.fee-e.ads;
async function loadLog(){try{LOG=await BE.listLog();logErr=""}catch(e){LOG=[];logErr="Could not load your sales. Check your connection and try again."}}
async function loadProfile(){try{profile=await BE.profile()}catch(e){}}
const upgradeUrl=()=>CFG.stripeProLink+(CFG.stripeProLink.includes("?")?"&":"?")+"client_reference_id="+ENC(user.id)+"&prefilled_email="+ENC(user.email);
const portalUrl=()=>CFG.stripePortalLink+(CFG.stripePortalLink.includes("?")?"&":"?")+"prefilled_email="+ENC(user.email);

/* ---------- membership ---------- */
function refreshNav(){$("navAcc").lastElementChild.textContent=user?"Account":"Member"}
async function afterAuth(r){
 if(r.err){accMsg={t:r.err,err:1};renderAcc();return}
 if(r.info){accMsg={t:r.info};renderAcc();return}
 user=r.user;await loadProfile();refreshNav();go("log")}
function renderAcc(){
 const el=$("acc"),m=accMsg?`<div class="msg ${accMsg.err?"err":""}" role="status">${esc(accMsg.t)}</div>`:"";accMsg=null;
 const where=BE.mode==="cloud"?"Your account and sales are saved securely online and sync across your devices.":"Accounts and sales are saved in this browser on this device only. They do not sync to other devices.";
 if(!user){
  el.innerHTML=m+`<div class="panel"><p class="meta" style="margin-top:0">Create a free membership to unlock the profit log${paywall?` (up to ${LIMIT} sales). Pro adds unlimited sales, the profit chart and CSV export.`:" and profit chart."}</p>
  <form id="authForm"><div class="cg"><label>Email<input id="a-email" type="email" required autocomplete="email"></label><label>Password (8+ characters)<input id="a-pw" type="password" minlength="8" required autocomplete="current-password"></label></div>
  <div class="row" style="margin-top:12px"><button class="btn acc" type="submit" data-m="signup">Sign up</button><button class="btn ghost" type="submit" data-m="login">Log in</button></div></form></div><p class="how">${where}</p>`;
  let mode="signup";el.querySelectorAll("button[data-m]").forEach(b=>b.onclick=()=>mode=b.dataset.m);
  $("authForm").onsubmit=async e=>{e.preventDefault();const em=$("a-email").value.trim().toLowerCase(),pw=$("a-pw").value;
   afterAuth(mode==="signup"?await BE.signup(em,pw):await BE.login(em,pw))};
 }else{
  const plan=paywall?(profile.is_pro?"Pro":"Free"):"Member";
  el.innerHTML=m+`<div class="panel"><h3 class="s">${esc(user.email)} <span class="tag">${plan}</span></h3><p class="meta">Member since ${esc(profile.since||"today")}${paywall&&!profile.is_pro?` · Free plan: ${LIMIT} sales`:""}</p>
  <div class="row" style="flex-wrap:wrap"><a class="btn" href="#log">Profit log</a><a class="btn" href="#chart">Charts</a><a class="btn" href="#pay">Payments</a><button class="btn ghost" id="out2">Log out</button></div></div>
  ${paywall&&!profile.is_pro?`<div class="panel"><h3 class="s">Upgrade to Pro</h3><p class="meta">Unlimited sales, the profit chart and CSV export.</p><div class="row" style="flex-wrap:wrap"><a class="btn acc" href="${esc(upgradeUrl())}">Upgrade to Pro</a><button class="btn ghost" id="ref">I already paid, refresh</button></div></div>`:""}
  ${paywall&&profile.is_pro&&CFG.stripePortalLink?`<div class="panel"><h3 class="s">Billing</h3><a class="btn ghost" href="${esc(portalUrl())}">Manage or cancel plan</a></div>`:""}
  <div class="panel"><h3 class="s">Delete my data</h3><p class="meta">Removes this account and all its sales.${paywall&&profile.is_pro?" Cancel your plan first in Billing so you are not charged again.":""}</p><button class="btn ghost" id="del">Delete account</button></div><p class="how">${where}</p>`;
  $("out2").onclick=async()=>{await BE.logout();user=null;LOG=[];profile={is_pro:false,since:""};refreshNav();accMsg={t:"You are logged out."};renderAcc()};
  if($("ref"))$("ref").onclick=async()=>{await loadProfile();accMsg={t:profile.is_pro?"Pro is active. Thank you!":"Not active yet. It can take a minute after paying. Try again shortly."};renderAcc()};
  $("del").onclick=async()=>{if(!confirm("Delete this account and all its sales? This cannot be undone."))return;const r=await BE.delAccount();if(r.err){accMsg={t:r.err,err:1};renderAcc();return}user=null;LOG=[];refreshNav();accMsg={t:"Account deleted."};renderAcc()};
 }}

/* ---------- navigation ---------- */
const views=["products","calc","log","chart","pay","account"];
function go(v){if(location.hash.slice(1)===v)show();else location.hash=v}
async function show(){
 let v=location.hash.slice(1);if(!views.includes(v))v="products";
 if((v==="log"||v==="chart"||v==="pay")&&!user){accMsg={t:"Log in or sign up to use the profit log, charts and payments."};v="account"}
 views.forEach(n=>$("v-"+n).classList.toggle("on",n===v));
 document.querySelectorAll("#nav a").forEach(a=>a.setAttribute("aria-current",a.dataset.v===v?"page":"false"));
 document.body.dataset.v=v;
 window.scrollTo(0,0);
 if(v==="account")renderAcc();
 if(v==="log"){await loadLog();renderLog()}
 if(v==="chart"){await Promise.all([loadLog(),loadPay()]);renderChart()}
 if(v==="pay"){await loadPay();renderPay()}}
window.addEventListener("hashchange",show);

/* ---------- products ---------- */
let cat="All",favs=new Set(S.get("df-favs",[])),favOnly=false;
const cats=["All",...new Set(P.map(p=>p.c))];
$("plist").innerHTML=P.map(p=>`<option value="${esc(p.n)}">`).join("");
const CE={All:"🛍️",Kitchen:"🍳",Home:"🏠",Pets:"🐾",Tech:"📱",Fashion:"👟",Health:"💪",Beauty:"💄",Outdoor:"⛺"};
function chips(){$("chips").innerHTML=cats.map(c=>`<button class="cat" aria-pressed="${c===cat}" data-c="${c}"><span class="ci" aria-hidden="true">${CE[c]||"🛒"}</span>${c==="All"?"All":c}</button>`).join("")}
const slug=n=>n.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const margin=p=>p.sell-p.cost-p.sell*.13-5;
function render(){
 const q=$("q").value.toLowerCase().trim(),s=$("sort").value;
 const l=P.filter(p=>(cat==="All"||p.c===cat)&&p.n.toLowerCase().includes(q)&&(!favOnly||favs.has(p.n)));
 l.sort((a,b)=>s==="margin"?margin(b)-margin(a):s==="cheap"?a.cost-b.cost:b.hot-a.hot);
 $("grid").innerHTML=l.length?l.map(p=>`<article class="pc">
 <div class="pimg"><span aria-hidden="true">${p.e}</span><img src="${esc(p.img||"images/"+slug(p.n)+".jpg")}" alt="${esc(p.n)}" loading="lazy" decoding="async"><span class="hot">🔥 ${p.hot}</span><button class="fav" data-f="${esc(p.n)}" aria-pressed="${favs.has(p.n)}" aria-label="Save ${esc(p.n)}">${favs.has(p.n)?"♥":"♡"}</button></div>
 <div class="pb"><h3>${esc(p.n)}</h3>
 <div class="pr"><div><b>${money(p.sell)}</b><br><small>Source ${money(p.cost)}</small></div><button class="add" data-l="${esc(p.n)}" aria-label="Log a sale of ${esc(p.n)}">+</button></div>
 <span class="pp">+${money(margin(p))} profit</span>
 <div class="mk"><a class="az" target="_blank" rel="noopener sponsored" href="${esc(p.az||amz(p.k))}">Amazon</a><a class="tm" target="_blank" rel="noopener sponsored" href="${esc(p.tm||tmu(p.k))}">Temu</a><a class="eb" target="_blank" rel="noopener sponsored" href="${esc(p.eb||ebi(p.k))}">eBay</a></div>
 ${p.buy?`<a class="buy" href="${esc(p.buy)}">Buy now</a>`:""}
 </div></article>`).join(""):'<div class="empty">No products match. Clear the search or filters.</div>'}
$("chips").onclick=e=>{const b=e.target.closest("[data-c]");if(b){cat=b.dataset.c;chips();render()}};
$("grid").onclick=e=>{
 const fb=e.target.closest("[data-f]"),lb=e.target.closest("[data-l]"),f=fb&&fb.dataset.f,l=lb&&lb.dataset.l;
 if(f){favs.has(f)?favs.delete(f):favs.add(f);S.set("df-favs",[...favs]);render()}
 if(l){const p=P.find(x=>x.n===l);prefill={name:p.n,rev:p.sell,cost:p.cost,fee:+(p.sell*.13).toFixed(2),ads:5};
  if(!user){accMsg={t:"Log in or sign up to log sales."};go("account")}else go("log")}};
$("grid").addEventListener("error",e=>{if(e.target.tagName==="IMG")e.target.remove()},true);
$("favOnly").onclick=e=>{favOnly=!favOnly;e.target.setAttribute("aria-pressed",favOnly);render()};
$("q").oninput=render;$("sort").onchange=render;

/* ---------- calculator ---------- */
function calc(){const[a,b,c,d,e]=["c1","c2","c3","c4","c5"].map(i=>parseFloat($(i).value)||0);const p=c-a-b-c*d/100-e,mg=c?p/c*100:0;
 $("out").innerHTML=`Profit per sale: <span class="${p>=0?"pos":"neg"}">${money(p)}</span> (${mg.toFixed(0)}% margin)`}
document.querySelectorAll("#v-calc input").forEach(i=>i.oninput=calc);

/* ---------- profit log ---------- */
function stats(L){
 const t=L.reduce((s,e)=>s+pf(e),0),by={};L.forEach(e=>by[e.name]=(by[e.name]||0)+pf(e));
 const best=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];
 return `<div class="stat"><b class="${t>=0?"pos":"neg"}">${money(t)}</b><small>Total profit</small></div><div class="stat"><b>${L.length}</b><small>Sales</small></div><div class="stat"><b>${L.length?money(t/L.length):"$0.00"}</b><small>Avg per sale</small></div><div class="stat"><b style="font-size:16px">${best?esc(best[0]):"—"}</b><small>Best product</small></div>`}
const atLimit=()=>paywall&&!profile.is_pro&&LOG.length>=LIMIT;
function renderLog(){
 $("stats").innerHTML=stats(LOG);
 $("l-date").value=ymd(new Date());
 if(prefill){$("l-name").value=prefill.name;$("l-rev").value=prefill.rev;$("l-cost").value=prefill.cost;$("l-fee").value=prefill.fee;$("l-ads").value=prefill.ads;prefill=null}
 const note=logErr?`<div class="msg err" role="alert">${esc(logErr)}</div>`:atLimit()?`<div class="msg">Free plan limit reached (${LIMIT} sales). <a href="#account">Upgrade to Pro</a> to log more.</div>`:"";
 $("logNote").innerHTML=note;
 $("saveBtn").disabled=atLimit();
 $("entries").innerHTML=LOG.length?LOG.map(e=>`<div class="entry"><span class="d">${esc(e.date)}</span><span>${esc(e.name)}<br><span class="d">Revenue ${money(e.rev)}</span></span><span class="${pf(e)>=0?"pos":"neg"}">${money(pf(e))}</span><button data-d="${esc(e.id)}" aria-label="Delete sale of ${esc(e.name)}">✕</button></div>`).join(""):'<div class="empty">No sales yet. Add your first sale above, or tap "Log a sale" on a product.</div>'}
$("logForm").onsubmit=async e=>{e.preventDefault();
 const n=i=>parseFloat($(i).value)||0;
 const r=await BE.addLog({date:$("l-date").value,name:$("l-name").value.trim(),rev:n("l-rev"),cost:n("l-cost"),ship:n("l-ship"),fee:n("l-fee"),ads:n("l-ads")});
 if(r.err){$("logNote").innerHTML=`<div class="msg err" role="alert">${esc(r.err)}</div>`;return}
 $("logForm").reset();await loadLog();renderLog()};
$("entries").onclick=async e=>{const id=e.target.dataset.d;if(!id)return;await BE.delLog(id);await loadLog();renderLog()};
$("csv").onclick=()=>{
 if(!isPro()){accMsg={t:"CSV export is part of Pro."};go("account");return}
 const q=v=>'"'+String(v).replace(/"/g,'""').replace(/^([=+\-@])/,"'$1")+'"';
 const rows=[["date","product","revenue","cost","shipping","fees","ads","profit"],...LOG.map(e=>[e.date,e.name,e.rev,e.cost,e.ship,e.fee,e.ads,pf(e).toFixed(2)])];
 const blob=new Blob([rows.map(r=>r.map(q).join(",")).join("\n")],{type:"text/csv"}),a=document.createElement("a");
 a.href=URL.createObjectURL(blob);a.download="dropfinder-profit-log.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};

/* ---------- payments ---------- */
const PAY_IN=["Customer payment","Marketplace payout","Refund received"];
const PAY_OUT=["Supplier payment","Ad spend","Platform fee","Shipping cost","Refund to customer","Other expense"];
const PAY_M=["Card","PayPal","Stripe","Bank transfer","Cash","Other"];
let PAY=[],payErr="";
const payAmt=p=>PAY_IN.includes(p.kind)?p.amount:-p.amount;
async function loadPay(){try{PAY=await BE.listPay();payErr=""}catch(e){PAY=[];payErr="Could not load payments. Check your connection and try again."}}
const atPayLimit=()=>paywall&&!profile.is_pro&&PAY.length>=LIMIT;
function fillPaySelects(){
 $("p-kind").innerHTML='<optgroup label="Money in">'+PAY_IN.map(k=>`<option>${k}</option>`).join("")+'</optgroup><optgroup label="Money out">'+PAY_OUT.map(k=>`<option>${k}</option>`).join("")+"</optgroup>";
 $("p-meth").innerHTML=PAY_M.map(k=>`<option>${k}</option>`).join("")}
function payStats(L){
 const i=L.filter(p=>PAY_IN.includes(p.kind)).reduce((s,p)=>s+p.amount,0),o=L.filter(p=>PAY_OUT.includes(p.kind)).reduce((s,p)=>s+p.amount,0);
 return `<div class="stat"><b class="pos">${money(i)}</b><small>Money in</small></div><div class="stat"><b class="neg">${money(o)}</b><small>Money out</small></div><div class="stat"><b class="${i-o>=0?"pos":"neg"}">${money(i-o)}</b><small>Net</small></div><div class="stat"><b>${L.length}</b><small>Payments</small></div>`}
function renderPay(){
 $("pstats").innerHTML=payStats(PAY);
 $("p-date").value=ymd(new Date());
 $("payNote").innerHTML=payErr?`<div class="msg err" role="alert">${esc(payErr)}</div>`:atPayLimit()?`<div class="msg">Free plan limit reached (${LIMIT} payments). <a href="#account">Upgrade to Pro</a> to record more.</div>`:"";
 $("payBtn").disabled=atPayLimit();
 $("pentries").innerHTML=PAY.length?PAY.map(p=>`<div class="entry"><span class="d">${esc(p.date)}</span><span>${esc(p.kind)}<br><span class="d">${esc(p.method)}${p.note?" · "+esc(p.note):""}</span></span><span class="${payAmt(p)>=0?"pos":"neg"}">${payAmt(p)>=0?"+":"-"}${money(p.amount)}</span><button data-pd="${esc(p.id)}" aria-label="Delete payment ${esc(p.kind)}">✕</button></div>`).join(""):'<div class="empty">No payments yet. Record money in (customer payments, payouts) and money out (supplier orders, ads, fees).</div>'}
$("payForm").onsubmit=async e=>{e.preventDefault();
 const r=await BE.addPay({date:$("p-date").value,kind:$("p-kind").value,method:$("p-meth").value,amount:parseFloat($("p-amt").value)||0,note:$("p-note").value.trim()});
 if(r.err){$("payNote").innerHTML=`<div class="msg err" role="alert">${esc(r.err)}</div>`;return}
 $("payForm").reset();await loadPay();renderPay()};
$("pentries").onclick=async e=>{const b=e.target.closest("[data-pd]");if(!b)return;await BE.delPay(b.dataset.pd);await loadPay();renderPay()};
$("pcsv").onclick=()=>{
 if(!isPro()){accMsg={t:"CSV export is part of Pro."};go("account");return}
 const q=v=>'"'+String(v).replace(/"/g,'""').replace(/^([=+\-@])/,"'$1")+'"';
 const rows=[["date","type","method","amount","direction","note"],...PAY.map(p=>[p.date,p.kind,p.method,p.amount,PAY_IN.includes(p.kind)?"in":"out",p.note||""])];
 const blob=new Blob([rows.map(r=>r.map(q).join(",")).join("\n")],{type:"text/csv"}),a=document.createElement("a");
 a.href=URL.createObjectURL(blob);a.download="dropfinder-payments.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};

/* ---------- charts: sales / profit / payments ---------- */
let metric="profit";
function buckets(r){
 const out=[],now=new Date();
 if(r==="12m")for(let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);out.push({key:d.getFullYear()+"-"+pad(d.getMonth()+1),label:d.toLocaleString("en",{month:"short"}),up:0,down:0})}
 else for(let i=+r-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i);out.push({key:ymd(d),label:String(d.getDate()),up:0,down:0})}
 return out}
function fill(b,r,items,fn){items.forEach(e=>{const o=b.find(x=>x.key===(r==="12m"?e.date.slice(0,7):e.date));if(o){const v=fn(e);if(v>=0)o.up+=v;else o.down+=v}})}
function salesStats(L){
 const t=L.reduce((s,e)=>s+e.rev,0),by={};L.forEach(e=>by[e.name]=(by[e.name]||0)+e.rev);
 const best=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];
 return `<div class="stat"><b>${money(t)}</b><small>Total sales</small></div><div class="stat"><b>${L.length}</b><small>Orders</small></div><div class="stat"><b>${L.length?money(t/L.length):"$0.00"}</b><small>Avg order</small></div><div class="stat"><b style="font-size:16px">${best?esc(best[0]):"—"}</b><small>Top seller</small></div>`}
const LEG={sales:'<span><b style="color:var(--org)">■</b> Sales</span><span><b style="color:var(--blue)">━</b> Running total</span>',profit:'<span><b style="color:var(--ok)">■</b> Profit</span><span><b style="color:var(--price)">■</b> Loss</span><span><b style="color:var(--blue)">━</b> Running total</span>',pay:'<span><b style="color:var(--ok)">■</b> Money in</span><span><b style="color:var(--price)">■</b> Money out</span><span><b style="color:var(--blue)">━</b> Net running total</span>'};
function renderChart(){
 document.querySelectorAll("#seg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.m===metric));
 const isPay=metric==="pay",items=isPay?PAY:LOG;
 $("stats2").innerHTML=isPay?payStats(PAY):metric==="sales"?salesStats(LOG):stats(LOG);
 $("legend").innerHTML=LEG[metric];
 const err=isPay?payErr:logErr;
 if(err){$("chartBox").innerHTML=`<div class="msg err" role="alert">${esc(err)}</div>`;return}
 if(!isPro()){$("chartBox").innerHTML='<div class="empty">Charts are part of Pro.<br><br><a class="btn acc" href="#account">See Pro</a></div>';return}
 if(!items.length){$("chartBox").innerHTML=isPay?'<div class="empty">No data yet. Record payments in <a href="#pay">Payments</a> to see this chart.</div>':'<div class="empty">No data yet. Add sales in the <a href="#log">profit log</a> to see your charts.</div>';return}
 const r=$("range").value,s=buckets(r);
 fill(s,r,items,isPay?payAmt:metric==="sales"?(e=>e.rev):pf);
 const W=640,H=260,M={l:48,r:12,t:14,b:28},w=W-M.l-M.r,h=H-M.t-M.b;
 let c=0;const cum=s.map(x=>c+=x.up+x.down),all=[0,...s.map(x=>x.up),...s.map(x=>x.down),...cum],mx=Math.max(...all),mn=Math.min(...all),sp=(mx-mn)||1;
 const y=v=>M.t+h-(v-mn)/sp*h,bw=w/s.length,x=i=>M.l+i*bw+bw/2,step=Math.ceil(s.length/10);
 let g="";for(let i=0;i<=4;i++){const v=mn+sp*i/4;g+=`<line x1="${M.l}" x2="${W-M.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${M.l-6}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="var(--mute)">$${Math.round(v)}</text>`}
 const upC=metric==="sales"?"var(--org)":"var(--ok)";
 const bars=s.map((d,i)=>(d.up?`<rect x="${x(i)-bw*.35}" width="${bw*.7}" y="${y(d.up)}" height="${Math.max(y(0)-y(d.up),1)}" rx="2" fill="${upC}"/>`:"")+(d.down?`<rect x="${x(i)-bw*.35}" width="${bw*.7}" y="${y(0)}" height="${Math.max(y(d.down)-y(0),1)}" rx="2" fill="var(--price)"/>`:"")).join("");
 const lab=s.map((d,i)=>i%step===0?`<text x="${x(i)}" y="${H-8}" text-anchor="middle" font-size="11" fill="var(--mute)">${d.label}</text>`:"").join("");
 const line=cum.map((v,i)=>`${x(i)},${y(v)}`).join(" "),name={sales:"Sales",profit:"Profit",pay:"Payments"}[metric];
 $("chartBox").innerHTML=`<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${name} chart. Total in this range ${money(cum[cum.length-1])}">${g}${bars}<polyline points="${line}" fill="none" stroke="var(--blue)" stroke-width="2.5"/>${lab}</svg>`}
$("range").onchange=renderChart;
$("seg").onclick=e=>{const b=e.target.closest("[data-m]");if(b){metric=b.dataset.m;renderChart()}};

/* ---------- boot ---------- */
chips();render();calc();fillPaySelects();
(async()=>{try{user=await BE.init();if(user)await loadProfile()}catch(e){user=null}
 refreshNav();show()})();
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("sw.js").catch(()=>{});
