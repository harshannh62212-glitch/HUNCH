// Seeded RNG so every run is reproducible: SEED=7 node tools/dock_controller_test.js
let _seed=(+process.env.SEED||1)>>>0; Math.random=function(){_seed=(_seed+0x6D2B79F5)>>>0; let t=_seed; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296;};
// Wide starts (3-12 m out, +-2.8 m lateral) are the default; EASY=1 gives the old narrow starts.
// BLACKOUT=from,duration injects a sensor dropout burst (seconds of approach time).
const ADV=!process.env.EASY;
const D=require('../js/dock_station.js'); const C=D.C;
const Y=-Math.PI/4, a={x:Math.cos(Y),z:-Math.sin(Y)}, u={x:a.z,z:-a.x};
const wrap=D._wrapPi;
function frame(p){return {along:p.x*a.x+p.z*a.z, lat:p.x*u.x+p.z*u.z};}
function run(seed, verbose){
  D.reset(); D.beginApproach(); if(process.env.BLACKOUT){const b=process.env.BLACKOUT.split(',').map(Number); D.state().inject={from:b[0],to:b[0]+b[1]};}
  const along0=ADV?3.2+Math.random()*8.8:6+Math.random()*6, lat0=(Math.random()*2-1)*(ADV?2.8:1.5), yaw0=(Math.random()*2-1)*Math.PI;
  let p={x:a.x*along0+u.x*lat0, z:a.z*along0+u.z*lat0}; let yaw=Y+Math.PI-yaw0; // psi=yaw0
  let vel=0,turn=0,state='ALIGN',t=0,dt=1/60,maxLat=0,ev=[];
  D.setLogger(m=>ev.push(t.toFixed(1)+' '+m));
  const dt0=dt;
  while(t<240){
    const f=frame(p), psi=wrap(Y+Math.PI-yaw);
    const S=D.state();
    let cmd;
    if(state==='DOCKED'){break;}
    cmd=D.step({state,along:f.along,lat:f.lat,psi,vel,dt,doorOpen:1});
    if(cmd.next) state=cmd.next;
    // viewer.update arms/coupler targets
    D.update&&0;
    // emulate viewer's targets
    const s=D.state();
    // arm/coupler animation (same as update())
    const closed=(state==='CAPTURE'||state==='LATCH'||state==='DOCKED');
    if(state==='ENTER'||state==='ALIGN'||state==='RETRY'){s.armTarget=1;s.couplerTarget=0;} else if(closed){s.armTarget=0;}
    s.arm+=Math.max(-dt/1.6,Math.min(dt/1.6,s.armTarget-s.arm));
    s.coupler+=Math.max(-dt/1.6,Math.min(dt/1.6,s.couplerTarget-s.coupler));
    // plant (viewer physics)
    const maxTurn=1.7, tgt=Math.max(-maxTurn,Math.min(maxTurn,cmd.steer));
    turn+=(tgt-turn)*Math.min(1,7.5*dt); if(Math.abs(turn)<0.018)turn=0; yaw+=turn*dt;
    const ms=0.94, af=1.0; let ta=0;
    if(cmd.forward){const tg=ms*cmd.throttle; ta=Math.max(-af,Math.min(af,(tg-vel)*2.2));}
    else if(cmd.reverse){const tg=-ms*0.4*cmd.throttle; ta=Math.max(-af,Math.min(af,(tg-vel)*1.5));}
    else { if(vel>0.01)ta=-0.6; else if(vel<-0.01)ta=0.6; else vel=0;}
    if(Math.abs(vel)>0.02) ta-=Math.sign(vel)*0.05*1.622;
    vel+=ta*dt;
    p.x+=Math.cos(yaw)*vel*dt; p.z+=-Math.sin(yaw)*vel*dt;
    // bumper hard stop
    let f2=frame(p);
    if(state==='CAPTURE'||state==='LATCH'){
      const as=D.assist(); let lat=Math.max(-as.latMax,Math.min(as.latMax,f2.lat));
      let ps=wrap(Y+Math.PI-yaw); ps=Math.max(-as.psiMax,Math.min(as.psiMax,ps)); yaw=Y+Math.PI-ps;
      let al=Math.max(f2.along,C.PARK_ALONG); if(al===C.PARK_ALONG) vel=Math.max(0,Math.min(vel,0)) ;
      p={x:a.x*al+u.x*lat, z:a.z*al+u.z*lat};
    }
    maxLat=Math.max(maxLat,Math.abs(f2.lat)*(f2.along<2.5?1:0));
    if(process.env.TRACE&&t>230&&Math.round(t*60)%30==0) console.log(t.toFixed(1),state,'psi',psi.toFixed(4),'est',D.state().est.psi.toFixed(4),'turn',turn.toFixed(4),'vel',vel.toFixed(3),'steer',cmd.steer.toFixed(3),'settle',D.state().settle.toFixed(2));
    t+=dt;
  }
  const fr=frame(p); const res=D.state().result;
  return {ok:state==='DOCKED', t, retries:D.state().retries, lat:fr.lat, along:fr.along, maxLatInBay:maxLat, res, ev, state, fault:D.state().fault};
}
const N=+process.argv[2]||100; let ok=0,rt=0,times=[],bad=[];
for(let i=0;i<N;i++){const r=run(i); if(r.ok){ok++; times.push(r.t);} else bad.push(r); rt+=r.retries;}
times.sort((x,y)=>x-y);
console.log(`success ${ok}/${N}  retries total ${rt}  t median ${times[times.length>>1]?.toFixed(1)}  p95 ${times[Math.floor(times.length*0.95)]?.toFixed(1)}`);
if(bad.length){const b=bad[0];console.log('first failure:',b.state,b.fault,'t',b.t.toFixed(0),'along',b.along.toFixed(2),'lat',b.lat.toFixed(3));console.log(b.ev.slice(-12).join('\n'));}
