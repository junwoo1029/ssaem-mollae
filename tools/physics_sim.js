const {stepCar,newCarState}=require('../src/physics.js');
const road={mu:1,roll:0};
let c=newCarState(), t=0, dt=1/240, t100=null;
while(t<60){ stepCar(c,{thr:1},dt,road); t+=dt; if(!t100&&c.u>=100/3.6) t100=t; }
console.log('0-100',t100?.toFixed(2),'top',(c.u*3.6).toFixed(1),'gear',c.gear,'rpm',c.rpm|0);
// braking 100-0
c=newCarState(); c.vz=100/3.6; c.u=c.vz; c.gear=4; let d=0; t=0;
while(c.u>0.1&&t<10){ const z0=c.z; stepCar(c,{brake:1},dt,road); d+=c.z-z0; t+=dt;}
console.log('100-0 m',d.toFixed(1),'s',t.toFixed(2));
// skidpad: constant speed steer
for (const kmh of [60,120,180]){
c=newCarState(); c.vz=kmh/3.6; c.gear=4; t=0; let maxAy=0;
while(t<6){ const thr=c.u<kmh/3.6; stepCar(c,{thr,steer:1},dt,road); t+=dt; maxAy=Math.max(maxAy,Math.abs(c.ay));}
console.log(kmh,'lat g',(maxAy/9.81).toFixed(2),'speed',(c.u*3.6).toFixed(0),'r',c.r.toFixed(2),'v',c.v.toFixed(2), 'nan?',isNaN(c.x));
}
// reverse
c=newCarState(); t=0; while(t<3){stepCar(c,{back:1,steer:0.5},dt,road);t+=dt;} console.log('rev u',c.u.toFixed(2),c.gear);
// circle at constant speed with modest steer, measure radius
for (const kmh of [60,120,180]){
 for(const st of [0.3,0.6,1]){
 let c=newCarState(); c.vz=kmh/3.6; c.u=c.vz; c.gear=4; let t=0;
 while(t<8){ const thr=c.u<kmh/3.6; stepCar(c,{thr,steer:st},1/240,{mu:1,roll:0}); t+=1/240;}
 console.log(kmh,st,'ay g',(c.u*c.r/9.81).toFixed(2),'spd',(c.u*3.6).toFixed(0),'R',(c.u/c.r).toFixed(0),'beta',(Math.atan2(c.v,c.u)*57.3).toFixed(1));
}}
