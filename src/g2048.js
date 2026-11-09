// ===== 게임 3: 2048 =====
const G4={N:4,tiles:[],id:0,score:0,over:false,won:false,keepGoing:false,busy:false,top:null,mine:null,best:0,on:false,moves:0};
function g4Empty(){const e=[];for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(!G4.tiles.some(t=>!t.gone&&t.r===r&&t.c===c))e.push([r,c]);return e;}
function g4Spawn(){const e=g4Empty();if(!e.length)return;const [r,c]=e[Math.floor(Math.random()*e.length)];G4.tiles.push({id:++G4.id,v:Math.random()<0.9?2:4,r,c,isNew:true});}
function g4Start(){
  G4.tiles=[];G4.score=0;G4.over=false;G4.won=false;G4.keepGoing=false;G4.moves=0;$('#g4Over').hidden=true;
  g4Spawn();g4Spawn();g4Render(true);g4Hud();g4Audio();
}
function g4At(r,c){return G4.tiles.find(t=>!t.gone&&t.r===r&&t.c===c);}
function g4Move(dir){ // 0 위,1 오른쪽,2 아래,3 왼쪽
  if(G4.over||G4.busy||(G4.won&&!G4.keepGoing))return;
  const vec=[[-1,0],[0,1],[1,0],[0,-1]][dir];
  const order=[0,1,2,3];const rows=vec[0]===1?order.slice().reverse():order,cols=vec[1]===1?order.slice().reverse():order;
  G4.tiles=G4.tiles.filter(t=>!t.gone);G4.tiles.forEach(t=>{t.merged=false;t.isNew=false;t.from=null;});
  let moved=false,gain=0,maxMerge=0;
  for(const r of rows)for(const c of cols){
    const t=g4At(r,c);if(!t)continue;
    let nr=r,nc=c;
    while(true){const rr=nr+vec[0],cc=nc+vec[1];if(rr<0||rr>3||cc<0||cc>3)break;const o=g4At(rr,cc);
      if(!o){nr=rr;nc=cc;continue;}
      if(o.v===t.v&&!o.merged&&!o.mergeLock){ // 합치기
        t.r=rr;t.c=cc;t.gone=true;o.v*=2;o.merged=true;o.mergeLock=true;gain+=o.v;maxMerge=Math.max(maxMerge,o.v);moved=true;nr=null;break;}
      break;}
    if(nr!==null&&(nr!==r||nc!==c)){t.r=nr;t.c=nc;moved=true;}
  }
  G4.tiles.forEach(t=>delete t.mergeLock);
  if(!moved){g4Bump(dir);return;}
  G4.moves++;G4.score+=gain;
  G4.busy=true;g4Render();
  if(gain)g4Float('+'+gain.toLocaleString(),maxMerge);
  g4Snd(gain?'merge':'slide',maxMerge);
  if(maxMerge>=128)g4Shake(maxMerge);
  setTimeout(()=>{G4.tiles=G4.tiles.filter(t=>!t.gone);g4Spawn();g4Render();G4.busy=false;g4Hud();
    if(maxMerge>=2048&&!G4.won){G4.won=true;g4Snd('win');setTimeout(()=>g4ShowOver(true),500);}
    else if(!g4CanMove()){G4.over=true;g4Snd('over');setTimeout(()=>g4ShowOver(false),700);}
  },115);
}
function g4CanMove(){if(g4Empty().length)return true;for(let r=0;r<4;r++)for(let c=0;c<4;c++){const t=g4At(r,c);for(const [dr,dc] of [[0,1],[1,0]]){const o=g4At(r+dr,c+dc);if(o&&o.v===t.v)return true;}}return false;}
// ----- 표시
const G4_TIER={2:'t2',4:'t4',8:'t8',16:'t16',32:'t32',64:'t64',128:'t128',256:'t256',512:'t512',1024:'t1024',2048:'t2048'};
function g4Render(instant){
  const layer=$('#g4Tiles');const seen=new Set();
  for(const t of G4.tiles){seen.add(t.id);let el=layer.querySelector(`[data-id="${t.id}"]`);
    if(!el){el=document.createElement('div');el.className='g4t';el.dataset.id=t.id;el.innerHTML='<span></span>';layer.appendChild(el);if(instant||t.isNew)el.style.transition='none';}
    el.style.setProperty('--r',t.r);el.style.setProperty('--c',t.c);
    const tier=G4_TIER[t.v]||'tmax';const digits=String(t.v).length;
    el.className='g4t '+tier+' d'+digits+(t.isNew?' spawn':'')+(t.merged&&!t.gone?' pop':'')+(t.gone?' gone':'');
    el.querySelector('span').textContent=t.v;
    if(el.style.transition==='none'){void el.offsetWidth;el.style.transition='';}
  }
  layer.querySelectorAll('.g4t').forEach(el=>{if(!seen.has(+el.dataset.id))el.remove();});
}
function g4Hud(){
  $('#g4Score').textContent=G4.score.toLocaleString();
  const best=Math.max(G4.mine||0,G4.score);$('#g4Best').textContent=best?best.toLocaleString():'—';
  const top=G4.top,beat=top&&G4.score>top.score;
  $('#g4Top').textContent=top?(beat?G4.score:top.score).toLocaleString():(G4.score?G4.score.toLocaleString():'—');
  $('#g4TopWho').textContent=top?(beat?'지금 내가 1위!':top.nick):(G4.score?'지금 내가 1위!':'기록 없음');
  $('#g4Top').classList.toggle('beat',!!beat||(!top&&G4.score>0));
  const mx=Math.max(0,...G4.tiles.filter(t=>!t.gone).map(t=>t.v));$('#g4Max').textContent=mx||'—';
}
function g4Float(t,v){const el=document.createElement('div');el.className='g4float'+(v>=128?' big':'');el.textContent=t;$('#g4ScoreBox').appendChild(el);setTimeout(()=>el.remove(),900);}
function g4Shake(v){const b=$('#g4Board');b.classList.remove('shake');void b.offsetWidth;b.style.setProperty('--sh',Math.min(10,2+Math.log2(v)-6)+'px');b.classList.add('shake');}
function g4Bump(dir){const b=$('#g4Board');b.dataset.bump=dir;b.classList.remove('bump');void b.offsetWidth;b.classList.add('bump');}
// ----- 열기/랭킹/결과
async function openG4(){show('g48');G4.on=true;if(!G4.tiles.length)g4Start();else{g4Render(true);g4Hud();}await g4LoadRank();}
function closeG4(){G4.on=false;}
async function g4LoadRank(){
  const el=$('#g4Rank');
  try{await Store.ready;const top=await Store.topScore('g2048',20);G4.top=top[0]||null;
    G4.mine=null;if(USER){const me=await Store.getScore('g2048',USER.key);G4.mine=me?me.score:null;}else G4.mine=LS.get('smr_guest_g2048',null);
    el.innerHTML=top.length?'<table>'+top.map((r,i)=>`<tr class="${USER&&r.key===USER.key?'mine':''}"><td class="p">${i+1}</td><td>${nickCell(r.key,r.nick)}</td><td class="lv">${r.maxTile||''}</td><td class="tm">${r.score.toLocaleString()}</td></tr>`).join('')+'</table>':'<div class="empty">아직 기록이 없어요.</div>';
  }catch(e){el.innerHTML='<div class="empty">랭킹을 불러오지 못했어요.</div>';}
  g4Hud();
}
async function g4ShowOver(win){
  const score=G4.score,top=G4.top,prev=G4.mine,isPB=score>0&&(prev==null||score>prev),isTop=score>0&&(!top||score>top.score);
  const maxTile=Math.max(...G4.tiles.map(t=>t.v));
  $('#g4OverT').textContent=win?'2048 달성!':'더 이상 움직일 수 없어요';
  $('#g4Final').textContent=score.toLocaleString();$('#g4Final').className='laptime'+(isTop?' tr':(isPB?' pb':''));
  let saved=false,err=null,rank=null;const rec={score,maxTile,moves:G4.moves,at:Date.now()};
  if(USER&&isPB){try{await Store.setScore('g2048',USER.key,Object.assign({nick:USER.nick},rec));saved=true;G4.mine=score;}catch(e){err=saveErr(e);}}
  if(USER&&score>0){try{rank=await Store.rankScore('g2048',G4.mine??score);}catch(e){}}
  if(!USER&&isPB){LS.set('smr_guest_g2048',score);G4.mine=score;}
  let badges='';if(isTop)badges+=USER&&saved?`<span class="badge tr">새 최고 점수 · ${esc(USER.nick)}</span>`:'<span class="badge tr">최고 점수보다 높아요</span>';
  if(isPB)badges+='<span class="badge pb">개인 최고</span>';if(!badges)badges=`<span class="badge n">최고 타일 ${maxTile}</span>`;
  $('#g4Badges').innerHTML=badges;
  let list=`<span>점수</span><b>${score.toLocaleString()}</b><span>최고 타일 · 이동</span><b>${maxTile} · ${G4.moves}</b><span>내 최고</span><b>${G4.mine!=null?G4.mine.toLocaleString():'—'}</b><span>최고 점수${top?' · '+esc(top.nick):''}</span><b>${top?top.score.toLocaleString():'—'}</b>`;
  if(USER&&rank)list+=`<span>내 순위</span><b>${rank<=20?rank+'위':rank+'위 (20위 밖)'}</b>`;
  if(!USER&&score>0)list+=gsaveForm('g4');
  if(err)list+=`<span style="grid-column:1/-1;color:#ff7a7a">${err}</span>`;
  $('#g4List').innerHTML=list;$('#g4Continue').hidden=!win;$('#g4Over').hidden=false;
  if(saved&&isTop)G4.top={nick:USER.nick,score};
  bindGsave('g4','g2048',()=>Object.assign({},rec),()=>G4.mine,v=>{G4.mine=v;g4LoadRank();});
}
// 게스트 저장 폼 (블록·2048 공용)
function gsaveForm(p){return `<form class="gsave" id="${p}Save" style="grid-column:1/-1" autocomplete="off"><div class="gs-t">이 점수를 랭킹에 올리기</div>
  <div class="gs-row"><input id="${p}Nick" maxlength="12" placeholder="닉네임" aria-label="닉네임" autocapitalize="off" spellcheck="false"><input id="${p}Pw" type="password" maxlength="32" placeholder="비밀번호 4자리+" aria-label="비밀번호"></div>
  <div class="gs-row"><button class="btn primary" type="submit">로그인하고 저장</button><button class="btn ghost" type="button" id="${p}New">새로 만들고 저장</button></div><div class="msg" id="${p}Msg">다른 게임과 같은 계정을 써요.</div></form>`;}
function bindGsave(p,gid,recFn,getMine,setMine){
  const f=$('#'+p+'Save');if(!f)return;
  const go=async isNew=>{const el=$('#'+p+'Msg');const set=(t,c)=>{el.textContent=t;el.className='msg '+(c||'');};
    if(!await authUser($('#'+p+'Nick').value,$('#'+p+'Pw').value,isNew,set))return;
    const rec=recFn();
    try{const me=await Store.getScore(gid,USER.key);
      if(!me||rec.score>me.score){await Store.setScore(gid,USER.key,Object.assign({nick:USER.nick},rec));setMine(rec.score);set(`${USER.nick} 이름으로 ${rec.score.toLocaleString()}점을 저장했어요.`,'ok');}
      else{setMine(me.score);set(`이미 더 높은 점수(${me.score.toLocaleString()})가 있어서 그대로 두었어요.`,'ok');}
      f.querySelectorAll('input,button').forEach(x=>x.disabled=true);
    }catch(e){set(saveErr(e),'err');}};
  f.addEventListener('submit',e=>{e.preventDefault();go(false);});$('#'+p+'New').addEventListener('click',()=>go(true));
}
// ----- 입력: 화살표/WASD, 스와이프
window.addEventListener('keydown',e=>{
  if(!G4.on||$('#g48').hidden||(e.target&&e.target.tagName==='INPUT')||modalOpen())return;
  const k={ArrowUp:0,ArrowRight:1,ArrowDown:2,ArrowLeft:3,KeyW:0,KeyD:1,KeyS:2,KeyA:3,UIKeyInputUpArrow:0,UIKeyInputRightArrow:1,UIKeyInputDownArrow:2,UIKeyInputLeftArrow:3,Up:0,Right:1,Down:2,Left:3}[e.code]??{ArrowUp:0,ArrowRight:1,ArrowDown:2,ArrowLeft:3,UIKeyInputUpArrow:0,UIKeyInputRightArrow:1,UIKeyInputDownArrow:2,UIKeyInputLeftArrow:3,w:0,d:1,s:2,a:3,'ㅈ':0,'ㅇ':1,'ㄴ':2,'ㅁ':3}[e.key];
  if(k===undefined){if((e.code==='Enter'||e.key==='Enter')&&!$('#g4Over').hidden&&$('#g4Continue').hidden)g4Start();return;}
  e.preventDefault();g4Audio();g4Move(k);
},{capture:true});
(function(){const b=$('#g4Board');let s=null;
  b.addEventListener('pointerdown',e=>{s={x:e.clientX,y:e.clientY};b.setPointerCapture(e.pointerId);g4Audio();});
  b.addEventListener('pointerup',e=>{if(!s)return;const dx=e.clientX-s.x,dy=e.clientY-s.y;s=null;if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;
    g4Move(Math.abs(dx)>Math.abs(dy)?(dx>0?1:3):(dy>0?2:0));});
  b.addEventListener('pointercancel',()=>s=null);})();
document.addEventListener('click',e=>{const b=e.target.closest('[data-g4]');if(!b)return;
  if(b.dataset.g4==='new')g4Start();if(b.dataset.g4==='continue'){G4.keepGoing=true;$('#g4Over').hidden=true;}});
// ----- 소리
const G4A={};
function g4Audio(){if(!gSnd('g2048'))return;try{if(!G4A.ctx){G4A.ctx=(typeof BKA!=='undefined'&&BKA.ctx)||(typeof AUD!=='undefined'&&AUD.ctx)||new (window.AudioContext||window.webkitAudioContext)();}if(G4A.ctx.state==='suspended')G4A.ctx.resume();}catch(e){}}
function g4Tone(f,d,type,vol,delay,slide){const c=G4A.ctx;if(!c)return;const t=c.currentTime+(delay||0),o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+d);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.01);g.gain.exponentialRampToValueAtTime(0.0001,t+d);o.connect(g);g.connect(gOut(c,'g2048'));o.start(t);o.stop(t+d+0.02);}
function g4Snd(kind,v){if(!gSnd('g2048')||!G4A.ctx)return;try{
  if(kind==='slide')g4Tone(300,0.06,'triangle',0.04,0,180);
  if(kind==='merge'){const n=Math.log2(v);g4Tone(220*Math.pow(2,(n-1)/4),0.12,'triangle',0.09,0,0);g4Tone(440*Math.pow(2,(n-1)/4),0.1,'sine',0.05,0.04);if(v>=128)g4Tone(80,0.25,'sine',0.25,0,40);}
  if(kind==='win')[0,4,7,12,16,19,24].forEach((s,i)=>g4Tone(523*Math.pow(2,s/12),0.25,'square',0.06,i*0.07));
  if(kind==='over')[0,-4,-7].forEach((s,i)=>g4Tone(330*Math.pow(2,s/12),0.3,'sawtooth',0.05,i*0.15));
}catch(e){}}
