// Minimal THREE shim: records world-space triangles for Mesh(Box|Cylinder|Torus) so a python rasterizer can draw them.
'use strict';
const fs=require('fs');
function mat4(){return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];}
function mul(a,b){const o=new Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++){let s=0;for(let k=0;k<4;k++)s+=a[r*4+k]*b[k*4+c];o[r*4+c]=s;}return o;}
function inv(m){const a=m.slice(),I=mat4();for(let c=0;c<4;c++){let p=c;for(let r=c+1;r<4;r++)if(Math.abs(a[r*4+c])>Math.abs(a[p*4+c]))p=r;for(let k=0;k<4;k++){[a[c*4+k],a[p*4+k]]=[a[p*4+k],a[c*4+k]];[I[c*4+k],I[p*4+k]]=[I[p*4+k],I[c*4+k]]}const d=a[c*4+c];for(let k=0;k<4;k++){a[c*4+k]/=d;I[c*4+k]/=d}for(let r=0;r<4;r++)if(r!==c){const f=a[r*4+c];for(let k=0;k<4;k++){a[r*4+k]-=f*a[c*4+k];I[r*4+k]-=f*I[c*4+k]}}}return I}
class V3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}set(x,y,z){this.x=x;this.y=y;this.z=z;return this}copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this}clone(){return new V3(this.x,this.y,this.z)}add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this}multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this}setScalar(s){this.x=this.y=this.z=s;return this}length(){return Math.hypot(this.x,this.y,this.z)}fromArray(a){this.x=a[0];this.y=a[1];this.z=a[2];return this}lerpVectors(a,b,t){this.x=a.x+(b.x-a.x)*t;this.y=a.y+(b.y-a.y)*t;this.z=a.z+(b.z-a.z)*t;return this}applyQuaternion(){return this}}
class Euler{constructor(){this.x=0;this.y=0;this.z=0;this.order='XYZ'}set(x,y,z,o){this.x=x;this.y=y;this.z=z;if(o)this.order=o;return this}}
class Obj{
 constructor(){this.position=new V3();this.rotation=new Euler();this.scale=new V3(1,1,1);this.children=[];this.parent=null;this.visible=true;this.userData={};this.name='';this.quaternion={setFromUnitVectors(){},copy(){}}}
 add(...o){for(const c of o){if(!c)continue;c.parent=this;this.children.push(c)}return this}
 remove(c){const i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1)}
 worldM(){return this.parent&&this.parent.worldM?mul(this.parent.worldM(),this.local()):this.local()}
 getWorldPosition(v){v=v||new V3();const W=this.worldM();v.x=W[3];v.y=W[7];v.z=W[11];return v}
 localToWorld(v){const W=this.worldM();const x=v.x,y=v.y,z=v.z;v.x=W[0]*x+W[1]*y+W[2]*z+W[3];v.y=W[4]*x+W[5]*y+W[6]*z+W[7];v.z=W[8]*x+W[9]*y+W[10]*z+W[11];return v}
 worldToLocal(v){const I=inv(this.worldM());const x=v.x,y=v.y,z=v.z;v.x=I[0]*x+I[1]*y+I[2]*z+I[3];v.y=I[4]*x+I[5]*y+I[6]*z+I[7];v.z=I[8]*x+I[9]*y+I[10]*z+I[11];return v}
 attach(c){this.add(c)}
 updateWorldMatrix(){} updateMatrixWorld(){} lookAt(){} traverse(f){f(this);this.children.forEach(c=>c.traverse&&c.traverse(f))}
 local(){const {x:a,y:b,z:c}=this.rotation;const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cc=Math.cos(c),sc=Math.sin(c);
  // three.js 'XYZ' euler -> R = Rx*Ry*Rz
  const R=[cb*cc, -cb*sc, sb, ca*sc+sa*sb*cc, ca*cc-sa*sb*sc, -sa*cb, sa*sc-ca*sb*cc, sa*cc+ca*sb*sc, ca*cb];
  const s=this.scale,p=this.position;
  return [R[0]*s.x,R[1]*s.y,R[2]*s.z,p.x, R[3]*s.x,R[4]*s.y,R[5]*s.z,p.y, R[6]*s.x,R[7]*s.y,R[8]*s.z,p.z, 0,0,0,1];}
}
class Mesh extends Obj{constructor(g,m){super();this.geometry=g;this.material=m||{};this.castShadow=false;this.receiveShadow=false}}
class Geo{constructor(t,p){this.t=t;this.p=p;this.ops=[]}
 translate(x,y,z){this.ops.push(['t',x,y,z]);return this} rotateX(a){this.ops.push(['x',a]);return this} rotateY(a){this.ops.push(['y',a]);return this} rotateZ(a){this.ops.push(['z',a]);return this}
 computeVertexNormals(){return this} scale(x,y,z){this.ops.push(['s',x,y,z]);return this}}
// 2D shapes for ExtrudeGeometry (outline sampled; curves sampled at 6 points)
class Shape{constructor(){this.pts=[];this.holes=[];this.c=[0,0]}
 moveTo(x,y){this.c=[x,y];this.pts.push([x,y]);return this} lineTo(x,y){this.c=[x,y];this.pts.push([x,y]);return this}
 quadraticCurveTo(cx,cy,x,y){const [x0,y0]=this.c;for(let i=1;i<=6;i++){const t=i/6,a=(1-t)*(1-t),b=2*(1-t)*t,d=t*t;this.pts.push([a*x0+b*cx+d*x,a*y0+b*cy+d*y])}this.c=[x,y];return this}
 absarc(x,y,r,a0,a1){for(let i=0;i<=16;i++){const a=a0+(a1-a0)*i/16;this.pts.push([x+r*Math.cos(a),y+r*Math.sin(a)])}return this}}
function Mat(o){o=Object.assign({},o||{});const ev=o.emissive||0;o.emissive={v:ev,setHex(h){this.v=h}};const cv=o.color==null?0x888888:o.color;o.color={v:cv,setHex(h){this.v=h},set(h){this.v=h}};return Object.assign({color:0x888888,emissive:0,emissiveIntensity:1,metalness:0,roughness:0.5,opacity:1,transparent:false},o||{})}
function Any(){const f=function(){};const p=new Proxy(f,{get:(t,k)=>k==='then'?undefined:(k===Symbol.toPrimitive?()=>0:p),apply:()=>p,construct:()=>p,set:()=>true});return p}
const THREE=new Proxy({},{get(t,k){
 if(k in t)return t[k];
 if(typeof k!=='string')return undefined;
 if(/Geometry$/.test(k))return function(...a){return new Geo(k,a)};
 if(/Material$/.test(k))return function(o){return Mat(o)};
 return Obj.__proto__===Function.prototype?Obj:Obj;
}});
THREE.Group=Obj;THREE.Scene=class extends Obj{constructor(){super();global.__scene=this;this.background=null;this.fog=null}};THREE.Object3D=Obj;THREE.Mesh=Mesh;THREE.Vector3=V3;THREE.PerspectiveCamera=class extends Obj{constructor(){super()}};
THREE.CanvasTexture=function(){return Any()};THREE.Color=function(c){return {r:0,g:0,b:0,setHex(){}}};
THREE.SpotLight=class extends Obj{constructor(){super();this.target=new Obj()}};THREE.PointLight=class extends Obj{};THREE.Light=Obj;
THREE.RepeatWrapping=1000;THREE.DoubleSide=2;THREE.Shape=Shape;THREE.Path=Shape;THREE.Vector2=function(x,y){return {x:x||0,y:y||0}};
global.THREE=THREE;global.window=global;
const ctx=new Proxy({},{get:(t,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{},set:()=>true});
global.document={createElement:()=>({getContext:()=>ctx,width:0,height:0,style:{}}),getElementById:()=>null,body:{}};
global.devicePixelRatio=1;
// ---- triangulation
function tris(g){
 const T=[];const P=g.p;
 if(g.t==='BoxGeometry'){const [w,h,d]=[P[0],P[1],P[2]].map(x=>x/2);
  const v=[];for(const sx of[-1,1])for(const sy of[-1,1])for(const sz of[-1,1])v.push([sx*w,sy*h,sz*d]);
  const idx=(x,y,z)=>((x>0)*4+(y>0)*2+(z>0));
  const quad=(a,b,c,dd)=>{T.push([v[a],v[b],v[c]],[v[a],v[c],v[dd]])};
  quad(idx(1,-1,-1),idx(1,1,-1),idx(1,1,1),idx(1,-1,1));
  quad(idx(-1,-1,1),idx(-1,1,1),idx(-1,1,-1),idx(-1,-1,-1));
  quad(idx(-1,1,-1),idx(-1,1,1),idx(1,1,1),idx(1,1,-1));
  quad(idx(-1,-1,1),idx(-1,-1,-1),idx(1,-1,-1),idx(1,-1,1));
  quad(idx(-1,-1,1),idx(1,-1,1),idx(1,1,1),idx(-1,1,1));
  quad(idx(1,-1,-1),idx(-1,-1,-1),idx(-1,1,-1),idx(1,1,-1));
 } else if(g.t==='CylinderGeometry'){const rt=P[0],rb=P[1],h=P[2]/2,n=Math.max(6,P[3]||8);
  for(let i=0;i<n;i++){const a0=i/n*2*Math.PI,a1=(i+1)/n*2*Math.PI;const c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1);
   const t0=[rt*c0,h,rt*s0],t1=[rt*c1,h,rt*s1],b0=[rb*c0,-h,rb*s0],b1=[rb*c1,-h,rb*s1];
   T.push([t0,b0,b1],[t0,b1,t1],[[0,h,0],t1,t0],[[0,-h,0],b0,b1]);}
 } else if(g.t==='TorusGeometry'){const R=P[0],r=P[1],rs=Math.min(8,P[2]||6),ts=Math.min(16,P[3]||12),arc=P[4]||2*Math.PI;
  const pt=(i,j)=>{const u=i/rs*2*Math.PI,v=j/ts*arc;return [(R+r*Math.cos(u))*Math.cos(v),(R+r*Math.cos(u))*Math.sin(v),r*Math.sin(u)]};
  for(let i=0;i<rs;i++)for(let j=0;j<ts;j++){const a=pt(i,j),b=pt(i+1,j),c=pt(i+1,j+1),d=pt(i,j+1);T.push([a,b,c],[a,c,d])}
 } else if(g.t==='SphereGeometry'){const r=P[0],ws=P[1]||12,hs=P[2]||8;
  const pt=(i,j)=>{const u=i/ws*2*Math.PI,v=j/hs*Math.PI;return [r*Math.cos(u)*Math.sin(v),r*Math.cos(v),r*Math.sin(u)*Math.sin(v)]};
  for(let i=0;i<ws;i++)for(let j=0;j<hs;j++){const a=pt(i,j),b=pt(i+1,j),c=pt(i+1,j+1),d=pt(i,j+1);T.push([a,b,c],[a,c,d])}
 } else if(g.t==='ExtrudeGeometry'){const sh=P[0],o=P[1]||{},dep=o.depth||0,bev=o.bevelEnabled?(o.bevelSize||0):0,bt=o.bevelEnabled?(o.bevelThickness||0):0;
  const pts=sh.pts;let cx=0,cy=0;pts.forEach(p=>{cx+=p[0];cy+=p[1]});cx/=pts.length;cy/=pts.length;
  const out=pts.map(p=>{const dx=p[0]-cx,dy=p[1]-cy,l=Math.hypot(dx,dy)||1;return [p[0]+dx/l*bev,p[1]+dy/l*bev]});
  const z0=-bt,z1=dep+bt;
  for(let i=0;i<out.length;i++){const a=out[i],b=out[(i+1)%out.length];T.push([[a[0],a[1],z0],[b[0],b[1],z0],[b[0],b[1],z1]],[[a[0],a[1],z0],[b[0],b[1],z1],[a[0],a[1],z1]]);
   T.push([[cx,cy,z0],a.concat([z0]),b.concat([z0])],[[cx,cy,z1],a.concat([z1]),b.concat([z1])])}
 } else if(g.t==='LatheGeometry'){const pts=P[0],n=Math.min(24,P[1]||12);
  for(let i=0;i<n;i++){const a0=i/n*2*Math.PI,a1=(i+1)/n*2*Math.PI;for(let j=0;j<pts.length-1;j++){const p=pts[j],q=pts[j+1];
   const A=[p.x*Math.sin(a0),p.y,p.x*Math.cos(a0)],B=[p.x*Math.sin(a1),p.y,p.x*Math.cos(a1)],C=[q.x*Math.sin(a1),q.y,q.x*Math.cos(a1)],D=[q.x*Math.sin(a0),q.y,q.x*Math.cos(a0)];T.push([A,B,C],[A,C,D])}}
 } else if(g.t==='CapsuleGeometry'||g.t==='ConeGeometry'){ }
 if(g.ops&&g.ops.length){for(const t of T)for(let k=0;k<3;k++){let [x,y,z]=t[k];for(const op of g.ops){
   if(op[0]==='t'){x+=op[1];y+=op[2];z+=op[3]}else if(op[0]==='s'){x*=op[1];y*=op[2];z*=op[3]}
   else{const c=Math.cos(op[1]),sn=Math.sin(op[1]);if(op[0]==='x'){[y,z]=[y*c-z*sn,y*sn+z*c]}else if(op[0]==='y'){[x,z]=[x*c+z*sn,-x*sn+z*c]}else{[x,y]=[x*c-y*sn,x*sn+y*c]}}}
   t[k]=[x,y,z]}}
 return T;}
function walk(o,M,out){
 if(o.visible===false)return;
 const W=mul(M,o.local());
 if(o instanceof Mesh&&o.geometry&&o.geometry.t){
  const m=o.material||{};
  for(const t of tris(o.geometry)){
   out.push({v:t.map(p=>[W[0]*p[0]+W[1]*p[1]+W[2]*p[2]+W[3],W[4]*p[0]+W[5]*p[1]+W[6]*p[2]+W[7],W[8]*p[0]+W[9]*p[1]+W[10]*p[2]+W[11]]),
    c:(m.color&&m.color.v!=null?m.color.v:m.color)||0x888888,e:(m.emissive&&m.emissive.v!=null?m.emissive.v:m.emissive)||0,ei:m.emissiveIntensity||1,mt:m.metalness||0,rg:m.roughness==null?0.5:m.roughness,op:m.opacity==null?1:m.opacity});
  }
 }
 for(const c of o.children)walk(c,W,out);
}
module.exports={THREE,Obj,V3,dump(root,file){const out=[];walk(root,mat4(),out);fs.writeFileSync(file,JSON.stringify(out));return out.length}, walk, mat4};
