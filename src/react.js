// ===== 게임 4: 반응 속도 (F1 출발 신호) =====
// 빨간불 5개가 1초 간격으로 켜지고, 무작위로 기다렸다가 모두 꺼지는 순간 반응. 꺼지기 전에 누르면 점프 스타트.
const RX={on:false,state:'idle',lit:0,t0:0,outAt:0,timers:[],tries:[],best:null,top:null,mine:null};
function rxClear(){RX.timers.forEach(clearTimeout);RX.timers=[];}
function rxSetLights(n,col){$$('#rxLights .rxpod').forEach((p,k)=>{p.classList.toggle('on',k<n);p.classList.toggle('green',col==='green');});}
function rxMsg(big,small,cls){$('#rxBig').textContent=big;$('#rxBig').className='rxbig '+(cls||'');$('#rxSmall').textContent=small||'';}
function rxArm(){
  if(RX.state==='lights'||RX.state==='wait')return;
  rxClear();RX.state='lights';RX.lit=0;rxSetLights(0);rxMsg('준비','불이 모두 꺼지면 바로 누르세요');rxAudio();
  for(let k=1;k<=5;k++)RX.timers.push(setTimeout(()=>{RX.lit=k;rxSetLights(k);rxSnd('beep');if(k===5){RX.state='wait';
    const hold=200+Math.random()*2800; // 실제 F1처럼 0.2~3초 무작위
    RX.timers.push(setTimeout(rxOut,hold));}},k*1000));
}
function rxOut(){
  // 다음 그림이 그려지는 순간을 출발 시각으로 잡음
  rxSetLights(0);rxSnd('out');
  requestAnimationFrame(()=>{RX.outAt=performance.now();RX.state='go';rxMsg('GO!','','go');if(SET.rxFlash){const a=$('#rxArea');a.classList.remove('goflash');void a.offsetWidth;a.classList.add('goflash');}});
}
function rxPress(ts){
  if(RX.state==='idle'||RX.state==='result'||RX.state==='jump'){rxArm();return;}
  if(RX.state==='lights'||RX.state==='wait'){rxClear();RX.state='jump';rxSetLights(5);$('#rxLights').classList.add('jump');setTimeout(()=>$('#rxLights').classList.remove('jump'),600);
    rxSnd('jump');rxMsg('점프 스타트!','불이 꺼지기 전에 출발했어요. 다시 누르면 재도전','bad');rxAddTry(null);return;}
  if(RX.state==='go'){
    const now=(ts&&ts>RX.outAt-50&&ts<performance.now()+5)?ts:performance.now();
    const ms=Math.max(0,Math.round(now-RX.outAt));RX.state='result';
    if(ms<100){rxMsg(ms+' ms','100ms 미만은 예측 출발로 봐요 (F1 규정과 같은 기준). 무효','bad');rxSnd('jump');rxAddTry(null);return;}
    const [grade,cls]=rxGrade(ms);rxMsg(ms+' ms',grade+' · 다시 누르면 재도전',cls);rxSnd('good',ms);rxAddTry(ms);rxSave(ms);
  }
}
function rxGrade(ms){
  if(ms<170)return ['F1 드라이버급 반응','g1'];if(ms<210)return ['프로 레이서 수준','g2'];if(ms<260)return ['아주 빨라요','g3'];
  if(ms<320)return ['평균보다 빨라요','g4'];if(ms<400)return ['보통이에요','g5'];return ['출발이 늦었어요','g6'];
}
function rxAddTry(ms){
  RX.tries.unshift(ms);RX.tries=RX.tries.slice(0,10);
  const valid=RX.tries.filter(v=>v!=null);
  $('#rxTries').innerHTML=RX.tries.map(v=>`<span class="${v==null?'bad':rxGrade(v)[1]}">${v==null?'무효':v+' ms'}</span>`).join('');
  const last5=valid.slice(0,5);$('#rxAvg').textContent=last5.length?Math.round(last5.reduce((a,b)=>a+b,0)/last5.length)+' ms':'—';
  if(valid.length){const b=Math.min(...valid);if(RX.best==null||b<RX.best)RX.best=b;}
  $('#rxSess').textContent=RX.best!=null?RX.best+' ms':'—';
}
async function rxSave(ms){
  const isPB=RX.mine==null||ms<RX.mine,isTop=!RX.top||ms<RX.top.ms;
  if(USER&&isPB){try{await Store.setBest('react',USER.key,{nick:USER.nick,ms,at:Date.now()});RX.mine=ms;if(isTop)RX.top={nick:USER.nick,ms};rxNote(isTop?`새 1위! ${USER.nick} · ${ms} ms`:`개인 최고 ${ms} ms 저장`,'ok');rxLoadRank();}
    catch(e){rxNote(saveErr(e),'err');}}
  else if(!USER&&isPB){RX.pending=ms;LS.set('smr_guest_react',ms);RX.mine=ms;rxNote(`${ms} ms · 로그인하면 랭킹에 올라가요`,'',true);}
  rxHud();
}
function rxNote(t,cls,form){
  const el=$('#rxNote');el.className='rxnote '+(cls||'');
  el.innerHTML=esc(t)+(form?`<form class="gsave" id="rxSave" autocomplete="off"><div class="gs-row"><input id="rxNick" maxlength="12" placeholder="닉네임" aria-label="닉네임" autocapitalize="off" spellcheck="false"><input id="rxPw" type="password" maxlength="32" placeholder="비밀번호 4자리+" aria-label="비밀번호"></div>
    <div class="gs-row"><button class="btn primary" type="submit">로그인하고 저장</button><button class="btn ghost" type="button" id="rxNew">새로 만들고 저장</button></div><div class="msg" id="rxMsg"></div></form>`:'');
  if(form){const go=async isNew=>{const m=$('#rxMsg');const set=(x,c)=>{m.textContent=x;m.className='msg '+(c||'');};
      if(!await authUser($('#rxNick').value,$('#rxPw').value,isNew,set))return;
      try{const me=await Store.getBest('react',USER.key);const ms=RX.pending;
        if(!me||ms<me.ms){await Store.setBest('react',USER.key,{nick:USER.nick,ms,at:Date.now()});RX.mine=ms;set(`${USER.nick} 이름으로 ${ms} ms 저장했어요.`,'ok');}
        else{RX.mine=me.ms;set(`이미 더 빠른 기록(${me.ms} ms)이 있어요.`,'ok');}
        rxLoadRank();}catch(e){set('저장하지 못했어요.','err');}};
    $('#rxSave').addEventListener('submit',e=>{e.preventDefault();e.stopPropagation();go(false);});$('#rxNew').addEventListener('click',e=>{e.stopPropagation();go(true);});}
}
function rxHud(){
  $('#rxTop').textContent=RX.top?RX.top.ms+' ms':'—';$('#rxTopWho').textContent=RX.top?RX.top.nick:'기록 없음';
  $('#rxMine').textContent=RX.mine!=null?RX.mine+' ms':'—';
}
async function rxLoadRank(){
  const el=$('#rxRank');
  try{await Store.ready;const top=await Store.top('react',20);RX.top=top[0]||null;
    if(USER){const me=await Store.getBest('react',USER.key);RX.mine=me?me.ms:null;}else RX.mine=LS.get('smr_guest_react',null);
    el.innerHTML=top.length?'<table>'+top.map((r,i)=>`<tr class="${USER&&r.key===USER.key?'mine':''}"><td class="p">${i+1}</td><td>${nickCell(r.key,r.nick)}</td><td class="tm">${r.ms} ms</td></tr>`).join('')+'</table>':'<div class="empty">아직 기록이 없어요.</div>';
  }catch(e){el.innerHTML='<div class="empty">랭킹을 불러오지 못했어요.</div>';}
  rxHud();
}
async function openRx(){show('react');RX.on=true;RX.state='idle';rxSetLights(0);rxMsg('누르면 시작',touchOn()?'화면 아무 곳이나 탭':'Space·Enter·아무 키나 누르기');$('#rxNote').innerHTML='';await rxLoadRank();}
function closeRx(){RX.on=false;rxClear();RX.state='idle';}
// 입력: 키보드 아무 키, 화면 탭 (판정은 눌린 순간 기준)
window.addEventListener('keydown',e=>{
  if(!RX.on||$('#react').hidden||(e.target&&e.target.tagName==='INPUT')||e.repeat||modalOpen())return;
  if(e.code==='Escape'||e.key==='Escape'){rxClear();RX.state='idle';rxSetLights(0);rxMsg('누르면 시작','');return;}
  if(e.metaKey||e.ctrlKey||e.altKey||e.key==='Tab')return;
  e.preventDefault();rxPress(e.timeStamp);
},{capture:true});
(function(){const a=$('#rxArea');a.addEventListener('pointerdown',e=>{if(e.target.closest('button,input,a,form'))return;e.preventDefault();rxPress(e.timeStamp);});})();
// 소리
function rxAudio(){if(!gSnd('react'))return;try{RX.ctx=RX.ctx||(typeof G4A!=='undefined'&&G4A.ctx)||(typeof BKA!=='undefined'&&BKA.ctx)||new (window.AudioContext||window.webkitAudioContext)();if(RX.ctx.state==='suspended')RX.ctx.resume();}catch(e){}}
function rxTone(f,d,type,vol,delay){const c=RX.ctx;if(!c)return;const t=c.currentTime+(delay||0),o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.005);g.gain.exponentialRampToValueAtTime(0.0001,t+d);o.connect(g);g.connect(gOut(c,'react'));o.start(t);o.stop(t+d+0.02);}
function rxSnd(k,ms){if(!gSnd('react')||!RX.ctx)return;try{
  if(k==='beep'&&SET.rxBeep)rxTone(880,0.12,'square',0.06);
  if(k==='out'){rxTone(140,0.5,'sawtooth',0.05);rxTone(70,0.6,'sine',0.25);} // 엔진이 터지는 느낌
  if(k==='jump')[0,-5].forEach((s,i)=>rxTone(330*Math.pow(2,s/12),0.25,'sawtooth',0.06,i*0.15));
  if(k==='good'){const hi=ms<210;[0,4,7].concat(hi?[12]:[]).forEach((s,i)=>rxTone(660*Math.pow(2,s/12),0.15,'triangle',0.07,i*0.06));}
}catch(e){}}
