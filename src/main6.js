// ===== 배치 오브젝트 (건물·관중석 등) + 배치 편집기 =====
// 오브젝트: {t:종류, x,z:월드 좌표(m), a:회전(rad), s:크기 배율, h:높이(m, 건물류)}
const OBJ_TYPES={
  stand:{n:'관중석',c:'#9aa3ab',fp:o=>[27*o.s,14]},
  pit:{n:'피트 빌딩',c:'#d7dde3',fp:o=>[150*o.s,16]},
  bldg:{n:'빌딩',c:'#c9b48f',fp:o=>[18*o.s,18*o.s],h:24},
  tower:{n:'고층 유리 타워',c:'#7fa6c9',fp:o=>[16*o.s,16*o.s],h:70},
  house:{n:'주택',c:'#c98f6b',fp:o=>[10*o.s,8*o.s]},
  forest:{n:'나무 숲',c:'#3f7a3a',r:o=>22*o.s},
  palm:{n:'야자수',c:'#6a9a3a',r:o=>9*o.s},
  tent:{n:'텐트',c:'#f2f2f2',fp:o=>[8*o.s,8*o.s]},
  bill:{n:'광고판',c:'#ffb000',fp:o=>[8*o.s,1]},
  light:{n:'조명탑',c:'#fff3d6',r:o=>1.2},
  marshal:{n:'마샬 포스트',c:'#ff7a1a',fp:o=>[2.4,2.4]},
  tyres:{n:'타이어 더미',c:'#333',fp:o=>[4*o.s,1.6]},
  cone:{n:'라바콘',c:'#ff6a00',r:o=>0.6},
  ferris:{n:'대관람차',c:'#e7e2d8',fp:o=>[84*o.s,14]},
  hotel:{n:'트랙 위 호텔',c:'#e9eef2',fp:o=>[120*o.s,90]},
  dome:{n:'붉은 돔 건물',c:'#b5231c',r:o=>150*o.s},
  casino:{n:'카지노',c:'#e7d7b5',fp:o=>[60*o.s,34*o.s]},
};
const ED_PALETTE=['bldg','tower','house','stand','pit','forest','palm','tent','bill','light','marshal','tyres','cone','ferris','casino','dome','hotel'];

function groundAt(T,x,z){
  let bd=1e18,bh=0;for(let i=0;i<T.N;i+=3){const d=(T.px[i]-x)**2+(T.pz[i]-z)**2;if(d<bd){bd=d;bh=T.py[i];}}
  const th=T.terrainH?T.terrainH(x,z):bh;return {h:th,trackH:bh,dist:Math.sqrt(bd)};
}
// 트랙 정보만으로 기본 배치 만들기 (랜드마크 + 관중석 + 피트 + 마샬 + 광고판)
function defaultLayout(t){
  const G=trackGeo(t),env=t.env,S=t._scale,N=G.N,objs=[];
  const side=i=>{const rx=-G.tz[i],rz=G.tx[i];return G.inPoly(G.px[i]+rx*40,G.pz[i]+rz*40)?-1:1;};
  const wall=(i,sd)=>sd<0?G.wallL[i]:G.wallR[i];
  const at=(i,sd,off)=>{const rx=-G.tz[i],rz=G.tx[i];const nx=rx*sd,nz=rz*sd;return {x:G.px[i]+nx*off,z:G.pz[i]+nz*off,a:Math.atan2(nx,nz)};};
  for(const f of env.stands||[]){for(let k=0;k<3;k++){const i=(Math.floor(f*N)+k*15+N)%N;if(G.tunnel[i])continue;const sd=side(i);const p=at(i,sd,wall(i,sd)+2.5);objs.push({t:'stand',x:p.x,z:p.z,a:p.a,s:1});}}
  if(env.pit){const i=N-80,sd=-side(i);const p=at(i,sd,wall(i,sd)+3+8);objs.push({t:'pit',x:p.x,z:p.z,a:p.a,s:1});}
  if(env.ferris) objs.push({t:'ferris',x:env.ferris[0]*S,z:env.ferris[1]*S,a:0.6,s:1});
  if(env.dome) objs.push({t:'dome',x:env.dome[0]*S,z:env.dome[1]*S,a:0,s:1});
  if(env.casino) objs.push({t:'casino',x:env.casino[0]*S,z:env.casino[1]*S,a:0.3,s:1});
  if(env.hotel){const hx=env.hotel[0]*S,hz=env.hotel[1]*S;let bi=0,bd=1e18;for(let i=0;i<N;i++){const d=(G.px[i]-hx)**2+(G.pz[i]-hz)**2;if(d<bd){bd=d;bi=i;}}
    objs.push({t:'hotel',x:G.px[bi],z:G.pz[bi],a:Math.atan2(G.tx[bi],G.tz[bi]),s:1});}
  // 마샬 포스트: 약 450m마다 번갈아
  const stepM=Math.round(450/G.ds);for(let i=stepM,k=0;i<N-stepM/2;i+=stepM,k++){if(G.tunnel[i])continue;const sd=k%2?1:-1;const p=at(i,sd,wall(i,sd)+2.2);objs.push({t:'marshal',x:p.x,z:p.z,a:p.a,s:1});}
  // 광고판: 출발 직선 바깥쪽
  for(let k=0;k<4;k++){const i=(N-30-k*28+N)%N;const sd=side(i);const p=at(i,sd,wall(i,sd)+1.2);objs.push({t:'bill',x:p.x,z:p.z,a:p.a,s:1});}
  return {objs,auto:{trees:true,city:!!env.buildings,lights:!!env.floodlights},v:0};
}

// ----- 오브젝트 3D 생성
function objMats(){
  if(objMats.m) return objMats.m;
  const M={};const S=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:0.8},o||{}));
  M.concrete=S(0x9aa1a8);M.white=S(0xe9ecef,{roughness:0.6});M.dark=S(0x2a2d31,{metalness:0.5,roughness:0.5});
  M.crowd=S(0xffffff,{map:TEX.crowd,roughness:1});M.roof=S(0xdfe3e6,{roughness:0.5,side:THREE.DoubleSide});
  M.garage=S(0xffffff,{map:TEX.garage,roughness:0.6});M.glass=S(0x1d2a36,{roughness:0.08,metalness:0.7,envMap:RACE.env});
  M.bldg=[0xdccdb0,0xe8dfcf,0xcbb89a,0xd9c3a5,0xbfc4c9].map(c=>S(c,{map:TEX.building,roughness:0.85}));
  M.tower=S(0xffffff,{map:TEX.glassT,roughness:0.15,metalness:0.6,envMap:RACE.env});
  M.parapet=S(0x8d8a84);M.ac=S(0xb7bcc1,{metalness:0.4});M.trunk=S(0x5a4330,{roughness:1});
  M.pine=S(0x2b5428,{roughness:0.95});M.pine2=S(0x3a6b33,{roughness:0.95});M.leaf=S(0x4d7a2e,{roughness:0.9,side:THREE.DoubleSide});
  M.brick=S(0xb5694a);M.tile=S(0x7a3b2a);M.tent=S(0xf4f4f2,{roughness:0.7});M.ad=S(0xffffff,{map:TEX.ad,roughness:0.5});
  M.lamp=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xfff3d6,emissiveIntensity:2});M.orange=S(0xff6a00,{roughness:0.6});
  M.tyre=S(0x151515,{roughness:0.95});M.red=S(0xb5231c,{roughness:0.5,metalness:0.2});M.cream=S(0xe7d7b5,{roughness:0.7});M.copper=S(0x5b6b63,{roughness:0.5,metalness:0.4});
  M.lawn=S(0x4f7d36,{roughness:1});M.hotelW=S(0xe9eef2,{roughness:0.35,metalness:0.3,envMap:RACE.env});
  M.hotelG=S(0x26384a,{roughness:0.08,metalness:0.7,envMap:RACE.env,emissive:0x1a2a3a,emissiveIntensity:0.4});
  M.grid=new THREE.MeshBasicMaterial({color:0x8fdcff,wireframe:true,transparent:true,opacity:0.7});
  return objMats.m=M;
}
function uvBox(w,h,d,tile){ // 면마다 실제 크기에 맞춰 텍스처 반복
  const g=new THREE.BoxGeometry(w,h,d);const uv=g.attributes.uv;tile=tile||12;
  const sizes=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(let f=0;f<6;f++)for(let k=0;k<4;k++){const i=f*4+k;uv.setXY(i,uv.getX(i)*sizes[f][0]/tile,uv.getY(i)*sizes[f][1]/tile);}
  return g;
}
function mesh(g,m,x,y,z,parent,sh){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);if(sh){o.castShadow=true;o.receiveShadow=true;}parent.add(o);return o;}
const OBJ_BUILD={
  stand(o,g,M,sh){const L=27*o.s;
    for(let k=0;k<6;k++){mesh(new THREE.BoxGeometry(L,1.2,2.0),[M.concrete,M.concrete,M.crowd,M.concrete,M.concrete,M.crowd],0,0.6+k*1.2,1+k*2,g,sh);}
    mesh(new THREE.BoxGeometry(L,1.1,0.25),M.white,0,0.55,-0.1,g);
    mesh(new THREE.BoxGeometry(L,11,0.4),M.concrete,0,5.5,12.2,g,sh);
    for(const sd of [-1,1]) mesh(new THREE.BoxGeometry(0.4,8.5,12.5),M.concrete,sd*L/2,4.25,6.2,g);
    const roof=mesh(new THREE.BoxGeometry(L+2,0.35,15),M.roof,0,12.6,5.8,g,sh);roof.rotation.x=0.06;
    for(let k=0;k<=3;k++){mesh(new THREE.CylinderGeometry(0.22,0.22,12.4,8),M.dark,-L/2+k*L/3,6.2,12.6,g);}
    mesh(new THREE.BoxGeometry(L,0.6,0.3),M.ad,0,12.0,-1.2,g);},
  pit(o,g,M,sh){const L=150*o.s;
    mesh(uvBox(L,8,16,12),[M.white,M.white,M.concrete,M.white,M.white,M.garage],0,4,0,g,sh);
    mesh(new THREE.BoxGeometry(L+0.2,2.4,16.2),M.glass,0,7,0,g);
    mesh(new THREE.BoxGeometry(L+4,0.4,5),M.white,0,8.4,-9.5,g,sh);
    for(let x=-L/2;x<=L/2;x+=12) mesh(new THREE.BoxGeometry(0.35,8.6,0.5),M.dark,x,4.3,-8.2,g);
    mesh(new THREE.BoxGeometry(L*0.35,5,12),M.white,L*0.2,10.5,2,g,sh);mesh(new THREE.BoxGeometry(L*0.35+0.2,2,12.2),M.glass,L*0.2,10.6,2,g);},
  bldg(o,g,M,sh){const w=18*o.s,d=18*o.s,h=o.h||24;const m=M.bldg[Math.abs(Math.round(o.x+o.z))%M.bldg.length];
    mesh(uvBox(w,h,d,12),m,0,h/2,0,g,sh);
    mesh(new THREE.BoxGeometry(w+0.5,1,d+0.5),M.parapet,0,h+0.5,0,g);
    mesh(new THREE.BoxGeometry(w-0.6,0.3,d-0.6),M.parapet,0,h+0.15,0,g);
    mesh(new THREE.BoxGeometry(3,1.6,2.2),M.ac,w*0.2,h+0.8,-d*0.2,g);mesh(new THREE.BoxGeometry(2.2,1.4,2.2),M.ac,-w*0.25,h+0.7,d*0.15,g);
    mesh(new THREE.CylinderGeometry(1.2,1.2,2.4,10),M.ac,-w*0.25,h+1.2,-d*0.25,g);
    mesh(new THREE.BoxGeometry(w*0.4,3.2,0.3),M.glass,0,1.6,-d/2-0.05,g);},
  tower(o,g,M,sh){const w=16*o.s,d=16*o.s,h=o.h||70;
    mesh(uvBox(w,h,d,8),M.tower,0,h/2,0,g,sh);mesh(new THREE.BoxGeometry(w*0.7,6,d*0.7),M.dark,0,h+3,0,g);
    mesh(new THREE.CylinderGeometry(0.2,0.2,10,6),M.dark,w*0.2,h+11,0,g);mesh(new THREE.BoxGeometry(w+1,4,d+1),M.dark,0,2,0,g);},
  house(o,g,M,sh){const w=10*o.s,d=8*o.s,h=5.5*o.s;
    mesh(new THREE.BoxGeometry(w,h,d),M.brick,0,h/2,0,g,sh);
    const sh2=new THREE.Shape([new THREE.Vector2(-d/2-0.4,0),new THREE.Vector2(d/2+0.4,0),new THREE.Vector2(0,d*0.42)]);
    const rg=new THREE.ExtrudeGeometry(sh2,{depth:w+0.6,bevelEnabled:false});rg.translate(0,0,-(w+0.6)/2);rg.rotateY(Math.PI/2);
    mesh(rg,M.tile,0,h,0,g,sh);
    mesh(new THREE.BoxGeometry(1.1,2.1,0.1),M.dark,0,1.05,-d/2-0.05,g);
    for(const sd of [-1,1]) mesh(new THREE.BoxGeometry(1.4,1.2,0.1),M.glass,sd*w*0.28,h*0.6,-d/2-0.05,g);},
  forest(o,g,M,sh,T){const R=22*o.s,n=Math.round(14*o.s*o.s)+4,r=rng(Math.round(o.x*7+o.z*13));
    const tg=new THREE.CylinderGeometry(0.2,0.3,1,6);tg.translate(0,0.5,0);const c1=new THREE.ConeGeometry(2.4,5,8);c1.translate(0,2.5,0);const c2=new THREE.ConeGeometry(1.6,4,8);c2.translate(0,2,0);
    const I=[new THREE.InstancedMesh(tg,M.trunk,n),new THREE.InstancedMesh(c1,M.pine,n),new THREE.InstancedMesh(c2,M.pine2,n)];
    const mm=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),sc=new THREE.Vector3();
    for(let k=0;k<n;k++){const a=r()*6.28,d=Math.sqrt(r())*R,x=Math.sin(a)*d,z=Math.cos(a)*d,s=0.8+r()*0.6,th=2+r();
      const gy=T&&T.terrainH?T.terrainH(o.x+x,o.z+z)-g.position.y:0;q.setFromAxisAngle(new THREE.Vector3(0,1,0),r()*6);
      mm.compose(p.set(x,gy,z),q,sc.set(s,th,s));I[0].setMatrixAt(k,mm);
      mm.compose(p.set(x,gy+th*0.8,z),q,sc.set(s,s,s));I[1].setMatrixAt(k,mm);
      mm.compose(p.set(x,gy+th*0.8+3.2*s,z),q,sc.set(s,s,s));I[2].setMatrixAt(k,mm);}
    I.forEach(m=>{m.castShadow=sh;g.add(m);});},
  palm(o,g,M,sh){const r=rng(Math.round(o.x*3+o.z*5)),n=Math.max(1,Math.round(5*o.s));
    for(let k=0;k<n;k++){const a=r()*6.28,d=k?2+r()*6*o.s:0;const p=new THREE.Group();p.position.set(Math.sin(a)*d,0,Math.cos(a)*d);g.add(p);
      const h=7+r()*5;const tr=mesh(new THREE.CylinderGeometry(0.22,0.35,h,7),M.trunk,0,h/2,0,p,sh);tr.rotation.z=(r()-0.5)*0.15;
      for(let l=0;l<7;l++){const lf=new THREE.Mesh(new THREE.ConeGeometry(0.5,4,4),M.leaf);lf.scale.set(1,1,0.15);lf.position.set(0,h,0);lf.rotation.set(0,l/7*6.28,0);lf.rotateX(-1.9);lf.translateY(2);p.add(lf);}}},
  tent(o,g,M,sh){const w=8*o.s;mesh(new THREE.BoxGeometry(w,3,w),M.tent,0,1.5,0,g,sh);const r=mesh(new THREE.ConeGeometry(w*0.72,2.6,4),M.tent,0,4.3,0,g,sh);r.rotation.y=Math.PI/4;
    for(const sx of [-1,1])for(const sz of [-1,1]) mesh(new THREE.CylinderGeometry(0.08,0.08,3,6),M.dark,sx*w/2,1.5,sz*w/2,g);},
  bill(o,g,M,sh){const w=8*o.s;for(const sd of [-1,1]) mesh(new THREE.CylinderGeometry(0.12,0.12,3,6),M.dark,sd*w*0.4,1.5,0.1,g);
    const p=mesh(new THREE.BoxGeometry(w,2.6,0.15),[M.dark,M.dark,M.dark,M.dark,M.dark,M.ad],0,3.6,0,g,sh);},
  light(o,g,M,sh){mesh(new THREE.CylinderGeometry(0.22,0.32,18,8),M.dark,0,9,0,g,sh);const hd=mesh(new THREE.BoxGeometry(3.4,1.4,0.5),M.lamp,0,18.4,-0.3,g);hd.rotation.x=0.35;},
  marshal(o,g,M,sh){mesh(new THREE.BoxGeometry(2.2,2.4,2.2),M.white,0,1.2,0,g,sh);mesh(new THREE.BoxGeometry(2.6,0.2,2.6),M.orange,0,2.5,0,g);
    mesh(new THREE.BoxGeometry(1.8,0.9,0.1),M.glass,0,1.7,-1.11,g);mesh(new THREE.CylinderGeometry(0.04,0.04,2,6),M.dark,0.9,3.5,0.9,g);
    mesh(new THREE.BoxGeometry(0.02,0.6,0.9),M.orange,0.9,4.1,0.45,g);},
  tyres(o,g,M,sh){const n=Math.max(2,Math.round(5*o.s)),geo=new THREE.TorusGeometry(0.28,0.13,6,12);geo.rotateX(Math.PI/2);
    const I=new THREE.InstancedMesh(geo,M.tyre,n*2*3);const mm=new THREE.Matrix4();let k=0;
    for(let c=0;c<n;c++)for(let r2=0;r2<2;r2++)for(let l=0;l<3;l++){mm.makeTranslation(-n*0.42+c*0.84+0.42,0.13+l*0.26,r2*0.78-0.39);I.setMatrixAt(k++,mm);}
    I.castShadow=sh;g.add(I);},
  cone(o,g,M,sh){mesh(new THREE.ConeGeometry(0.22,0.75,12),M.orange,0,0.4,0,g,sh);mesh(new THREE.CylinderGeometry(0.15,0.17,0.12,12),M.white,0,0.42,0,g);mesh(new THREE.BoxGeometry(0.5,0.04,0.5),M.orange,0,0.02,0,g);},
  ferris(o,g,M,sh){const s=o.s,fg=new THREE.Group();fg.position.set(0,46*s,0);fg.scale.setScalar(s);g.add(fg);
    fg.add(new THREE.Mesh(new THREE.TorusGeometry(40,0.7,6,64),M.white));fg.add(new THREE.Mesh(new THREE.TorusGeometry(37,0.4,6,64),M.white));
    for(let k=0;k<24;k++){const a=k/24*Math.PI*2;const sp=new THREE.Mesh(new THREE.BoxGeometry(0.3,40,0.3),M.white);sp.rotation.z=a;sp.translateY(20);fg.add(sp);
      const cab=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,2.4,10),new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(k/24,0.55,0.55)}));cab.position.set(Math.sin(a)*40,Math.cos(a)*40-2,0);fg.add(cab);}
    fg.add(new THREE.Mesh(new THREE.CylinderGeometry(2,2,4,16).rotateX(Math.PI/2),M.dark));
    for(const sd of [-1,1])for(const fz of [-1,1]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.8,1.4,50,8),M.white);leg.position.set(sd*12,-23,fz*3);leg.rotation.z=sd*0.25;fg.add(leg);}
    mesh(new THREE.BoxGeometry(40*s,4,12),M.white,0,2,0,g,sh);},
  hotel(o,g,M,sh,T){const span=24*o.s;
    for(const sd of [-1,1]){mesh(new THREE.BoxGeometry(26,30,90),M.hotelW,sd*(span+13),15,0,g,sh);mesh(new THREE.BoxGeometry(26.4,22,86),M.hotelG,sd*(span+13),17,0,g);}
    mesh(new THREE.BoxGeometry(span*2+4,7,22),M.hotelW,0,16,0,g,sh);mesh(new THREE.BoxGeometry(span*2+4.2,3,22.2),M.hotelG,0,16,0,g);
    const shell=new THREE.Mesh(new THREE.SphereGeometry(1,28,10,0,Math.PI*2,0,Math.PI/2),M.grid);shell.scale.set(span+32,22,70);shell.position.set(0,20,0);g.add(shell);},
  dome(o,g,M,sh){const R=150*o.s;const d=mesh(new THREE.SphereGeometry(1,48,14,0,Math.PI*2,0,Math.PI/2),M.red,0,0,0,g,sh);d.scale.set(R,R*0.17,R);
    mesh(new THREE.CylinderGeometry(R*1.02,R*1.04,4,48),M.white,0,2,0,g);mesh(new THREE.CylinderGeometry(R*0.12,R*0.14,8,24),M.red,0,R*0.17+2,0,g);},
  casino(o,g,M,sh){const s=o.s;const cg=new THREE.Group();cg.scale.setScalar(s);g.add(cg);
    mesh(new THREE.BoxGeometry(60,20,34),M.cream,0,10,0,cg,sh);mesh(new THREE.BoxGeometry(62,1.4,36),M.white,0,20.7,0,cg);
    for(const sd of [-1,1]){mesh(new THREE.BoxGeometry(8,30,8),M.cream,sd*24,15,-13,cg,sh);const cap=mesh(new THREE.ConeGeometry(5.5,8,4),M.copper,sd*24,34,-13,cg);cap.rotation.y=Math.PI/4;}
    mesh(new THREE.SphereGeometry(9,20,10,0,Math.PI*2,0,Math.PI/2),M.copper,0,21,0,cg);
    for(let k=0;k<8;k++) mesh(new THREE.BoxGeometry(2.2,9,0.6),M.white,-21+k*6,4.5,-17.2,cg);
    mesh(new THREE.CylinderGeometry(14,14,0.6,24),M.lawn,0,0.3,-34,cg);},
};
// 충돌용 원 (트랙 근처에 둔 물체만 의미 있음)
function objColliders(o){const s=o.s||1,ca=Math.cos(o.a||0),sa=Math.sin(o.a||0),P=(lx,lz,r)=>({x:o.x+lx*ca+lz*sa,z:o.z-lx*sa+lz*ca,r});
  switch(o.t){
    case 'cone':return [P(0,0,0.35)];case 'light':return [P(0,0,0.4)];case 'marshal':return [P(0,0,1.5)];
    case 'tyres':{const n=Math.max(2,Math.round(5*s)),L=[];for(let c=0;c<n;c+=2)L.push(P(-n*0.42+c*0.84+0.42,0,0.8));return L;}
    case 'bill':return [P(-3.2*s,0,0.3),P(0,0,0.3),P(3.2*s,0,0.3)];
    case 'tent':return [P(0,0,4*s)];case 'house':return [P(0,0,4*s)];
    case 'bldg':return [P(0,0,8.5*s)];case 'tower':return [P(0,0,7.5*s)];
    case 'palm':return [P(0,0,0.5)];
    case 'stand':{const L=[];for(let k=-2;k<=2;k++)L.push(P(k*5.4*s,6,6));return L;}
    default:return [];
  }
}
function applyLayout(T,layout){
  const M=objMats(),sh=Q().shadow>0;T.colliders=[];T.occupied=[];
  for(const o of layout.objs||[]){
    const fn=OBJ_BUILD[o.t];if(!fn)continue;
    const g=new THREE.Group();const gr=groundAt(T,o.x,o.z);
    const nearTrack=gr.dist<T.wallBase+30;
    g.position.set(o.x,nearTrack?Math.max(gr.h,gr.trackH-0.3):gr.h,o.z);g.rotation.y=o.a||0;
    if(o.t==='hotel'){g.position.y=gr.trackH;}
    try{fn(o,g,M,sh,T);}catch(e){console.warn(e);continue;}
    T.group.add(g);
    T.colliders.push(...objColliders(o));
    const ty=OBJ_TYPES[o.t];const r=ty.r?ty.r(o):Math.hypot(...ty.fp(o))/2;T.occupied.push([o.x,o.z,r]);
  }
}

// ----- 레이아웃 불러오기/저장
async function loadLayout(t){
  try{await Store.ready;const L=await Store.getLayout(t.id);t._layout=L&&L.objs?L:null;}catch(e){t._layout=null;}
  return t._layout;
}

// ===== 배치 편집기 (2D 위에서 보기) =====
const ED={t:null,L:null,sel:-1,place:null,cx:0,cz:0,zoom:0.3,drag:null,dirty:false,geo:null,path:null};
function canEditLayout(){return ED.allowed===true;}
async function checkEditPermission(){
  ED.allowed=false;
  if(Store.mode!=='cloud'){ED.allowed=true;return true;}
  try{const u=window.claude&&await window.claude.use('user');ED.allowed=!!(u&&u.canEdit&&await u.canEdit());}catch(e){ED.allowed=false;}
  return ED.allowed;
}
function openEditor(){
  const t=curTrack;if(!t)return;ED.t=t;ED.geo=trackGeo(t);
  ED.L=JSON.parse(JSON.stringify(t._layout||defaultLayout(t)));ED.sel=-1;ED.place=null;ED.dirty=false;
  const G=ED.geo;let mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9;for(let i=0;i<G.N;i+=4){mnx=Math.min(mnx,G.px[i]);mxx=Math.max(mxx,G.px[i]);mnz=Math.min(mnz,G.pz[i]);mxz=Math.max(mxz,G.pz[i]);}
  ED.cx=(mnx+mxx)/2;ED.cz=(mnz+mxz)/2;
  show('editor');$('#edTitle').textContent='배치 편집 · '+t.name;
  const cv=$('#edCanvas');const r=cv.getBoundingClientRect();ED.zoom=Math.min(r.width/(mxx-mnx+300),r.height/(mxz-mnz+300));
  $('#edPalette').innerHTML=ED_PALETTE.map(k=>`<button class="pal" data-pal="${k}"><i style="background:${OBJ_TYPES[k].c}"></i>${OBJ_TYPES[k].n}</button>`).join('');
  $('#edAutoTrees').checked=!!ED.L.auto.trees;$('#edAutoCity').checked=!!ED.L.auto.city;
  edPanel();edResize();
}
function edResize(){const cv=$('#edCanvas');const r=cv.getBoundingClientRect();const dpr=Math.min(2,devicePixelRatio||1);cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);ED.dpr=dpr;edDraw();}
const w2s=(x,z)=>{const cv=$('#edCanvas');return [(x-ED.cx)*ED.zoom*ED.dpr+cv.width/2,(z-ED.cz)*ED.zoom*ED.dpr+cv.height/2];};
const s2w=(sx,sy)=>{const cv=$('#edCanvas');return [(sx*ED.dpr-cv.width/2)/(ED.zoom*ED.dpr)+ED.cx,(sy*ED.dpr-cv.height/2)/(ED.zoom*ED.dpr)+ED.cz];};
function edDraw(){
  const cv=$('#edCanvas');if(!cv||$('#editor').hidden)return;const x=cv.getContext('2d'),G=ED.geo,Z=ED.zoom*ED.dpr;
  x.fillStyle='#24301f';x.fillRect(0,0,cv.width,cv.height);
  // 격자 (100m)
  x.strokeStyle='rgba(255,255,255,.05)';x.lineWidth=1;const step=100*Z;const [ox,oy]=w2s(0,0);
  for(let gx=ox%step;gx<cv.width;gx+=step){x.beginPath();x.moveTo(gx,0);x.lineTo(gx,cv.height);x.stroke();}
  for(let gy=oy%step;gy<cv.height;gy+=step){x.beginPath();x.moveTo(0,gy);x.lineTo(cv.width,gy);x.stroke();}
  // 트랙: 벽 범위, 노면
  const line=(off,w,col)=>{x.beginPath();for(let i=0;i<=G.N;i+=2){const k=i%G.N;const p=w2s(G.px[k],G.pz[k]);i?x.lineTo(...p):x.moveTo(...p);}x.closePath();x.strokeStyle=col;x.lineWidth=w;x.lineJoin='round';x.stroke();};
  line(0,(G.wallBase*2)*Z,'rgba(150,160,120,.35)');line(0,G.hw*2*Z,'#4a4d52');line(0,Math.max(1,0.4*Z),'rgba(255,255,255,.25)');
  // 출발선
  {const p=w2s(G.px[0],G.pz[0]);x.fillStyle='#fff';x.beginPath();x.arc(p[0],p[1],5*ED.dpr,0,7);x.fill();x.fillStyle='#ffb000';x.font=`${12*ED.dpr}px sans-serif`;x.fillText('START',p[0]+8*ED.dpr,p[1]-6*ED.dpr);}
  // 오브젝트
  ED.L.objs.forEach((o,k)=>{const ty=OBJ_TYPES[o.t];if(!ty)return;const p=w2s(o.x,o.z);x.save();x.translate(p[0],p[1]);x.rotate(-(o.a||0));
    x.fillStyle=ty.c;x.globalAlpha=0.85;x.strokeStyle=k===ED.sel?'#ffb000':'rgba(0,0,0,.6)';x.lineWidth=(k===ED.sel?3:1)*ED.dpr;
    if(ty.r){const r=Math.max(3*ED.dpr,ty.r(o)*Z);x.beginPath();x.arc(0,0,r,0,7);x.fill();x.stroke();}
    else{const [w,d]=ty.fp(o);const W=Math.max(4*ED.dpr,w*Z),D=Math.max(3*ED.dpr,d*Z);x.fillRect(-W/2,o.t==='stand'||o.t==='bill'?0:-D/2,W,D);x.strokeRect(-W/2,o.t==='stand'||o.t==='bill'?0:-D/2,W,D);
      if(o.t==='stand'||o.t==='bill'){x.fillStyle='#000';x.fillRect(-W/2,-1*ED.dpr,W,2*ED.dpr);}}
    x.restore();
    if(k===ED.sel||ED.zoom>0.8){x.fillStyle='#fff';x.font=`${11*ED.dpr}px sans-serif`;x.fillText(ty.n,p[0]+6*ED.dpr,p[1]-6*ED.dpr);}
  });
  if(ED.place){x.fillStyle='rgba(255,176,0,.9)';x.font=`bold ${13*ED.dpr}px sans-serif`;x.fillText('지도를 눌러 "'+OBJ_TYPES[ED.place].n+'" 놓기',14*ED.dpr,24*ED.dpr);}
}
function edHit(wx,wz){let best=-1,bd=1e9;ED.L.objs.forEach((o,k)=>{const ty=OBJ_TYPES[o.t];const r=ty.r?ty.r(o):Math.max(...ty.fp(o))/2;const d=Math.hypot(o.x-wx,o.z-wz);const lim=Math.max(r,8/ED.zoom);if(d<lim&&d<bd){bd=d;best=k;}});return best;}
function edPanel(){
  const p=$('#edProps');const o=ED.L.objs[ED.sel];
  if(!o){p.innerHTML=`<div class="edhint">왼쪽 목록에서 종류를 고르고 지도를 누르면 놓여요. 놓인 것을 누르면 선택, 끌면 이동, 빈 곳을 끌면 지도 이동, 휠/두 손가락으로 확대해요.</div><div class="edcount">${ED.L.objs.length}개 배치됨</div>`;return;}
  const ty=OBJ_TYPES[o.t];const deg=Math.round(((o.a||0)*180/Math.PI%360+360)%360);
  p.innerHTML=`<div class="edsel"><i style="background:${ty.c}"></i>${ty.n}</div>
    <label for="edRot">방향 <b>${deg}°</b></label><input type="range" id="edRot" min="0" max="359" value="${deg}">
    <label for="edSize">크기 <b>${(o.s||1).toFixed(2)}×</b></label><input type="range" id="edSize" min="0.4" max="3" step="0.05" value="${o.s||1}">
    ${ty.h?`<label for="edH">높이 <b>${Math.round(o.h||ty.h)}m</b></label><input type="range" id="edH" min="6" max="160" step="1" value="${o.h||ty.h}">`:''}
    <div class="row" style="margin-top:10px"><button class="btn ghost" data-ed="dup" style="flex:1">복제</button><button class="btn ghost" data-ed="del" style="flex:1;color:#ff7a7a">삭제</button></div>`;
  const upd=()=>{ED.dirty=true;edDraw();};
  $('#edRot').oninput=e=>{o.a=+e.target.value*Math.PI/180;e.target.previousElementSibling.querySelector('b').textContent=e.target.value+'°';upd();};
  $('#edSize').oninput=e=>{o.s=+e.target.value;e.target.previousElementSibling.querySelector('b').textContent=(+e.target.value).toFixed(2)+'×';upd();};
  if($('#edH'))$('#edH').oninput=e=>{o.h=+e.target.value;e.target.previousElementSibling.querySelector('b').textContent=e.target.value+'m';upd();};
}
(function edEvents(){
  const cv=$('#edCanvas');if(!cv)return;const ptrs=new Map();
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,[e.offsetX,e.offsetY]);
    if(ptrs.size===2){ED.pinch={d:Math.hypot(...[...ptrs.values()].reduce((a,b)=>[a[0]-b[0],a[1]-b[1]])),z:ED.zoom};ED.drag=null;return;}
    const [wx,wz]=s2w(e.offsetX,e.offsetY);
    if(ED.place){const def={t:ED.place,x:wx,z:wz,a:0,s:1};if(OBJ_TYPES[ED.place].h)def.h=OBJ_TYPES[ED.place].h;
      // 트랙 근처면 트랙을 바라보게
      const G=ED.geo;let bi=0,bd=1e18;for(let i=0;i<G.N;i+=2){const d=(G.px[i]-wx)**2+(G.pz[i]-wz)**2;if(d<bd){bd=d;bi=i;}}
      if(Math.sqrt(bd)<200){const dx=wx-G.px[bi],dz=wz-G.pz[bi];def.a=Math.atan2(dx,dz);if(ED.place==='hotel'){def.x=G.px[bi];def.z=G.pz[bi];def.a=Math.atan2(G.tx[bi],G.tz[bi]);}}
      ED.L.objs.push(def);ED.sel=ED.L.objs.length-1;ED.place=null;$$('.pal').forEach(b=>b.classList.remove('on'));ED.dirty=true;edPanel();edDraw();return;}
    const k=edHit(wx,wz);ED.sel=k;edPanel();
    ED.drag=k>=0?{k,ox:ED.L.objs[k].x-wx,oz:ED.L.objs[k].z-wz}:{pan:true,sx:e.offsetX,sy:e.offsetY,cx:ED.cx,cz:ED.cz};edDraw();});
  cv.addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId))return;ptrs.set(e.pointerId,[e.offsetX,e.offsetY]);
    if(ptrs.size===2&&ED.pinch){const d=Math.hypot(...[...ptrs.values()].reduce((a,b)=>[a[0]-b[0],a[1]-b[1]]));ED.zoom=clamp(ED.pinch.z*d/ED.pinch.d,0.05,6);edDraw();return;}
    if(!ED.drag)return;
    if(ED.drag.pan){ED.cx=ED.drag.cx-(e.offsetX-ED.drag.sx)/ED.zoom;ED.cz=ED.drag.cz-(e.offsetY-ED.drag.sy)/ED.zoom;}
    else{const [wx,wz]=s2w(e.offsetX,e.offsetY);const o=ED.L.objs[ED.drag.k];o.x=wx+ED.drag.ox;o.z=wz+ED.drag.oz;ED.dirty=true;}
    edDraw();});
  const up=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)ED.pinch=null;if(!ptrs.size)ED.drag=null;};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{e.preventDefault();const [wx,wz]=s2w(e.offsetX,e.offsetY);ED.zoom=clamp(ED.zoom*Math.exp(-e.deltaY*0.0015),0.05,6);
    const [nx,nz]=s2w(e.offsetX,e.offsetY);ED.cx+=wx-nx;ED.cz+=wz-nz;edDraw();},{passive:false});
  window.addEventListener('resize',()=>{if(!$('#editor').hidden)edResize();});
  window.addEventListener('keydown',e=>{if($('#editor').hidden||e.target.tagName==='INPUT'&&e.target.type!=='range')return;const o=ED.L&&ED.L.objs[ED.sel];
    if((e.code==='Delete'||e.code==='Backspace')&&o){ED.L.objs.splice(ED.sel,1);ED.sel=-1;ED.dirty=true;edPanel();edDraw();e.preventDefault();}
    if(e.code==='KeyQ'&&o){o.a=(o.a||0)+Math.PI/12;ED.dirty=true;edPanel();edDraw();}
    if(e.code==='KeyE'&&o){o.a=(o.a||0)-Math.PI/12;ED.dirty=true;edPanel();edDraw();}
    if(e.code==='Escape'){ED.place=null;$$('.pal').forEach(b=>b.classList.remove('on'));edDraw();}});
  document.addEventListener('click',async e=>{
    const pb=e.target.closest('[data-pal]');if(pb){ED.place=pb.dataset.pal;$$('.pal').forEach(b=>b.classList.toggle('on',b===pb));edDraw();return;}
    const b=e.target.closest('[data-ed]');if(!b)return;const o=ED.L.objs[ED.sel];
    switch(b.dataset.ed){
      case 'del':if(o){ED.L.objs.splice(ED.sel,1);ED.sel=-1;ED.dirty=true;edPanel();edDraw();}break;
      case 'dup':if(o){const c=Object.assign({},o,{x:o.x+12,z:o.z+12});ED.L.objs.push(c);ED.sel=ED.L.objs.length-1;ED.dirty=true;edPanel();edDraw();}break;
      case 'reset':ED.L=defaultLayout(ED.t);ED.sel=-1;ED.dirty=true;$('#edAutoTrees').checked=true;$('#edAutoCity').checked=!!ED.L.auto.city;edPanel();edDraw();toast('기본 배치로 되돌렸어요 (저장해야 적용돼요)');break;
      case 'clear':ED.L.objs=[];ED.sel=-1;ED.dirty=true;edPanel();edDraw();break;
      case 'zin':ED.zoom=Math.min(6,ED.zoom*1.3);edDraw();break;
      case 'zout':ED.zoom=Math.max(0.05,ED.zoom/1.3);edDraw();break;
      case 'save':{ED.L.auto.trees=$('#edAutoTrees').checked;ED.L.auto.city=$('#edAutoCity').checked;ED.L.v=Date.now();ED.L.by=USER?USER.nick:'';
        b.disabled=true;try{await Store.setLayout(ED.t.id,ED.L);ED.t._layout=JSON.parse(JSON.stringify(ED.L));ED.dirty=false;ED.t._hero=null;toast('저장했어요. 다음 주행부터 모두에게 적용돼요');}
        catch(err){toast('저장하지 못했어요. 이 사이트를 편집할 권한이 있는지 확인해 주세요.');}b.disabled=false;break;}
      case 'close':if(ED.dirty&&!b.dataset.sure){b.dataset.sure=1;b.textContent='저장 안 하고 나가기';setTimeout(()=>{delete b.dataset.sure;b.textContent='나가기';},2500);break;}
        delete b.dataset.sure;b.textContent='나가기';show('tracks');selectTrack(ED.t.id);break;
    }});
  $('#edAutoTrees').addEventListener('change',()=>ED.dirty=true);$('#edAutoCity').addEventListener('change',()=>ED.dirty=true);
})();
