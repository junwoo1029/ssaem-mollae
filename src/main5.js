// ===== 레이스 =====
function disposeRace(){
  if(!RACE.scene) return;
  RACE.scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)[].concat(o.material).forEach(m=>{if(m.map&&!Object.values(TEX).includes(m.map))m.map.dispose();m.dispose();});});
  if(RACE.env) RACE.env.dispose();
  RACE.scene=null;RACE.T=null;RACE.car=null;RACE.builtKey=null;RACE.skid=null;
}
function raceKey(t){return t.id+'|'+SET.quality+'|'+(t._layout?t._layout.v:0)+'|'+paintIdx;}
function buildRace(t){
  disposeRace(); initRenderer(); buildTextures(); objMats.m=null;
  const env=t.env,q=Q();
  const sc=new THREE.Scene();
  RACE.env=makeEnv(env.sky[0],env.ground,[[env.sun[0]*40,env.sun[1]*40,env.sun[2]*40,14,14,4]]);
  sc.fog=new THREE.Fog(env.fog,180,env.fogD);
  sc.background=new THREE.Color(env.fog);
  // 하늘 돔
  const sunDir=new THREE.Vector3(...env.sun).normalize();
  const sky=new THREE.Mesh(new THREE.SphereGeometry(3000,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{top:{value:new THREE.Color(env.sky[0])},hor:{value:new THREE.Color(env.sky[1])},sd:{value:sunDir},sc:{value:new THREE.Color(env.sunCol)}},
    vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform vec3 top;uniform vec3 hor;uniform vec3 sd;uniform vec3 sc;varying vec3 p;void main(){vec3 d=normalize(p);float h=d.y;vec3 c=mix(hor,top,pow(clamp(h,0.,1.),.55));if(h<0.)c=hor*.92;float s=max(dot(d,sd),0.);c+=sc*(pow(s,900.)*3.+pow(s,10.)*.22);gl_FragColor=vec4(c,1.);}'}));
  sky.renderOrder=-1;sc.add(sky);RACE.sky=sky;
  sc.add(new THREE.HemisphereLight(env.sky[1],env.ground,env.dusk?0.75:0.6));
  const sun=new THREE.DirectionalLight(env.sunCol,env.dusk?1.6:2.4);sun.castShadow=q.shadow>0;
  if(q.shadow){sun.shadow.mapSize.set(q.shadow,q.shadow);const sc2=sun.shadow.camera;sc2.left=-45;sc2.right=45;sc2.top=45;sc2.bottom=-45;sc2.near=1;sc2.far=400;sun.shadow.bias=-0.0006;sun.shadow.normalBias=0.04;}
  sc.add(sun,sun.target);RACE.sun=sun;RACE.sunDir=sunDir;
  RACE.T=buildTrack(t);sc.add(RACE.T.group);
  RACE.car=buildCar(q.car,PAINTS[paintIdx].c,RACE.env);sc.add(RACE.car.root);
  if(q.shadow) RACE.car.blob.visible=false;
  RACE.cam=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.08,5000);
  linearize(RACE.T.group);sc.traverse(o=>{if(o.isLight&&!o.userData.lin){o.color.convertSRGBToLinear();if(o.groundColor)o.groundColor.convertSRGBToLinear();o.userData.lin=1;}});sc.fog.color.convertSRGBToLinear();
  RACE.scene=sc;resize();skidInit();
  // 미니맵 준비
  const o=outlinePath(t,340,24);RACE.mini={path:new Path2D(o.d),map:o.map};$('#miniName').textContent=t.en;
}
async function startRace(){
  const t=curTrack; MODE='none';
  $('#lEn').textContent=t.en; $('#lName').textContent=t.name;
  $('#lTip').textContent=['Space를 누르면 바퀴가 잠기며 미끄러져요. 좌우와 같이 누르면 드리프트!','드리프트하면 부스트 게이지가 차요.','코너 전에 미리 감속하면 더 빨라요.','부스트(Shift)는 20초 분량. 아껴 쓰면 다시 차요.','C 키로 운전석 시점을 써 보세요.','길을 잃으면 R 키로 트랙에 복귀할 수 있어요.'][Math.floor(Math.random()*5)];
  $('#loading').hidden=false; $('#flash').classList.remove('on');
  await new Promise(r=>setTimeout(r,60));
  if(t._layout===undefined) await loadLayout(t);
  try{ if(!(RACE.scene&&RACE.builtKey===raceKey(t))){buildRace(t);RACE.builtKey=raceKey(t);} RACE.car.root.visible=true; }catch(e){ console.error(e); $('#loading').hidden=true; toast('서킷을 불러오지 못했어요.'); show('tracks'); return; }
  // 기록 불러오기
  RACE.pb=null;RACE.tr=null;RACE.pbSec=null;
  try{ await Store.ready; const top=await Store.top(t.id,1); RACE.tr=top[0]||null;
    if(USER){const me=await Store.getBest(t.id,USER.key);RACE.pb=me?me.ms:null;RACE.pbSec=me&&me.sec||null;}
    else{const g=LS.get('smr_guest_'+t.id,null);RACE.pb=g==null?null:(typeof g==='number'?g:g.ms);RACE.pbSec=g&&g.sec||null;}
  }catch(e){}
  $('#tPb').textContent=fmt(RACE.pb);$('#tTr').textContent=RACE.tr?fmt(RACE.tr.ms):'--:--.---';
  show('hud'); $('#loading').hidden=true; updateTouchVis();
  RACE.camMode=SET.cam; resetRace(); MODE='race';
}
function resetRace(){
  const T=RACE.T,i=T.startIdx;const c=newCarState();
  const rx=-T.tz[i],rz=T.tx[i];c.x=T.px[i]+rx*T.startLat;c.z=T.pz[i]+rz*T.startLat;c.yaw=Math.atan2(T.tx[i],T.tz[i]);
  RACE.c=c;RACE.idx=i;RACE.prevIdx=i;RACE.cp=[0,0,0];RACE.time=0;RACE.acc=0;RACE.phase='intro';RACE.phaseT=0;RACE.litN=0;RACE.hold=0.4+Math.random()*1.6;
  RACE.camYaw=c.yaw;RACE.paused=false;RACE.shake=0;RACE.offT=0;RACE.camInit=false;
  RACE.sus={h:0,p:0,r:0,vh:0,vp:0,vr:0};RACE.sec=[];RACE.travel=0;resetSectorsHUD();
  if(RACE.skid){RACE.skid.n=0;RACE.skid.mesh.count=0;RACE.skid.last=[null,null,null,null];}
  setLights(0);$('#lights').classList.remove('hide');$('#tNow').textContent='0:00.000';
  for(const id of ['#resultOv','#pauseOv','#settingsOv']) $(id).hidden=true;
  msg('',0);
  if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
}
function setLights(n){RACE.litN=n;$$('#lights .pod').forEach((p,k)=>p.classList.toggle('on',k<n));if(RACE.T)RACE.T.lampMats.forEach((m,k)=>m.emissiveIntensity=k<n?6:0);}
function msg(t,ms){const el=$('#cmsg');el.textContent=t;el.classList.toggle('on',!!t);clearTimeout(msg._t);if(t&&ms)msg._t=setTimeout(()=>el.classList.remove('on'),ms);}
const SURF={road:{mu:1,roll:0},kerb:{mu:0.97,roll:0.006},grass:{mu:0.82,roll:0.035}};
// 차체 모서리(길이 4.68m, 폭 1.83m) — 벽/물체 충돌 판정용
const CAR_CORNERS=[[2.3,0.9],[2.3,-0.9],[-2.32,0.9],[-2.32,-0.9],[0.9,0.92],[0.9,-0.92],[-1.0,0.92],[-1.0,-0.92]];
function collide(c,T,h){
  const fx=Math.sin(c.yaw),fz=Math.cos(c.yaw),rx=-fz,rz=fx,M=CAR_SPEC.mass,I=CAR_SPEC.Iz;
  let best=null;
  for(const [lf,lr] of CAR_CORNERS){
    const ox=fx*lf+rx*lr, oz=fz*lf+rz*lr, px=c.x+ox, pz=c.z+oz;
    const q=trackQuery(T,px,pz,RACE.idx);
    const wall=(q.lat>0?T.wallR[q.i]:T.wallL[q.i])-0.05;
    const pen=Math.abs(q.lat)-wall;
    if(pen>0&&(!best||pen>best.pen)){const sg=Math.sign(q.lat);best={pen,ox,oz,nx:T.tz[q.i]*sg,nz:-T.tx[q.i]*sg};} // n: 트랙 안쪽 방향
  }
  // 사용자가 배치한 물체(원형 판정)
  if(T.colliders) for(const o of T.colliders){const dx=c.x-o.x,dz=c.z-o.z;if(dx*dx+dz*dz>(o.r+3)**2)continue;
    for(const [lf,lr] of CAR_CORNERS){const ox=fx*lf+rx*lr,oz=fz*lf+rz*lr,px=c.x+ox-o.x,pz=c.z+oz-o.z;const d=Math.hypot(px,pz);const pen=o.r-d;
      if(pen>0&&(!best||pen>best.pen))best={pen,ox,oz,nx:px/(d||1),nz:pz/(d||1)};}}
  if(!best) return;
  const {pen,ox,oz,nx,nz}=best;
  c.x+=nx*pen;c.z+=nz*pen;
  const w=-c.r; // y축 각속도
  const vcx=c.vx+w*oz, vcz=c.vz-w*ox;
  const vn=vcx*nx+vcz*nz;
  if(vn<0){
    const rn=oz*nx-ox*nz;
    const e=0.22;const J=-(1+e)*vn/(1/M+rn*rn/I);
    c.vx+=J*nx/M;c.vz+=J*nz/M;let w2=w+J*rn/I;
    // 벽을 따라 긁히는 마찰
    const tx=-nz,tz=nx,vt=vcx*tx+vcz*tz,rt=oz*tx-ox*tz;
    const Jt=clamp(-vt/(1/M+rt*rt/I),-0.35*J,0.35*J);
    c.vx+=Jt*tx/M;c.vz+=Jt*tz/M;w2+=Jt*rt/I;
    c.r=-w2;
    const hit=-vn;RACE.shake=Math.min(1.2,RACE.shake+hit/10);if(hit>2.5)thud(hit);
    if(hit>1) RACE.scrape=0.25;
  }
}
function physicsStep(h,inp){
  const T=RACE.T,c=RACE.c;
  const q=trackQuery(T,c.x,c.z,RACE.idx);
  const a=Math.abs(q.lat);c.surface=a<=T.hw?'road':(a<=T.hw+T.kerbW?'kerb':'grass');
  c.slope=T.slope[q.i]*(Math.sin(c.yaw)*T.tx[q.i]+Math.cos(c.yaw)*T.tz[q.i]);
  const live=RACE.phase==='run';
  stepCar(c,live?inp:{brake:RACE.phase==='done'?0.6:1,steer:0},h,SURF[c.surface]);
  collide(c,T,h);
  const q2=trackQuery(T,c.x,c.z,q.i);
  RACE.prevIdx=RACE.idx;RACE.idx=q2.i;c.y=q2.h-(c.surface==='grass'?0.05:0);RACE.lat=q2.lat;
  if(live){
    RACE.time+=h;
    const N=T.N,i=RACE.idx,p=RACE.prevIdx;
    [0.25,0.5,0.75].forEach((f,k)=>{if(!RACE.cp[k]&&(k===0||RACE.cp[k-1])&&i>=N*f&&i<N*f+80)RACE.cp[k]=1;});
    // 섹터 기록
    const si=T.sectorIdx,k=RACE.sec.length;
    if(k<2&&p<si[k]&&i>=si[k]&&i-si[k]<60&&(k===0||RACE.cp[0])){RACE.sec.push(RACE.time*1000-(k?RACE.sec[0]:0));showSector(k);}
    if(RACE.prevIdx>N-60&&i<60&&RACE.cp[2]) finishLap(RACE.time*1000);
  }
}
function getInput(){
  const k=KEYS,t=TOUCH;
  return {thr:k.thr||t.thr,back:k.back||t.back,lock:k.lock||t.lock,boost:k.boost||t.boost,steer:((k.right||t.right)?1:0)-((k.left||t.left)?1:0)};
}
function resetToTrack(){
  if(RACE.phase!=='run') return; const T=RACE.T,c=RACE.c,i=RACE.idx;
  c.x=T.px[i];c.z=T.pz[i];c.yaw=Math.atan2(T.tx[i],T.tz[i]);c.vx=c.vz=0;c.r=0;c.steer=0;c.gear=1;c.drift=0;msg('트랙 복귀',900);
}
// ----- 서스펜션 (시각/카메라용 스프링-댐퍼) + 연석 진동
const WHEEL_POS=[[1.36,0.8],[1.36,-0.8],[-1.36,0.8],[-1.36,-0.8]];
function roadBump(T,x,z,hint,dist){
  const q=trackQuery(T,x,z,hint);const a=Math.abs(q.lat);
  if(a<=T.hw) return 0.0015*Math.sin(dist*7.1)+0.001*Math.sin(dist*13.7);
  if(a<=T.hw+T.kerbW){ // 연석: 리브 간격 약 1m, 높이 3~5cm
    const k=(a-T.hw)/T.kerbW; return 0.012+0.03*Math.max(0,Math.sin(dist*Math.PI*2/1.0))*(0.6+0.4*k);}
  return 0.012*Math.sin(dist*3.3+x*0.7)+0.01*Math.sin(dist*5.9+z); // 잔디: 울퉁불퉁
}
function suspensionTick(dt){
  const R=RACE,c=R.c,T=R.T,S=R.sus;
  const fx=Math.sin(c.yaw),fz=Math.cos(c.yaw),rx=-fz,rz=fx;
  const travel=(R.travel=(R.travel||0)+Math.abs(c.u)*dt);
  let b=[0,0,0,0],onKerb=0;
  for(let k=0;k<4;k++){const [lf,lr]=WHEEL_POS[k];const x=c.x+fx*lf+rx*lr,z=c.z+fz*lf+rz*lr;
    b[k]=roadBump(T,x,z,R.idx,travel+lf+(lr>0?0.37:0));if(b[k]>0.011)onKerb++;}
  R.wheelBump=b;R.onKerb=onKerb;
  const heaveT=(b[0]+b[1]+b[2]+b[3])/4;
  const pitchT=clamp(c.axs||c.ax,-12,12)*0.0042+((b[0]+b[1])-(b[2]+b[3]))/2/2.72;
  const rollT=-clamp(c.ay,-15,15)*0.0042+((b[0]+b[2])-(b[1]+b[3]))/2/1.6*-1;
  const K=190,C=12;
  for(const [key,tgt] of [['h',heaveT],['p',pitchT],['r',rollT]]){
    const a=K*(tgt-S[key])-C*S['v'+key];S['v'+key]+=a*dt;S[key]+=S['v'+key]*dt;}
  if(onKerb&&Math.abs(c.u)>5) R.shake=Math.max(R.shake,0.12+Math.min(0.35,Math.abs(c.u)/80));
}
// ----- 타이어 자국
function skidInit(){
  const g=new THREE.PlaneGeometry(0.26,0.55);g.rotateX(-Math.PI/2);
  const m=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.42,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3});
  const mesh=new THREE.InstancedMesh(g,m,900);mesh.count=0;mesh.frustumCulled=false;RACE.scene.add(mesh);
  RACE.skid={mesh,n:0,last:[null,null,null,null]};
}
const _sm=new THREE.Matrix4(),_sq=new THREE.Quaternion(),_sv=new THREE.Vector3(),_ss=new THREE.Vector3(1,1,1),_UP=new THREE.Vector3(0,1,0);
function skidTick(){
  const R=RACE,c=R.c,S=R.skid;if(!S)return;
  const sp=Math.hypot(c.vx,c.vz);const on=c.slip>0.35&&sp>3&&c.surface!=='grass';
  const fx=Math.sin(c.yaw),fz=Math.cos(c.yaw),rx=-fz,rz=fx;
  for(let k=0;k<4;k++){
    const front=k<2; if(!on||(front&&!c.locked)){S.last[k]=null;continue;}
    const [lf,lr]=WHEEL_POS[k];const x=c.x+fx*lf+rx*lr,z=c.z+fz*lf+rz*lr;
    const L=S.last[k];if(L&&(x-L[0])**2+(z-L[1])**2<0.25)continue;
    S.last[k]=[x,z];
    const ang=Math.atan2(c.vx,c.vz);_sq.setFromAxisAngle(_UP,ang);
    _sm.compose(_sv.set(x,c.y+0.03,z),_sq,_ss);S.mesh.setMatrixAt(S.n%900,_sm);S.n++;S.mesh.count=Math.min(900,S.n);S.mesh.instanceMatrix.needsUpdate=true;
  }
}
const tmpV=new THREE.Vector3(),tmpV2=new THREE.Vector3();
function tickRace(dt){
  const R=RACE,c=R.c,T=R.T,car=R.car;
  if(!R.paused){
    R.phaseT+=dt;
    if(R.phase==='intro'&&R.phaseT>2.4){R.phase='lights';R.phaseT=0;}
    if(R.phase==='lights'){const n=Math.min(5,Math.floor(R.phaseT/0.9)+1);if(n!==R.litN){setLights(n);beep(440,0.12);}
      if(R.phaseT>4.5+R.hold){setLights(0);R.phase='run';R.phaseT=0;msg('GO',900);beep(880,0.35);setTimeout(()=>$('#lights').classList.add('hide'),700);}}
    const inp=getInput();
    if(R.phase==='intro'||R.phase==='lights'){ // 출발 전: 공회전, 가속 페달로 회전수만 올림
      c.rpm=lerp(c.rpm,inp.thr?4200:850,1-Math.exp(-dt*(inp.thr?4:3)));
      const q=trackQuery(T,c.x,c.z,R.idx);c.y=q.h;
    } else {
      R.acc+=Math.min(dt,0.1);const h=1/240;while(R.acc>=h){physicsStep(h,inp);R.acc-=h;}
    }
    suspensionTick(Math.min(dt,0.05));skidTick();
    if(R.phase==='run') $('#tNow').textContent=fmt(R.time*1000);
    // 경고
    const fwd=c.vx*T.tx[R.idx]+c.vz*T.tz[R.idx];
    const w=R.phase==='run'?(fwd<-4?'역주행':(c.surface==='grass'?'트랙 이탈':(c.drift>0.3&&Math.abs(c.beta)>0.15?'DRIFT · 부스트 충전':''))):'';
    const we=$('#warn');if(we.textContent!==w){we.textContent=w||we.textContent;we.classList.toggle('on',!!w);we.classList.toggle('drift',w.startsWith('DRIFT'));}
  }
  // 차량 표시: 차체는 도로 경사만 따르고, 서스펜션 움직임은 차체 그룹에
  const pitch=-Math.atan(T.slope[R.idx]*(Math.sin(c.yaw)*T.tx[R.idx]+Math.cos(c.yaw)*T.tz[R.idx]));
  car.root.position.set(c.x,c.y,c.z);car.root.rotation.set(pitch,c.yaw,0,'YXZ');
  const S=R.sus;car.bodyG.position.y=S.h;car.bodyG.rotation.set(S.r,0,S.p);
  const wb=R.wheelBump||[0,0,0,0];
  car.wheels.forEach((w,k)=>{w.spin.rotation.z=-c.wheelAng;if(w.front)w.pivot.rotation.y=-c.steer;w.pivot.position.y=CAR_SHAPE.R+wb[k];});
  car.tailM.emissiveIntensity=c.brk>0?4:0.6;
  car.steer.rotation.x=c.steer*5;
  // 카메라
  car.root.updateMatrixWorld(true);
  const cam=R.cam;const cockpit=R.camMode==='cockpit'&&R.phase!=='intro';
  car.interior.visible=cockpit||Q().car>0;car.glassMeshes.forEach(g=>g.visible=!cockpit);if(car.ghPaint)car.ghPaint.visible=!cockpit;car.cockpitOnly.visible=cockpit;
  const shake=R.shake*(cockpit?0.5:1);
  if(cockpit){
    car.bodyG.localToWorld(tmpV.set(-0.5,1.16,-0.37));car.bodyG.localToWorld(tmpV2.set(6,0.9,-0.37));
    cam.position.copy(tmpV);cam.up.set(0,1,0);cam.lookAt(tmpV2);cam.near=0.05;
    if(shake>0){cam.position.y+=(Math.random()-0.5)*shake*0.03;cam.position.x+=(Math.random()-0.5)*shake*0.015;}
    cam.fov=lerp(cam.fov,70,0.1);
    if((R.frame++%3)===0) drawDash(car,Math.abs(c.u)*3.6,c.rpm,c.gear===-1?'R':String(c.gear),c.boost);
  } else {
    cam.near=0.1;
    const sp=Math.hypot(c.vx,c.vz);
    let ty=c.yaw; if(sp>6){const vy=Math.atan2(c.vx,c.vz);let d=vy-c.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));if(c.u>0)ty=c.yaw+clamp(d,-0.7,0.7)*0.65;}
    let dy=ty-R.camYaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));R.camYaw+=dy*(1-Math.exp(-dt*5));
    let dist=7.0,hgt=3.0,ang=R.camYaw;
    if(R.phase==='intro'){const k=smooth(0,2.4,R.phaseT);ang=c.yaw+Math.PI*(1-k)*1.15;dist=lerp(13,7.0,k);hgt=lerp(5.5,3.0,k);}
    const fx=Math.sin(ang),fz=Math.cos(ang);
    tmpV.set(c.x-fx*dist,c.y+hgt,c.z-fz*dist);
    // 카메라가 벽 밖으로 나가지 않게
    const qc=trackQuery(T,tmpV.x,tmpV.z,R.idx);const lim=(qc.lat>0?T.wallR[qc.i]:T.wallL[qc.i])-0.4;
    if(Math.abs(qc.lat)>lim){const sg=Math.sign(qc.lat),over=Math.abs(qc.lat)-lim;tmpV.x-=-T.tz[qc.i]*sg*over;tmpV.z-=T.tx[qc.i]*sg*over;}
    const gh=Math.max(T.terrainH(tmpV.x,tmpV.z),qc.h)+0.8; if(tmpV.y<gh)tmpV.y=gh;
    if(T.tunnel[qc.i]) tmpV.y=Math.min(tmpV.y,qc.h+5.4);
    if(!R.camInit||R.phase==='intro'){cam.position.copy(tmpV);R.camInit=true;} else cam.position.lerp(tmpV,1-Math.exp(-dt*11));
    if(shake>0){cam.position.x+=(Math.random()-0.5)*shake*0.22;cam.position.y+=(Math.random()-0.5)*shake*0.16;}
    cam.lookAt(c.x+Math.sin(R.camYaw)*4,c.y+1.25,c.z+Math.cos(R.camYaw)*4);
    cam.fov=lerp(cam.fov,60+clamp(Math.abs(c.u)*3.6,0,260)*0.07+(c.boosting?4:0),0.08);
  }
  cam.updateProjectionMatrix();R.shake=Math.max(0,R.shake-dt*3);R.scrape=Math.max(0,(R.scrape||0)-dt);
  R.sky.position.copy(cam.position);
  R.sun.position.set(c.x+R.sunDir.x*150,c.y+R.sunDir.y*150,c.z+R.sunDir.z*150);R.sun.target.position.set(c.x,c.y,c.z);
  updateHUD();
  audioUpdate(c,!R.paused&&R.phase!=='none');
  renderer.render(R.scene,cam);
}
// HUD
function secFmt(ms){if(ms==null)return '--.---';ms=Math.round(ms);const s=Math.floor(ms/1000),x=ms%1000;return (s>=60?Math.floor(s/60)+':'+String(s%60).padStart(2,'0'):s)+'.'+String(x).padStart(3,'0');}
function secClass(k,ms){const tr=RACE.tr&&RACE.tr.sec&&RACE.tr.sec[k],pb=RACE.pbSec&&RACE.pbSec[k];
  if(tr==null||ms<tr) return 'purple'; if(pb==null||ms<pb) return 'green'; return 'yellow';}
function resetSectorsHUD(){for(let k=0;k<3;k++){const el=$('#sc'+k);el.className='';el.querySelector('b').textContent=RACE.pbSec&&RACE.pbSec[k]!=null?secFmt(RACE.pbSec[k]):'--.---';el.style.opacity=.55;}}
function showSector(k){const ms=RACE.sec[k];const el=$('#sc'+k);el.className=secClass(k,ms);el.style.opacity=1;el.querySelector('b').textContent=secFmt(ms);}
const rpmEls=[];{const r=$('#rpm');for(let i=0;i<22;i++){const e=document.createElement('i');e.className=i>=19?'r':(i>=15?'y':'');r.appendChild(e);rpmEls.push(e);}}
let hudPrev={};
function updateHUD(){
  const c=RACE.c;const spd=Math.round(Math.abs(c.u)*3.6),gear=c.gear===-1?'R':String(c.gear);
  if(hudPrev.spd!==spd){$('#spd').textContent=spd;hudPrev.spd=spd;}
  if(hudPrev.gear!==gear){$('#gear').textContent=gear;hudPrev.gear=gear;}
  const lit=Math.round(clamp(c.rpm/6800,0,1)*22);if(hudPrev.lit!==lit){rpmEls.forEach((e,i)=>e.classList.toggle('on',i<lit));hudPrev.lit=lit;}
  const b=Math.round(c.boost*100);if(hudPrev.b!==b){$('#boostfill').style.width=b+'%';hudPrev.b=b;}
  $('#boostbar').classList.toggle('on',c.boosting);
  // 미니맵
  const mc=$('#mini'),x=mc.getContext('2d');x.clearRect(0,0,340,340);
  x.lineJoin='round';x.strokeStyle='rgba(255,255,255,.18)';x.lineWidth=14;x.stroke(RACE.mini.path);x.strokeStyle='#e8ecef';x.lineWidth=5;x.stroke(RACE.mini.path);
  const T=RACE.T,s=RACE.mini.map(T.px[0],T.pz[0]);x.fillStyle='#ffb000';x.fillRect(s[0]-5,s[1]-5,10,10);
  const p=RACE.mini.map(c.x,c.z);x.beginPath();x.arc(p[0],p[1],10,0,7);x.fillStyle='#ffb000';x.fill();x.lineWidth=3;x.strokeStyle='#000';x.stroke();
}
async function finishLap(ms){
  const R=RACE;if(R.phase!=='run')return;R.phase='done';R.phaseT=0;
  ms=Math.round(ms);$('#tNow').textContent=fmt(ms);msg('FINISH',1400);beep(990,0.2);setTimeout(()=>beep(1320,0.3),220);
  while(R.sec.length<2)R.sec.push(null);
  const s3=ms-(R.sec[0]||0)-(R.sec[1]||0);const sec=[R.sec[0],R.sec[1],R.sec[0]!=null&&R.sec[1]!=null?s3:null].map(v=>v==null?null:Math.round(v));
  R.sec=sec;showSector(2);const secCls=sec.map((v,k)=>v==null?'':secClass(k,v));
  const t=curTrack, prevPB=R.pb, isPB=prevPB==null||ms<prevPB, beatTR=!R.tr||ms<R.tr.ms;
  let saved=false,rank=null,err=null;
  if(USER){ if(isPB){ try{ await Store.setBest(t.id,USER.key,{nick:USER.nick,ms,sec,at:Date.now(),car:'SMR-1'}); saved=true; R.pb=ms; R.pbSec=sec; }catch(e){err=saveErr(e);} }
    try{ rank=await Store.rankOf(t.id,R.pb??ms); }catch(e){} }
  else if(isPB){ LS.set('smr_guest_'+t.id,{ms,sec}); R.pb=ms; R.pbSec=sec; }
  if(USER&&saved&&beatTR) R.tr={nick:USER.nick,ms,sec};
  $('#tPb').textContent=fmt(R.pb);
  setTimeout(()=>{
    $('#rTrack').textContent=t.en+' · '+t.name;
    const tt=$('#rTime');tt.textContent=fmt(ms);tt.className='laptime'+(beatTR&&(USER?saved:true)?' tr':(isPB?' pb':''));
    let badges='';
    if(beatTR&&USER&&saved) badges+='<span class="badge tr">트랙 신기록</span>';
    else if(beatTR&&!USER) badges+='<span class="badge tr">트랙 레코드보다 빠름</span>';
    if(isPB) badges+='<span class="badge pb">개인 최고 기록</span>';
    if(!badges) badges='<span class="badge n">완주</span>';
    $('#rBadges').innerHTML=badges+'<div class="rsecs" style="width:100%">'+sec.map((v,k)=>`<div class="${secCls[k]}"><span>SECTOR ${k+1}</span><b>${secFmt(v)}</b></div>`).join('')+'</div>';
    let list=`<span>이번 랩</span><b>${fmt(ms)}</b><span>내 최고 기록</span><b>${fmt(R.pb)}</b><span>트랙 레코드${R.tr?' · '+esc(R.tr.nick):''}</span><b>${R.tr?fmt(R.tr.ms):'—'}</b>`;
    if(USER&&rank) list+=`<span>내 순위</span><b>${rank<=20?rank+'위':rank+'위 (20위 밖)'}</b>`;
    if(USER) list+=`<span style="grid-column:1/-1;font-size:12.5px">${esc(USER.nick)} 이름으로 저장 중 · <button class="linkbtn" type="button" data-act="switch-user">다른 사람으로 타기</button></span>`;
    if(!USER) list+=`<form class="gsave" id="gsave" style="grid-column:1/-1" autocomplete="off">
      <div class="gs-t">이 기록을 랭킹에 올리기</div>
      <div class="gs-row"><input id="gsNick" maxlength="12" placeholder="닉네임" aria-label="닉네임" autocapitalize="off" spellcheck="false"><input id="gsPw" type="password" maxlength="32" placeholder="비밀번호 4자리+" aria-label="비밀번호"></div>
      <div class="gs-row"><button class="btn primary" type="submit" data-new="0">로그인하고 저장</button><button class="btn ghost" type="button" id="gsNew">새로 만들고 저장</button></div>
      <div class="msg" id="gsMsg">친구와 번갈아 탈 때도 각자 닉네임으로 저장하면 돼요.</div></form>`;
    if(err) list+=`<span style="grid-column:1/-1;color:#ff7a7a">${err}</span>`;
    $('#rList').innerHTML=list;$('#resultOv').hidden=false;
    if(!USER&&$('#gsave')){const lap={ms,sec,tid:t.id};
      const go=async isNew=>{const el=$('#gsMsg');const set=(x,c)=>{el.textContent=x;el.className='msg '+(c||'');};
        if(!await authUser($('#gsNick').value,$('#gsPw').value,isNew,set))return;
        try{const me=await Store.getBest(lap.tid,USER.key);
          if(!me||lap.ms<me.ms){await Store.setBest(lap.tid,USER.key,{nick:USER.nick,ms:lap.ms,sec:lap.sec,at:Date.now(),car:'SMR-1'});R.pb=lap.ms;R.pbSec=lap.sec;set(`${USER.nick} 이름으로 ${fmt(lap.ms)} 기록을 저장했어요.`,'ok');}
          else{R.pb=me.ms;R.pbSec=me.sec||null;set(`이미 더 빠른 기록(${fmt(me.ms)})이 있어서 그대로 두었어요.`,'ok');}
          const rank=await Store.rankOf(lap.tid,R.pb);$('#tPb').textContent=fmt(R.pb);
          $('#gsave').insertAdjacentHTML('beforebegin',`<span>내 순위</span><b>${rank<=20?rank+'위':rank+'위 (20위 밖)'}</b>`);
          $('#gsave').querySelectorAll('input,button').forEach(x=>x.disabled=true);
        }catch(e){set(saveErr(e),'err');}};
      $('#gsave').addEventListener('submit',e=>{e.preventDefault();go(false);});$('#gsNew').addEventListener('click',()=>go(true));}
  },1300);
}
function togglePause(force){
  if(MODE!=='race'||RACE.phase==='done') return;
  RACE.paused=force!==undefined?force:!RACE.paused;$('#pauseOv').hidden=!RACE.paused;
}
function exitRace(){
  MODE='none';RACE.phase='none';audioUpdate(null,false);disposeRace();
  for(const id of ['#resultOv','#pauseOv','#settingsOv']) $(id).hidden=true;
  show('tracks');if(curTrack){selectTrack(curTrack.id);}
}

// ===== 입력 =====
const KEYS={thr:0,back:0,left:0,right:0,lock:0,boost:0};
const TOUCH={thr:0,back:0,left:0,right:0,lock:0,boost:0};
const KMAP={KeyW:'thr',ArrowUp:'thr',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'lock',ShiftLeft:'boost',ShiftRight:'boost'};
window.addEventListener('keydown',e=>{
  if(e.target&&e.target.tagName==='INPUT')return;
  if(MODE==='race'){
    const k=KMAP[e.code];
    if(k&&!modalOpen()){KEYS[k]=1;e.preventDefault();}
    if(e.code==='KeyC'&&!e.repeat){RACE.camMode=RACE.camMode==='chase'?'cockpit':'chase';}
    if(e.code==='KeyR'&&!e.repeat) resetToTrack();
    if(e.code==='Escape'||e.code==='KeyP'){ if(modalOpen()){closeModals();} else togglePause(); }
    if(e.code==='Enter'&&!$('#resultOv').hidden){resetRace();}
  } else if(MODE==='garage'&&e.code==='Enter'){pickCar();}
});
window.addEventListener('keyup',e=>{const k=KMAP[e.code];if(k)KEYS[k]=0;});
window.addEventListener('blur',()=>{for(const k in KEYS)KEYS[k]=0;for(const k in TOUCH)TOUCH[k]=0;});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&MODE==='race'&&RACE.phase!=='done')togglePause(true);});
// 터치 버튼 (멀티터치 + 왼쪽/오른쪽 사이 미끄러지기)
const tActive=new Map();
function syncTouch(){for(const k in TOUCH)TOUCH[k]=0;for(const k of tActive.values())TOUCH[k]=1;$$('#touch .tb').forEach(b=>b.classList.toggle('on',!!TOUCH[b.dataset.k]));}
$('#touch').addEventListener('pointerdown',e=>{const b=e.target.closest('.tb');if(!b)return;e.preventDefault();
  if(b.dataset.k==='reset'){resetToTrack();return;}
  tActive.set(e.pointerId,b.dataset.k);syncTouch();});
window.addEventListener('pointermove',e=>{if(!tActive.has(e.pointerId))return;const el=document.elementFromPoint(e.clientX,e.clientY);const b=el&&el.closest&&el.closest('.tb');
  const cur=tActive.get(e.pointerId);if(b&&b.dataset.k!==cur&&['left','right'].includes(cur)&&['left','right'].includes(b.dataset.k)){tActive.set(e.pointerId,b.dataset.k);syncTouch();}});
for(const ev of ['pointerup','pointercancel'])window.addEventListener(ev,e=>{if(tActive.delete(e.pointerId))syncTouch();});
$('#touch').addEventListener('contextmenu',e=>e.preventDefault());
function updateTouchVis(){
  const on=touchOn();
  $('#touch').hidden=!on;document.body.classList.toggle('touchmode',on);
}

// ===== 사운드 (WebAudio 합성) =====
const AUD={ctx:null};
function audioInit(){
  if(!gSnd('racer')) return;
  try{
    if(!AUD.ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const ctx=new C();AUD.ctx=ctx;
      const master=ctx.createGain();master.gain.value=0;master.connect(gOut(ctx,'racer'));AUD.master=master;
      const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=900;f.Q.value=4;f.connect(master);AUD.f=f;
      const o1=ctx.createOscillator();o1.type='sawtooth';const o2=ctx.createOscillator();o2.type='square';const g2=ctx.createGain();g2.gain.value=0.35;
      o1.connect(f);o2.connect(g2);g2.connect(f);o1.start();o2.start();AUD.o1=o1;AUD.o2=o2;
      const len=ctx.sampleRate;const buf=ctx.createBuffer(1,len,ctx.sampleRate);const d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
      const ns=ctx.createBufferSource();ns.buffer=buf;ns.loop=true;const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1700;bp.Q.value=3;const ng=ctx.createGain();ng.gain.value=0;
      ns.connect(bp);bp.connect(ng);ng.connect(gOut(ctx,'racer'));ns.start();AUD.ng=ng;AUD.bp=bp;
      const ro=ctx.createOscillator();ro.type='square';ro.frequency.value=20;const rf=ctx.createBiquadFilter();rf.type='lowpass';rf.frequency.value=180;const rg=ctx.createGain();rg.gain.value=0;ro.connect(rf);rf.connect(rg);rg.connect(gOut(ctx,'racer'));ro.start();AUD.ro=ro;AUD.rg=rg;
    }
    if(AUD.ctx.state==='suspended')AUD.ctx.resume();
  }catch(e){AUD.ctx=null;}
}
function audioUpdate(c,on){
  if(!AUD.ctx) return;const t=AUD.ctx.currentTime;
  if(!on||!c||!gSnd('racer')||RACE.paused){AUD.master.gain.setTargetAtTime(0,t,0.05);AUD.ng.gain.setTargetAtTime(0,t,0.05);AUD.rg.gain.setTargetAtTime(0,t,0.05);return;}
  const fr=c.rpm/60*2;AUD.o1.frequency.setTargetAtTime(fr,t,0.03);AUD.o2.frequency.setTargetAtTime(fr*0.5,t,0.03);
  AUD.f.frequency.setTargetAtTime(320+c.rpm*0.16+(c.boosting?350:0),t,0.05);
  AUD.master.gain.setTargetAtTime(0.02+(c.thr?0.028:0.008),t,0.08);
  const sl=c.surface==='road'||c.surface==='kerb'?c.slip:0;AUD.ng.gain.setTargetAtTime(Math.abs(c.u)>4?sl*(c.locked?0.035:0.022):0,t,0.05);AUD.bp.frequency.setTargetAtTime(c.locked?1100:1700,t,0.05);
  const kerb=RACE.onKerb&&Math.abs(c.u)>3;AUD.ro.frequency.setTargetAtTime(clamp(Math.abs(c.u)/1.0,8,90),t,0.03);AUD.rg.gain.setTargetAtTime(kerb?0.05:0,t,0.03);
}
function beep(f,d){if(!AUD.ctx||!gSnd('racer'))return;try{const ctx=AUD.ctx,o=ctx.createOscillator(),g=ctx.createGain();o.type='square';o.frequency.value=f;g.gain.value=0.05;g.gain.setTargetAtTime(0,ctx.currentTime+d*0.6,0.03);o.connect(g);g.connect(gOut(ctx,'racer'));o.start();o.stop(ctx.currentTime+d+0.1);}catch(e){}}
function thud(v){if(!AUD.ctx||!gSnd('racer'))return;try{const ctx=AUD.ctx,o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=70;g.gain.value=Math.min(0.25,v*0.015);g.gain.setTargetAtTime(0,ctx.currentTime,0.08);o.connect(g);g.connect(gOut(ctx,'racer'));o.start();o.stop(ctx.currentTime+0.4);}catch(e){}}

// ===== 클릭 처리 =====
document.addEventListener('click',e=>{
  const tc=e.target.closest('[data-track]');if(tc){selectTrack(tc.dataset.track);return;}
  const pt=e.target.closest('[data-paint]');if(pt){paintIdx=+pt.dataset.paint;LS.set('smr_paint',paintIdx);if(GAR.car)GAR.car.setPaint(PAINTS[paintIdx].c);renderSpec();return;}
  const a=e.target.closest('[data-act]');if(!a)return;
  switch(a.dataset.act){
    case 'open-racer': countPlay('racer');show('tracks');checkEditPermission().then(ok=>{$('#editBtn').hidden=!ok;});renderStrip();updateChips();{const last=LS.get('smr_lastTrack',null);if(last)selectTrack(last);}break;
    case 'home': closeBlocks();closeG4();closeRx();show('home');renderGames();break;
    case 'open-g48': countPlay('g2048');openG4();break;
    case 'open-react': countPlay('react');openRx();break;
    case 'open-blocks': countPlay('blocks');openBlocks();break;
    case 'switch-user-bk': logout();a.closest('span').textContent='다음 판부터는 끝난 뒤 각자 닉네임으로 저장할 수 있어요.';break;
    case 'tracks': MODE='none';show('tracks');break;
    case 'to-garage': openGarage();break;
    case 'edit-layout': openEditor();break;
    case 'pick-car': pickCar();break;
    case 'signup': doLogin(true);break;
    case 'logout': logout();break;
    case 'switch-user': logout();a.closest('span').textContent='다음 랩부터는 끝난 뒤 각자 닉네임으로 저장할 수 있어요.';break;
    case 'settings': openSettings();break;
    case 'close-settings': closeModals();break;
    case 'profile': openProfile();break;
    case 'forgot': openForgot();break;
    case 'close-profile': closeModals();break;
    case 'pause': togglePause();break;
    case 'resume': togglePause(false);break;
    case 'cam': RACE.camMode=RACE.camMode==='chase'?'cockpit':'chase';a.blur();break;
    case 'retry': audioInit();resetRace();break;
    case 'exit': exitRace();break;
  }
});

// ===== 메인 루프 =====
let lastT=performance.now();
function loop(now){requestAnimationFrame(loop);const dt=Math.min(0.05,(now-lastT)/1000);lastT=now;
  try{ if(MODE==='garage')tickGarage(dt); else if(MODE==='race'&&RACE.scene)tickRace(dt); }catch(e){console.error(e);MODE='none';toast('오류가 생겨 멈췄어요. 나가기 후 다시 시도해 주세요.');}
}
// ===== 시작 =====
if(typeof THREE==='undefined'){document.body.insertAdjacentHTML('beforeend','<div class="loading"><div class="box"><div class="t">3D 엔진을 불러오지 못했어요</div><div class="s">인터넷 연결을 확인하고 새로고침해 주세요.</div></div></div>');}
else{ renderLogin(); renderGames(); Store.init(); requestAnimationFrame(loop); }
