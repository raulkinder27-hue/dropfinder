const S={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}};
const CFG=window.DF_CONFIG||{};
const SB=(CFG.supabaseUrl&&CFG.supabaseKey&&window.supabase)?window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey):null;
const b64=a=>btoa(String.fromCharCode(...a)),unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function hashPw(pw,salt){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveBits"]);return b64(new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"},k,256)))}
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};

/* Cloud: Supabase (accounts + sales sync across devices; Pro status set by the Stripe webhook) */
const cloud={
 mode:"cloud",
 async init(){const{data}=await SB.auth.getSession();const u=data.session&&data.session.user;return u?{id:u.id,email:u.email}:null},
 async signup(e,p){const{data,error}=await SB.auth.signUp({email:e,password:p});if(error)return{err:error.message};if(!data.session)return{info:"Check your email to confirm your account, then log in."};return{user:{id:data.user.id,email:data.user.email}}},
 async login(e,p){const{data,error}=await SB.auth.signInWithPassword({email:e,password:p});if(error)return{err:error.message};return{user:{id:data.user.id,email:data.user.email}}},
 async logout(){await SB.auth.signOut()},
 async profile(){const{data}=await SB.from("profiles").select("is_pro,created_at").maybeSingle();return{is_pro:!!(data&&data.is_pro),since:data&&data.created_at?data.created_at.slice(0,10):today()}},
 async listLog(){const{data,error}=await SB.from("sales").select("id,date,name,rev,cost,ship,fee,ads").order("date",{ascending:false});if(error)throw error;return data.map(r=>({...r,rev:+r.rev,cost:+r.cost,ship:+r.ship,fee:+r.fee,ads:+r.ads}))},
 async addLog(e){const{error}=await SB.from("sales").insert({date:e.date,name:e.name,rev:e.rev,cost:e.cost,ship:e.ship,fee:e.fee,ads:e.ads});return error?{err:/row-level security/i.test(error.message)?"Free plan limit reached. Upgrade to Pro to log more sales.":error.message}:{}},
 async delLog(id){const{error}=await SB.from("sales").delete().eq("id",id);return error?{err:error.message}:{}},
 async listPay(){const{data,error}=await SB.from("payments").select("id,date,kind,method,amount,note").order("date",{ascending:false});if(error)throw error;return data.map(r=>({...r,amount:+r.amount}))},
 async addPay(e){const{error}=await SB.from("payments").insert({date:e.date,kind:e.kind,method:e.method,amount:e.amount,note:e.note});return error?{err:/row-level security/i.test(error.message)?"Free plan limit reached. Upgrade to Pro to record more payments.":error.message}:{}},
 async delPay(id){const{error}=await SB.from("payments").delete().eq("id",id);return error?{err:error.message}:{}},
 async delAccount(){const{error}=await SB.rpc("delete_my_account");if(error)return{err:error.message};await SB.auth.signOut();return{}}
};

/* Local: this device only (no server) */
let cur=null;
const local={
 mode:"local",
 async init(){const s=S.get("df-session",null);cur=s;return s?{id:s,email:s}:null},
 async signup(email,pw){
  if(!window.crypto||!crypto.subtle)return{err:"Sign-up needs a secure (https) page."};
  const U=S.get("df-users",{});if(U[email])return{err:"That email already has an account. Log in instead."};
  const salt=crypto.getRandomValues(new Uint8Array(16));
  U[email]={salt:b64(salt),hash:await hashPw(pw,salt),since:today()};
  if(!S.set("df-users",U))return{err:"Could not save. Allow site storage in your browser."};
  cur=email;S.set("df-session",email);return{user:{id:email,email}}},
 async login(email,pw){
  const u=S.get("df-users",{})[email];if(!u)return{err:"No account for that email. Sign up first."};
  if(!window.crypto||!crypto.subtle)return{err:"Log-in needs a secure (https) page."};
  if(await hashPw(pw,unb64(u.salt))!==u.hash)return{err:"Wrong password."};
  cur=email;S.set("df-session",email);return{user:{id:email,email}}},
 async logout(){cur=null;try{localStorage.removeItem("df-session")}catch(e){}},
 async profile(){const u=S.get("df-users",{})[cur]||{};return{is_pro:true,since:u.since||today()}},
 async listLog(){return S.get("df-log:"+cur,[]).sort((a,b)=>b.date.localeCompare(a.date))},
 async addLog(e){const L=S.get("df-log:"+cur,[]);L.push({...e,id:Date.now()+Math.random().toString(36).slice(2,6)});return S.set("df-log:"+cur,L)?{}:{err:"Could not save. Allow site storage in your browser."}},
 async delLog(id){S.set("df-log:"+cur,S.get("df-log:"+cur,[]).filter(x=>x.id!==id));return{}},
 async listPay(){return S.get("df-pay:"+cur,[]).sort((a,b)=>b.date.localeCompare(a.date))},
 async addPay(e){const L=S.get("df-pay:"+cur,[]);L.push({...e,id:Date.now()+Math.random().toString(36).slice(2,6)});return S.set("df-pay:"+cur,L)?{}:{err:"Could not save. Allow site storage in your browser."}},
 async delPay(id){S.set("df-pay:"+cur,S.get("df-pay:"+cur,[]).filter(x=>x.id!==id));return{}},
 async delAccount(){const U=S.get("df-users",{});delete U[cur];S.set("df-users",U);try{localStorage.removeItem("df-log:"+cur);localStorage.removeItem("df-pay:"+cur)}catch(e){}await this.logout();return{}}
};
const BE=SB?cloud:local;
