// ===== 차량 물리 (아반떼 N 실제 제원 기반) =====
const G = 9.81;
const CAR_SPEC = {
  mass: 1445,          // kg (DCT 기준 공차중량 근사)
  a: 1.08, b: 1.64,    // 무게중심→앞/뒤 차축 (m), 앞쪽이 무거운 FF 배분 ≈ 60:40
  h: 0.50,             // 무게중심 높이
  Iz: 2350,            // 요 관성모멘트
  r: 0.327,            // 245/35R19 타이어 반경
  gears: [3.6, 2.5, 1.85, 1.43, 1.15, 0.95, 0.79, 0.66],
  rev: 3.4, fd: 3.75, eff: 0.88,
  idle: 850, redline: 6750, upRpm: 6550, downRpm: 2600, shiftTime: 0.11,
  torque: [[800,210],[1500,300],[2100,392],[4700,392],[5500,362],[6000,328],[6600,292],[6900,240]],
  mu: 1.30,            // 미쉐린 PS4S
  CaF: 95000, CaR: 125000,
  CdA: 0.66, ClA: 0.22, roll: 0.013,
  brakeG: 1.08, vmax: 250/3.6,
  boostMul: 1.11,      // N 그린 시프트처럼 일시적 출력 상승
  boostSec: 20
};
function engineTorque(rpm){
  const t=CAR_SPEC.torque;
  if(rpm<=t[0][0]) return t[0][1];
  for(let i=1;i<t.length;i++){ if(rpm<=t[i][0]){ const k=(rpm-t[i-1][0])/(t[i][0]-t[i-1][0]); return t[i-1][1]+(t[i][1]-t[i-1][1])*k; } }
  return 0;
}
function newCarState(){
  return {x:0,z:0,y:0,yaw:0,vx:0,vz:0,r:0,steer:0,gear:1,rpm:850,shiftT:0,ax:0,ay:0,
    boost:1,boosting:false,spin:0,drift:0,driftDir:0,locked:0,beta:0,slip:0,surface:'road',slope:0,u:0,v:0,thr:0,brk:0,wheelAng:0};
}
// inp: {thr, back(S: 제동/후진), lock(Space: 바퀴 잠금 제동·드리프트), steer(-1..1, +오른쪽), boost}
function stepCar(c, inp, dt, surf){
  const P=CAR_SPEC, m=P.mass, L=P.a+P.b;
  const fx=Math.sin(c.yaw), fz=Math.cos(c.yaw), rx=-fz, rz=fx;
  let u=c.vx*fx+c.vz*fz, v=c.vx*rx+c.vz*rz;
  const sp=Math.abs(u);
  // 조향: 속도 감응형
  const maxSt=0.6/(1+Math.pow(sp/20,1.3));
  const tgt=clampP(inp.steer||0,-1,1)*maxSt;
  const rate=(Math.abs(tgt)<Math.abs(c.steer)||tgt*c.steer<0)?3.4:2.3;
  c.steer+=clampP(tgt-c.steer,-rate*dt,rate*dt);
  // 페달 해석 (S: 전진 중이면 제동, 거의 정지면 후진)
  let thr=0, brk=inp.brake?1:0;
  const lock=!!inp.lock&&sp>0.6;
  if(inp.back){
    if(c.gear>0 && u>1.0) brk=Math.max(brk,1);
    else { if(c.gear>0 && u<=1.0) c.gear=-1; if(c.gear===-1) thr=1; }
  }
  if(inp.thr){
    if(c.gear===-1){ if(u<-1.0) brk=Math.max(brk,1); else { c.gear=1; thr=1; } }
    else thr=1;
  }
  if(inp.thr&&inp.back&&c.gear>0){ thr=1; }
  // 부스트
  c.boosting=!!(inp.boost&&thr>0&&c.boost>0&&c.gear>0);
  if(c.boosting) c.boost=Math.max(0,c.boost-dt/P.boostSec); else c.boost=Math.min(1,c.boost+dt/60);
  // 드리프트 상태: Space + 조향으로 시작, 놓아도 가속+조향이면 잠시 유지
  const steerAbs=Math.abs(inp.steer||0);
  // 드리프트 방향은 시작할 때 정해짐. 반대로 조향(카운터)하면 자세가 서서히 돌아옴
  if(!c.driftDir&&lock&&steerAbs>0.2&&sp>8) c.driftDir=Math.sign(inp.steer);
  const steerRel=(inp.steer||0)*(c.driftDir||0);
  if(c.driftDir&&lock&&steerRel>0.2&&sp>8) c.drift=Math.min(1,c.drift+dt*1.5);          // 부드럽게 진입 (~0.7초)
  else if(c.driftDir&&steerRel<-0.2) c.drift=Math.max(0,c.drift-dt*0.8);                // 카운터: 약 1초에 걸쳐 회복
  else if(c.driftDir&&thr>0&&steerRel>0.2&&Math.abs(c.beta)>0.1&&sp>8) c.drift=Math.max(0,c.drift-dt*0.22); // 가속+조향이면 유지
  else c.drift=Math.max(0,c.drift-dt*(lock?0.9:1.1));
  if(c.drift<=0) c.driftDir=0;
  // 엔진/변속
  let Fd=0;
  if(c.shiftT>0) c.shiftT-=dt;
  if(c.gear===-1){
    const wr=Math.abs(u)/P.r*60/(2*Math.PI)*P.rev*P.fd;
    c.rpm+= (Math.max(P.idle+thr*1200,wr)-c.rpm)*Math.min(1,dt*10);
    Fd= u>-7 ? -thr*engineTorque(c.rpm)*P.rev*P.fd*P.eff/P.r*0.6 : 0;
  } else {
    const ratio=P.gears[c.gear-1]*P.fd;
    let wr=Math.max(u,0)/P.r*60/(2*Math.PI)*ratio;
    let target=wr;
    if(c.gear===1&&thr>0) target=Math.max(wr,Math.min(4200,2600+sp*300));
    target=Math.max(target,P.idle+thr*(c.gear===1?0:0));
    c.rpm+=(target-c.rpm)*Math.min(1,dt*(c.shiftT>0?18:25));
    if(c.rpm>P.redline+50) c.rpm=P.redline+50;
    let T=c.rpm>=P.redline?0:engineTorque(c.rpm);
    if(c.boosting) T*=P.boostMul;
    Fd= (c.shiftT>0)?0: thr*T*ratio*P.eff/P.r;
    if(u>=P.vmax) Fd=Math.min(Fd, 0.5*1.225*P.CdA*u*u + P.roll*m*G);
    // 자동 변속 (8단 DCT)
    if(c.shiftT<=0){
      const up=c.boosting?P.upRpm+120:P.upRpm;
      if(wr>up && c.gear<8){ c.gear++; c.shiftT=c.boosting?0.07:P.shiftTime; }
      else if(c.gear>1){
        const down=brk>0?3600:(thr>0?P.downRpm:1700);
        const lowerRpm=Math.max(u,0)/P.r*60/(2*Math.PI)*P.gears[c.gear-2]*P.fd;
        if(wr<down && lowerRpm<P.upRpm-500){ c.gear--; c.shiftT=0.08; }
      }
    }
  }
  // 하중 (가감속 하중이동 + 다운포스)
  const q=0.5*1.225*u*u, df=q*P.ClA;
  // 하중이동은 부드럽게 (서스펜션이 받아주는 것처럼)
  c.axs=(c.axs||0)+(clampP(c.ax,-1.3*G,1.0*G)-(c.axs||0))*Math.min(1,dt*8);
  let FzF=m*G*P.b/L - m*c.axs*P.h/L + df*0.45;
  let FzR=m*G*P.a/L + m*c.axs*P.h/L + df*0.55;
  FzF=Math.max(FzF,500); FzR=Math.max(FzR,500);
  const mu=P.mu*surf.mu;
  const sgn=u>=0?1:-1;
  const maxF=mu*FzF, maxR=mu*FzR;
  // ABS + 전자식 제동력 배분: 뒷바퀴는 접지력의 45%까지만 써서 옆 그립을 남겨 둔다 (제동 중 스핀 방지)
  const Fb=sp>0.05?brk*P.brakeG*m*G:0;
  const st=Math.min(1,steerAbs);
  const bR=Math.min(Fb*0.25, maxR*(0.4-0.15*st)), bF=Math.min(Fb-bR, maxF*(0.94-0.2*st));
  let FxF=Fd - bF*sgn;
  let FxR=- bR*sgn;
  c.slip=0;
  c.locked=lock?1:0;
  const hbrake=lock&&steerAbs>0.2; // Space+조향: 뒷바퀴만 잠그는 사이드브레이크 드리프트
  if(lock){ // 바퀴가 잠긴 채 미끄러지는 제동: 미끄럼 마찰(최대의 82%)로 감속, 옆 그립은 크게 줄어듦
    if(!hbrake) FxF=-sgn*maxF*0.82; FxR=-sgn*maxR*(hbrake?0.45:0.82); }
  // 트랙션 컨트롤: 구동력은 앞 접지력의 92%까지
  if(Fd>0 && FxF>maxF*0.92){ c.slip=Math.min(1,(Fd-maxF*0.92)/maxF); FxF=maxF*0.92; }
  if(Math.abs(FxF)>maxF){ FxF=Math.sign(FxF)*maxF; }
  if(Math.abs(FxR)>maxR) FxR=Math.sign(FxR)*maxR;
  let FyFmax=Math.sqrt(Math.max(maxF*maxF-FxF*FxF,0))+1;
  let FyRmax=Math.sqrt(Math.max(maxR*maxR-FxR*FxR,0))+1;
  if(lock){if(!hbrake)FyFmax=Math.max(FyFmax,maxF*0.42);FyRmax=Math.max(FyRmax,maxR*0.3);}
  FyRmax*=1-0.5*c.drift; // 드리프트 중엔 뒤가 흐름
  const uu=Math.max(sp,2.0);
  const slipF=Math.atan2(v+P.a*c.r, uu) - c.steer*(u<0?-1:1);
  const slipR=Math.atan2(v-P.b*c.r, uu);
  const FyF=-FyFmax*Math.tanh(P.CaF*slipF/FyFmax);
  const FyR=-FyRmax*Math.tanh(P.CaR*slipR/FyRmax);
  c.slip=Math.max(c.slip, clampP((Math.abs(slipR)-0.06)*6,0,1), clampP((Math.abs(slipF)-0.09)*5,0,1)*(sp>8?1:0));
  const cs=Math.cos(c.steer), sn=Math.sin(c.steer);
  const drag=0.5*1.225*P.CdA*u*Math.abs(u);
  const rollF=(P.roll+surf.roll)*m*G*(sp>0.3?sgn:u/0.3);
  const grav=m*G*(c.slope||0);
  const Flong=FxF*cs - FyF*sn + FxR - drag - rollF - grav;
  const Flat=FxF*sn + FyF*cs + FyR;
  const Mz=P.a*(FxF*sn+FyF*cs) - P.b*FyR;
  c.r+=Mz/P.Iz*dt;
  // 저속에서는 기구학 모델로 부드럽게 전환
  const k=c.gear===-1?0:clampP((sp-2)/4,0,1);
  if(k<1){
    const rk=u*Math.tan(c.steer)/L;
    c.r=rk+(c.r-rk)*k;
  }
  // 차체 자세 제어 (ESC): 운전자가 원하는 회전량(조향각 기준)으로 요 레이트를 당겨 줌
  // 실제로 낼 수 있는 횡가속도(현재 횡력) 이상으로는 차체를 돌리지 않음 → 차체가 진행 방향을 앞질러 도는 스핀 방지
  const rfeas=Math.min(mu*G*0.95, Math.abs(Flat)/m+1.2)/Math.max(sp,3);
  const D=c.drift, Ds=D*D*(3-2*D); // 부드러운 전환 곡선
  // 일반 주행 목표 (조향각 기준)
  const rk2=clampP(u*Math.tan(c.steer)/L,-rfeas,rfeas);
  const want=steerAbs<0.05?7:2.6;
  let rN=c.r; if(sp>3) rN+=(rk2-c.r)*Math.min(1,dt*want*(brk>0||lock?1.6:1));
  if(D<0.02){
    c.r=rN;const rmax=mu*G*1.15/Math.max(sp,3)+0.06;c.r=clampP(c.r,-rmax,rmax);
  } else {
    // 드리프트 보조: 목표 미끄럼각을 유지하도록 요 레이트 조절
    // 같은 방향 조향 → 각이 커짐(최대 약 26°), 손 놓으면 유지, 반대 조향 → 목표각이 0으로 줄며 자세 회복
    const ax=(Flong*fx+Flat*rx)/m, az=(Flong*fz+Flat*rz)/m, v2=c.vx*c.vx+c.vz*c.vz+1e-3;
    const pathR=-(c.vz*ax-c.vx*az)/v2;
    let mag=steerRel>0?0.30+0.16*steerRel:(steerRel<0?0.30*Math.max(0,1+steerRel*1.1):0.27);
    const betaT=-c.driftDir*mag*Ds;
    const rD=pathR+DRIFT_K*(c.beta-betaT);
    const rDr=c.r+(rD-c.r)*Math.min(1,dt*8);
    c.r=rN*(1-Ds)+rDr*Ds;
    c.r=clampP(c.r,-1.6,1.6);
  }
  // 월드 좌표계에서 적분 (원심/구심 효과가 자연스럽게 생김)
  c.vx+=(Flong*fx+Flat*rx)/m*dt; c.vz+=(Flong*fz+Flat*rz)/m*dt;
  c.yaw-=c.r*dt;
  const fx2=Math.sin(c.yaw), fz2=Math.cos(c.yaw), rx2=-fz2, rz2=fx2;
  let nu=c.vx*fx2+c.vz*fz2, nv=c.vx*rx2+c.vz*rz2;
  if(k<1) nv*=(k+(1-k)*Math.max(0,1-dt*14));
  // 옆미끄러짐 보조 (게임용 그립 어시스트)
  if(sp>3) nv*=Math.max(0,1-dt*(steerAbs<0.05?2.2:0.9)*(1-0.85*c.drift)*(lock?0.4:1));
  // 정지 처리
  if((brk>0||lock)&&thr===0&&(Math.abs(u)<0.4||Math.sign(nu)!==Math.sign(u))) { nu=0; nv*=0.5; }
  if(thr===0&&brk===0&&Math.abs(nu)<0.08&&Math.abs(c.slope||0)<0.03) nu=0;
  c.ax=(nu-u)/dt; c.ay=Flat/m;
  c.vx=nu*fx2+nv*rx2; c.vz=nu*fz2+nv*rz2;
  c.x+=c.vx*dt; c.z+=c.vz*dt;
  c.u=nu; c.v=nv; c.thr=thr; c.brk=brk||(lock?1:0);
  c.beta=Math.abs(nu)>3?Math.atan2(nv,Math.abs(nu)):0;
  c.slip=Math.max(c.slip,lock&&sp>2?1:0,clampP((Math.abs(c.beta)-0.08)*4,0,1)*(sp>6?1:0));
  // 드리프트로 부스트 충전
  if(Math.abs(c.beta)>0.1&&sp>10&&!c.boosting) c.boost=Math.min(1,c.boost+dt*clampP(Math.abs(c.beta)*0.2,0,0.1));
  if(!lock) c.wheelAng+=nu/P.r*dt;
}
let DRIFT_K=4.5;
function clampP(v,a,b){return v<a?a:v>b?b:v;}
if(typeof module!=='undefined') module.exports={stepCar,newCarState,CAR_SPEC,setK:k=>DRIFT_K=k};
