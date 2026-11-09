// ===== 게임 2: 블록 낙하 =====
// 7종 블록, 7개 묶음 랜덤, 회전 벽차기(SRS), 고스트, 홀드, 고정 지연, 레벨별 속도·배경, 효과음·흔들림·파티클
const BK={W:10,H:20,VIS:20};
const BK_SHAPES={ // 회전 0 상태의 칸 (4x4 안)
  I:[[0,1],[1,1],[2,1],[3,1]], O:[[1,0],[2,0],[1,1],[2,1]], T:[[1,0],[0,1],[1,1],[2,1]],
  S:[[1,0],[2,0],[0,1],[1,1]], Z:[[0,0],[1,0],[1,1],[2,1]], J:[[0,0],[0,1],[1,1],[2,1]], L:[[2,0],[0,1],[1,1],[2,1]]};
const BK_COL={I:'#3fd0e8',O:'#f5c843',T:'#a86ae8',S:'#58d36a',Z:'#ef5a5a',J:'#4f7cf0',L:'#f39a3d'};
// SRS 벽차기 표
const KICK_JLSTZ={'0>1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],'1>0':[[0,0],[1,0],[1,-1],[0,2],[1,2]],'1>2':[[0,0],[1,0],[1,-1],[0,2],[1,2]],'2>1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '2>3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],'3>2':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],'3>0':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],'0>3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]]};
const KICK_I={'0>1':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],'1>0':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],'1>2':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],'2>1':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  '2>3':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],'3>2':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],'3>0':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],'0>3':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]]};
function bkCells(type,rot){
  if(type==='O') return BK_SHAPES.O;
  const n=type==='I'?4:3;let c=BK_SHAPES[type].map(p=>p.slice());
  for(let r=0;r<rot;r++) c=c.map(([x,y])=>[n-1-y,x]);
  return c;
}
// 레벨 테마: 색 2개 + 파티클 종류
const BK_THEMES=[
  {n:'새벽',a:'#141b33',b:'#2c3e70',p:'star',pc:'#ffffff'},
  {n:'바다',a:'#06324a',b:'#0b6c8a',p:'bubble',pc:'#9fe6ff'},
  {n:'숲',a:'#0c2a16',b:'#2f6b2c',p:'leaf',pc:'#b6e36a'},
  {n:'노을',a:'#3a1440',b:'#e0703a',p:'dust',pc:'#ffd7a0'},
  {n:'네온 도시',a:'#0a0820',b:'#3b0f5c',p:'rain',pc:'#ff4fd8'},
  {n:'오로라',a:'#031a1e',b:'#145e5a',p:'aurora',pc:'#6dffc5'},
  {n:'화산',a:'#1a0602',b:'#8a1f05',p:'ember',pc:'#ffb04a'},
  {n:'우주',a:'#020208',b:'#1b1240',p:'warp',pc:'#c8d8ff'},
  {n:'번개',a:'#0b0f1a',b:'#2a3550',p:'rain',pc:'#a8d4ff'},
  {n:'하이퍼',a:'#12001f',b:'#001f3a',p:'warp',pc:'#ffffff'},
];
const BKS={on:false,state:'idle',board:null,cur:null,hold:null,canHold:true,bag:[],queue:[],score:0,lines:0,level:1,combo:-1,b2b:false,
  grav:0,lockT:0,lockResets:0,shake:0,flash:0,clearRows:null,clearT:0,parts:[],pops:[],themeA:0,themeT:1,bgParts:[],top:null,mine:null,last:0,keys:{},das:{},soft:false};
function bkGravity(level){return Math.max(0.012,0.45*Math.pow(0.82,level-1));} // 한 칸 내려가는 시간(초)
function bkNewBag(){const b=Object.keys(BK_SHAPES);for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
function bkNext(){while(BKS.queue.length<6){if(!BKS.bag.length)BKS.bag=bkNewBag();BKS.queue.push(BKS.bag.pop());}return BKS.queue.shift();}
function bkFits(type,rot,x,y){for(const [cx,cy] of bkCells(type,rot)){const X=x+cx,Y=y+cy;if(X<0||X>=BK.W||Y>=BK.H)return false;if(Y>=0&&BKS.board[Y][X])return false;}return true;}
function bkSpawn(type){
  const p={type,rot:0,x:type==='O'?3:3,y:type==='I'?-1:-1};
  if(!bkFits(p.type,p.rot,p.x,p.y)){ if(bkFits(p.type,p.rot,p.x,p.y-1)) p.y--; else {bkGameOver();return;} }
  BKS.cur=p;BKS.lockT=0;BKS.lockResets=0;BKS.grav=0;
  // 처음부터 아래로 한 칸
  if(bkFits(p.type,p.rot,p.x,p.y+1)) p.y++;
}
function bkStart(){
  BKS.board=Array.from({length:BK.H},()=>Array(BK.W).fill(null));
  BKS.bag=[];BKS.queue=[];BKS.hold=null;BKS.canHold=true;BKS.score=0;BKS.lines=0;BKS.level=1;BKS.combo=-1;BKS.b2b=false;
  BKS.parts=[];BKS.pops=[];BKS.clearRows=null;BKS.shake=0;BKS.flash=0;BKS.state='play';BKS.themeA=0;BKS.themeT=1;BKS.soft=false;BKS.keys={};BKS.das={};
  for(const id of ['#bkStart','#bkOver','#bkPause']) $(id).hidden=true;
  if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
  bkSpawn(bkNext());bkHud();bkBanner('LEVEL 1 · '+BK_THEMES[0].n,1400);bkAudio();bkSnd('start');
}
function bkMove(dx){const p=BKS.cur;if(!p||BKS.state!=='play')return false;if(bkFits(p.type,p.rot,p.x+dx,p.y)){p.x+=dx;bkTouchLock();bkSnd('move');return true;}return false;}
function bkRotate(dir){
  const p=BKS.cur;if(!p||BKS.state!=='play'||p.type==='O')return;
  const to=(p.rot+dir+4)%4,tbl=p.type==='I'?KICK_I:KICK_JLSTZ,kicks=tbl[p.rot+'>'+to];
  for(const [kx,ky] of kicks){if(bkFits(p.type,to,p.x+kx,p.y-ky)){p.x+=kx;p.y-=ky;p.rot=to;bkTouchLock();bkSnd('rot');p.lastRot=true;return;}}
}
function bkTouchLock(){const p=BKS.cur;if(!bkFits(p.type,p.rot,p.x,p.y+1)&&BKS.lockResets<15){BKS.lockT=0;BKS.lockResets++;}}
function bkGhostY(){const p=BKS.cur;let y=p.y;while(bkFits(p.type,p.rot,p.x,y+1))y++;return y;}
function bkHard(){
  const p=BKS.cur;if(!p||BKS.state!=='play')return;const gy=bkGhostY();const d=gy-p.y;
  // 내려꽂는 잔상
  for(const [cx,cy] of bkCells(p.type,p.rot)) BKS.parts.push({trail:1,x:p.x+cx,y0:p.y+cy,y1:gy+cy,life:0.22,max:0.22,c:BK_COL[p.type]});
  p.y=gy;BKS.score+=d*5*BKS.level;BKS.shake=Math.max(BKS.shake,4+d*0.35);bkSnd('hard',d);bkLock(true);
}
function bkHold(){
  if(!BKS.canHold||BKS.state!=='play')return;const t=BKS.cur.type;
  if(BKS.hold){const h=BKS.hold;BKS.hold=t;bkSpawn(h);}else{BKS.hold=t;bkSpawn(bkNext());}
  BKS.canHold=false;bkSnd('hold');
}
function bkLock(hard){
  const p=BKS.cur;let above=true;
  for(const [cx,cy] of bkCells(p.type,p.rot)){const X=p.x+cx,Y=p.y+cy;if(Y>=0){BKS.board[Y][X]=p.type;above=false;}}
  // 설치 효과: 칸마다 작은 먼지
  for(const [cx,cy] of bkCells(p.type,p.rot)) for(let k=0;k<3;k++) BKS.parts.push({x:p.x+cx+Math.random(),y:p.y+cy+1,vx:(Math.random()-0.5)*3,vy:-Math.random()*2,life:0.35,max:0.35,c:'#ffffff',s:2});
  BKS.lockFlash={cells:bkCells(p.type,p.rot).map(([cx,cy])=>[p.x+cx,p.y+cy]),t:0.18};
  if(!hard){BKS.shake=Math.max(BKS.shake,2.5);bkSnd('lock');}
  if(above){bkGameOver();return;}
  // T-스핀 간단 판정 (마지막 동작이 회전 + 모서리 3칸 막힘)
  let tspin=false;if(p.type==='T'&&p.lastRot){let c=0;for(const [dx,dy] of [[0,0],[2,0],[0,2],[2,2]]){const X=p.x+dx,Y=p.y+dy;if(X<0||X>=BK.W||Y>=BK.H||(Y>=0&&BKS.board[Y][X]))c++;}tspin=c>=3;}
  const full=[];for(let y=0;y<BK.H;y++) if(BKS.board[y].every(v=>v)) full.push(y);
  if(full.length){
    BKS.combo++;const n=full.length;
    const base=tspin?[1000,2000,3000,4000][n]:[0,250,750,1250,2500][n];
    const diff=n===4||tspin;let pts=base*BKS.level;if(diff&&BKS.b2b) pts=Math.round(pts*1.5);
    pts+=Math.max(0,BKS.combo)*150*BKS.level;BKS.score+=pts;BKS.b2b=diff;
    BKS.clearRows=full;BKS.clearT=0;BKS.state='clear';
    BKS.shake=Math.max(BKS.shake,4+n*3.5);BKS.flash=n===4?1:0.45+n*0.12;
    for(const y of full) for(let x=0;x<BK.W;x++){const c=BK_COL[BKS.board[y][x]]||'#fff';for(let k=0;k<(n===4?5:3);k++)BKS.parts.push({x:x+0.5,y:y+0.5,vx:(Math.random()-0.5)*16,vy:(Math.random()-0.9)*14,life:0.7+Math.random()*0.4,max:1.1,c,s:3+Math.random()*3,g:1});}
    const label=tspin?['','T-스핀 싱글','T-스핀 더블','T-스핀 트리플'][n]:['','싱글','더블','트리플','쿼드!'][n];
    bkPop((BKS.b2b&&diff&&BKS.lastDiff?'연속 ':'')+label+(BKS.combo>0?`  ${BKS.combo} 콤보`:'')+`  +${pts.toLocaleString()}`,n);
    bkSnd(n===4?'quad':'clear',n,BKS.combo);BKS.lastDiff=diff;
  } else {BKS.combo=-1;if(tspin){BKS.score+=1000*BKS.level;bkPop('T-스핀 +'+(1000*BKS.level),1);}bkNextPiece();}
  bkHud();
}
function bkNextPiece(){BKS.canHold=true;bkSpawn(bkNext());}
function bkFinishClear(){
  const rows=BKS.clearRows;BKS.board=BKS.board.filter((_,y)=>!rows.includes(y));while(BKS.board.length<BK.H)BKS.board.unshift(Array(BK.W).fill(null));
  const before=BKS.level;BKS.lines+=rows.length;BKS.level=Math.floor(BKS.lines/8)+1;
  BKS.clearRows=null;BKS.state='play';
  if(BKS.level>before){const th=BK_THEMES[(BKS.level-1)%BK_THEMES.length];BKS.themeA=(BKS.level-2)%BK_THEMES.length;BKS.themeT=0;bkBanner(`LEVEL ${BKS.level} · ${th.n}`,1600);bkSnd('level');}
  bkHud();bkNextPiece();
}
function bkGameOver(){
  if(BKS.state==='over')return;BKS.state='over';BKS.shake=10;bkSnd('over');
  setTimeout(bkShowOver,900);
}
// ----- 표시
function bkHud(){
  $('#bkScore').textContent=BKS.score.toLocaleString();$('#bkLevel').textContent=BKS.level;$('#bkLines').textContent=BKS.lines;
  const top=BKS.top;const beat=top&&BKS.score>top.score;
  $('#bkTop').textContent=top?(beat?BKS.score:top.score).toLocaleString():(BKS.score?BKS.score.toLocaleString():'—');
  $('#bkTopWho').textContent=top?(beat?'지금 내가 1위!':top.nick):(BKS.score?'지금 내가 1위!':'아직 기록 없음');
  $('#bkTop').classList.toggle('beat',!!beat||(!top&&BKS.score>0));
  $('#bkMine').textContent=BKS.mine!=null?BKS.mine.toLocaleString():'—';
  bkDrawSide();
}
function bkBanner(t,ms){const el=$('#bkBanner');el.textContent=t;el.classList.remove('on');void el.offsetWidth;el.classList.add('on');clearTimeout(bkBanner.t);bkBanner.t=setTimeout(()=>el.classList.remove('on'),ms);}
function bkPop(t,n){const el=$('#bkPop');el.textContent=t;el.className='bkpop on n'+n;clearTimeout(bkPop.t);bkPop.t=setTimeout(()=>el.className='bkpop',1100);}
function bkCellDraw(x,c,px,py,s,alpha){
  x.globalAlpha=alpha==null?1:alpha;
  x.fillStyle=c;x.fillRect(px,py,s,s);
  const g=x.createLinearGradient(px,py,px,py+s);g.addColorStop(0,'rgba(255,255,255,.38)');g.addColorStop(0.5,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,.25)');
  x.fillStyle=g;x.fillRect(px,py,s,s);
  x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=Math.max(1,s*0.06);x.strokeRect(px+0.5,py+0.5,s-1,s-1);
  x.fillStyle='rgba(255,255,255,.55)';x.fillRect(px+s*0.12,py+s*0.12,s*0.3,s*0.1);
  x.globalAlpha=1;
}
function bkMini(cv,types,gap){
  const x=cv.getContext('2d');x.clearRect(0,0,cv.width,cv.height);const s=24;
  types.forEach((t,k)=>{if(!t)return;const cells=bkCells(t,0);const mx=Math.min(...cells.map(c=>c[0])),Mx=Math.max(...cells.map(c=>c[0])),my=Math.min(...cells.map(c=>c[1])),My=Math.max(...cells.map(c=>c[1]));
    const w=(Mx-mx+1)*s,h=(My-my+1)*s,ox=(cv.width-w)/2,oy=k*gap+(gap-h)/2;
    const dim=cv.id==='bkHold'&&!BKS.canHold;
    for(const [cx,cy] of cells) bkCellDraw(x,dim?'#5a6270':BK_COL[t],ox+(cx-mx)*s,oy+(cy-my)*s,s,k===0?1:0.8);});
}
function bkDrawSide(){bkMini($('#bkHold'),[BKS.hold],110);bkMini($('#bkNext'),BKS.queue.slice(0,5),80);}
function bkDraw(dt){
  const cv=$('#bkBoard'),x=cv.getContext('2d');const W=cv.width,H=cv.height,s=W/BK.W;
  x.save();x.clearRect(0,0,W,H);
  if(BKS.shake>0&&SET.bkShake){x.translate((Math.random()-0.5)*BKS.shake*s*0.08,(Math.random()-0.3)*BKS.shake*s*0.1);}
  // 판 배경 + 격자
  x.fillStyle='rgba(6,8,12,.72)';x.fillRect(0,0,W,H);
  x.strokeStyle=SET.bkGrid?'rgba(255,255,255,.05)':'rgba(0,0,0,0)';x.lineWidth=1;
  for(let i=1;i<BK.W;i++){x.beginPath();x.moveTo(i*s,0);x.lineTo(i*s,H);x.stroke();}
  for(let j=1;j<BK.H;j++){x.beginPath();x.moveTo(0,j*s);x.lineTo(W,j*s);x.stroke();}
  // 쌓인 블록
  const clearing=BKS.clearRows,ct=BKS.clearT;
  for(let y=0;y<BK.H;y++)for(let X=0;X<BK.W;X++){const v=BKS.board[y][X];if(!v)continue;
    if(clearing&&clearing.includes(y)){const k=Math.min(1,ct/0.32);const wipe=Math.abs(X-4.5)/5<k;if(wipe)continue;bkCellDraw(x,'#ffffff',X*s,y*s,s,1-k*0.3);continue;}
    bkCellDraw(x,BK_COL[v],X*s,y*s,s);}
  // 고정 순간 반짝임
  if(BKS.lockFlash&&BKS.lockFlash.t>0){x.fillStyle=`rgba(255,255,255,${BKS.lockFlash.t/0.18*0.6})`;for(const [cx,cy] of BKS.lockFlash.cells)if(cy>=0)x.fillRect(cx*s,cy*s,s,s);BKS.lockFlash.t-=dt;}
  // 현재 블록 + 고스트
  const p=BKS.cur;
  if(p&&BKS.state==='play'){const gy=bkGhostY();
    x.globalAlpha=SET.bkGhost?0.28:0;for(const [cx,cy] of bkCells(p.type,p.rot)){if(gy+cy<0)continue;x.fillStyle=BK_COL[p.type];x.fillRect((p.x+cx)*s+1,(gy+cy)*s+1,s-2,s-2);}
    x.globalAlpha=0.7;x.strokeStyle=BK_COL[p.type];x.lineWidth=2;for(const [cx,cy] of bkCells(p.type,p.rot)){if(gy+cy<0)continue;x.strokeRect((p.x+cx)*s+2,(gy+cy)*s+2,s-4,s-4);}x.globalAlpha=1;
    const lockGlow=!bkFits(p.type,p.rot,p.x,p.y+1)?Math.min(1,BKS.lockT/0.5):0;
    for(const [cx,cy] of bkCells(p.type,p.rot)){if(p.y+cy<0)continue;bkCellDraw(x,BK_COL[p.type],(p.x+cx)*s,(p.y+cy)*s,s);if(lockGlow){x.fillStyle=`rgba(255,255,255,${lockGlow*0.35})`;x.fillRect((p.x+cx)*s,(p.y+cy)*s,s,s);}}}
  // 파티클
  for(const q of BKS.parts){
    if(q.trail){const a=q.life/q.max;const g=x.createLinearGradient(0,q.y0*s,0,(q.y1+1)*s);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,q.c);x.globalAlpha=a*0.55;x.fillStyle=g;x.fillRect(q.x*s+s*0.2,q.y0*s,s*0.6,(q.y1-q.y0+1)*s);x.globalAlpha=1;continue;}
    x.globalAlpha=Math.max(0,q.life/q.max);x.fillStyle=q.c;const r=(q.s||2)*s/30;x.fillRect(q.x*s-r/2,q.y*s-r/2,r,r);x.globalAlpha=1;}
  // 줄 지울 때 섬광
  if(BKS.flash>0){x.fillStyle=`rgba(255,255,255,${BKS.flash*0.35})`;x.fillRect(0,0,W,H);}
  if(BKS.state==='over'){x.fillStyle='rgba(0,0,0,.45)';x.fillRect(0,0,W,H);}
  x.restore();
}
// ----- 배경 (레벨마다 테마가 바뀌고, 빨라질수록 파티클도 빨라짐)
function bkBg(dt){
  const cv=$('#bkBg'),x=cv.getContext('2d');const W=cv.width,H=cv.height;
  const lv=BKS.level, idx=(lv-1)%BK_THEMES.length, th=BK_THEMES[idx], prev=BK_THEMES[(BKS.themeA+BK_THEMES.length)%BK_THEMES.length];
  BKS.themeT=Math.min(1,BKS.themeT+dt/1.2);const k=BKS.themeT;
  const mix=(a,b)=>{const pa=parseInt(a.slice(1),16),pb=parseInt(b.slice(1),16);const r=Math.round(((pa>>16)&255)*(1-k)+((pb>>16)&255)*k),g=Math.round(((pa>>8)&255)*(1-k)+((pb>>8)&255)*k),bl=Math.round((pa&255)*(1-k)+(pb&255)*k);return `rgb(${r},${g},${bl})`;};
  const t=performance.now()/1000;
  const grd=x.createLinearGradient(0,0,W*0.3,H);grd.addColorStop(0,mix(prev.a,th.a));grd.addColorStop(1,mix(prev.b,th.b));x.fillStyle=grd;x.fillRect(0,0,W,H);
  const speed=1+(lv-1)*0.35;
  // 테마 특유의 큰 형태
  if(th.p==='aurora'||th.p==='star'){x.globalAlpha=0.18*k;for(let i=0;i<3;i++){x.fillStyle=th.pc;x.beginPath();x.moveTo(0,H*(0.3+i*0.1));for(let X=0;X<=W;X+=W/24)x.lineTo(X,H*(0.3+i*0.1)+Math.sin(X/W*6+t*0.6*speed+i)*H*0.05);x.lineTo(W,0);x.lineTo(0,0);x.fill();}x.globalAlpha=1;}
  if(th.p==='ember'){const g2=x.createRadialGradient(W/2,H*1.1,10,W/2,H*1.1,H*0.9);g2.addColorStop(0,'rgba(255,120,30,.45)');g2.addColorStop(1,'rgba(255,60,0,0)');x.fillStyle=g2;x.fillRect(0,0,W,H);}
  if(th.p==='rain'&&lv>=9&&Math.random()<dt*0.4){BKS.bolt=0.15;}
  if(BKS.bolt>0){x.fillStyle=`rgba(200,220,255,${BKS.bolt*2})`;x.fillRect(0,0,W,H);BKS.bolt-=dt;}
  // 파티클
  const want=Math.round(60+lv*10);while(BKS.bgParts.length<want)BKS.bgParts.push({x:Math.random(),y:Math.random(),z:Math.random(),ph:Math.random()*6});
  x.fillStyle=th.pc;x.strokeStyle=th.pc;
  for(const q of BKS.bgParts){
    const v=(0.02+q.z*0.06)*speed*dt;
    switch(th.p){
      case 'star':q.y+=v*0.3;x.globalAlpha=(0.3+0.7*Math.abs(Math.sin(t*2+q.ph)))*0.8;x.fillRect(q.x*W,q.y*H,1+q.z*2,1+q.z*2);break;
      case 'bubble':q.y-=v;q.x+=Math.sin(t+q.ph)*0.0008;x.globalAlpha=0.35;x.beginPath();x.arc(q.x*W,q.y*H,2+q.z*6,0,7);x.stroke();break;
      case 'leaf':q.y+=v*0.8;q.x+=Math.sin(t*1.5+q.ph)*0.0015;x.globalAlpha=0.6;x.save();x.translate(q.x*W,q.y*H);x.rotate(t+q.ph);x.fillRect(-4,-2,8+q.z*6,4);x.restore();break;
      case 'dust':q.x+=v*0.6;x.globalAlpha=0.4;x.beginPath();x.arc(q.x*W,q.y*H,1+q.z*2.5,0,7);x.fill();break;
      case 'rain':q.y+=v*5;q.x-=v*0.6;x.globalAlpha=0.5;x.lineWidth=1+q.z;x.beginPath();x.moveTo(q.x*W,q.y*H);x.lineTo(q.x*W+6,q.y*H-20-q.z*20);x.stroke();break;
      case 'aurora':q.y-=v*0.2;x.globalAlpha=0.5*Math.abs(Math.sin(t+q.ph));x.fillRect(q.x*W,q.y*H,2,2);break;
      case 'ember':q.y-=v*1.6;q.x+=Math.sin(t*3+q.ph)*0.001;x.globalAlpha=0.8*q.z+0.2;x.fillStyle=q.z>0.6?'#ffe08a':th.pc;x.fillRect(q.x*W,q.y*H,2+q.z*2,2+q.z*2);x.fillStyle=th.pc;break;
      case 'warp':{const cx=W/2,cy=H/2;const dx=q.x-0.5,dy=q.y-0.5;q.x+=dx*v*6;q.y+=dy*v*6;x.globalAlpha=Math.min(1,Math.hypot(dx,dy)*2.5);x.lineWidth=1+q.z*1.5;x.beginPath();x.moveTo(cx+dx*W,cy+dy*H);x.lineTo(cx+dx*W*(1-0.08*speed),cy+dy*H*(1-0.08*speed));x.stroke();
        if(Math.abs(dx)>0.5||Math.abs(dy)>0.5){q.x=0.5+(Math.random()-0.5)*0.1;q.y=0.5+(Math.random()-0.5)*0.1;}break;}
    }
    if(q.y>1.05)q.y=-0.05;if(q.y<-0.05)q.y=1.05;if(q.x>1.05)q.x=-0.05;if(q.x<-0.05)q.x=1.05;
  }
  x.globalAlpha=1;
}
// ----- 루프
function bkTick(dt){
  if(BKS.state==='play'&&!BKS.paused){
    // 자동 반복 이동 (DAS 150ms / ARR 40ms)
    for(const dir of ['left','right']){const d=BKS.das[dir];if(!d)continue;d.t+=dt;const DS=BK_DAS[SET.bkDas]||BK_DAS.mid;if(d.t>DS[0]){d.r=(d.r||0)+dt;while(d.r>DS[1]){d.r-=DS[1];bkMove(dir==='left'?-1:1);}}}
    const p=BKS.cur;if(p){
      const g=bkGravity(BKS.level)/(BKS.soft?20:1);BKS.grav+=dt;
      while(BKS.grav>=g){BKS.grav-=g;if(bkFits(p.type,p.rot,p.x,p.y+1)){p.y++;p.lastRot=false;if(BKS.soft){BKS.score+=2*BKS.level;bkHud();}}else break;}
      if(!bkFits(p.type,p.rot,p.x,p.y+1)){BKS.lockT+=dt;if(BKS.lockT>=0.5)bkLock(false);}
    }
  }else if(BKS.state==='clear'){BKS.clearT+=dt;if(BKS.clearT>=0.36)bkFinishClear();}
  BKS.shake=Math.max(0,BKS.shake-dt*28);BKS.flash=Math.max(0,BKS.flash-dt*2.5);
  for(const q of BKS.parts){q.life-=dt;if(!q.trail){q.x+=q.vx*dt;q.y+=q.vy*dt;if(q.g)q.vy+=30*dt;}}
  BKS.parts=BKS.parts.filter(q=>q.life>0);
  bkBg(dt);bkDraw(dt);
}
function bkLoop(now){if(!BKS.on)return;requestAnimationFrame(bkLoop);const dt=Math.min(0.05,(now-(BKS.last||now))/1000);BKS.last=now;try{bkTick(dt);}catch(e){console.error(e);}}
function bkResize(){
  const wrap=$('.bkboardwrap'),cv=$('#bkBoard');const r=wrap.getBoundingClientRect();const dpr=Math.min(2,devicePixelRatio||1);
  cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.width*2*dpr);cv.style.height=r.width*2+'px';
  const bg=$('#bkBg');bg.width=Math.round(innerWidth*Math.min(1.5,dpr));bg.height=Math.round(innerHeight*Math.min(1.5,dpr));
}
// ----- 화면 열기/닫기, 랭킹
async function openBlocks(){
  show('blocks');BKS.on=true;BKS.last=0;BKS.state='idle';BKS.level=1;BKS.themeT=1;BKS.board=Array.from({length:BK.H},()=>Array(BK.W).fill(null));BKS.cur=null;BKS.queue=[];BKS.hold=null;
  $('#bkStart').hidden=false;$('#bkOver').hidden=true;$('#bkPause').hidden=true;
  requestAnimationFrame(()=>{bkResize();requestAnimationFrame(bkLoop);});
  bkTouchVis();await bkLoadRank();
}
function closeBlocks(){BKS.on=false;BKS.state='idle';}
async function bkLoadRank(){
  const el=$('#bkRank');
  try{await Store.ready;const top=await Store.topScore('blocks',20);BKS.top=top[0]||null;
    BKS.mine=null;if(USER){const me=await Store.getScore('blocks',USER.key);BKS.mine=me?me.score:null;}else{BKS.mine=LS.get('smr_guest_blocks',null);}
    let rows=top.map((r,i)=>`<tr class="${USER&&r.key===USER.key?'mine':''}"><td class="p">${i+1}</td><td>${nickCell(r.key,r.nick)}</td><td class="lv">Lv ${r.level||1}</td><td class="tm">${(r.score||0).toLocaleString()}</td></tr>`).join('');
    if(USER&&!top.some(r=>r.key===USER.key)&&BKS.mine!=null){const rank=await Store.rankScore('blocks',BKS.mine);rows+=`<tr class="sep"><td colspan="4">· · · 내 기록 · · ·</td></tr><tr class="mine"><td class="p">${rank}</td><td>${nickCell(USER.key,USER.nick)}</td><td></td><td class="tm">${BKS.mine.toLocaleString()}</td></tr>`;}
    el.innerHTML=top.length?`<div class="label" style="padding:0 0 6px">랭킹 TOP 20</div><table>${rows}</table>`:`<div class="empty">아직 기록이 없어요. 첫 1위가 되어 보세요!</div>`;
  }catch(e){el.innerHTML='<div class="empty">랭킹을 불러오지 못했어요.</div>';}
  bkHud();
}
async function bkShowOver(){
  const score=BKS.score,top=BKS.top,isTop=!top||score>top.score,prev=BKS.mine,isPB=prev==null||score>prev;
  $('#bkFinal').textContent=score.toLocaleString();$('#bkFinal').className='laptime'+(isTop&&score>0?' tr':(isPB&&score>0?' pb':''));
  let saved=false,err=null,rank=null;const rec={score,lines:BKS.lines,level:BKS.level,at:Date.now()};
  if(USER&&score>0){if(isPB){try{await Store.setScore('blocks',USER.key,Object.assign({nick:USER.nick},rec));saved=true;BKS.mine=score;}catch(e){err=saveErr(e);}}
    try{rank=await Store.rankScore('blocks',BKS.mine??score);}catch(e){}}
  else if(!USER&&isPB&&score>0){LS.set('smr_guest_blocks',score);BKS.mine=score;}
  let badges='';
  if(isTop&&score>0) badges+=USER&&saved?`<span class="badge tr">새 최고 점수 · ${esc(USER.nick)}</span>`:'<span class="badge tr">최고 점수보다 높아요</span>';
  if(isPB&&score>0) badges+='<span class="badge pb">개인 최고</span>';
  if(!badges) badges='<span class="badge n">게임 오버</span>';
  $('#bkBadges').innerHTML=badges;
  let list=`<span>점수</span><b>${score.toLocaleString()}</b><span>레벨 · 줄</span><b>${BKS.level} · ${BKS.lines}</b><span>내 최고</span><b>${BKS.mine!=null?BKS.mine.toLocaleString():'—'}</b><span>최고 점수${top?' · '+esc(top.nick):''}</span><b>${top?top.score.toLocaleString():'—'}</b>`;
  if(USER&&rank) list+=`<span>내 순위</span><b>${rank<=20?rank+'위':rank+'위 (20위 밖)'}</b>`;
  if(USER) list+=`<span style="grid-column:1/-1;font-size:12.5px">${esc(USER.nick)} 이름으로 저장 중 · <button class="linkbtn" type="button" data-act="switch-user-bk">다른 사람으로 하기</button></span>`;
  if(!USER&&score>0) list+=`<form class="gsave" id="bkSave" style="grid-column:1/-1" autocomplete="off"><div class="gs-t">이 점수를 랭킹에 올리기</div>
    <div class="gs-row"><input id="bkNick" maxlength="12" placeholder="닉네임" aria-label="닉네임" autocapitalize="off" spellcheck="false"><input id="bkPw" type="password" maxlength="32" placeholder="비밀번호 4자리+" aria-label="비밀번호"></div>
    <div class="gs-row"><button class="btn primary" type="submit">로그인하고 저장</button><button class="btn ghost" type="button" id="bkNew">새로 만들고 저장</button></div><div class="msg" id="bkMsg">레이싱과 같은 계정을 써요.</div></form>`;
  if(err) list+=`<span style="grid-column:1/-1;color:#ff7a7a">${err}</span>`;
  $('#bkList').innerHTML=list;$('#bkOver').hidden=false;
  if(saved&&isTop){BKS.top={nick:USER.nick,score};}
  if($('#bkSave')){const go=async isNew=>{const el=$('#bkMsg');const set=(t,c)=>{el.textContent=t;el.className='msg '+(c||'');};
      if(!await authUser($('#bkNick').value,$('#bkPw').value,isNew,set))return;
      try{const me=await Store.getScore('blocks',USER.key);
        if(!me||score>me.score){await Store.setScore('blocks',USER.key,Object.assign({nick:USER.nick},rec));BKS.mine=score;set(`${USER.nick} 이름으로 ${score.toLocaleString()}점을 저장했어요.`,'ok');if(!top||score>top.score)BKS.top={nick:USER.nick,score};}
        else{BKS.mine=me.score;set(`이미 더 높은 점수(${me.score.toLocaleString()})가 있어서 그대로 두었어요.`,'ok');}
        $('#bkSave').querySelectorAll('input,button').forEach(x=>x.disabled=true);bkHud();
      }catch(e){set(saveErr(e),'err');}};
    $('#bkSave').addEventListener('submit',e=>{e.preventDefault();go(false);});$('#bkNew').addEventListener('click',()=>go(true));}
  bkHud();
}
// ----- 입력
function bkPause(on){if(BKS.state!=='play'&&BKS.state!=='clear')return;BKS.paused=on;$('#bkPause').hidden=!on;}
// 키 매핑: e.code 우선, 안 되면 e.key (한글 입력 상태·아이패드 하드웨어 키보드 대비)
const BK_CODE={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'soft',ArrowUp:'cw',KeyZ:'cw',KeyC:'hold',Space:'hard'};
const BK_KEY={ArrowLeft:'left',Left:'left',UIKeyInputLeftArrow:'left',ArrowRight:'right',Right:'right',UIKeyInputRightArrow:'right',
  ArrowDown:'soft',Down:'soft',UIKeyInputDownArrow:'soft',ArrowUp:'cw',Up:'cw',UIKeyInputUpArrow:'cw',
  z:'cw',Z:'cw','ㅋ':'cw',c:'hold',C:'hold','ㅊ':'hold',' ':'hard',Spacebar:'hard'};
const BK_DAS={slow:[0.2,0.06],mid:[0.15,0.04],fast:[0.1,0.022]};
const BK_KC={37:'left',39:'right',40:'soft',38:'cw',90:'cw',67:'hold',32:'hard'};
function bkKeyOf(e){return BK_CODE[e.code]||BK_KEY[e.key]||BK_KC[e.keyCode]||null;}
window.addEventListener('keydown',e=>{
  if(!BKS.on||(e.target&&e.target.tagName==='INPUT'))return;
  if(modalOpen()){if(e.code==='Escape')closeModals();return;}
  const k=bkKeyOf(e);
  if(k&&!$('#blocks').hidden) e.preventDefault(); // 스페이스·화살표로 페이지가 움직이거나 버튼이 눌리지 않게
  if((e.code==='Enter'||e.key==='Enter'||k==='hard')&&!$('#bkStart').hidden){bkStart();return;}
  if((e.code==='Enter'||e.key==='Enter')&&!$('#bkOver').hidden){bkStart();return;}
  if(e.code==='Escape'||e.key==='Escape'||e.code==='KeyP'){if(modalOpen())closeModals();else bkPause(!BKS.paused);return;}
  if(BKS.paused||BKS.state!=='play'||!k)return;
  if(e.repeat)return; // 자동 반복은 게임이 직접 처리
  bkAction(k,true);
},{capture:true});
window.addEventListener('keyup',e=>{if(!BKS.on)return;const k=bkKeyOf(e);if(k==='left'||k==='right'||k==='soft')bkAction(k,false);},{capture:true});
window.addEventListener('blur',()=>{BKS.das={};BKS.soft=false;});
function bkAction(k,down){
  if(k==='left'||k==='right'){if(down){bkMove(k==='left'?-1:1);BKS.das[k]={t:0};delete BKS.das[k==='left'?'right':'left'];}else delete BKS.das[k];return;}
  if(k==='soft'){BKS.soft=down;return;}
  if(!down)return;
  if(k==='cw')bkRotate(1);else if(k==='ccw')bkRotate(-1);else if(k==='hard')bkHard();else if(k==='hold')bkHold();
}
// 터치 버튼 + 판 위 제스처(탭=회전, 좌우로 끌기=이동, 아래로 빠르게 쓸기=내려꽂기)
(function bkTouchSetup(){
  const tb=$('#bkTouch');
  tb.addEventListener('pointerdown',e=>{const b=e.target.closest('.bt');if(!b)return;e.preventDefault();b.setPointerCapture(e.pointerId);b.classList.add('on');bkAudio();bkAction(b.dataset.bt,true);});
  const up=e=>{const b=e.target.closest('.bt');if(!b)return;b.classList.remove('on');bkAction(b.dataset.bt,false);};
  tb.addEventListener('pointerup',up);tb.addEventListener('pointercancel',up);tb.addEventListener('contextmenu',e=>e.preventDefault());
  const bd=$('#bkBoard');let g=null;
  bd.addEventListener('pointerdown',e=>{if(BKS.state!=='play')return;bkAudio();g={x:e.clientX,y:e.clientY,t:performance.now(),moved:0,cell:bd.getBoundingClientRect().width/BK.W,dx:0,dy:0};bd.setPointerCapture(e.pointerId);});
  bd.addEventListener('pointermove',e=>{if(!g)return;const ddx=e.clientX-g.x-g.dx*g.cell;if(Math.abs(ddx)>g.cell*0.9){const n=Math.sign(ddx);bkMove(n);g.dx+=n;g.moved=1;}
    const ddy=e.clientY-g.y;if(ddy>g.cell*1.2&&!g.fast){BKS.soft=true;g.moved=1;}});
  bd.addEventListener('pointerup',e=>{if(!g)return;const dt=performance.now()-g.t,dy=e.clientY-g.y;BKS.soft=false;
    if(dy>g.cell*3&&dt<260)bkHard();else if(!g.moved&&dt<300)bkRotate(1);g=null;});
  bd.addEventListener('pointercancel',()=>{g=null;BKS.soft=false;});
})();
function bkTouchVis(){const on=touchOn();$('#bkTouch').hidden=!on;$('#blocks').classList.toggle('touchmode',on);}
document.addEventListener('click',e=>{const b=e.target.closest('[data-bk]');if(!b)return;
  switch(b.dataset.bk){case 'start':case 'restart':bkStart();break;case 'pause':bkPause(!BKS.paused);break;case 'resume':bkPause(false);break;}});
window.addEventListener('resize',()=>{if(BKS.on)bkResize();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&BKS.on)bkPause(true);});
// ----- 효과음 (WebAudio 합성: 타격감 위주)
const BKA={ctx:null};
function bkAudio(){if(!gSnd('blocks'))return;try{if(!BKA.ctx){BKA.ctx=(typeof AUD!=='undefined'&&AUD.ctx)||new (window.AudioContext||window.webkitAudioContext)();BKA.out=BKA.ctx.createGain();BKA.out.gain.value=0.5;BKA.out.connect(gOut(BKA.ctx,'blocks'));
  const len=BKA.ctx.sampleRate*0.5,buf=BKA.ctx.createBuffer(1,len,BKA.ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;BKA.noise=buf;}
  if(BKA.ctx.state==='suspended')BKA.ctx.resume();}catch(e){BKA.ctx=null;}}
function bkTone(f,dur,type,vol,slide,delay){const c=BKA.ctx,t=c.currentTime+(delay||0);const o=c.createOscillator(),g=c.createGain();o.type=type||'square';o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t+dur);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(BKA.out);o.start(t);o.stop(t+dur+0.02);}
function bkNoise(dur,vol,freq,delay,q){const c=BKA.ctx,t=c.currentTime+(delay||0);const s=c.createBufferSource();s.buffer=BKA.noise;const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=freq||1200;f.Q.value=q||1.2;const g=c.createGain();
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);s.connect(f);f.connect(g);g.connect(BKA.out);s.start(t);s.stop(t+dur+0.02);}
function bkSnd(kind,n,combo){
  if(!gSnd('blocks')||!BKA.ctx)return;
  try{switch(kind){
    case 'move':bkTone(520,0.03,'square',0.025);break;
    case 'rot':bkTone(760,0.05,'triangle',0.05,980);break;
    case 'hold':bkTone(400,0.08,'triangle',0.06,600);bkTone(600,0.08,'triangle',0.05,800,0.06);break;
    case 'lock':bkTone(150,0.12,'sine',0.22,60);bkNoise(0.06,0.12,900);break;                       // 툭
    case 'hard':bkTone(220,0.2,'sine',0.35,40);bkNoise(0.12,0.25,600,0,0.8);bkTone(90,0.15,'square',0.06,45);break; // 쿵
    case 'clear':{const base=[0,523,587,659][n]||523,up=Math.min(combo||0,8)*0.06+1;
      [0,4,7,12].slice(0,n+1).forEach((s,i)=>bkTone(base*up*Math.pow(2,s/12),0.16,'square',0.07,0,i*0.05));
      bkNoise(0.35,0.18,3000,0,0.6);bkTone(120,0.25,'sine',0.3,50);break;}                         // 촤르륵 + 쿵
    case 'quad':[0,4,7,12,16,19,24].forEach((s,i)=>bkTone(440*Math.pow(2,s/12),0.2,'square',0.07,0,i*0.045));
      bkNoise(0.6,0.3,2500,0,0.5);bkTone(80,0.5,'sine',0.45,30);bkTone(1760,0.4,'triangle',0.05,2640,0.3);break;
    case 'level':[0,7,12,19].forEach((s,i)=>bkTone(523*Math.pow(2,s/12),0.22,'triangle',0.08,0,i*0.08));break;
    case 'start':bkTone(392,0.1,'square',0.05);bkTone(523,0.15,'square',0.05,0,0.1);break;
    case 'over':[0,-3,-7,-12].forEach((s,i)=>bkTone(330*Math.pow(2,s/12),0.25,'sawtooth',0.06,0,i*0.16));bkTone(70,0.8,'sine',0.35,35,0.3);break;
  }}catch(e){}
}
