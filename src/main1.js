'use strict';
// ===== 공통 유틸 =====
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
function fmt(ms){if(ms==null||!isFinite(ms))return '--:--.---';ms=Math.max(0,Math.round(ms));const m=Math.floor(ms/60000),s=Math.floor(ms/1000)%60,x=ms%1000;return m+':'+String(s).padStart(2,'0')+'.'+String(x).padStart(3,'0');}
function toast(t,ms=2600){const el=$('#toast');el.textContent=t;el.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('on'),ms);}
function rng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296;};}
function hash2(x,y){let h=Math.imul(x|0,374761393)+Math.imul(y|0,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  return lerp(lerp(hash2(xi,yi),hash2(xi+1,yi),u),lerp(hash2(xi,yi+1),hash2(xi+1,yi+1),u),v);}
function fbm(x,y){let a=0,s=1,f=1;for(let i=0;i<4;i++){a+=vnoise(x*f,y*f)*s;s*=0.5;f*=2.03;}return a/1.875;}

// ===== 설정 =====
// 휴대폰·패드 판별: 손가락이 주 입력장치이거나(iPadOS는 Mac처럼 보이므로 터치 지점 수로 구분), 모바일 기기 이름
const isTouchDev=(()=>{try{
  const ua=navigator.userAgent||'';
  if(/Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(ua))return true;
  if(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1)return true;  // iPadOS
  return !!(window.matchMedia&&matchMedia('(pointer:coarse)').matches&&!matchMedia('(any-pointer:fine)').matches);
}catch(e){return false;}})();
const SET=Object.assign({quality:isTouchDev?'mid':'high',cam:'chase',touch:'auto',sound:1,
  snd:{},bkGhost:1,bkShake:1,bkDas:'mid',bkGrid:1,g4Anim:1,g4Pad:1,rxBeep:1,rxFlash:1,racerHud:1},LS.get('smr_settings',{}));
SET.snd=SET.snd||{};
for(const g of ['racer','blocks','g2048','react'])SET.snd[g]=Object.assign({on:SET.sound?1:0,vol:0.8},SET.snd[g]||{});
function saveSet(){LS.set('smr_settings',SET);}
const QUAL={
  low:{pr:0.8,shadow:0,scen:0.3,car:0,grid:110,aniso:1},
  mid:{pr:1.3,shadow:1024,scen:0.65,car:1,grid:160,aniso:4},
  high:{pr:2,shadow:2048,scen:1,car:2,grid:210,aniso:8}};
const Q=()=>QUAL[SET.quality]||QUAL.mid;

// ===== 닉네임 필터 =====
const BAD=['씨발','시발','씨빨','씨바','시바','쉬발','쒸발','씌발','ㅅㅂ','ㅆㅂ','ㅅㅃ','씹','좆','좇','존나','졸라','조까','병신','븅신','빙신','ㅂㅅ','애미','애비','에미','니미','느금','니애미','엠창','앰창','개새','개색','새끼','섀끼','ㅅㄲ','지랄','ㅈㄹ','미친','또라이','닥쳐','꺼져','등신','찐따','창녀','걸레','보지','자지','섹스','야동','성기','fuck','fuk','fck','shit','bitch','sex','dick','pussy','asshole','porn','nigg','tlqkf','qudtls','wlfkf','dkaal','sibal','ssibal','shibal','byungsin','gaesaekki','운영자','관리자','admin'];
function badNick(n){
  const low=n.normalize('NFC').toLowerCase();
  const leet=low.replace(/0/g,'o').replace(/1/g,'i').replace(/3/g,'e').replace(/4/g,'a').replace(/5/g,'s').replace(/7/g,'t').replace(/@/g,'a').replace(/\$/g,'s');
  const a=low.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-z]/g,''), b=leet.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-z]/g,'');
  return BAD.some(w=>a.includes(w)||b.includes(w));
}
function nickKey(n){return 'n_'+[...new TextEncoder().encode(n.normalize('NFC').toLowerCase())].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function hashPw(salt,pw){
  const txt='ssaem|'+salt+'|'+pw;
  try{const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(txt));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');}
  catch(e){let h=2166136261;for(let r=0;r<2000;r++)for(const c of txt+r){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return 'f'+(h>>>0).toString(16);}
}

// ===== 저장소: 공유 DB(가능하면) / 이 기기(대체) =====
const Store={
  mode:'local', db:null, ready:null, readOnly:false,
  init(){
    this.ready=(async()=>{
      // Claude 링크 안: Claude 공유 DB / 그 밖(Vercel 등): Supabase / 둘 다 안 되면 이 기기
      if(window.claude&&typeof window.claude.use==='function'){ try{ const db=await window.claude.use('db'); if(db){this.db=db;this.mode='cloud';} }catch(e){} }
      else if(typeof SUPA!=='undefined'&&location.protocol.startsWith('http')){ this.mode='sb'; }
      await Acc.check();
      renderLogin(); renderGames();
    })();
    return this.ready;
  },
  _l(){return LS.get('smr_db',{acc:{},laps:{}});}, _ls(d){LS.set('smr_db',d);},
  async getAcc(key){
    if(this.mode==='cloud'){const s=await this.db.collection('accounts').doc(key).get();return s.exists?s.data():null;}
    return this._l().acc[key]||null;
  },
  async putAcc(key,obj){
    if(this.mode==='cloud'){await this.db.collection('accounts').doc(key).set(obj);return;}
    const d=this._l();d.acc[key]=obj;this._ls(d);
  },
  async getBest(tid,key){
    if(this.mode==='cloud'){const s=await this.db.collection('laps_'+tid).doc(key).get();return s.exists?s.data():null;}
    const d=this._l();return (d.laps[tid]||{})[key]||null;
  },
  async setBest(tid,key,obj){
    if(this.mode==='cloud'){await this.db.collection('laps_'+tid).doc(key).set(obj);return;}
    const d=this._l();(d.laps[tid]=d.laps[tid]||{})[key]=obj;this._ls(d);
  },
  async top(tid,n=20){
    if(this.mode==='cloud'){const s=await this.db.collection('laps_'+tid).orderBy('ms','asc').limit(n).get();return s.docs.map(d=>Object.assign({key:d.id},d.data()));}
    const d=this._l();return Object.entries(d.laps[tid]||{}).map(([k,v])=>Object.assign({key:k},v)).sort((a,b)=>a.ms-b.ms).slice(0,n);
  },
  async getLayout(tid){
    if(this.mode==='cloud'){const s=await this.db.doc('layouts/'+tid).get();return s.exists?s.data():null;}
    return LS.get('smr_layout_'+tid,null);
  },
  async setLayout(tid,L){
    if(this.mode==='cloud'){await this.db.doc('layouts/'+tid).set(JSON.parse(JSON.stringify(L)));return;}
    LS.set('smr_layout_'+tid,L);
  },
  async plays(){
    if(this.mode==='cloud'){try{const s=await this.db.doc('stats/games').get();return s.exists?s.data():{};}catch(e){return {};}}
    return this._l().plays||{};
  },
  async addPlay(gid){
    if(this.mode==='cloud'){const ref=this.db.doc('stats/games');const s=await ref.get();const d=s.exists?Object.assign({},s.data()):{};d[gid]=(d[gid]||0)+1;await ref.set(d);return;}
    const d=this._l();d.plays=d.plays||{};d.plays[gid]=(d.plays[gid]||0)+1;this._ls(d);
  },
  // 점수형 게임 (높을수록 좋음)
  async topScore(gid,n=20){
    if(this.mode==='cloud'){const s=await this.db.collection('scores_'+gid).orderBy('score','desc').limit(n).get();return s.docs.map(d=>Object.assign({key:d.id},d.data()));}
    const d=this._l();return Object.entries((d.sc||{})[gid]||{}).map(([k,v])=>Object.assign({key:k},v)).sort((a,b)=>b.score-a.score).slice(0,n);
  },
  async getScore(gid,key){
    if(this.mode==='cloud'){const s=await this.db.collection('scores_'+gid).doc(key).get();return s.exists?s.data():null;}
    const d=this._l();return ((d.sc||{})[gid]||{})[key]||null;
  },
  async setScore(gid,key,obj){
    if(this.mode==='cloud'){await this.db.collection('scores_'+gid).doc(key).set(obj);return;}
    const d=this._l();d.sc=d.sc||{};(d.sc[gid]=d.sc[gid]||{})[key]=obj;this._ls(d);
  },
  async rankScore(gid,score){
    if(this.mode==='cloud'){const s=await this.db.collection('scores_'+gid).where('score','>',score).limit(1000).get();return s.size+1;}
    const d=this._l();return Object.values((d.sc||{})[gid]||{}).filter(v=>v.score>score).length+1;
  },
  // 프로필(사진) · 임의 문서 지우기
  async getProfile(key){
    if(this.mode==='cloud'){const d=await this.db.collection('profiles').doc(key).get();return d.exists?d.data():null;}
    return (this._l().prof||{})[key]||null;
  },
  async setProfile(key,obj){
    if(this.mode==='cloud'){if(obj)await this.db.collection('profiles').doc(key).set(obj);else await this.db.collection('profiles').doc(key).delete();return;}
    const d=this._l();d.prof=d.prof||{};if(obj)d.prof[key]=obj;else delete d.prof[key];this._ls(d);
  },
  async delAcc(key){
    if(this.mode==='cloud'){await this.db.collection('accounts').doc(key).delete();return;}
    const d=this._l();delete d.acc[key];this._ls(d);
  },
  async delBest(tid,key){
    if(this.mode==='cloud'){await this.db.collection('laps_'+tid).doc(key).delete();return;}
    const d=this._l();if(d.laps[tid])delete d.laps[tid][key];this._ls(d);
  },
  async delScore(gid,key){
    if(this.mode==='cloud'){await this.db.collection('scores_'+gid).doc(key).delete();return;}
    const d=this._l();if(d.sc&&d.sc[gid])delete d.sc[gid][key];this._ls(d);
  },
  async rankOf(tid,ms){
    if(this.mode==='cloud'){const s=await this.db.collection('laps_'+tid).where('ms','<',ms).limit(1000).get();return s.size+1;}
    const d=this._l();return Object.values(d.laps[tid]||{}).filter(v=>v.ms<ms).length+1;
  }
};

// ===== 로그인 =====
let USER=LS.get('smr_session',null);
function renderLogin(){
  const c=$('#loginCard');
  const where=Store.mode==='cloud'||Store.mode==='sb'?'기록은 공유 랭킹에 저장돼요.':'공유 저장소에 연결되지 않아 이 기기에만 저장돼요.';
  if(USER){
    c.innerHTML=`<h2>내 계정 <span>PLAYER</span></h2>
      <div class="me"><div class="av" data-avk="${USER.key}">${esc(USER.nick[0]||'?')}</div><div><div class="nm">${esc(USER.nick)}</div><div class="sub">로그인됨 · 기록이 자동 저장돼요</div></div></div>
      <div class="row" style="margin-top:12px"><button class="btn primary" data-act="profile" style="flex:1">프로필 설정</button><button class="btn ghost" data-act="logout" style="flex:1">로그아웃</button></div>
      <div class="store-note">${where}</div>`;
  } else {
    c.innerHTML=`<h2>로그인 <span>LOGIN</span></h2>
      <form id="loginForm" autocomplete="off">
        <div class="field"><label for="inNick">닉네임 (2~12자)</label><input id="inNick" maxlength="12" placeholder="예: 질주하는고양이" autocapitalize="off" spellcheck="false"></div>
        <div class="field"><label for="inPw">비밀번호 (4자리 이상)</label><input id="inPw" type="password" maxlength="32" placeholder="••••" inputmode="text"></div>
        <div class="row"><button class="btn primary" type="submit" style="flex:1" id="btnLogin">로그인</button><button class="btn ghost" type="button" data-act="signup" style="flex:1">새로 만들기</button></div>
        <div class="msg" id="loginMsg"></div>
      </form>
      <button class="linkbtn" data-act="forgot">비밀번호를 잊었어요</button>
      <div class="store-note">처음이면 '새로 만들기'. 로그인하지 않아도 플레이할 수 있지만 랭킹에는 오르지 않아요.</div>`;
    $('#loginForm').addEventListener('submit',e=>{e.preventDefault();doLogin(false);});
  }
  updateChips();
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function updateChips(){
  for(const id of ['#userChip2']){const el=$(id);if(!el)continue;
    el.className='chip'+(USER?'':' guest');el.innerHTML=`<i></i>${USER?esc(USER.nick):'게스트 (기록 미저장)'}`;}
}
// 닉네임/비밀번호 확인 (로그인 창과 결과 화면에서 같이 씀). 성공하면 true
// 저장 실패 안내 (어디서 열었는지에 따라)
function saveErr(e){
  if(e&&(e.code==='session'||e.message==='session')){try{Acc.logout();renderLogin();}catch(_){} return '로그인이 풀렸어요. 다시 로그인한 뒤 저장해 주세요.';}
  if(Store.mode==='cloud')return '저장하지 못했어요. 공유한 사람에게 "참여자" 권한을 요청해 주세요.';
  if(Store.mode==='sb')return '저장하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
  return '저장하지 못했어요.';
}
async function authUser(nick,pw,isNew,set){
  nick=nick.trim();
  if(!/^[가-힣a-zA-Z0-9_]{2,12}$/.test(nick)){set('닉네임은 2~12자의 한글, 영문, 숫자, _ 만 쓸 수 있어요.','err');return false;}
  if(isNew&&badNick(nick)){set('쓸 수 없는 단어가 들어 있어요. 다른 닉네임을 정해 주세요.','err');return false;}
  if(pw.length<4){set('비밀번호는 4자리 이상으로 정해 주세요.','err');return false;}
  set('확인하는 중…');
  try{
    await Store.ready;
    const r=isNew?await Acc.signup(nick,pw):await Acc.login(nick,pw);
    if(r.err){set(r.err,'err');return false;}
    toast(isNew?`${USER.nick} 계정을 만들었어요`:`${USER.nick}님 환영해요`);
    renderLogin();return true;
  }catch(e){ set(Store.mode==='cloud'?'이 링크의 권한으로는 저장할 수 없어요. 공유한 사람에게 "참여자" 권한을 요청해 주세요.':'서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.','err');return false; }
}
async function doLogin(isNew){
  const msg=$('#loginMsg');const set=(t,cls)=>{msg.textContent=t;msg.className='msg '+(cls||'');};
  await authUser($('#inNick').value,$('#inPw').value,isNew,set);
}
function logout(){Acc.logout();renderLogin();}
