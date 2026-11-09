// ===== 서킷 생성 =====
// 지도 좌표(가로 1000px, y 아래쪽) → 월드 좌표: x = mx*scale, z = my*scale (위에서 보면 지도와 같은 모양)
function trackCurve(t){
  if(t._curve) return t._curve;
  const c0=new THREE.CatmullRomCurve3(t.pts.map(p=>new THREE.Vector3(p[0],0,p[1])),true,'centripetal');c0.arcLengthDivisions=4000;
  const s=t.len/c0.getLength();
  const c=new THREE.CatmullRomCurve3(t.pts.map(p=>new THREE.Vector3(p[0]*s,p[2]||0,p[1]*s)),true,'centripetal');c.arcLengthDivisions=8000;
  t._curve=c;t._scale=s;return c;
}
function trackOutline(t,n=360){
  if(t._out&&t._out.length===n) return t._out;
  const c=trackCurve(t);t._out=c.getSpacedPoints(n).slice(0,n).map(p=>[p.x,p.z]);return t._out;
}
function outlinePath(t,size,pad){
  const pts=trackOutline(t);let mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9;
  for(const [x,z] of pts){mnx=Math.min(mnx,x);mxx=Math.max(mxx,x);mnz=Math.min(mnz,z);mxz=Math.max(mxz,z);}
  const sc=(size-pad*2)/Math.max(mxx-mnx,mxz-mnz),ox=(size-(mxx-mnx)*sc)/2,oz=(size-(mxz-mnz)*sc)/2;
  const P=pts.map(([x,z])=>[ox+(x-mnx)*sc,oz+(z-mnz)*sc]);
  return {d:'M'+P.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join('L')+'Z',P,map:(x,z)=>[ox+(x-mnx)*sc,oz+(z-mnz)*sc]};
}

function trackGeo(t){
  if(t._geo) return t._geo;
  const curve=trackCurve(t), S=t._scale;
  const N=Math.round(t.len/2), ds=t.len/N;
  const raw=curve.getSpacedPoints(N);
  const px=new Float32Array(N),py=new Float32Array(N),pz=new Float32Array(N),tx=new Float32Array(N),tz=new Float32Array(N),slope=new Float32Array(N);
  for(let i=0;i<N;i++){px[i]=raw[i].x;py[i]=raw[i].y;pz[i]=raw[i].z;}
  // 높이를 한 번 더 부드럽게 (급경사 계단 방지)
  {const h2=new Float32Array(N);for(let i=0;i<N;i++){let s=0;for(let k=-8;k<=8;k++)s+=py[(i+k+N)%N];h2[i]=s/17;}py.set(h2);}
  for(let i=0;i<N;i++){const a=(i-1+N)%N,b=(i+1)%N;let dx=px[b]-px[a],dz=pz[b]-pz[a];const l=Math.hypot(dx,dz)||1;tx[i]=dx/l;tz[i]=dz/l;slope[i]=(py[b]-py[a])/(2*ds);}
  const hw=t.width/2, kerbW=1.3;
  // 다각형(트랙 안쪽 판정)
  const poly=[];for(let i=0;i<N;i+=4)poly.push([px[i],pz[i]]);
  const inPoly=(x,z)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a[1]>z)!==(b[1]>z))&&(x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;};
  // 곡률 → 연석, 안쪽 벽 거리 제한
  const curv=new Float32Array(N), turn=new Float32Array(N);
  for(let i=0;i<N;i++){const a=(i-5+N)%N,b=(i+5)%N;const cr=tx[a]*tz[b]-tz[a]*tx[b];const dot=tx[a]*tx[b]+tz[a]*tz[b];const ang=Math.atan2(cr,dot);curv[i]=Math.abs(ang)/(10*ds);turn[i]=ang>0?1:-1;}
  const wallBase=hw+kerbW+t.runoff;
  let wallL=new Float32Array(N).fill(wallBase), wallR=new Float32Array(N).fill(wallBase);
  for(let i=0;i<N;i++){ if(curv[i]>1e-4){const R=1/curv[i];const lim=Math.max(hw+kerbW+0.6,R*0.8);
      // turn>0 → 오른쪽이 안쪽
      if(turn[i]>0) wallR[i]=Math.min(wallR[i],lim); else wallL[i]=Math.min(wallL[i],lim);} }
  // 다른 구간과 가까운 곳에서는 벽을 당겨서 서로 겹치지 않게
  for(let i=0;i<N;i+=2){const rx=-tz[i],rz=tx[i];
    for(const sd of [-1,1]){const lim=sd<0?wallL:wallR;
      for(let j=0;j<N;j+=3){const di=Math.min(Math.abs(i-j),N-Math.abs(i-j));if(di<60)continue;
        if(Math.abs(py[j]-py[i])>5)continue;
        const dx=px[j]-px[i],dz=pz[j]-pz[i];const lat=(dx*rx+dz*rz)*sd,lon=dx*tx[i]+dz*tz[i];
        if(lat>0&&Math.abs(lon)<25){const half=lat/2-0.5;if(half<lim[i])lim[i]=Math.max(hw+kerbW+0.6,half);if(i+1<N&&half<lim[i+1])lim[i+1]=Math.max(hw+kerbW+0.6,half);}}}}
  const smoothArr=(arr)=>{const out=new Float32Array(N);for(let i=0;i<N;i++){let m=1e9;for(let k=-10;k<=10;k++)m=Math.min(m,arr[(i+k+N)%N]);out[i]=m;}const o2=new Float32Array(N);for(let i=0;i<N;i++){let s=0;for(let k=-6;k<=6;k++)s+=out[(i+k+N)%N];o2[i]=s/13;}return o2;};
  wallL=smoothArr(wallL);wallR=smoothArr(wallR);
  const kerb=new Uint8Array(N);for(let i=0;i<N;i++){let m=0;for(let k=-4;k<=4;k++)m=Math.max(m,curv[(i+k+N)%N]);kerb[i]=m>1/170?1:0;}
  // 터널 (모나코)
  const tunnel=new Uint8Array(N);
  if(t.tunnel){const cp=t.pts.map(p=>[p[0]*S,p[1]*S]);for(let i=0;i<N;i++){let bi=0,bd=1e18;for(let k=0;k<cp.length;k++){const d=(cp[k][0]-px[i])**2+(cp[k][1]-pz[i])**2;if(d<bd){bd=d;bi=k;}}if(bi>=t.tunnel[0]&&bi<=t.tunnel[1])tunnel[i]=1;}}
  const T={t,N,ds,px,py,pz,tx,tz,slope,hw,kerbW,wallL,wallR,kerb,tunnel,inPoly,S};
  T.sectorIdx=(t.sectors||[1/3,2/3]).map(s=>{if(typeof s==='number')return Math.floor(s*N);let bi=0,bd=1e18;for(let i=0;i<N;i++){const d=(px[i]-s[0]*S)**2+(pz[i]-s[1]*S)**2;if(d<bd){bd=d;bi=i;}}return bi;}).sort((a,b)=>a-b);
  T.wallBase=wallBase;T.curv=curv;
  t._geo=T;return T;
}

function buildTrack(t){
  const q=Q(), env=t.env, S=t._scale||(trackCurve(t),t._scale);
  const G0=trackGeo(t);
  const T=Object.assign({},G0);
  const {N,ds,px,py,pz,tx,tz,slope,hw,kerbW,wallL,wallR,kerb,tunnel,inPoly,wallBase}=T;
  const group=new THREE.Group();T.group=group;

  // --- 지형 (트랙 높이를 따라가고, 교차로에선 아래쪽 도로 높이를 씀)
  let mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9;for(let i=0;i<N;i++){mnx=Math.min(mnx,px[i]);mxx=Math.max(mxx,px[i]);mnz=Math.min(mnz,pz[i]);mxz=Math.max(mxz,pz[i]);}
  const M=env.mountains?900:450;mnx-=M;mxx+=M;mnz-=M;mxz+=M;
  const G=q.grid, gw=(mxx-mnx)/(G-1), gd=(mxz-mnz)/(G-1), cell=Math.max(gw,gd);
  const H=new Float32Array(G*G), Dn=new Float32Array(G*G), Wt=new Uint8Array(G*G);
  const st=3, nearOff=t.city?0.35:1.1;
  const isWaterMap=(mx,my,d,x,z)=>{
    if(env.harbor) return d>wallBase+8&&my>300&&mx>120&&!inPoly(x,z);
    if(env.sea) return d>wallBase+14&&env.sea.some(r=>mx>=r[0]&&mx<=r[2]&&my>=r[1]&&my<=r[3]);
    return false;};
  for(let gz=0;gz<G;gz++)for(let gx=0;gx<G;gx++){
    const x=mnx+gx*gw,z=mnz+gz*gd;let bd=1e18,bh=0;
    for(let i=0;i<N;i+=st){const d=(px[i]-x)**2+(pz[i]-z)**2;if(d<bd){bd=d;bh=py[i];}}
    const d=Math.sqrt(bd);
    let near=bh;
    if(d<wallBase+120){const r2=(d+cell*1.2)**2;for(let i=0;i<N;i+=st){const dd=(px[i]-x)**2+(pz[i]-z)**2;if(dd<r2&&py[i]<near)near=py[i];}}
    const w=smooth(wallBase+6,wallBase+(t.city?60:240),d);
    let far=near+env.amp*(fbm(x/420+3.1,z/420)-0.38)*1.5;
    if(env.mountains) far+=smooth(700,1500,d)*160*fbm(x/900,z/900);
    let h=lerp(near-nearOff,far,w);
    const mx=x/S,my=z/S;
    if(isWaterMap(mx,my,d,x,z)){h=Math.min(h,-6);Wt[gz*G+gx]=1;}
    H[gz*G+gx]=h; Dn[gz*G+gx]=d;
  }
  // 물가 경계 부드럽게
  if(env.harbor||env.sea){const H2=H.slice();for(let gz=1;gz<G-1;gz++)for(let gx=1;gx<G-1;gx++){const k=gz*G+gx;if(Wt[k]||Wt[k-1]||Wt[k+1]||Wt[k-G]||Wt[k+G]){H2[k]=(H[k]*2+H[k-1]+H[k+1]+H[k-G]+H[k+G])/6;}}H.set(H2);}
  const tg=new THREE.PlaneGeometry(mxx-mnx,mxz-mnz,G-1,G-1);tg.rotateX(-Math.PI/2);
  const tp=tg.attributes.position;
  for(let k=0;k<tp.count;k++){const gx=k%G,gz=Math.floor(k/G);tp.setY(k,H[gz*G+gx]);}
  tg.translate((mnx+mxx)/2,0,(mnz+mxz)/2);tg.computeVertexNormals();
  const uv=tg.attributes.uv;for(let k=0;k<uv.count;k++)uv.setXY(k,uv.getX(k)*(mxx-mnx)/24,uv.getY(k)*(mxz-mnz)/24);
  const terrain=new THREE.Mesh(tg,new THREE.MeshStandardMaterial({map:t.city?TEX.verge:TEX.grass,color:env.ground,roughness:1}));terrain.receiveShadow=true;group.add(terrain);
  T.terrainH=(x,z)=>{const fx=clamp((x-mnx)/gw,0,G-1.001),fz=clamp((z-mnz)/gd,0,G-1.001);const ix=Math.floor(fx),iz=Math.floor(fz),ax=fx-ix,az=fz-iz;
    return lerp(lerp(H[iz*G+ix],H[iz*G+ix+1],ax),lerp(H[(iz+1)*G+ix],H[(iz+1)*G+ix+1],ax),az);};
  T.trackDist=(x,z)=>{const fx=clamp(Math.round((x-mnx)/gw),0,G-1),fz=clamp(Math.round((z-mnz)/gd),0,G-1);return Dn[fz*G+fx];};
  T.isWater=(x,z)=>{const fx=clamp(Math.round((x-mnx)/gw),0,G-1),fz=clamp(Math.round((z-mnz)/gd),0,G-1);return !!Wt[fz*G+fx];};
  if(env.harbor||env.sea){const w=new THREE.Mesh(new THREE.PlaneGeometry((mxx-mnx)*3,(mxz-mnz)*3),new THREE.MeshStandardMaterial({color:env.dusk?0x1f4d6b:0x1b5d86,roughness:0.06,metalness:0.5,envMap:RACE.env,envMapIntensity:1.2}));w.rotation.x=-Math.PI/2;w.position.set((mnx+mxx)/2,-1.5,(mnz+mxz)/2);group.add(w);}
  T.bounds=[mnx,mxx,mnz,mxz];
  T.wallBase=wallBase;
  T.exactDist=(x,z)=>{let bd=1e18;for(let i=0;i<N;i+=2){const d=(px[i]-x)**2+(pz[i]-z)**2;if(d<bd)bd=d;}return Math.sqrt(bd);};
  // 다리 구간: 도로가 지면보다 2.2m 이상 떠 있는 곳
  const bridge=new Uint8Array(N);for(let i=0;i<N;i++){if(py[i]-T.terrainH(px[i],pz[i])>2.2)bridge[i]=1;}
  T.bridge=bridge;

  // --- 리본 메시 도우미
  function ribbon(offA,offB,yA,yB,mat,vScale,filter,uRepeat){
    const P=[],U=[],I=[];let vi=0,open=false;
    for(let j=0;j<=N;j++){const i=j%N; if(filter&&!filter(i)){open=false;continue;}
      const rx=-tz[i],rz=tx[i];const a=offA(i),b=offB(i);
      const ya=typeof yA==='function'?yA(i):yA, yb=typeof yB==='function'?yB(i):yB;
      P.push(px[i]+rx*a,py[i]+ya,pz[i]+rz*a, px[i]+rx*b,py[i]+yb,pz[i]+rz*b);
      U.push(0,j*ds/vScale,uRepeat||1,j*ds/vScale);
      if(open){I.push(vi-2,vi-1,vi,vi-1,vi+1,vi);} open=true;vi+=2;}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();
    const m=new THREE.Mesh(g,mat);m.receiveShadow=true;group.add(m);return m;}
  // 노면
  const roadMat=new THREE.MeshStandardMaterial({map:TEX.asphalt,roughness:0.92,metalness:0,color:0xffffff});
  ribbon(i=>-hw,i=>hw,0,0,roadMat,14);
  // 연석
  const kerbMat=new THREE.MeshStandardMaterial({map:TEX.kerb,roughness:0.7,polygonOffset:true,polygonOffsetFactor:-1});
  ribbon(i=>-hw-kerbW,i=>-hw+0.05,0.03,0.0,kerbMat,6,i=>kerb[i]);
  ribbon(i=>hw-0.05,i=>hw+kerbW,0.0,0.03,kerbMat,6,i=>kerb[i]);
  // 갓길
  const vergeMat=new THREE.MeshStandardMaterial({map:TEX.verge,color:t.city?0x8d8a84:(env.dusk?0xcbb48f:0x86a05e),roughness:1});
  ribbon(i=>-wallL[i]-0.2,i=>-hw,-0.06,-0.01,vergeMat,10,null,Math.max(1,t.runoff/8));
  ribbon(i=>hw,i=>wallR[i]+0.2,-0.01,-0.06,vergeMat,10,null,Math.max(1,t.runoff/8));
  // 둑(스커트): 갓길 바깥에서 지면으로 내려가는 경사면 → 지형과 도로 사이 틈을 가림
  const skirtMat=new THREE.MeshStandardMaterial({map:t.city?TEX.verge:TEX.grass,color:env.ground,roughness:1});
  ribbon(i=>-wallL[i]-9,i=>-wallL[i]-0.2,-5,-0.06,skirtMat,10,i=>!bridge[i]);
  ribbon(i=>wallR[i]+0.2,i=>wallR[i]+9,-0.06,-5,skirtMat,10,i=>!bridge[i]);
  // 벽
  const wallMat=new THREE.MeshStandardMaterial({map:t.city?TEX.armco:TEX.wall,roughness:t.city?0.35:0.8,metalness:t.city?0.7:0,side:THREE.DoubleSide});
  const wh=t.city?1.1:1.0;
  ribbon(i=>-wallL[i],i=>-wallL[i],wh,-0.3,wallMat,t.city?4:8);
  ribbon(i=>wallR[i],i=>wallR[i],-0.3,wh,wallMat,t.city?4:8);
  // 다리 상판 + 기둥
  {const pm=new THREE.MeshStandardMaterial({color:0xa3a29c,roughness:0.9});
    ribbon(i=>-wallL[i]-0.4,i=>wallR[i]+0.4,-1.2,-1.2,pm,10,i=>bridge[i]).material.side=THREE.DoubleSide;
    ribbon(i=>-wallL[i]-0.4,i=>-wallL[i]-0.4,-0.06,-1.2,pm,10,i=>bridge[i]).material.side=THREE.DoubleSide;
    ribbon(i=>wallR[i]+0.4,i=>wallR[i]+0.4,-1.2,-0.06,pm,10,i=>bridge[i]);
    for(let i=0;i<N;i+=9){if(!bridge[i])continue;const gh=T.terrainH(px[i],pz[i]);const h=py[i]-1.2-gh;if(h<1)continue;const rx=-tz[i],rz=tx[i];
      for(const sd of [-1,1]){const off=sd<0?-wallL[i]*0.6:wallR[i]*0.6;const p=new THREE.Mesh(new THREE.BoxGeometry(1.4,h+1,1.4),pm);p.position.set(px[i]+rx*off,gh+h/2-0.5,pz[i]+rz*off);p.castShadow=true;group.add(p);}}}
  // 터널
  if(t.tunnel){const tm=new THREE.MeshStandardMaterial({color:0x3a3a3c,roughness:0.9,side:THREE.DoubleSide});
    ribbon(i=>-wallL[i]-0.3,i=>wallR[i]+0.3,6.2,6.2,tm,10,i=>tunnel[i]);
    ribbon(i=>-wallL[i]-0.3,i=>-wallL[i]-0.3,-0.3,6.2,tm,10,i=>tunnel[i]);
    ribbon(i=>wallR[i]+0.3,i=>wallR[i]+0.3,6.2,-0.3,tm,10,i=>tunnel[i]);
    const lm=new THREE.MeshBasicMaterial({color:0xfff1c8});ribbon(i=>-0.4,i=>0.4,6.1,6.1,lm,10,i=>tunnel[i]&&(i%6<2));
    // 터널 위 건물(호텔)
    const ids=[];for(let i=0;i<N;i++)if(tunnel[i])ids.push(i);
    if(ids.length){const bm=new THREE.MeshStandardMaterial({map:TEX.building,color:0xf1e6d2,roughness:0.8});
      for(let k=0;k<ids.length;k+=Math.max(1,Math.floor(ids.length/6))){const i=ids[k];const b=new THREE.Mesh(new THREE.BoxGeometry(38,22,ds*Math.max(1,Math.floor(ids.length/6))+4),bm);b.position.set(px[i],py[i]+6.2+11,pz[i]);b.rotation.y=Math.atan2(tx[i],tz[i]);b.castShadow=q.shadow>0;group.add(b);}}}
  // 출발선
  {const g=new THREE.PlaneGeometry(t.width,1.6);const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:TEX.checker,roughness:0.8,polygonOffset:true,polygonOffsetFactor:-2}));
    TEX.checker.repeat.set(t.width/4,1);m.rotation.x=-Math.PI/2;m.rotation.z=Math.atan2(tx[0],tz[0])+Math.PI;m.position.set(px[0],py[0]+0.02,pz[0]);m.receiveShadow=true;group.add(m);}
  // 그리드 박스 (폴 포지션)
  T.startIdx=N-6; T.startLat=-hw*0.35;
  {const i=T.startIdx,rx=-tz[i],rz=tx[i];const lm=new THREE.MeshBasicMaterial({color:0xf0f0f0});
    const bar=new THREE.Mesh(new THREE.PlaneGeometry(2.4,0.2),lm);bar.rotation.x=-Math.PI/2;bar.rotation.z=Math.atan2(tx[i],tz[i]);
    const j=(i+2)%N;bar.position.set(px[j]+rx*T.startLat,py[j]+0.025,pz[j]+rz*T.startLat);group.add(bar);}
  // 출발 신호등 갠트리
  T.lampMats=[];
  {const i=4%N,ang=Math.atan2(tx[i],tz[i]);const g=new THREE.Group();g.position.set(px[i],py[i],pz[i]);g.rotation.y=ang;group.add(g);
    const pm=new THREE.MeshStandardMaterial({color:0x2a2d31,metalness:0.6,roughness:0.5});
    for(const sd of [-1,1]){const p=new THREE.Mesh(new THREE.BoxGeometry(0.5,7.5,0.5),pm);p.position.set(sd*(hw+1.2),3.75,0);p.castShadow=true;g.add(p);}
    const beam=new THREE.Mesh(new THREE.BoxGeometry(t.width+3,0.9,0.7),pm);beam.position.set(0,7.2,0);g.add(beam);
    const ban=new THREE.Mesh(new THREE.PlaneGeometry(t.width+3,0.8),new THREE.MeshBasicMaterial({map:TEX.banner}));TEX.banner.repeat.set((t.width+3)/8,1);ban.position.set(0,6.4,-0.36);ban.rotation.y=Math.PI;g.add(ban);
    for(let k=0;k<5;k++){const box=new THREE.Mesh(new THREE.BoxGeometry(0.7,1.4,0.5),new THREE.MeshStandardMaterial({color:0x090a0b}));box.position.set((k-2)*0.95,8.2,-0.1);g.add(box);
      const mat=new THREE.MeshStandardMaterial({color:0x220000,emissive:0xff0000,emissiveIntensity:0});T.lampMats.push(mat);
      for(const yy of [-0.3,0.3]){const l=new THREE.Mesh(new THREE.CircleGeometry(0.22,16),mat);l.position.set((k-2)*0.95,8.2+yy,-0.36);l.rotation.y=Math.PI;g.add(l);}}}
  buildScenery(T);
  return T;
}

// 트랙 바깥쪽(다각형 밖) 방향: +1이면 오른쪽
function outsideSide(T,i){const rx=-T.tz[i],rz=T.tx[i];return T.inPoly(T.px[i]+rx*40,T.pz[i]+rz*40)?-1:1;}
function placeOnTrackSide(T,i,side,off){const rx=-T.tz[i],rz=T.tx[i];return {x:T.px[i]+rx*side*off,z:T.pz[i]+rz*side*off,ny:Math.atan2(rx*side,rz*side),ay:Math.atan2(T.tx[i],T.tz[i])};}

function buildScenery(T){
  const {t,N,px,py,pz,tx,tz,group,S}=T, env=t.env, q=Q(), r=rng(t.id.length*977+13);
  const sh=q.shadow>0;
  const mm=new THREE.Matrix4(),qq=new THREE.Quaternion(),sc=new THREE.Vector3(),pp=new THREE.Vector3(),col=new THREE.Color(),UP=new THREE.Vector3(0,1,0);
  const wallAt=(i,side)=>side<0?T.wallL[i]:T.wallR[i];
  const layout=t._layout||defaultLayout(t);T.layout=layout;
  applyLayout(T,layout);
  const occupied=T.occupied;
  const free=(x,z,r0)=>!occupied.some(o=>(o[0]-x)**2+(o[1]-z)**2<(o[2]+r0)**2);
  const auto=layout.auto||{};
  // 캐치 펜스 (시가지 제외): 벽 위 철망
  if(!t.city){const fm=new THREE.MeshStandardMaterial({map:TEX.fence,transparent:true,alphaTest:0.4,side:THREE.DoubleSide,roughness:0.6,metalness:0.4});
    const R=(off,y0,y1,filter)=>{const P=[],U=[],I=[];let vi=0,open=false;for(let j=0;j<=N;j++){const i=j%N;if(filter&&!filter(i)){open=false;continue;}const rx=-tz[i],rz=tx[i],a=off(i);
      P.push(px[i]+rx*a,py[i]+y0,pz[i]+rz*a,px[i]+rx*a,py[i]+y1,pz[i]+rz*a);U.push(j*T.ds/3,0,j*T.ds/3,1);if(open)I.push(vi-2,vi-1,vi,vi-1,vi+1,vi);open=true;vi+=2;}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();group.add(new THREE.Mesh(g,fm));};
    R(i=>-T.wallL[i]-0.15,1.0,3.6,i=>!T.bridge[i]);R(i=>T.wallR[i]+0.15,1.0,3.6,i=>!T.bridge[i]);
    // 펜스 기둥
    const pg=new THREE.CylinderGeometry(0.06,0.06,3.6,5);pg.translate(0,1.8,0);const cnt=Math.floor(N/4)*2;const posts=new THREE.InstancedMesh(pg,new THREE.MeshStandardMaterial({color:0x6a7077,metalness:0.6,roughness:0.4}),cnt);let n=0;
    for(let i=0;i<N&&n<cnt;i+=4){for(const sd of [-1,1]){const off=wallAt(i,sd)+0.15;const P=placeOnTrackSide(T,i,sd,off);mm.compose(pp.set(P.x,py[i],P.z),qq.identity(),sc.set(1,1,1));posts.setMatrixAt(n++,mm);}}
    posts.count=n;group.add(posts);}
  // 투광등 (야스, 야간 분위기)
  if(auto.lights){const pm=new THREE.MeshStandardMaterial({color:0x3a3f45,metalness:0.6,roughness:0.5}),lm=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xfff3d6,emissiveIntensity:2.2});
    const step=Math.round((q.scen<0.5?90:55)/T.ds);
    for(let i=0;i<N;i+=step){if(T.bridge[i])continue;const side=(Math.floor(i/step)%2)?1:-1;const off=wallAt(i,side)+3;const P=placeOnTrackSide(T,i,side,off);
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.35,20,6),pm);pole.position.set(P.x,py[i]+9.7,P.z);group.add(pole);
      const head=new THREE.Mesh(new THREE.BoxGeometry(3,1.2,0.6),lm);head.position.set(P.x,py[i]+20,P.z);head.rotation.y=P.ny;group.add(head);}}
  // 도시 건물 자동 배치 (모나코)
  if(auto.city){
    const cnt=Math.round(700*q.scen);const bg=new THREE.BoxGeometry(1,1,1);bg.translate(0,0.5,0);
    const bm=new THREE.InstancedMesh(bg,new THREE.MeshStandardMaterial({map:TEX.building,roughness:0.85}),cnt);
    const rg=new THREE.BoxGeometry(1,1,1);rg.translate(0,0.5,0);const roofs=new THREE.InstancedMesh(rg,new THREE.MeshStandardMaterial({color:0x8d8a84,roughness:0.9}),cnt);
    let n=0;
    for(let s=0;s<cnt*6&&n<cnt;s++){const i=Math.floor(r()*N);if(T.tunnel[i])continue;const side=r()<0.5?-1:1;
      const w=10+r()*16,d=10+r()*16,half=Math.hypot(w,d)/2;const off=wallAt(i,side)+4+half+r()*r()*110;
      const P=placeOnTrackSide(T,i,side,off);if(T.isWater(P.x,P.z)||!free(P.x,P.z,half)||T.exactDist(P.x,P.z)<T.wallBase+3+half)continue;
      const h=T.terrainH(P.x,P.z);const hh=10+r()*(off<50?26:52);const base=Math.min(h,py[i])-2,H=hh+2+Math.max(0,h-py[i]);
      qq.setFromAxisAngle(UP,P.ay);mm.compose(pp.set(P.x,base,P.z),qq,sc.set(w,H,d));bm.setMatrixAt(n,mm);
      mm.compose(pp.set(P.x,base+H,P.z),qq,sc.set(w*0.92,1.2,d*0.92));roofs.setMatrixAt(n,mm);
      bm.setColorAt(n,col.setHSL(0.07+r()*0.07,0.2+r()*0.35,0.7+r()*0.2));n++;occupied.push([P.x,P.z,half]);}
    bm.count=roofs.count=n;bm.castShadow=sh;group.add(bm,roofs);
  }
  // 항구의 요트
  if(env.harbor||env.sea){const cnt=Math.round((env.harbor?160:60)*q.scen);const hg=new THREE.BoxGeometry(1,1,1);hg.translate(0,0.5,0);
    const yachts=new THREE.InstancedMesh(hg,new THREE.MeshStandardMaterial({color:0xf4f5f6,roughness:0.4}),cnt);
    const cg=new THREE.BoxGeometry(1,1,1);cg.translate(0,0.5,0);const cabins=new THREE.InstancedMesh(cg,new THREE.MeshStandardMaterial({color:0x2a3a4a,roughness:0.2,metalness:0.5}),cnt);let n=0;
    for(let s=0;s<cnt*20&&n<cnt;s++){const i=Math.floor(r()*N);const side=r()<0.5?-1:1;const off=wallAt(i,side)+14+r()*90;const P=placeOnTrackSide(T,i,side,off);
      if(!T.isWater(P.x,P.z))continue;const L=8+r()*r()*40;qq.setFromAxisAngle(UP,P.ny);mm.compose(pp.set(P.x,-1.8,P.z),qq,sc.set(L*0.28,1.6+L*0.05,L));yachts.setMatrixAt(n,mm);
      mm.compose(pp.set(P.x,-0.2+L*0.05,P.z),qq,sc.set(L*0.2,1+L*0.04,L*0.45));cabins.setMatrixAt(n,mm);n++;}
    yachts.count=cabins.count=n;group.add(yachts,cabins);}
  // 나무 자동 배치 (2단 침엽수 / 활엽수 / 야자)
  const count=auto.trees?Math.round(env.trees*q.scen):0;
  if(count>0){
    const kind=env.tree;
    const trunkG=new THREE.CylinderGeometry(0.18,0.28,1,6);trunkG.translate(0,0.5,0);
    let c1,c2,crownC;
    if(kind==='palm'){c1=new THREE.ConeGeometry(2.6,1.4,7);c1.rotateX(Math.PI);c1.translate(0,0.6,0);c2=new THREE.ConeGeometry(1.4,1.2,6);c2.translate(0,0.9,0);crownC=0x4d7a2e;}
    else if(kind==='mix'){c1=new THREE.IcosahedronGeometry(2.6,0);c1.translate(0,2.2,0);c2=new THREE.IcosahedronGeometry(1.8,0);c2.translate(0.6,3.8,0.3);crownC=0x3f6d2f;}
    else{c1=new THREE.ConeGeometry(2.3,5,q.car?8:6);c1.translate(0,2.5,0);c2=new THREE.ConeGeometry(1.5,4,q.car?8:6);c2.translate(0,5.3,0);crownC=0x2b5428;}
    const trunks=new THREE.InstancedMesh(trunkG,new THREE.MeshStandardMaterial({color:0x5a4330,roughness:1}),count);
    const crowns=new THREE.InstancedMesh(c1,new THREE.MeshStandardMaterial({color:crownC,roughness:0.95,flatShading:true}),count);
    const crowns2=new THREE.InstancedMesh(c2,new THREE.MeshStandardMaterial({color:crownC,roughness:0.95,flatShading:true}),count);
    let n=0,tries=0;
    while(n<count&&tries<count*14){tries++;
      const i=Math.floor(r()*N),side=r()<0.5?-1:1,off=wallAt(i,side)+10+Math.pow(r(),1.6)*(t.city?60:340);
      const P=placeOnTrackSide(T,i,side,off);const x=P.x,z=P.z;
      if(T.isWater(x,z)||!free(x,z,3)||(T.trackDist(x,z)<T.wallBase+40&&T.exactDist(x,z)<T.wallBase+5)) continue;
      const h=T.terrainH(x,z);
      const s=0.8+r()*0.7, trunkH=kind==='palm'?7+r()*4:1.6+r()*1.2;
      qq.setFromAxisAngle(UP,r()*6.28);
      mm.compose(pp.set(x,h,z),qq,sc.set(s,trunkH,s));trunks.setMatrixAt(n,mm);
      mm.compose(pp.set(x,h+trunkH-0.4,z),qq,sc.set(s,s*(kind==='palm'?1:0.9+r()*0.5),s));crowns.setMatrixAt(n,mm);crowns2.setMatrixAt(n,mm);
      col.setHex(crownC).offsetHSL((r()-0.5)*0.05,0,(r()-0.5)*0.14);crowns.setColorAt(n,col);crowns2.setColorAt(n,col.offsetHSL(0,0,0.04));n++;}
    trunks.count=crowns.count=crowns2.count=n;crowns.castShadow=sh;group.add(trunks,crowns,crowns2);
  }
}

// 트랙 위 위치 질의 (주변 구간만 검색해서 교차로에서도 정확)
function trackQuery(T,x,z,hint,wide){
  const N=T.N;let bi=hint,bd=1e18;
  const a=wide?0:hint-14,b=wide?N:hint+46;
  for(let k=a;k<b;k++){const i=((k%N)+N)%N;const d=(T.px[i]-x)**2+(T.pz[i]-z)**2;if(d<bd){bd=d;bi=i;}}
  const rx=-T.tz[bi],rz=T.tx[bi];const dx=x-T.px[bi],dz=z-T.pz[bi];
  const lat=dx*rx+dz*rz, along=dx*T.tx[bi]+dz*T.tz[bi];
  const nb=along>=0?(bi+1)%N:(bi-1+N)%N;const f=Math.min(1,Math.abs(along)/T.ds);
  const h=lerp(T.py[bi],T.py[nb],f);
  return {i:bi,lat,h,dist:Math.sqrt(bd)};
}
