// ===== 렌더러 =====
const canvas=$('#gl');
let renderer=null;
function initRenderer(){
  if(renderer) return;
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  applyQuality();
  window.addEventListener('resize',resize);
}
function resize(){ if(!renderer) return; const w=innerWidth,h=innerHeight; renderer.setSize(w,h,false);
  for(const cam of [GAR.cam,RACE.cam]) if(cam){cam.aspect=w/h;cam.updateProjectionMatrix();} }
function applyQuality(){
  if(!renderer) return; const q=Q();
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,q.pr));
  const sh=q.shadow>0; if(renderer.shadowMap.enabled!==sh){renderer.shadowMap.enabled=sh;
    for(const sc of [GAR.scene,RACE.scene]) if(sc) sc.traverse(o=>{if(o.material){[].concat(o.material).forEach(m=>m.needsUpdate=true);}});}
  if(RACE.sun){RACE.sun.castShadow=sh; if(sh){RACE.sun.shadow.mapSize.set(q.shadow,q.shadow); if(RACE.sun.shadow.map){RACE.sun.shadow.map.dispose();RACE.sun.shadow.map=null;}}}
  resize();
}

// r128은 hex 색을 선형값으로 다루므로, sRGB 출력에서 색이 바래지 않게 한 번 변환
function linearize(root){
  const seen=new Set();
  root.traverse(o=>{
    if(o.isInstancedMesh&&o.instanceColor&&!o.userData.lin){const a=o.instanceColor.array,c=new THREE.Color();for(let i=0;i<a.length;i+=3){c.setRGB(a[i],a[i+1],a[i+2]).convertSRGBToLinear();a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}o.instanceColor.needsUpdate=true;o.userData.lin=1;}
    if(o.isMesh&&o.geometry&&o.geometry.attributes.color&&!o.geometry.userData.lin){const a=o.geometry.attributes.color.array,c=new THREE.Color();for(let i=0;i<a.length;i+=3){c.setRGB(a[i],a[i+1],a[i+2]).convertSRGBToLinear();a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}o.geometry.userData.lin=1;}
    if(!o.material)return;
    for(const m of [].concat(o.material)){if(seen.has(m)||m.userData.lin||m.isShaderMaterial)continue;seen.add(m);m.userData.lin=1;
      if(m.color)m.color.convertSRGBToLinear();if(m.emissive)m.emissive.convertSRGBToLinear();}
  });
}
// ===== 절차적 텍스처 =====
const TEX={};
function cvs(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')];}
function mkTex(c,rep){const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;}t.anisotropy=renderer?Math.min(Q().aniso,renderer.capabilities.getMaxAnisotropy()):1;return t;}
function noiseFill(x,w,h,base,amp,seed){const id=x.getImageData(0,0,w,h),d=id.data,r=rng(seed);for(let i=0;i<d.length;i+=4){const n=(r()-0.5)*amp;d[i]=clamp(base[0]+n,0,255);d[i+1]=clamp(base[1]+n,0,255);d[i+2]=clamp(base[2]+n,0,255);d[i+3]=255;}x.putImageData(id,0,0);}
function buildTextures(){
  if(TEX.asphalt) return;
  // 아스팔트: 가로 = 도로 폭, 세로 = 진행 방향 반복. 양쪽 흰 차선 포함
  let [c,x]=cvs(512,512); noiseFill(x,512,512,[58,60,63],34,7);
  const r=rng(3); for(let i=0;i<2600;i++){x.fillStyle=`rgba(${r()<.5?20:120},${r()<.5?20:120},${r()<.5?22:125},${0.08+r()*0.12})`;x.fillRect(r()*512,r()*512,1+r()*2,1+r()*2);}
  // 레이싱 라인처럼 살짝 어두운 고무 자국
  const g=x.createLinearGradient(0,0,512,0);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.35,'rgba(0,0,0,.10)');g.addColorStop(.5,'rgba(0,0,0,.16)');g.addColorStop(.65,'rgba(0,0,0,.10)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,512,512);
  x.fillStyle='#e9ebe7';x.fillRect(6,0,9,512);x.fillRect(497,0,9,512);
  TEX.asphalt=mkTex(c,true);
  // 연석: 빨강/흰색 줄무늬
  [c,x]=cvs(32,128);x.fillStyle='#d8261c';x.fillRect(0,0,32,64);x.fillStyle='#f2f2ee';x.fillRect(0,64,32,64);x.fillStyle='rgba(0,0,0,.18)';x.fillRect(0,0,4,128);
  TEX.kerb=mkTex(c,true);
  // 잔디
  [c,x]=cvs(256,256);noiseFill(x,256,256,[150,150,150],60,11);
  for(let i=0;i<256;i+=32){x.fillStyle='rgba(255,255,255,.05)';x.fillRect(0,i,256,16);}
  TEX.grass=mkTex(c,true);
  // 갓길(자갈+잔디)
  [c,x]=cvs(128,128);noiseFill(x,128,128,[170,170,170],80,19);TEX.verge=mkTex(c,true);
  // 타이어 벽 / 가드레일
  [c,x]=cvs(256,64);x.fillStyle='#1c1e21';x.fillRect(0,0,256,64);
  for(let i=0;i<8;i++){x.fillStyle=i%2?'#d9d9d4':'#c4261d';x.fillRect(i*32,8,32,22);}
  x.fillStyle='#2a2d31';for(let i=0;i<16;i++){x.beginPath();x.arc(i*16+8,48,7,0,7);x.fill();}
  TEX.wall=mkTex(c,true);
  [c,x]=cvs(64,64);const gg=x.createLinearGradient(0,0,0,64);gg.addColorStop(0,'#9aa2a8');gg.addColorStop(.3,'#e3e7ea');gg.addColorStop(.5,'#8b9399');gg.addColorStop(.7,'#d6dadd');gg.addColorStop(1,'#7c8389');x.fillStyle=gg;x.fillRect(0,0,64,64);
  TEX.armco=mkTex(c,true);
  // 체커 (출발선)
  [c,x]=cvs(64,16);for(let i=0;i<16;i++)for(let j=0;j<4;j++){x.fillStyle=(i+j)%2?'#111':'#f4f4f4';x.fillRect(i*4,j*4,4,4);}
  TEX.checker=mkTex(c,true);TEX.checker.magFilter=THREE.NearestFilter;
  // 관중
  [c,x]=cvs(256,128);x.fillStyle='#2b2f36';x.fillRect(0,0,256,128);const rr=rng(5);
  for(let y=4;y<128;y+=10)for(let xx=2;xx<256;xx+=6){const h=rr();x.fillStyle=`hsl(${rr()*360},${40+rr()*40}%,${35+h*40}%)`;x.fillRect(xx,y,4,6);}
  TEX.crowd=mkTex(c,true);
  // 피트 차고 문
  [c,x]=cvs(256,128);x.fillStyle='#e9ecef';x.fillRect(0,0,256,128);
  for(let k=0;k<2;k++){x.fillStyle='#3a4048';x.fillRect(8+k*128,30,112,98);x.fillStyle='#4c535c';for(let y=34;y<128;y+=8)x.fillRect(10+k*128,y,108,4);
    x.fillStyle='#b5231c';x.fillRect(8+k*128,14,112,10);}
  TEX.garage=mkTex(c,true);
  // 유리 타워 커튼월
  [c,x]=cvs(128,128);const gg2=x.createLinearGradient(0,0,128,128);gg2.addColorStop(0,'#5d7f9e');gg2.addColorStop(1,'#2d4660');x.fillStyle=gg2;x.fillRect(0,0,128,128);
  x.fillStyle='#1b2733';for(let k=0;k<128;k+=32){x.fillRect(k,0,3,128);x.fillRect(0,k,128,4);}x.fillStyle='rgba(255,255,255,.12)';x.fillRect(4,4,24,24);x.fillRect(68,36,24,24);
  TEX.glassT=mkTex(c,true);
  // 광고판 (가상의 브랜드만)
  [c,x]=cvs(512,160);const ads=[['#0f1216','#ffb000','쌤몰래 GP'],['#ffffff','#b5231c','SMR MOTORS'],['#1b5d86','#ffffff','KOREA OIL+'],['#ffb000','#14100a','TURBO TIRE']];
  for(let k=0;k<4;k++){const a=ads[k];x.fillStyle=a[0];x.fillRect(k*128,0,128,160);x.fillStyle=a[1];x.font='bold 22px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(a[2],k*128+64,80);}
  TEX.ad=mkTex(c,true);TEX.ad.repeat.set(1,1);
  // 철망 (알파)
  [c,x]=cvs(64,64);x.clearRect(0,0,64,64);x.strokeStyle='rgba(200,205,210,0.95)';x.lineWidth=2;
  for(let k=-64;k<128;k+=12){x.beginPath();x.moveTo(k,0);x.lineTo(k+64,64);x.stroke();x.beginPath();x.moveTo(k+64,0);x.lineTo(k,64);x.stroke();}
  x.fillStyle='rgba(120,125,130,1)';x.fillRect(0,0,64,3);x.fillRect(0,61,64,3);
  TEX.fence=mkTex(c,true);
  // 건물 창문
  [c,x]=cvs(128,256);x.fillStyle='#d9cdb4';x.fillRect(0,0,128,256);const wr=rng(8);
  for(let y=10;y<256;y+=22)for(let xx=8;xx<128;xx+=20){x.fillStyle=wr()<.3?'#3d4e5c':'#56718a';x.fillRect(xx,y,12,14);x.fillStyle='rgba(255,255,255,.25)';x.fillRect(xx,y+12,12,2);}
  TEX.building=mkTex(c,true);
  // 차 아래 그림자
  [c,x]=cvs(128,128);const rg=x.createRadialGradient(64,64,10,64,64,64);rg.addColorStop(0,'rgba(0,0,0,.75)');rg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=rg;x.fillRect(0,0,128,128);
  TEX.blob=new THREE.CanvasTexture(c);
  // 그리드 박스 / 스폰서 없는 배너
  [c,x]=cvs(512,64);x.fillStyle='#0f1216';x.fillRect(0,0,512,64);x.fillStyle='#ffb000';x.font='bold 40px sans-serif';x.textBaseline='middle';
  x.font='bold 34px sans-serif';for(let i=0;i<2;i++){x.fillText('쌤몰래 GP',i*256+40,34);} TEX.banner=mkTex(c,true);
}

// ===== 환경맵 =====
function makeEnv(top,bottom,panels){
  const pm=new THREE.PMREMGenerator(renderer);const sc=new THREE.Scene();
  const geo=new THREE.SphereGeometry(50,32,16);const ct=new THREE.Color(top),cb=new THREE.Color(bottom),cc=new THREE.Color();
  const p=geo.attributes.position,cols=[];for(let i=0;i<p.count;i++){const h=p.getY(i)/50;cc.copy(cb).lerp(ct,smooth(-0.2,0.6,h));cols.push(cc.r,cc.g,cc.b);}
  geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
  const mat=new THREE.MeshBasicMaterial({side:THREE.BackSide,vertexColors:true});
  sc.add(new THREE.Mesh(geo,mat));
  if(panels){for(const [x,y,z,w,h,i] of panels){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(Math.min(i,1),Math.min(i,1),Math.min(i,1)),side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);sc.add(m);}}
  const rt=pm.fromScene(sc,0.02);pm.dispose();geo.dispose();mat.dispose();return rt.texture;
}

// ===== 차량 모델 (SMR-1 터보: 스포츠 세단 실루엣, 로프트 방식 곡면 차체) =====
const PAINTS=[{n:'퍼포먼스 블루',c:0x7b95c9},{n:'미드나잇 블랙',c:0x16181c},{n:'초크 화이트',c:0xe6e8ea},{n:'인텐스 레드',c:0xb3191e},{n:'사이버 그레이',c:0x8a8f94}];
let paintIdx=clamp(LS.get('smr_paint',0),0,PAINTS.length-1);
function keyInterp(keys,x){ // 코사인 보간
  if(x<=keys[0][0]) return keys[0][1]; const n=keys.length; if(x>=keys[n-1][0]) return keys[n-1][1];
  for(let i=1;i<n;i++){if(x<=keys[i][0]){const a=keys[i-1],b=keys[i],t=(x-a[0])/(b[0]-a[0]);const s=(1-Math.cos(t*Math.PI))/2;return a[1]+(b[1]-a[1])*s;}}
}
const CAR_SHAPE={
  len:2.34,
  top:[[-2.34,0.80],[-2.30,0.93],[-2.12,1.00],[-1.85,0.99],[-1.3,0.95],[0,0.925],[1.0,0.905],[1.55,0.85],[2.0,0.77],[2.26,0.68],[2.34,0.52]],
  halfW:[[-2.34,0.62],[-2.28,0.82],[-2.05,0.90],[-1.5,0.915],[1.2,0.915],[1.85,0.90],[2.18,0.84],[2.30,0.72],[2.34,0.50]],
  roof:[[-1.95,0],[-1.65,0.13],[-1.25,0.30],[-0.75,0.47],[-0.35,0.50],[0.12,0.47],[0.55,0.27],[1.08,0]],
  wheels:[[1.36,1],[-1.36,0]], R:0.327, track:0.80
};
function carBottom(x){
  let b=x>1.85?0.20+(x-1.85)*0.05:(x<-2.0?0.24:0.19);
  for(const [wx] of CAR_SHAPE.wheels){const dx=x-wx,ra=0.41;if(Math.abs(dx)<ra){b=Math.max(b,0.33+Math.sqrt(ra*ra-dx*dx));}}
  return b;
}
const SEN=5;
function secZ(w,f){f=clamp(f,-1,1);return w*Math.pow(1-Math.pow(Math.abs(f),SEN),1/SEN)*(1-0.07*Math.max(0,f));}
function buildCar(detail,paint,env){
  const root=new THREE.Group(), model=new THREE.Group(); model.rotation.y=-Math.PI/2; root.add(model);
  const bodyG=new THREE.Group(); model.add(bodyG); // 서스펜션으로 움직이는 차체
  const paintMat=new THREE.MeshPhysicalMaterial({color:paint,metalness:0.25,roughness:0.38,clearcoat:detail>0?1:0,clearcoatRoughness:0.08,envMap:env,envMapIntensity:0.85});
  const paintMat2=paintMat.clone();paintMat2.side=THREE.DoubleSide;
  const dark=new THREE.MeshStandardMaterial({color:0x111215,roughness:0.55,metalness:0.2,envMap:env});
  const gloss=new THREE.MeshStandardMaterial({color:0x07080a,roughness:0.12,metalness:0.5,envMap:env});
  const glass=new THREE.MeshStandardMaterial({color:0x0a0e13,roughness:0.03,metalness:0.7,envMap:env,envMapIntensity:1.6,transparent:true,opacity:0.9,side:THREE.DoubleSide});
  const headM=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xe8f2ff,emissiveIntensity:0.6});
  const tailM=new THREE.MeshStandardMaterial({color:0x550000,emissive:0xff1a1a,emissiveIntensity:0.6});
  const S=CAR_SHAPE;
  // --- 차체 로프트
  const NS=detail>1?60:(detail?40:24), NR=detail>1?32:(detail?22:14);
  const xs=[];for(let i=0;i<=NS;i++){const t=i/NS;xs.push(-S.len+2*S.len*(0.5-0.5*Math.cos(t*Math.PI)));} // 양 끝을 촘촘히
  const pos=[],idx=[];
  for(const x of xs){const tp=keyInterp(S.top,x),bt=Math.min(carBottom(x),tp-0.05),w=keyInterp(S.halfW,x);const yc=(tp+bt)/2,hh=(tp-bt)/2;
    for(let j=0;j<NR;j++){const th=j/NR*Math.PI*2;const s=Math.sin(th);const f=Math.sign(s)*Math.pow(Math.abs(s),2/SEN*1.0);
      const fy=Math.sign(s)*Math.pow(Math.abs(s),0.4);const z=Math.sign(Math.cos(th))*secZ(w,fy);pos.push(x,yc+hh*fy,z);}}
  for(let i=0;i<NS;i++)for(let j=0;j<NR;j++){const a=i*NR+j,b=i*NR+(j+1)%NR,c=(i+1)*NR+j,d=(i+1)*NR+(j+1)%NR;idx.push(a,c,b,b,c,d);}
  // 앞뒤 마감
  for(const [i,dir] of [[0,-1],[NS,1]]){const ci=pos.length/3;let cy=0;for(let j=0;j<NR;j++)cy+=pos[(i*NR+j)*3+1];pos.push(xs[i]+dir*0.01,cy/NR,0);
    for(let j=0;j<NR;j++){const a=i*NR+j,b=i*NR+(j+1)%NR;if(dir<0)idx.push(ci,a,b);else idx.push(ci,b,a);}}
  const bodyGeo=new THREE.BufferGeometry();bodyGeo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));bodyGeo.setIndex(idx);bodyGeo.computeVertexNormals();
  const body=new THREE.Mesh(bodyGeo,paintMat);body.castShadow=true;bodyG.add(body);
  // --- 그린하우스 (유리 + 필러 + 지붕)
  const GN=detail>1?36:(detail?24:14);
  const gx=[];for(let i=0;i<=GN;i++)gx.push(1.08+(-1.95-1.08)*i/GN);
  const gP={paint:[],glass:[],trim:[]};
  const ring=x=>{const tp=keyInterp(S.top,x),bt=Math.min(carBottom(x),tp-0.05),w=keyInterp(S.halfW,x);const yc=(tp+bt)/2,hh=(tp-bt)/2;
    const fb=0.86,yb=yc+hh*fb,zb=secZ(w,fb)-0.01;const rh=keyInterp(S.roof,x);const yr=yb+rh;const zr=Math.max(0.05,zb-0.12-rh*0.42);
    const yt=yb+0.05;const ys=yr-Math.min(0.07,rh*0.25);const zs=zr+0.03;
    const pts=[[-zb,yb],[-zb+0.01,yt],[-zs,ys],[-zr*0.6,yr-0.012],[0,yr],[zr*0.6,yr-0.012],[zs,ys],[zb-0.01,yt],[zb,yb]];
    return pts.map(p=>[x,p[1],p[0]]);};
  const R0=gx.map(ring);
  const tri=(arr,a,b,c)=>arr.push(...a,...b,...c);
  for(let i=0;i<GN;i++){const xm=(gx[i]+gx[i+1])/2;const A=R0[i],B=R0[i+1];const rh=keyInterp(S.roof,xm);
    for(let j=0;j<A.length-1;j++){
      let kind;
      if(j===0||j===A.length-2) kind='trim';
      else if(j===1||j===A.length-3) kind=(xm<-0.32&&xm>-0.44)||xm<-1.55?'paint':'glass';
      else if(j===2||j===A.length-4) kind='paint';
      else kind=(xm<0.2&&xm>-0.95)?'paint':'glass';
      const arr=gP[kind];tri(arr,A[j],B[j],A[j+1]);tri(arr,A[j+1],B[j],B[j+1]);}}
  const glassMeshes=[];let ghPaint=null;for(const [k,mat] of [['paint',paintMat2],['glass',glass],['trim',gloss]]){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(gP[k],3));g.computeVertexNormals();const m=new THREE.Mesh(g,mat);m.castShadow=k!=='glass';bodyG.add(m);if(k==='glass')glassMeshes.push(m);if(k==='paint')ghPaint=m;}
  function box(w,h,d,mat,x,y,z,parent){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);(parent||bodyG).add(m);return m;}
  // 앞: 헤드램프, 그릴, 립
  box(0.04,0.20,0.92,gloss,2.355,0.40,0); box(0.04,0.10,1.30,gloss,2.35,0.24,0);
  for(const sd of [-1,1]){ box(0.04,0.18,0.16,gloss,2.33,0.36,sd*0.62);
    const hh=box(0.10,0.05,0.36,gloss,2.30,0.585,sd*0.52); hh.rotation.y=sd*0.42;
    const h=box(0.11,0.016,0.34,headM,2.305,0.6,sd*0.52); h.rotation.y=sd*0.42; }
  box(0.03,0.012,0.95,headM,2.355,0.545,0);
  box(0.16,0.03,1.45,dark,2.30,0.165,0);
  // 뒤: 일자형 테일램프, 디퓨저
  box(0.10,0.045,1.30,tailM,-2.34,0.90,0);
  for(const sd of [-1,1]){const tl=box(0.18,0.07,0.22,tailM,-2.22,0.92,sd*0.70);tl.rotation.y=-sd*0.5;}
  box(0.16,0.16,1.45,dark,-2.26,0.30,0);
  // 사이드 스커트, 미러
  for(const sd of [-1,1]) box(1.85,0.08,0.05,dark,0.0,0.24,sd*0.905);
  for(const sd of [-1,1]){ const mr=box(0.20,0.12,0.16,paintMat,0.92,1.0,sd*0.95); mr.rotation.y=sd*0.25; box(0.05,0.05,0.10,dark,0.95,0.95,sd*0.88); }
  if(detail>=1){
    // 트렁크 스포일러 + 윙
    box(0.30,0.03,1.42,gloss,-2.13,1.12,0); for(const sd of [-1,1]) box(0.14,0.10,0.04,gloss,-2.10,1.05,sd*0.48);
    for(const sd of [-1,1]){const ex=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.16,16),new THREE.MeshStandardMaterial({color:0x8a8f96,metalness:1,roughness:0.25,envMap:env}));ex.rotation.z=Math.PI/2;ex.position.set(-2.32,0.27,sd*0.52);bodyG.add(ex);}
  }
  // 차체 안쪽을 막아 속이 비쳐 보이지 않게 (바닥 + 휠하우스)
  const well=new THREE.MeshStandardMaterial({color:0x060606,roughness:1});
  box(3.7,0.22,1.28,well,-0.05,0.33,0);
  for(const [wx] of S.wheels){ box(0.86,0.62,1.24,well,wx,0.47,0); }
  // 휠 아치 트림
  const trimM=new THREE.MeshStandardMaterial({color:0x0c0d0f,roughness:0.6});
  for(const [wx] of S.wheels)for(const sd of [-1,1]){const tr=new THREE.Mesh(new THREE.TorusGeometry(0.405,0.03,6,detail>1?24:12,Math.PI),trimM);tr.position.set(wx,0.33,sd*0.875);bodyG.add(tr);}
  if(detail>=1){
    const seam=new THREE.MeshBasicMaterial({color:0x101114});
    for(const sd of [-1,1]){
      // 도어 경계선 (앞문/뒷문)
      for(const dx of [0.98,-0.38,-1.32]){const l=box(0.012,0.5,0.012,seam,dx,0.62,sd*(secZ(keyInterp(S.halfW,dx),0.2)+0.003));}
      for(const dx of [0.35,-0.75]){const hnd=box(0.16,0.025,0.02,gloss,dx,0.80,sd*(secZ(keyInterp(S.halfW,dx),0.55)+0.006));}
      // 캐릭터 라인
      box(2.6,0.008,0.01,seam,-0.1,0.70,sd*(secZ(keyInterp(S.halfW,0),0.3)+0.004));
      // 안개등/에어커튼
      box(0.04,0.05,0.16,headM,2.27,0.27,sd*0.62);
    }
    // 번호판 자리
    box(0.02,0.11,0.52,new THREE.MeshStandardMaterial({color:0xe9ecef,roughness:0.6}),2.38,0.33,0);
    box(0.02,0.11,0.52,new THREE.MeshStandardMaterial({color:0xe9ecef,roughness:0.6}),-2.355,0.55,0);
    // 샤크핀 안테나
    const fin=new THREE.Mesh(new THREE.ConeGeometry(0.035,0.09,4),gloss);fin.scale.set(2.6,1,1);fin.position.set(-0.85,1.44,0);bodyG.add(fin);
  }
  // 바퀴
  const tireM=new THREE.MeshStandardMaterial({color:0x141414,roughness:0.9});
  const rimM=new THREE.MeshStandardMaterial({color:0x26292e,metalness:0.85,roughness:0.3,envMap:env});
  const calM=new THREE.MeshStandardMaterial({color:0xb3191e,roughness:0.4});
  const R=S.R, seg=detail>1?32:(detail?20:12);
  const wheels=[];
  for(const [wx,front] of S.wheels)for(const sd of [-1,1]){const wz=sd*S.track;
    const pivot=new THREE.Group();pivot.position.set(wx,R,wz);model.add(pivot);
    const spin=new THREE.Group();pivot.add(spin);
    const tire=new THREE.Mesh(new THREE.CylinderGeometry(R,R,0.245,seg,1),tireM);tire.rotation.x=Math.PI/2;tire.castShadow=true;spin.add(tire);
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(0.242,0.242,0.252,seg),detail>=2?dark:rimM);rim.rotation.x=Math.PI/2;spin.add(rim);
    if(detail>=1){ const sp=rimM; const n=detail>=2?10:5;
      for(let k=0;k<n;k++){const b=new THREE.Mesh(new THREE.BoxGeometry(detail>=2?0.032:0.05,0.22,0.03),sp);b.position.set(0,0,sd*0.128);b.rotation.z=k/n*Math.PI*2+(detail>=2&&k%2?0.12:0);b.translateY(0.1);spin.add(b);}
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.03,12),rimM);hub.rotation.x=Math.PI/2;hub.position.z=sd*0.13;spin.add(hub);
      const cal=new THREE.Mesh(new THREE.BoxGeometry(0.17,0.11,0.07),calM);cal.position.set(-0.06,0.12,sd*0.06);pivot.add(cal); }
    wheels.push({pivot,spin,front});
  }
  // 그림자 블롭
  const blob=new THREE.Mesh(new THREE.PlaneGeometry(2.6,5.4),new THREE.MeshBasicMaterial({map:TEX.blob,transparent:true,depthWrite:false,opacity:0.9}));
  blob.rotation.x=-Math.PI/2;blob.position.y=0.03;root.add(blob);
  // --- 실내 (운전석 시점): 와이드 디지털 패널, 가로형 송풍구, 3스포크 휠
  const interior=new THREE.Group();interior.visible=false;bodyG.add(interior);
  const cockpitOnly=new THREE.Group();cockpitOnly.visible=false;interior.add(cockpitOnly);
  const inM=new THREE.MeshStandardMaterial({color:0x16181b,roughness:0.85,side:THREE.DoubleSide});
  const inM2=new THREE.MeshStandardMaterial({color:0x2a2d32,roughness:0.55});
  const metal=new THREE.MeshStandardMaterial({color:0x8a9099,metalness:0.9,roughness:0.3,envMap:env});
  box(0.50,0.20,1.66,inM,0.66,0.84,0,interior);                     // 대시보드
  box(0.34,0.05,1.62,inM,0.48,0.955,0,interior);
  box(0.03,0.025,1.30,metal,0.31,0.90,0.05,interior);              // 송풍구 라인
  for(let k=0;k<6;k++) box(0.02,0.045,0.18,gloss,0.30,0.86,-0.55+k*0.22,interior);
  for(const sd of [-1,1]){ const pl=new THREE.Mesh(new THREE.PlaneGeometry(2.6,0.55),inM);pl.position.set(-0.55,0.62,sd*0.80);interior.add(pl); }
  const roofL=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.2),inM);roofL.rotation.x=Math.PI/2;roofL.position.set(-0.4,1.39,0);cockpitOnly.add(roofL);
  // 운전석 시점용: 차체 윗면을 가리는 실내 바닥/트림, 가는 A필러
  box(1.9,0.02,1.6,inM,-0.45,0.94,0,cockpitOnly);
  for(const sd of [-1,1]){const ap=box(1.0,0.045,0.05,inM2,0.6,1.15,sd*0.64,cockpitOnly);ap.rotation.z=-0.446;}
  box(0.06,0.05,1.2,inM2,0.12,1.37,0,cockpitOnly);
  box(0.6,0.5,0.5,inM2,-0.62,0.65,-0.37,interior); box(0.6,0.5,0.5,inM2,-0.62,0.65,0.37,interior);
  box(0.9,0.16,0.26,inM2,0.0,0.58,0,interior); // 센터 콘솔
  const shifter=box(0.07,0.12,0.07,gloss,0.05,0.70,0.0,interior);
  // 와이드 패널: 계기판 + 센터 스크린
  const panel=box(0.03,0.15,0.86,gloss,0.47,1.05,-0.16,interior);panel.rotation.z=0.12;
  const [dc,dx]=cvs(512,192); const dtex=new THREE.CanvasTexture(dc); dtex.encoding=THREE.sRGBEncoding;
  const cluster=new THREE.Mesh(new THREE.PlaneGeometry(0.38,0.135),new THREE.MeshBasicMaterial({map:dtex,toneMapped:false}));
  cluster.position.set(0.453,1.05,-0.37);cluster.rotation.y=-Math.PI/2;cluster.rotation.x=0.12;interior.add(cluster);
  const [mc,mx]=cvs(256,96);mx.fillStyle='#0b1016';mx.fillRect(0,0,256,96);
  for(let k=0;k<6;k++){mx.fillStyle=['#2a5a8a','#3a3f46','#2a6a4a','#3a3f46','#6a4a2a','#3a3f46'][k];mx.fillRect(14+(k%3)*42,12+Math.floor(k/3)*38,34,30);}
  mx.strokeStyle='#4fc3ff';mx.lineWidth=3;mx.beginPath();mx.arc(200,48,30,0,6.28);mx.stroke();
  const mtex=new THREE.CanvasTexture(mc);mtex.encoding=THREE.sRGBEncoding;
  const center=new THREE.Mesh(new THREE.PlaneGeometry(0.36,0.135),new THREE.MeshBasicMaterial({map:mtex,toneMapped:false}));center.position.set(0.453,1.05,0.02);center.rotation.y=-Math.PI/2;center.rotation.x=0.12;interior.add(center);
  // 스티어링 휠
  const sw=new THREE.Group();sw.position.set(0.14,0.91,-0.37);sw.rotation.z=0.42;interior.add(sw);
  const swInner=new THREE.Group();sw.add(swInner);
  const rg=new THREE.Mesh(new THREE.TorusGeometry(0.15,0.02,10,40),inM2);rg.rotation.y=Math.PI/2;swInner.add(rg);
  for(const ang of [Math.PI/2,-Math.PI/2,Math.PI]){const sp=new THREE.Mesh(new THREE.BoxGeometry(0.022,0.14,0.042),ang===Math.PI?gloss:metal);sp.rotation.x=ang;sp.translateY(0.07);swInner.add(sp);}
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.055,0.045,16),inM2);hub.rotation.z=Math.PI/2;swInner.add(hub);
  for(const sd of [-1,1]){const btn=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.016,0.02,12),new THREE.MeshStandardMaterial({color:sd<0?0xd01f1f:0x4a7fc0,emissive:sd<0?0x400000:0x0a1a30}));btn.rotation.z=Math.PI/2;btn.position.set(-0.02,-0.04,sd*0.085);swInner.add(btn);}
  const mark=new THREE.Mesh(new THREE.BoxGeometry(0.01,0.03,0.02),calM);mark.position.set(-0.005,0.15,0);swInner.add(mark);
  // 페달
  for(let k=0;k<3;k++) box(0.03,0.12,0.07,metal,0.95,0.32,-0.47+k*0.11,interior);
  const setPaint=c=>{paintMat.color.setHex(c).convertSRGBToLinear();paintMat2.color.copy(paintMat.color);};
  linearize(root);
  return {root,model,bodyG,cockpitOnly,glassMeshes,ghPaint,wheels,body,paintMat,setPaint,headM,tailM,glass,interior,steer:swInner,dash:{c:dc,x:dx,tex:dtex},blob,
    dispose(){root.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)[].concat(o.material).forEach(m=>{if(m.map&&m.map!==TEX.blob)m.map.dispose();m.dispose();});});}};
}
function drawDash(car,kmh,rpm,gear,boost){
  const {c,x,tex}=car.dash; x.fillStyle='#05080b';x.fillRect(0,0,512,192);
  const f=rpm/7000;x.lineWidth=14;x.strokeStyle='#1b232b';x.beginPath();x.arc(256,170,140,Math.PI*1.1,Math.PI*1.9);x.stroke();
  x.strokeStyle=rpm>6300?'#ff2b2b':'#ffb000';x.beginPath();x.arc(256,170,140,Math.PI*1.1,Math.PI*(1.1+0.8*clamp(f,0,1)));x.stroke();
  x.fillStyle='#eef1f4';x.font='bold 74px sans-serif';x.textAlign='center';x.fillText(String(Math.round(kmh)),256,140);
  x.font='18px sans-serif';x.fillStyle='#8c96a3';x.fillText('km/h',256,166);
  x.font='bold 52px sans-serif';x.fillStyle='#ffb000';x.fillText(gear,440,120);
  x.fillStyle='#4fc3ff';x.fillRect(40,150,90*boost,8);x.strokeStyle='#2a3a48';x.lineWidth=2;x.strokeRect(40,150,90,8);
  tex.needsUpdate=true;
}
