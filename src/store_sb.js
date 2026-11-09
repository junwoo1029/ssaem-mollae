// ===== 공유 저장소 2: Supabase (Vercel 등 Claude 밖에서 열었을 때) =====
// 계정·비밀번호는 서버 함수에서만 다루고(브라우저는 비밀번호 해시도 못 봄), 기록 저장은 로그인 토큰으로만 됨.
const SUPA={url:'https://thzlynfaydadrrptmasg.supabase.co',key:'sb_publishable_NCMU3ZjZjM7rGuCgLKHcvg__sezH4nz'};
const SB_ERR={nick:'닉네임은 2~12자의 한글, 영문, 숫자, _ 만 쓸 수 있어요.',pw:'비밀번호는 4자리 이상으로 정해 주세요.',
  taken:'이미 있는 닉네임이에요.',none:"없는 닉네임이에요. 처음이면 '새로 만들기'를 눌러 주세요.",bad:'비밀번호가 맞지 않아요.',
  locked:'비밀번호를 여러 번 틀려서 1분 동안 잠겼어요. 잠시 뒤에 다시 해 주세요.',session:'로그인이 풀렸어요. 다시 로그인해 주세요.',
  email:'인증한 이메일과 달라요.',noemail:'이메일 인증을 해 두지 않은 계정이에요.',code:'이메일이나 복구 코드가 맞지 않아요.',input:'입력한 내용을 다시 확인해 주세요.'};
const sbErr=e=>SB_ERR[e]||'문제가 생겼어요. 다시 시도해 주세요.';
async function sbRpc(fn,args){
  const r=await fetch(SUPA.url+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:SUPA.key,'Content-Type':'application/json'},body:JSON.stringify(args||{})});
  if(!r.ok)throw new Error('rpc '+fn+' '+r.status);const t=await r.text();return t?JSON.parse(t):null;
}
async function sbGet(path){const r=await fetch(SUPA.url+'/rest/v1/'+path,{headers:{apikey:SUPA.key}});if(!r.ok)throw new Error('get '+r.status);return r.json();}
async function sbCount(path){
  const r=await fetch(SUPA.url+'/rest/v1/'+path,{method:'HEAD',headers:{apikey:SUPA.key,Prefer:'count=exact'}});
  const m=(r.headers.get('content-range')||'').match(/\/(\d+)/);return m?+m[1]:0;
}
const enc=encodeURIComponent;
const lapRow=r=>Object.assign({key:r.key},r.data||{},{nick:r.nick,ms:r.ms});
const scRow=r=>Object.assign({key:r.key},r.data||{},{nick:r.nick,score:r.score});
const strip=(o,...ks)=>{const c=Object.assign({},o);ks.forEach(k=>delete c[k]);return c;};
function sbTok(){if(!USER||!USER.token)throw new Error('session');return USER.token;}
async function sbOk(p){const r=await p;if(!r||!r.ok){const e=new Error((r&&r.err)||'fail');e.code=r&&r.err;throw e;}return r;}
const SB={
  getBest:async(tid,key)=>{const r=await sbGet(`laps?tid=eq.${enc(tid)}&key=eq.${enc(key)}&select=key,nick,ms,data`);return r[0]?lapRow(r[0]):null;},
  setBest:async(tid,key,obj)=>{await sbOk(sbRpc('sm_submit_lap',{p_token:sbTok(),p_tid:tid,p_ms:Math.round(obj.ms),p_data:strip(obj,'nick','ms')}));},
  top:async(tid,n=20)=>(await sbGet(`laps?tid=eq.${enc(tid)}&select=key,nick,ms,data&order=ms.asc,at.asc&limit=${n}`)).map(lapRow),
  rankOf:async(tid,ms)=>(await sbCount(`laps?tid=eq.${enc(tid)}&ms=lt.${Math.round(ms)}&select=key`))+1,
  getLayout:async tid=>{const r=await sbGet(`layouts?tid=eq.${enc(tid)}&select=data`);return r[0]?r[0].data:null;},
  setLayout:async()=>{throw new Error('readonly');},
  plays:async()=>{const r=await sbGet('plays?select=gid,n');const o={};r.forEach(x=>o[x.gid]=+x.n);return o;},
  addPlay:async gid=>{await sbRpc('sm_add_play',{p_gid:gid});},
  topScore:async(gid,n=20)=>(await sbGet(`scores?gid=eq.${enc(gid)}&select=key,nick,score,data&order=score.desc,at.asc&limit=${n}`)).map(scRow),
  getScore:async(gid,key)=>{const r=await sbGet(`scores?gid=eq.${enc(gid)}&key=eq.${enc(key)}&select=key,nick,score,data`);return r[0]?scRow(r[0]):null;},
  setScore:async(gid,key,obj)=>{await sbOk(sbRpc('sm_submit_score',{p_token:sbTok(),p_gid:gid,p_score:Math.round(obj.score),p_data:strip(obj,'nick','score')}));},
  rankScore:async(gid,score)=>(await sbCount(`scores?gid=eq.${enc(gid)}&score=gt.${Math.round(score)}&select=key`))+1,
  getProfile:async key=>{const r=await sbGet(`profiles?key=eq.${enc(key)}&select=img,ratio,nick`);return r[0]||null;},
  setProfile:async(key,obj)=>{await sbOk(sbRpc('sm_set_profile',{p_token:sbTok(),p_img:obj?obj.img:null,p_ratio:obj?obj.ratio:null}));},
};
for(const k of Object.keys(SB)){const orig=Store[k];Store[k]=function(...a){return this.mode==='sb'?SB[k](...a):orig.apply(this,a);};}

// ===== 계정 기능 (모드와 상관없이 같은 방식으로 부름). 실패하면 {err:'메시지'} =====
const setSession=u=>{USER=u;LS.set('smr_session',USER);};
const Acc={
  async signup(nick,pw){
    if(Store.mode==='sb'){const r=await sbRpc('sm_signup',{p_nick:nick,p_pw:pw});if(!r.ok)return {err:sbErr(r.err)};setSession({key:r.key,nick:r.nick,token:r.token});return {ok:1};}
    const key=nickKey(nick);if(await Store.getAcc(key))return {err:'이미 있는 닉네임이에요. 로그인하거나 다른 닉네임을 써 주세요.'};
    const salt=Math.random().toString(36).slice(2,12);await Store.putAcc(key,{nick,salt,hash:await hashPw(salt,pw),created:Date.now()});
    setSession({key,nick});return {ok:1};
  },
  async login(nick,pw){
    if(Store.mode==='sb'){const r=await sbRpc('sm_login',{p_nick:nick,p_pw:pw});if(!r.ok)return {err:sbErr(r.err)};setSession({key:r.key,nick:r.nick,token:r.token});return {ok:1};}
    const key=nickKey(nick);const acc=await Store.getAcc(key);
    if(!acc)return {err:SB_ERR.none};if(await hashPw(acc.salt,pw)!==acc.hash)return {err:SB_ERR.bad};
    setSession({key,nick:acc.nick});return {ok:1};
  },
  logout(){if(Store.mode==='sb'&&USER&&USER.token)sbRpc('sm_logout',{p_token:USER.token}).catch(()=>{});USER=null;LS.set('smr_session',null);},
  // 저장된 로그인 확인 (닉네임이 다른 기기에서 바뀌었으면 반영)
  async check(){
    if(!USER)return;
    if(Store.mode==='sb'){if(!USER.token){USER=null;LS.set('smr_session',null);return;}
      try{const r=await sbRpc('sm_me',{p_token:USER.token});if(!r.ok){USER=null;LS.set('smr_session',null);}else if(r.key!==USER.key||r.nick!==USER.nick)setSession({key:r.key,nick:r.nick,token:USER.token});}catch(e){}
      return;}
    try{const acc=await Store.getAcc(USER.key);if(!acc){USER=null;LS.set('smr_session',null);}else if(acc.nick!==USER.nick)setSession({key:USER.key,nick:acc.nick});}catch(e){}
  },
  async info(){
    if(Store.mode==='sb'){const r=await sbRpc('sm_me',{p_token:sbTok()});if(!r.ok)return {err:sbErr(r.err)};return {created:r.created,emailMask:r.emailMask,hasEmail:r.hasEmail};}
    const a=await Store.getAcc(USER.key);if(!a)return {err:'계정 정보를 불러오지 못했어요.'};return {created:a.created,emailMask:a.emailMask,hasEmail:!!a.emailHash};
  },
  async setEmail(email,code){
    if(Store.mode==='sb'){const r=await sbRpc('sm_set_email',{p_token:sbTok(),p_email:email,p_mask:maskEmail(email),p_code:normCode(code)});return r.ok?{ok:1}:{err:sbErr(r.err)};}
    const acc=await Store.getAcc(USER.key);
    acc.emailHash=await hashPw(acc.salt,'email|'+email);acc.emailMask=maskEmail(email);acc.recHash=await hashPw(acc.salt,'rec|'+normCode(code));acc.emailAt=Date.now();
    await Store.putAcc(USER.key,acc);return {ok:1};
  },
  // by: {old:'현재 비번'} 또는 {email:'인증한 이메일'}
  async changePw(by,np){
    if(Store.mode==='sb'){const r=await sbRpc('sm_change_pw',{p_token:sbTok(),p_old:by.old??null,p_email:by.email??null,p_new:np});return r.ok?{ok:1}:{err:sbErr(r.err)};}
    const acc=await Store.getAcc(USER.key);
    if(by.email!=null){if(!acc.emailHash)return {err:SB_ERR.noemail};if((await hashPw(acc.salt,'email|'+normEmail(by.email)))!==acc.emailHash)return {err:SB_ERR.email};}
    else if(await hashPw(acc.salt,by.old)!==acc.hash)return {err:'현재 비밀번호가 맞지 않아요.'};
    acc.hash=await hashPw(acc.salt,np);await Store.putAcc(USER.key,acc);return {ok:1};
  },
  async recover(nick,email,code,np){
    if(Store.mode==='sb'){const r=await sbRpc('sm_recover',{p_nick:nick,p_email:normEmail(email),p_code:normCode(code),p_new:np});if(!r.ok)return {err:r.err==='none'?'없는 닉네임이에요.':sbErr(r.err)};setSession({key:r.key,nick:r.nick,token:r.token});return {ok:1};}
    const key=nickKey(nick);const acc=await Store.getAcc(key);
    if(!acc)return {err:'없는 닉네임이에요.'};if(!acc.emailHash)return {err:SB_ERR.noemail};
    if(!await checkRecovery(acc,email,code))return {err:SB_ERR.code};
    acc.hash=await hashPw(acc.salt,np);await Store.putAcc(key,acc);setSession({key,nick:acc.nick});return {ok:1};
  },
  async rename(pw,nick){
    if(Store.mode==='sb'){const r=await sbRpc('sm_rename',{p_token:sbTok(),p_pw:pw,p_nick:nick});if(!r.ok)return {err:r.err==='bad'?'현재 비밀번호가 맞지 않아요.':sbErr(r.err)};
      setSession({key:r.key,nick:r.nick,token:USER.token});return {ok:1};}
    const old=USER.key,nk=nickKey(nick);const acc=await Store.getAcc(old);
    if(!acc||await hashPw(acc.salt,pw)!==acc.hash)return {err:'현재 비밀번호가 맞지 않아요.'};
    if(nk!==old&&await Store.getAcc(nk))return {err:'이미 있는 닉네임이에요.'};
    await Store.putAcc(nk,Object.assign({},acc,{nick,renamedFrom:acc.nick}));
    for(const tid of TRACKS.map(t=>t.id).concat(['react'])){const r=await Store.getBest(tid,old);if(r){await Store.setBest(tid,nk,Object.assign({},r,{nick}));if(nk!==old)await Store.delBest(tid,old);}}
    for(const gid of ['blocks','g2048']){const r=await Store.getScore(gid,old);if(r){await Store.setScore(gid,nk,Object.assign({},r,{nick}));if(nk!==old)await Store.delScore(gid,old);}}
    const p=await Store.getProfile(old);if(p){await Store.setProfile(nk,Object.assign({},p,{nick}));if(nk!==old)await Store.setProfile(old,null);}
    if(nk!==old)await Store.delAcc(old);
    setSession({key:nk,nick});return {ok:1};
  },
};
