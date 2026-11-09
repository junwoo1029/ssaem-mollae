// ===== 공통: 게임별 소리 · 터치 자동 전환 · 설정 · 프로필 · 추천 =====

// ----- 게임별 소리 (켜기/끄기 + 볼륨). 게임마다 따로 출력 노드를 둬서 볼륨을 바로 반영
function gs(g){return SET.snd[g]||(SET.snd[g]={on:1,vol:0.8});}
function gSnd(g){const s=gs(g);return !!s.on&&s.vol>0.001;}
const OUTS=new Map();
function gOut(ctx,g){let m=OUTS.get(ctx);if(!m){m={};OUTS.set(ctx,m);}
  if(!m[g]){const n=ctx.createGain();n.gain.value=gSnd(g)?gs(g).vol:0;n.connect(ctx.destination);m[g]=n;}return m[g];}
function applyVol(){for(const [ctx,m] of OUTS)for(const g in m){try{m[g].gain.setTargetAtTime(gSnd(g)?gs(g).vol:0,ctx.currentTime,0.02);}catch(e){}}}
function anyCtx(){return (typeof AUD!=='undefined'&&AUD.ctx)||(typeof BKA!=='undefined'&&BKA.ctx)||(typeof G4A!=='undefined'&&G4A.ctx)||(typeof RX!=='undefined'&&RX.ctx)||null;}
function testTone(g){if(!gSnd(g))return;try{let c=anyCtx();if(!c){c=new (window.AudioContext||window.webkitAudioContext)();RX.ctx=c;}
  if(c.state==='suspended')c.resume();const t=c.currentTime,o=c.createOscillator(),q=c.createGain();o.type='triangle';o.frequency.value=660;
  q.gain.setValueAtTime(0.0001,t);q.gain.exponentialRampToValueAtTime(0.12,t+0.01);q.gain.exponentialRampToValueAtTime(0.0001,t+0.18);o.connect(q);q.connect(gOut(c,g));o.start(t);o.stop(t+0.2);}catch(e){}}
function wakeAudio(g){try{if(g==='racer')audioInit();else if(g==='blocks')bkAudio();else if(g==='g2048')g4Audio();else if(g==='react')rxAudio();}catch(e){}}

// ----- 터치 버튼 자동 전환: 휴대폰·패드면 표시, 컴퓨터면 숨김. 자동 모드에서는 키보드를 쓰면 숨기고 화면을 만지면 다시 표시
const TUI={live:isTouchDev};
function touchOn(){return SET.touch==='on'||(SET.touch==='auto'&&TUI.live);}
function refreshTouch(){
  const on=touchOn();document.documentElement.classList.toggle('is-touch',on);
  try{updateTouchVis();}catch(e){} try{bkTouchVis();}catch(e){}
  const pad=$('#g4Pad');if(pad)pad.hidden=!(on&&SET.g4Pad);
  const hint=$('.g4hint');if(hint)hint.textContent=on?'판을 밀거나 아래 방향 버튼으로 움직여요. 같은 숫자가 부딪히면 합쳐져요.':'화살표·WASD로 움직여요 (판을 마우스로 끌어도 돼요). 같은 숫자가 부딪히면 합쳐져요.';
  if(typeof RX!=='undefined'&&RX.state==='idle'&&$('#rxSmall'))$('#rxSmall').textContent=on?'화면 아무 곳이나 탭':'Space·Enter·아무 키나 누르기';
}
window.addEventListener('keydown',e=>{
  if(SET.touch!=='auto'||!TUI.live)return;
  if(e.target&&/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
  if(e.metaKey||e.ctrlKey||e.altKey||/^(Shift|Control|Alt|Meta|Tab|CapsLock|Unidentified)$/.test(e.key||''))return;
  TUI.live=false;refreshTouch();
},true);
window.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!TUI.live){TUI.live=true;refreshTouch();}},true);
// 2048 방향 버튼
$('#g4Pad').addEventListener('pointerdown',e=>{const b=e.target.closest('[data-dir]');if(!b)return;e.preventDefault();g4Audio();g4Move(+b.dataset.dir);b.classList.add('on');setTimeout(()=>b.classList.remove('on'),120);});
$('#g4Pad').addEventListener('contextmenu',e=>e.preventDefault());

// ----- 모달 공통
function modalOpen(){return !$('#settingsOv').hidden||!$('#profileOv').hidden;}
function closeModals(){$('#settingsOv').hidden=true;$('#profileOv').hidden=true;if(CROP)CROP=null;}
for(const id of ['#settingsOv','#profileOv'])$(id).addEventListener('pointerdown',e=>{if(e.target===e.currentTarget)e.currentTarget._bg=true;});
for(const id of ['#settingsOv','#profileOv'])$(id).addEventListener('click',e=>{if(e.target===e.currentTarget&&e.currentTarget._bg)closeModals();e.currentTarget._bg=false;});

// ===== 설정 (지금 있는 게임에 맞는 항목만) =====
const SET_TABS=[['common','공통'],['racer','서킷 타임어택'],['blocks','블록 낙하'],['g2048','2048'],['react','출발 반응']];
let SETCTX=null,SETTAB='common';
function curGame(){
  if(!$('#blocks').hidden)return 'blocks';if(!$('#g48').hidden)return 'g2048';if(!$('#react').hidden)return 'react';
  for(const s of ['#tracks','#garage','#hud','#editor'])if(!$(s).hidden)return 'racer';return null;
}
function openSettings(){
  SETCTX=curGame();SETTAB=SETCTX||'common';
  if(SETCTX==='blocks'&&BKS.state==='play'&&!BKS.paused)bkPause(true);
  if(SETCTX==='react'&&(RX.state==='lights'||RX.state==='wait')){rxClear();RX.state='idle';rxSetLights(0);rxMsg('누르면 시작','');}
  renderSettings();$('#settingsOv').hidden=false;
}
function segRow(id,label,sub,opts,val){
  return `<div class="set-l">${label}${sub?`<small>${sub}</small>`:''}</div><div class="seg" data-set="${id}">${opts.map(([v,t])=>`<button data-v="${v}" class="${String(v)===String(val)?'on':''}">${t}</button>`).join('')}</div>`;
}
const ONOFF=[[1,'켜기'],[0,'끄기']];
function sndRow(g){const s=gs(g),v=Math.round(s.vol*100);
  return `<div class="set-l">사운드<small>켜기/끄기와 볼륨은 이 게임에만 적용돼요.</small></div>
    <div class="sndrow"><div class="seg" data-set="snd:${g}">${ONOFF.map(([k,t])=>`<button data-v="${k}" class="${(s.on?1:0)===k?'on':''}">${t}</button>`).join('')}</div>
    <label class="vol ${s.on?'':'off'}"><span aria-hidden="true">🔊</span><input type="range" min="0" max="100" step="1" value="${v}" data-vol="${g}" aria-label="볼륨"><b>${v}%</b></label></div>`;}
function touchRow(){
  const dev=isTouchDev?'이 기기는 휴대폰·패드로 인식됐어요.':'이 기기는 컴퓨터로 인식됐어요.';
  return segRow('touch','터치 버튼',dev+" '자동'은 휴대폰·패드에서만 보이고, 키보드를 누르면 숨겨졌다가 화면을 만지면 다시 나와요.",[['auto','자동'],['on','항상 표시'],['off','숨김']],SET.touch);
}
const SET_SECTIONS={
  common:()=>touchRow()+segRow('allsnd','모든 게임 소리','게임별 볼륨은 각 게임 탭에서 정해요.',[[1,'모두 켜기'],[0,'모두 끄기']],Object.values(SET.snd).some(s=>s.on)?1:0),
  racer:()=>sndRow('racer')+
    segRow('quality','그래픽 품질',"아이패드·휴대폰이 느리면 '낮음'. 나무·관중석 수, 차 디테일, 그림자, 해상도가 바뀌어요.",[['low','낮음'],['mid','보통'],['high','높음']],SET.quality)+
    segRow('cam','기본 시점','주행 중에는 C 키나 시점 버튼으로도 바꿀 수 있어요.',[['chase','3인칭'],['cockpit','운전석']],SET.cam),
  blocks:()=>sndRow('blocks')+
    segRow('bkGhost','고스트 블록','블록이 떨어질 자리를 흐리게 보여줘요.',ONOFF,SET.bkGhost)+
    segRow('bkShake','화면 흔들림','내려꽂기·줄 지우기 때 판이 흔들려요.',ONOFF,SET.bkShake)+
    segRow('bkGrid','격자선','',ONOFF,SET.bkGrid)+
    segRow('bkDas','좌우 연속 이동 속도','← → 를 누르고 있을 때 블록이 미끄러지는 빠르기',[['slow','느리게'],['mid','보통'],['fast','빠르게']],SET.bkDas),
  g2048:()=>sndRow('g2048')+
    segRow('g4Anim','타일 움직임 효과','끄면 타일이 바로 자리를 바꿔요 (느린 기기용).',ONOFF,SET.g4Anim)+
    segRow('g4Pad','터치 방향 버튼','휴대폰·패드에서 판 아래에 ▲◀▼▶ 버튼을 보여줘요. 밀기는 항상 돼요.',ONOFF,SET.g4Pad),
  react:()=>sndRow('react')+
    segRow('rxBeep','신호등 켜짐 소리','불이 하나씩 켜질 때 삑 소리. 끄면 눈으로만 반응해요.',ONOFF,SET.rxBeep)+
    segRow('rxFlash','출발 순간 화면 번쩍임','',ONOFF,SET.rxFlash),
};
function renderSettings(){
  $('#setFor').textContent=SETCTX?(SET_TABS.find(t=>t[0]===SETCTX)||['',''])[1]:'';
  $('#setTabs').hidden=!!SETCTX;
  $('#setTabs').innerHTML=SET_TABS.map(([k,t])=>`<button data-tab="${k}" class="${k===SETTAB?'on':''}">${t}</button>`).join('');
  $('#setBody').innerHTML=SET_SECTIONS[SETTAB]()+(SETCTX?`<div class="setsep"></div>`+touchRow():'');
}
$('#settingsOv').addEventListener('click',e=>{
  const tab=e.target.closest('[data-tab]');if(tab){SETTAB=tab.dataset.tab;renderSettings();return;}
  const b=e.target.closest('.seg button');if(!b||!b.parentElement.dataset.set)return;
  const k=b.parentElement.dataset.set,v=b.dataset.v;
  if(k==='touch'){SET.touch=v;if(v==='auto')TUI.live=isTouchDev;refreshTouch();}
  else if(k==='allsnd'){for(const g in SET.snd)SET.snd[g].on=+v;applyVol();if(+v)wakeAudio(SETCTX||'react');}
  else if(k.startsWith('snd:')){const g=k.slice(4);gs(g).on=+v;if(+v&&gs(g).vol<0.05)gs(g).vol=0.6;applyVol();if(+v){wakeAudio(g);testTone(g);}}
  else if(k==='quality'){SET.quality=v;applyQuality();if(GAR.scene)rebuildGarageCar();
    if(RACE.scene&&RACE.car){const old=RACE.car;RACE.scene.remove(old.root);old.dispose();RACE.car=buildCar(Q().car,PAINTS[paintIdx].c,RACE.env);RACE.car.blob.visible=!Q().shadow;RACE.scene.add(RACE.car.root);}
    if(RACE.scene)toast('나무·건물 수는 다음 주행부터 바뀌어요');}
  else if(k==='cam'){SET.cam=v;RACE.camMode=v;}
  else if(k==='bkDas'){SET.bkDas=v;}
  else {SET[k]=+v;if(k==='g4Anim')$('#g48').classList.toggle('noanim',!SET.g4Anim);if(k==='g4Pad')refreshTouch();}
  saveSet();renderSettings();
});
$('#settingsOv').addEventListener('input',e=>{const r=e.target.closest('[data-vol]');if(!r)return;const g=r.dataset.vol;
  gs(g).vol=r.value/100;gs(g).on=r.value>0?1:0;applyVol();r.nextElementSibling.textContent=r.value+'%';
  const seg=$(`[data-set="snd:${g}"]`);if(seg)seg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',+x.dataset.v===gs(g).on));r.closest('.vol').classList.toggle('off',!gs(g).on);});
$('#settingsOv').addEventListener('change',e=>{const r=e.target.closest('[data-vol]');if(!r)return;saveSet();wakeAudio(r.dataset.vol);testTone(r.dataset.vol);});
$('#g48').classList.toggle('noanim',!SET.g4Anim);

// ===== 프로필 사진 (공유 저장소의 profiles/<계정키>) =====
const AVC=new Map(); // key -> Promise<profile|null>
function avGet(key){if(!AVC.has(key))AVC.set(key,Store.ready.then(()=>Store.getProfile(key)).catch(()=>null));return AVC.get(key);}
function nickCell(key,nick){return `<span class="nk"><span class="av xs" data-avk="${esc(key)}">${esc((nick||'?')[0])}</span><span>${esc(nick)}</span></span>`;}
function hydrateAv(root){
  (root||document).querySelectorAll('[data-avk]:not([data-avd])').forEach(el=>{el.dataset.avd='1';
    avGet(el.dataset.avk).then(p=>{if(p&&p.img){el.style.backgroundImage=`url("${p.img}")`;el.classList.add('img');}});});
}
new MutationObserver(()=>{clearTimeout(hydrateAv._t);hydrateAv._t=setTimeout(()=>hydrateAv(),40);}).observe(document.body,{childList:true,subtree:true});

// ===== 프로필 화면 =====
let CROP=null;
const maskEmail=m=>{const [u,d]=m.split('@');return (u.length<=2?u[0]+'*':u.slice(0,2)+'*'.repeat(Math.min(6,u.length-2)))+'@'+d;};
const normEmail=m=>String(m||'').trim().toLowerCase();
const okEmail=m=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m);
const normCode=c=>String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
function newCode(){const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const b=new Uint32Array(8);crypto.getRandomValues(b);const s=[...b].map(x=>A[x%A.length]).join('');return s.slice(0,4)+'-'+s.slice(4);}
function pmsg(id){const m=$(id);return (t,c)=>{m.textContent=t;m.className='msg '+(c||'');};}

async function openProfile(){
  if(!USER){toast('먼저 로그인해 주세요');return;}
  $('#profileOv').hidden=false;
  $('#profBody').innerHTML='<div class="empty" style="padding:30px;text-align:center;color:var(--muted)">불러오는 중…</div>';
  let acc=null,prof=null;
  let infoErr='계정 정보를 불러오지 못했어요.';
  try{await Store.ready;const [i,p]=await Promise.all([Acc.info(),Store.getProfile(USER.key).catch(()=>null)]);prof=p;
    if(i.err){infoErr=i.err;if(Store.mode==='sb'&&/로그인이 풀렸/.test(i.err)){Acc.logout();renderLogin();}}else acc={created:i.created,emailMask:i.emailMask,emailHash:i.hasEmail};}catch(e){}
  if(!acc){$('#profBody').innerHTML='<p>'+esc(infoErr)+'</p><button class="btn ghost" data-act="close-profile">닫기</button>';return;}
  const ratio=(prof&&prof.ratio)||'1/1';
  $('#profBody').innerHTML=`
    <div class="sethead"><h3>프로필 설정</h3><button class="iconbtn sm" data-act="close-profile" aria-label="닫기">✕</button></div>
    <div class="pf-top">
      <div class="pf-pic" style="aspect-ratio:${ratio}" ${prof&&prof.img?`data-img="1"`:''}>${prof&&prof.img?`<img src="${prof.img}" alt="프로필 사진">`:`<span>${esc(USER.nick[0])}</span>`}</div>
      <div class="pf-id"><div class="nm">${esc(USER.nick)}</div><div class="sub">${acc.created?new Date(acc.created).toLocaleDateString('ko-KR')+' 가입':''}</div>
        <div class="row"><label class="btn primary sm filebtn">사진 올리기<input type="file" accept="image/*" id="pfFile" hidden></label>${prof&&prof.img?'<button class="btn ghost sm" id="pfDel">사진 지우기</button>':''}</div>
        <div class="msg" id="pfPicMsg"></div></div>
    </div>
    <div class="cropper" id="cropper" hidden>
      <div class="set-l">사진 비율<small>틀 안에 보이는 부분이 프로필이 돼요. 끌어서 위치를 옮기고, 슬라이더나 두 손가락(휠)으로 크기를 바꿔요.</small></div>
      <div class="seg" id="cropRatio"><button data-r="1/1" class="on">1:1 정사각</button><button data-r="4/5">4:5 세로</button><button data-r="3/4">3:4 세로</button><button data-r="16/9">16:9 가로</button></div>
      <div class="cropstage" id="cropStage"><canvas id="cropCv"></canvas></div>
      <label class="vol"><span aria-hidden="true">🔍</span><input type="range" id="cropZoom" min="100" max="400" value="100" aria-label="확대"><b id="cropZv">1.0×</b></label>
      <div class="row"><button class="btn primary" id="cropOk">이 비율로 저장</button><button class="btn ghost" id="cropCancel">취소</button></div>
    </div>

    <section class="pf-sec"><h4>이메일 인증 <span class="label">비밀번호 찾기용</span></h4>
      ${acc.emailHash?`<div class="pf-state ok">✓ 인증된 이메일: <b>${esc(acc.emailMask||'')}</b></div>`:`<div class="pf-state">아직 등록한 이메일이 없어요. 등록해 두면 비밀번호를 잊었을 때 다시 정할 수 있어요.</div>`}
      <div class="field"><label for="pfEmail">${acc.emailHash?'다른 이메일로 바꾸기':'이메일 주소'}</label><input id="pfEmail" type="email" inputmode="email" autocapitalize="off" spellcheck="false" placeholder="name@example.com"></div>
      <button class="btn ghost" id="pfSend" style="width:100%">인증 코드 받기</button>
      <div class="pf-code" id="pfCodeBox" hidden></div>
      <div class="msg" id="pfMailMsg"></div>
    </section>

    <section class="pf-sec"><h4>닉네임 바꾸기</h4>
      <div class="field"><label for="pfNick">새 닉네임 (2~12자)</label><input id="pfNick" maxlength="12" autocapitalize="off" spellcheck="false" placeholder="${esc(USER.nick)}"></div>
      <div class="field"><label for="pfNickPw">현재 비밀번호</label><input id="pfNickPw" type="password" maxlength="32"></div>
      <button class="btn ghost" id="pfNickGo" style="width:100%">닉네임 바꾸기</button>
      <div class="msg" id="pfNickMsg">지금까지의 모든 게임 기록과 프로필 사진이 새 닉네임으로 옮겨져요.</div>
    </section>

    <section class="pf-sec"><h4>비밀번호 바꾸기</h4>
      <div class="seg" id="pwWay"><button data-w="pw" class="on">현재 비밀번호로 확인</button><button data-w="mail">이메일 인증으로 확인</button></div>
      <div id="pwByPw"><div class="field"><label for="pfOld">현재 비밀번호</label><input id="pfOld" type="password" maxlength="32"></div></div>
      <div id="pwByMail" hidden>${acc.emailHash?`<div class="field"><label for="pfPwMail">인증한 이메일</label><input id="pfPwMail" type="email" autocapitalize="off" spellcheck="false"></div>`:'<div class="pf-state">이메일 인증을 먼저 해 주세요.</div>'}</div>
      <div class="field"><label for="pfNew">새 비밀번호 (4자리 이상)</label><input id="pfNew" type="password" maxlength="32"></div>
      <div class="field"><label for="pfNew2">새 비밀번호 확인</label><input id="pfNew2" type="password" maxlength="32"></div>
      <button class="btn ghost" id="pfPwGo" style="width:100%">비밀번호 바꾸기</button>
      <div class="msg" id="pfPwMsg"></div>
    </section>`;
  // 사진
  $('#pfFile').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(f)startCrop(f);e.target.value='';});
  if($('#pfDel'))$('#pfDel').addEventListener('click',async()=>{try{await Store.setProfile(USER.key,null);AVC.delete(USER.key);refreshAvatars();openProfile();toast('프로필 사진을 지웠어요');}catch(e){pmsg('#pfPicMsg')('지우지 못했어요.','err');}});
  // 이메일 인증
  $('#pfSend').addEventListener('click',()=>startEmailVerify());
  // 닉네임
  $('#pfNickGo').addEventListener('click',()=>renameUser($('#pfNick').value,$('#pfNickPw').value,pmsg('#pfNickMsg')));
  // 비밀번호
  $('#pwWay').addEventListener('click',e=>{const b=e.target.closest('[data-w]');if(!b)return;$$('#pwWay button').forEach(x=>x.classList.toggle('on',x===b));
    $('#pwByPw').hidden=b.dataset.w!=='pw';$('#pwByMail').hidden=b.dataset.w!=='mail';});
  $('#pfPwGo').addEventListener('click',()=>changePw(pmsg('#pfPwMsg')));
}
function refreshAvatars(){$$('[data-avk]').forEach(el=>{delete el.dataset.avd;el.style.backgroundImage='';el.classList.remove('img');});renderLogin();hydrateAv();}

// ----- 사진 자르기
function startCrop(file){
  const set=pmsg('#pfPicMsg');
  if(!/^image\//.test(file.type)&&!/\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(file.name)){set('사진 파일만 올릴 수 있어요.','err');return;}
  if(file.size>25*1024*1024){set('25MB보다 작은 사진을 골라 주세요.','err');return;}
  const url=URL.createObjectURL(file);const img=new Image();
  img.onload=()=>{CROP={img,ratio:'1/1',z:1,ox:0,oy:0,ptrs:new Map()};$('#cropper').hidden=false;set('');$$('#cropRatio button').forEach(b=>b.classList.toggle('on',b.dataset.r==='1/1'));$('#cropZoom').value=100;cropLayout();
    $('#cropper').scrollIntoView({block:'nearest',behavior:'smooth'});};
  img.onerror=()=>set('이 사진은 열 수 없어요. JPG나 PNG로 다시 골라 주세요.','err');
  img.src=url;
}
function cropDims(){const [a,b]=CROP.ratio.split('/').map(Number);const W=Math.min(340,$('#cropStage').clientWidth||300);let w=W,h=W*b/a;if(h>380){h=380;w=h*a/b;}return {w:Math.round(w),h:Math.round(h)};}
function cropBase(w,h){const i=CROP.img;return Math.max(w/i.naturalWidth,h/i.naturalHeight);} // 틀을 꽉 채우는 최소 배율
function cropClamp(w,h){const s=cropBase(w,h)*CROP.z,iw=CROP.img.naturalWidth*s,ih=CROP.img.naturalHeight*s;
  const mx=Math.max(0,(iw-w)/2),my=Math.max(0,(ih-h)/2);CROP.ox=clamp(CROP.ox,-mx,mx);CROP.oy=clamp(CROP.oy,-my,my);}
function cropDraw(cv,w,h,scale){const x=cv.getContext('2d');const s=cropBase(w,h)*CROP.z;const iw=CROP.img.naturalWidth*s,ih=CROP.img.naturalHeight*s;
  x.fillStyle='#0c0f14';x.fillRect(0,0,cv.width,cv.height);x.imageSmoothingQuality='high';
  x.drawImage(CROP.img,((w-iw)/2+CROP.ox)*scale,((h-ih)/2+CROP.oy)*scale,iw*scale,ih*scale);}
function cropLayout(){if(!CROP)return;const {w,h}=cropDims();const cv=$('#cropCv'),dpr=Math.min(2,window.devicePixelRatio||1);
  cv.width=w*dpr;cv.height=h*dpr;cv.style.width=w+'px';cv.style.height=h+'px';cropClamp(w,h);cropDraw(cv,w,h,dpr);$('#cropZv').textContent=CROP.z.toFixed(1)+'×';}
$('#profileOv').addEventListener('click',e=>{
  const r=e.target.closest('#cropRatio [data-r]');if(r&&CROP){CROP.ratio=r.dataset.r;$$('#cropRatio button').forEach(b=>b.classList.toggle('on',b===r));cropLayout();return;}
  if(e.target.closest('#cropCancel')){CROP=null;$('#cropper').hidden=true;return;}
  if(e.target.closest('#cropOk'))saveCrop();
});
$('#profileOv').addEventListener('input',e=>{if(e.target.id==='cropZoom'&&CROP){CROP.z=e.target.value/100;cropLayout();}});
$('#profileOv').addEventListener('pointerdown',e=>{if(e.target.id!=='cropCv'||!CROP)return;e.preventDefault();e.target.setPointerCapture(e.pointerId);CROP.ptrs.set(e.pointerId,[e.clientX,e.clientY]);CROP.pinch=null;});
$('#profileOv').addEventListener('pointermove',e=>{if(!CROP||!CROP.ptrs.has(e.pointerId))return;const prev=CROP.ptrs.get(e.pointerId);CROP.ptrs.set(e.pointerId,[e.clientX,e.clientY]);
  if(CROP.ptrs.size>=2){const [a,b]=[...CROP.ptrs.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(CROP.pinch){CROP.z=clamp(CROP.z*d/CROP.pinch,1,4);$('#cropZoom').value=Math.round(CROP.z*100);}CROP.pinch=d;}
  else{CROP.ox+=e.clientX-prev[0];CROP.oy+=e.clientY-prev[1];}cropLayout();});
for(const ev of ['pointerup','pointercancel'])$('#profileOv').addEventListener(ev,e=>{if(CROP){CROP.ptrs.delete(e.pointerId);CROP.pinch=null;}});
$('#profileOv').addEventListener('wheel',e=>{if(e.target.id!=='cropCv'||!CROP)return;e.preventDefault();CROP.z=clamp(CROP.z*Math.exp(-e.deltaY*0.002),1,4);$('#cropZoom').value=Math.round(CROP.z*100);cropLayout();},{passive:false});
async function saveCrop(){
  const set=pmsg('#pfPicMsg');if(!CROP)return;
  const {w,h}=cropDims();const long=360,k=long/Math.max(w,h);const cv=document.createElement('canvas');cv.width=Math.round(w*k);cv.height=Math.round(h*k);
  cropDraw(cv,w,h,k);let q=0.86,url=cv.toDataURL('image/jpeg',q);while(url.length>140000&&q>0.4){q-=0.1;url=cv.toDataURL('image/jpeg',q);}
  set('저장하는 중…');
  try{await Store.setProfile(USER.key,{img:url,ratio:CROP.ratio,nick:USER.nick,at:Date.now()});AVC.delete(USER.key);CROP=null;refreshAvatars();await openProfile();toast('프로필 사진을 바꿨어요');}
  catch(e){set(saveErr(e),'err');}
}

// ----- 이메일 인증 (복구 코드 방식)
// 이 페이지에는 메일 서버가 없어서 직접 메일을 보낼 수 없음 → 복구 코드를 만들어 사용자의 메일 앱으로 자기 메일함에 보내 두게 하고,
// 코드를 다시 입력해 확인되면 이메일(해시)과 코드(해시)를 계정에 저장. 비밀번호를 잊으면 이메일+코드로 다시 정함.
async function startEmailVerify(){
  const set=pmsg('#pfMailMsg');const email=normEmail($('#pfEmail').value);
  if(!okEmail(email)){set('이메일 주소를 정확히 적어 주세요.','err');return;}
  const code=newCode();
  const subj=encodeURIComponent('[쌤몰래] 비밀번호 복구 코드');
  const body=encodeURIComponent(`쌤몰래 닉네임: ${USER.nick}\n복구 코드: ${code}\n\n비밀번호를 잊으면 로그인 화면의 '비밀번호를 잊었어요'에서 이 이메일 주소와 복구 코드를 입력하세요.\n이 메일은 지우지 말고 보관해 주세요.`);
  const box=$('#pfCodeBox');box.hidden=false;
  box.innerHTML=`<div class="pf-steps"><b>1</b> 아래 버튼을 눌러 내 메일함으로 코드를 보내 두세요 <small>(메일 앱이 열려요. 받는 사람이 ${esc(email)}인지 확인하고 보내기)</small></div>
    <a class="btn primary" style="width:100%" id="pfMailto" href="mailto:${encodeURIComponent(email)}?subject=${subj}&body=${body}">메일 앱으로 코드 보내기</a>
    <div class="pf-steps"><b>2</b> 받은 메일에 있는 복구 코드를 입력하면 인증이 끝나요</div>
    <div class="row"><input id="pfCodeIn" maxlength="12" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX" style="flex:1"><button class="btn ghost" id="pfCodeOk">인증 확인</button></div>
    <details class="pf-alt"><summary>메일 앱이 안 열려요</summary>복구 코드: <b class="code">${code}</b> <button class="btn ghost sm" id="pfCopy">복사</button><br><small>이 코드를 직접 메일이나 메모에 적어 두세요. 이 창을 닫으면 다시 볼 수 없어요.</small></details>`;
  set('');
  $('#pfCopy').addEventListener('click',()=>{try{navigator.clipboard.writeText(code);toast('복사했어요');}catch(e){}});
  $('#pfCodeOk').addEventListener('click',async()=>{
    if(normCode($('#pfCodeIn').value)!==normCode(code)){set('코드가 맞지 않아요. 메일에 있는 코드를 그대로 적어 주세요.','err');return;}
    set('저장하는 중…');
    try{const r=await Acc.setEmail(email,code);if(r.err){set(r.err,'err');return;}toast('이메일 인증을 마쳤어요');openProfile();}
    catch(e){set('저장하지 못했어요.','err');}
  });
}
async function checkRecovery(acc,email,code){
  if(!acc||!acc.emailHash||!acc.recHash)return false;
  return (await hashPw(acc.salt,'email|'+normEmail(email)))===acc.emailHash&&(await hashPw(acc.salt,'rec|'+normCode(code)))===acc.recHash;
}

// ----- 비밀번호 바꾸기
async function changePw(set){
  const byMail=!$('#pwByMail').hidden;const np=$('#pfNew').value,np2=$('#pfNew2').value;
  if(np.length<4){set('새 비밀번호는 4자리 이상으로 정해 주세요.','err');return;}
  if(np!==np2){set('새 비밀번호 두 칸이 서로 달라요.','err');return;}
  set('확인하는 중…');
  try{
    if(byMail&&!$('#pfPwMail')){set('이메일 인증을 먼저 해 주세요.','err');return;}
    const r=await Acc.changePw(byMail?{email:normEmail($('#pfPwMail').value)}:{old:$('#pfOld').value},np);
    if(r.err){set(r.err,'err');return;}
    ['#pfOld','#pfNew','#pfNew2','#pfPwCode'].forEach(id=>{if($(id))$(id).value='';});set('비밀번호를 바꿨어요.','ok');toast('비밀번호를 바꿨어요');
  }catch(e){set('저장하지 못했어요.','err');}
}

// ----- 닉네임 바꾸기 (계정·기록·사진을 새 이름으로 옮김)
async function renameUser(nick,pw,set){
  nick=nick.trim();
  if(!/^[가-힣a-zA-Z0-9_]{2,12}$/.test(nick)){set('닉네임은 2~12자의 한글, 영문, 숫자, _ 만 쓸 수 있어요.','err');return;}
  if(badNick(nick)){set('쓸 수 없는 단어가 들어 있어요. 다른 닉네임을 정해 주세요.','err');return;}
  if(nick===USER.nick){set('지금 닉네임과 같아요.','err');return;}
  set('확인하는 중…');
  try{
    const old=USER.key;set('기록을 옮기는 중…');
    const r=await Acc.rename(pw,nick);if(r.err){set(r.err,'err');return;}
    AVC.delete(old);AVC.delete(USER.key);
    toast(`닉네임을 ${nick}(으)로 바꿨어요`);refreshAvatars();openProfile();
  }catch(e){set(Store.mode==='cloud'?'옮기는 중 문제가 생겼어요. 다시 시도해 주세요.':'저장하지 못했어요.','err');}
}

// ----- 비밀번호 찾기 (로그아웃 상태)
function openForgot(){
  $('#profileOv').hidden=false;
  $('#profBody').innerHTML=`<div class="sethead"><h3>비밀번호 찾기</h3><button class="iconbtn sm" data-act="close-profile" aria-label="닫기">✕</button></div>
    <p class="pf-state">프로필에서 이메일 인증을 해 둔 계정만 다시 정할 수 있어요. 인증할 때 내 메일함에 보내 둔 <b>복구 코드</b>가 필요해요.</p>
    <div class="field"><label for="fgNick">닉네임</label><input id="fgNick" maxlength="12" autocapitalize="off" spellcheck="false"></div>
    <div class="field"><label for="fgMail">인증한 이메일</label><input id="fgMail" type="email" autocapitalize="off" spellcheck="false"></div>
    <div class="field"><label for="fgCode">복구 코드</label><input id="fgCode" maxlength="12" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX"></div>
    <div class="field"><label for="fgNew">새 비밀번호 (4자리 이상)</label><input id="fgNew" type="password" maxlength="32"></div>
    <div class="field"><label for="fgNew2">새 비밀번호 확인</label><input id="fgNew2" type="password" maxlength="32"></div>
    <button class="btn primary" id="fgGo" style="width:100%">비밀번호 다시 정하기</button><div class="msg" id="fgMsg"></div>`;
  $('#fgGo').addEventListener('click',async()=>{const set=pmsg('#fgMsg');const nick=$('#fgNick').value.trim(),np=$('#fgNew').value;
    if(np.length<4){set('새 비밀번호는 4자리 이상으로 정해 주세요.','err');return;}if(np!==$('#fgNew2').value){set('새 비밀번호 두 칸이 서로 달라요.','err');return;}
    set('확인하는 중…');
    try{await Store.ready;const r=await Acc.recover(nick,$('#fgMail').value,$('#fgCode').value,np);if(r.err){set(r.err,'err');return;}
      closeModals();renderLogin();toast('비밀번호를 다시 정하고 로그인했어요');
    }catch(e){set('저장하지 못했어요.','err');}});
}

// ===== 홈: 추천 게임 (돌아가며 하나씩) =====
const REC={i:0,t:null,hover:false};
const REC_WHY={racer:'실제 서킷에서 랩타임 경쟁',blocks:'쉬는 시간 10분에 딱',g2048:'머리 식히기 좋은 퍼즐',react:'5초면 끝나는 순발력 대결'};
function renderRec(){
  const el=$('#recCard');if(!el||!GAMES.length)return;const g=GAMES[REC.i%GAMES.length];
  el.dataset.act=g.act;el.dataset.game=g.id;el.setAttribute('aria-label','추천 게임: '+g.title+' 열기');
  el.innerHTML=`<div class="rc-in"><div class="rc-head"><span class="label">오늘의 추천</span><span class="rc-dots">${GAMES.map((_,k)=>`<i class="${k===REC.i%GAMES.length?'on':''}"></i>`).join('')}</span></div>
    <div class="rc-art">${g.art()}</div><div class="rc-t">${esc(g.title)}</div><div class="rc-d">${esc(REC_WHY[g.id]||g.desc)}</div><div class="rc-go">바로 하기 ›</div></div>`;
}
function recNext(){if(REC.hover||$('#home').hidden)return;REC.i=(REC.i+1)%GAMES.length;const el=$('#recCard');el.classList.add('swap');setTimeout(()=>{renderRec();el.classList.remove('swap');},260);}
REC.i=Math.floor(Math.random()*GAMES.length);
try{renderRec();}catch(e){}
REC.t=setInterval(recNext,4200);
$('#recCard').addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')REC.hover=true;});
$('#recCard').addEventListener('pointerleave',()=>{REC.hover=false;});
refreshTouch();
// Esc로 설정·프로필 창 닫기 (입력칸에 커서가 있어도)
window.addEventListener('keydown',e=>{if((e.key==='Escape'||e.code==='Escape')&&modalOpen()){e.preventDefault();e.stopImmediatePropagation();closeModals();}},true);
