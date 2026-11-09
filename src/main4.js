// ===== 상태 =====
const GAR={scene:null,cam:null,car:null,env:null,rot:0.7,auto:true,drag:null,anim:0,ring:null,strips:[],key:null};
const RACE={scene:null,cam:null,env:null,sun:null,T:null,car:null,c:null,sky:null,phase:'none',phaseT:0,time:0,idx:0,prevIdx:0,cp:[0,0,0],
  acc:0,camYaw:0,camMode:SET.cam,paused:false,hold:1,litN:0,shake:0,pb:null,tr:null,frame:0,kbdSeen:false,offT:0};
let MODE='none', curTrack=null;

// ===== 화면 전환 =====
function show(id){
  for(const s of ['#home','#tracks','#garage','#hud','#editor','#blocks','#g48','#react']) $(s).hidden=(s!=='#'+id);
  canvas.hidden=!(id==='garage'||id==='hud');
  if(document.activeElement&&document.activeElement.blur) document.activeElement.blur();
}

// ===== 홈: 게임 목록 (인기순, 2열, 총 10칸) =====
const GAMES=[
  {id:'racer',title:'서킷 타임어택',desc:'실제 서킷 5곳에서 1랩 기록 경쟁 · 상위 20위 랭킹',act:'open-racer',
   art:()=>{const o=outlinePath(TRACKS[0],120,10);return `<svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet"><path d="${o.d}" fill="none" stroke="#ffb000" stroke-width="4" stroke-linejoin="round"/></svg>`;}},
  {id:'blocks',title:'블록 낙하',desc:'떨어지는 블록으로 줄 지우기 · 레벨마다 빨라지고 배경이 바뀜',act:'open-blocks',
   art:()=>{const c=['#3fd0e8','#f5c843','#a86ae8','#58d36a','#ef5a5a','#4f7cf0','#f39a3d'];const cells=[[1,5,0],[2,5,0],[3,5,0],[4,5,0],[4,4,6],[5,4,6],[6,4,6],[6,3,6],[1,4,1],[2,4,1],[1,3,1],[2,3,1],[3,4,2],[3,3,2],[3,2,2],[2,2,2],[5,5,4],[6,5,4],[7,5,3],[7,4,3],[7,3,5],[8,3,5],[8,4,5],[8,5,5],[5,1,2],[4,1,2],[6,1,2],[5,0,2]];
     return `<svg viewBox="0 0 120 72">${cells.map(([x,y,k])=>`<rect x="${10+x*11}" y="${4+y*11}" width="10" height="10" rx="1.5" fill="${c[k]}"/>`).join('')}</svg>`;}},
  {id:'g2048',title:'2048',desc:'밀어서 같은 숫자 합치기 · 숫자가 커질수록 타일이 화려해짐',act:'open-g48',
   art:()=>{const t=[[2,'#2c3342','#c9d3e3'],[8,'#ff9a2f','#2a1400'],[128,'#f2b705','#3a2600'],[512,'#2ab3f0','#001b33'],[2048,'#a35bff','#fff'],[64,'#c4123b','#fff']];
     return `<svg viewBox="0 0 120 72">${t.map(([v,b,f],i)=>{const x=8+(i%3)*36,y=4+Math.floor(i/3)*34;return `<rect x="${x}" y="${y}" width="32" height="30" rx="5" fill="${b}"/><text x="${x+16}" y="${y+20}" font-size="${String(v).length>3?10:13}" font-weight="800" text-anchor="middle" fill="${f}" font-family="sans-serif">${v}</text>`;}).join('')}</svg>`;}},
  {id:'react',title:'출발 반응 테스트',desc:'F1 출발 신호 5개가 꺼지는 순간 반응 · 0.001초 단위 랭킹',act:'open-react',
   art:()=>`<svg viewBox="0 0 120 72"><rect x="6" y="8" width="108" height="6" fill="#2a2d33"/>${[0,1,2,3,4].map(i=>`<rect x="${10+i*21}" y="14" width="18" height="44" rx="4" fill="#060708"/><circle cx="${19+i*21}" cy="${38}" r="6" fill="#ff2020"/><circle cx="${19+i*21}" cy="${51}" r="6" fill="#ff2020"/><circle cx="${19+i*21}" cy="${25}" r="6" fill="#1a1b1d"/>`).join('')}</svg>`},
];
const SLOTS=10;
let PLAYS={};
async function renderGames(){
  const grid=$('#gameGrid');if(!grid)return;
  try{await Store.ready;PLAYS=await Store.plays();}catch(e){}
  const real=GAMES.slice().sort((a,b)=>(PLAYS[b.id]||0)-(PLAYS[a.id]||0));
  let html='';
  for(let k=0;k<SLOTS;k++){const g=real[k];
    if(g){const n=PLAYS[g.id]||0;
      html+=`<button class="gcard cut" data-act="${g.act}" data-game="${g.id}"><div class="rk">${k+1}</div><div class="th">${g.art()}</div><div><div class="t">${g.title}</div><div class="d">${g.desc}</div><div class="pl">${n.toLocaleString('ko-KR')}회 플레이</div></div><div class="go">플레이 ›</div></button>`;}
    else html+=`<button class="gcard cut" disabled><div class="rk">${k+1}</div><div class="th"><span class="label">SOON</span></div><div><div class="t">준비 중</div><div class="d">새 게임이 들어올 자리예요</div></div><div class="go">준비 중</div></button>`;
  }
  grid.innerHTML=html;
}
async function countPlay(id){try{await Store.ready;await Store.addPlay(id);PLAYS[id]=(PLAYS[id]||0)+1;}catch(e){}}

// ===== 서킷 선택 =====
function renderStrip(){
  $('#strip').innerHTML=TRACKS.map(t=>{const o=outlinePath(t,100,8);return `<button class="tcard cut" data-track="${t.id}"><svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"><path d="${o.d}"/></svg><div class="nm">${t.en}</div><div class="ko">${t.name}</div></button>`;}).join('');
}
function selectTrack(id){
  const t=TRACKS.find(x=>x.id===id);if(!t) return; curTrack=t; LS.set('smr_lastTrack',id);
  $$('.tcard').forEach(c=>{const on=c.dataset.track===id;c.classList.toggle('sel',on);c.classList.remove('pick');if(on){void c.offsetWidth;c.classList.add('pick');}});
  $('#dEn').textContent=t.en+' CIRCUIT';$('#dName').textContent=t.name;$('#dPlace').textContent=t.place+' · '+t.note;
  const o=outlinePath(t,400,26);const P0=o.P[0],P1=o.P[3];const ang=Math.atan2(P1[1]-P0[1],P1[0]-P0[0]);
  const nx=-Math.sin(ang)*14,ny=Math.cos(ang)*14;
  $('#bigmap').innerHTML=`<svg viewBox="0 0 400 400"><path class="tr2" d="${o.d}"/><path class="tr" id="mapPath" d="${o.d}"/>
    <line x1="${P0[0]-nx}" y1="${P0[1]-ny}" x2="${P0[0]+nx}" y2="${P0[1]+ny}" stroke="#ffb000" stroke-width="5"/>
    <g transform="translate(${P0[0]+Math.cos(ang)*26} ${P0[1]+Math.sin(ang)*26}) rotate(${ang*57.2958})"><path d="M-7 -7 L5 0 L-7 7" fill="none" stroke="#ffb000" stroke-width="3"/></g>
    <text x="${P0[0]+nx*1.8}" y="${P0[1]+ny*1.8}" fill="#ffb000" font-size="13" font-family="Saira Condensed, sans-serif" font-weight="700" text-anchor="middle" dominant-baseline="middle">START</text></svg>`;
  const mp=$('#mapPath');const L=mp.getTotalLength();mp.style.strokeDasharray=L;mp.style.strokeDashoffset=L;mp.classList.add('draw');
  $('#dStats').innerHTML=`<div><span class="label">길이</span><b>${(t.len/1000).toFixed(3)} km</b></div><div><span class="label">코너</span><b>${t.turns}</b></div><div><span class="label">도로 폭</span><b>${t.width} m</b></div>`;
  $('#startBtn').disabled=false;
  loadRanking(t);
  renderHero(t);
}
async function loadRanking(t){
  const rk=$('#rank');rk.innerHTML='<div class="empty">랭킹 불러오는 중…</div>';$('#recTime').textContent='--:--.---';$('#recWho').textContent='';
  try{
    await Store.ready; const top=await Store.top(t.id,20); if(curTrack!==t) return;
    if(top[0]){$('#recTime').textContent=fmt(top[0].ms);$('#recWho').innerHTML=`${esc(top[0].nick)}<span>${new Date(top[0].at||Date.now()).toLocaleDateString('ko-KR')}</span>`;}
    else{$('#recWho').textContent='아직 기록이 없습니다. 첫 기록의 주인공이 되어 보세요.';}
    let rows=top.map((r,i)=>`<tr class="${USER&&r.key===USER.key?'mine':''}"><td class="p">${i+1}</td><td>${nickCell(r.key,r.nick)}</td><td class="tm">${fmt(r.ms)}</td></tr>`).join('');
    if(USER&&!top.some(r=>r.key===USER.key)){
      const me=await Store.getBest(t.id,USER.key);
      if(me){const rank=await Store.rankOf(t.id,me.ms);rows+=`<tr class="sep"><td colspan="3">· · · 내 기록 · · ·</td></tr><tr class="mine"><td class="p">${rank}</td><td>${nickCell(USER.key,USER.nick)}</td><td class="tm">${fmt(me.ms)}</td></tr>`;}
      else rows+=`<tr class="sep"><td colspan="3">아직 이 서킷 기록이 없어요</td></tr>`;
    }
    if(!USER){const g=LS.get('smr_guest_'+t.id,null);const gm=g==null?null:(typeof g==='number'?g:g.ms);rows+=`<tr class="sep"><td colspan="3">게스트 기록은 랭킹에 오르지 않아요${gm?' · 이 기기 최고 '+fmt(gm):''}</td></tr>`;}
    rk.innerHTML=top.length||USER?`<table>${rows}</table>`:`<div class="empty">아직 아무도 달리지 않았어요.<br>로그인하고 달리면 1위로 등록됩니다.</div><table>${rows}</table>`;
  }catch(e){rk.innerHTML='<div class="empty">랭킹을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>';}
}

// ===== 차고 =====
function buildGarage(){
  initRenderer(); buildTextures();
  if(GAR.scene){ rebuildGarageCar(); return; }
  const sc=new THREE.Scene();sc.background=new THREE.Color(0x07080a);sc.fog=new THREE.Fog(0x07080a,14,34);
  GAR.env=makeEnv(0x30363f,0x050607,[[0,8,0,10,2,6],[-6,3,6,1,6,3],[6,3,6,1,6,3],[0,3,-8,8,1,2]]);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(40,64),new THREE.MeshStandardMaterial({color:0x0d0f12,roughness:0.32,metalness:0.4,envMap:GAR.env}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;sc.add(floor);
  const tt=new THREE.Mesh(new THREE.CylinderGeometry(3.4,3.5,0.12,72),new THREE.MeshStandardMaterial({color:0x15181c,roughness:0.4,metalness:0.6,envMap:GAR.env}));tt.position.y=0.06;tt.receiveShadow=true;sc.add(tt);
  GAR.ring=new THREE.Mesh(new THREE.TorusGeometry(3.45,0.03,8,96),new THREE.MeshBasicMaterial({color:0xffb000}));GAR.ring.rotation.x=Math.PI/2;GAR.ring.position.y=0.12;sc.add(GAR.ring);
  // 뒤쪽 조명 스트립
  GAR.strips=[];for(let k=0;k<11;k++){const a=-1.25+k*0.25;const m=new THREE.MeshBasicMaterial({color:0x9aa4b0});const s=new THREE.Mesh(new THREE.BoxGeometry(0.12,4.2,0.12),m);s.position.set(Math.sin(a)*13,2.4,-Math.cos(a)*13);sc.add(s);GAR.strips.push(m);}
  const ceil=new THREE.Mesh(new THREE.BoxGeometry(7,0.08,0.5),new THREE.MeshBasicMaterial({color:0xffffff}));ceil.position.set(0,6,0);sc.add(ceil);
  sc.add(new THREE.HemisphereLight(0x8a96a8,0x0a0b0d,0.55));
  const key=new THREE.SpotLight(0xffffff,1.6,30,0.6,0.5,1);key.position.set(3,9,6);key.target.position.set(0,0.6,0);key.castShadow=Q().shadow>0;key.shadow.mapSize.set(1024,1024);sc.add(key,key.target);GAR.key=key;
  const rim=new THREE.SpotLight(0xffc35a,1.4,30,0.7,0.6,1);rim.position.set(-6,4,-6);rim.target.position.set(0,0.6,0);sc.add(rim,rim.target);
  const fill=new THREE.DirectionalLight(0x9fb4ff,0.35);fill.position.set(-5,3,5);sc.add(fill);
  sc.traverse(o=>{if(o.isLight){o.color.convertSRGBToLinear();if(o.groundColor)o.groundColor.convertSRGBToLinear();}});linearize(sc);sc.fog.color.convertSRGBToLinear();
  GAR.scene=sc;GAR.cam=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,0.1,100);
  rebuildGarageCar();
  // 드래그 회전
  canvas.addEventListener('pointerdown',e=>{if(MODE!=='garage')return;GAR.drag={x:e.clientX,r:GAR.rot};GAR.auto=false;});
  window.addEventListener('pointermove',e=>{if(MODE!=='garage'||!GAR.drag)return;GAR.rot=GAR.drag.r+(e.clientX-GAR.drag.x)*0.01;});
  window.addEventListener('pointerup',()=>{if(GAR.drag){GAR.drag=null;setTimeout(()=>GAR.auto=true,2500);}});
  resize();
}
function rebuildGarageCar(){
  if(GAR.car){GAR.scene.remove(GAR.car.root);GAR.car.dispose();}
  GAR.car=buildCar(Q().car,PAINTS[paintIdx].c,GAR.env);GAR.car.interior.visible=Q().car>0;GAR.car.root.position.y=0.12;GAR.scene.add(GAR.car.root);
  if(GAR.key) GAR.key.castShadow=Q().shadow>0;
}
function renderSpec(){
  const S=CAR_SPEC;
  const rows=[['최고출력',280/320,'280 마력'],['최대토크',40/50,'40.0 kgf·m'],['0→100km/h',(8-5.3)/5,'5.3 초'],['최고속도',250/320,'250 km/h'],['공차중량',1445/2000,`${S.mass.toLocaleString()} kg`]];
  $('#spec').innerHTML=rows.map(r=>`<span>${r[0]}</span><div class="bar"><i style="width:${Math.round(r[1]*100)}%"></i></div><span class="v">${r[2]}</span>`).join('')+
    `<span>구동</span><span style="color:var(--muted)">전륜(FF) · e-LSD</span><span class="v">8단 DCT</span>`;
  $('#paints').innerHTML=PAINTS.map((p,i)=>`<button class="paint${i===paintIdx?' on':''}" data-paint="${i}" style="background:#${p.c.toString(16).padStart(6,'0')}" aria-label="${p.n}"></button>`).join('')+`<span id="paintName">${PAINTS[paintIdx].n}</span>`;
}
function openGarage(){
  if(!curTrack) return;
  show('garage'); $('#gTrack').innerHTML=`<i></i>${curTrack.name}`; renderSpec();
  try{ buildGarage(); }catch(e){ console.error(e); toast('3D 그래픽을 켜지 못했어요. 브라우저 설정을 확인해 주세요.'); show('tracks'); return; }
  GAR.anim=0; GAR.fade=false; GAR.ring.material.color.setHex(0xffb000); GAR.car.headM.emissiveIntensity=0.6; GAR.strips.forEach(m=>m.color.setHex(0x9aa4b0));
  $('#pickBtn').disabled=false; MODE='garage';
}
function tickGarage(dt){
  if(GAR.auto&&!GAR.anim) GAR.rot+=dt*0.25;
  let camR=8.2,camH=1.9,ty=0.65;
  if(GAR.anim){ GAR.anim+=dt; const t=GAR.anim;
    const target=Math.round((GAR.rot-0.7)/(Math.PI*2))*Math.PI*2+0.7; GAR.rot=lerp(GAR.rot,target,1-Math.exp(-dt*5));
    const k=smooth(0,1.6,t); camR=lerp(8.2,5.6,k); camH=lerp(1.9,1.1,k); ty=lerp(0.65,0.55,k);
    GAR.car.headM.emissiveIntensity= t>0.35? 3.5+Math.sin(t*30)*(t<0.7?2:0):0.6;
    GAR.strips.forEach((m,i)=>m.color.setHex(t>0.4+i*0.04?0xffd27a:0x9aa4b0));
    GAR.ring.material.color.setHSL(0.11,1,0.5+0.3*Math.sin(t*12));
    if(t>1.25&&!GAR.fade){GAR.fade=true;$('#flash').classList.add('on');}
    if(t>1.8){GAR.anim=0;GAR.fade=false;startRace();return;}
  }
  GAR.car.root.rotation.y=GAR.rot;
  GAR.car.wheels.forEach(w=>{if(w.front)w.pivot.rotation.y=-Math.sin(performance.now()/1400)*0.12*(GAR.anim?0:1);});
  GAR.cam.position.set(Math.sin(0.5)*camR,camH,Math.cos(0.5)*camR);GAR.cam.lookAt(0,ty,0);
  renderer.render(GAR.scene,GAR.cam);
}
function pickCar(){ if(GAR.anim) return; audioInit(); GAR.anim=0.0001; $('#pickBtn').disabled=true; beep(520,0.08); setTimeout(()=>beep(780,0.12),180); }

// ===== 서킷 선택 배경: 그 서킷의 대표 장면을 3D로 렌더링
async function renderHero(t){
  const tok=(renderHero.tok=(renderHero.tok||0)+1);const el=$('#tracks');
  if(t._hero){el.style.backgroundImage=`url(${t._hero})`;el.classList.add('hashero');return;}
  el.classList.remove('hashero');el.style.backgroundImage='';
  if(t._layout===undefined) await loadLayout(t);
  if(tok!==renderHero.tok||$('#tracks').hidden) return;
  await new Promise(r=>setTimeout(r,40));if(tok!==renderHero.tok)return;
  try{
    if(!(RACE.scene&&RACE.builtKey===raceKey(t))){buildRace(t);RACE.builtKey=raceKey(t);}
    const T=RACE.T,N=T.N,hv=t.env.hero||{f:0.97,h:8,look:180};let i;
    if(hv.near){const o=(T.layout.objs||[]).find(o=>o.t===hv.near);let bi=0,bd=1e18;if(o){for(let k=0;k<N;k++){const d=(T.px[k]-o.x)**2+(T.pz[k]-o.z)**2;if(d<bd){bd=d;bi=k;}}}i=(bi-Math.round(hv.back/T.ds)+N)%N;}
    else i=Math.floor((((hv.f%1)+1)%1)*N)%N;
    const j=(i+Math.round(hv.look/T.ds))%N;
    // 차는 출발 위치에
    const si=T.startIdx;RACE.car.root.position.set(T.px[si]-T.tz[si]*T.startLat,T.py[si],T.pz[si]+T.tx[si]*T.startLat);RACE.car.root.rotation.set(0,Math.atan2(T.tx[si],T.tz[si]),0);
    const cam=RACE.cam;const lat=hv.side||0;
    cam.position.set(T.px[i]-T.tz[i]*lat,T.py[i]+hv.h,T.pz[i]+T.tx[i]*lat);cam.lookAt(T.px[j],T.py[j]+(hv.ly||3),T.pz[j]);
    cam.fov=58;cam.aspect=16/9;cam.updateProjectionMatrix();RACE.sky.position.copy(cam.position);
    RACE.sun.position.set(T.px[j]+RACE.sunDir.x*150,T.py[j]+RACE.sunDir.y*150,T.pz[j]+RACE.sunDir.z*150);RACE.sun.target.position.set(T.px[j],T.py[j],T.pz[j]);
    renderer.setSize(1280,720,false);renderer.render(RACE.scene,cam);
    const url=renderer.domElement.toDataURL('image/jpeg',0.82);resize();
    t._hero=url;if(tok!==renderHero.tok)return;el.style.backgroundImage=`url(${url})`;el.classList.add('hashero');
  }catch(e){console.warn('hero',e);}
}
