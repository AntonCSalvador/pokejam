import {DT,A,PLAYERS,defaultSelection,validateSelection,TUNING as T,neutral,hoop} from './data.js';
const ms=DT*1000, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function random(m){m.seed=(Math.imul(m.seed,1664525)+1013904223)>>>0;return m.seed/4294967296;}
function emit(m,kind,player=null,extra={}){
 m.events.push({id:++m.eventId,tick:m.tick,kind,player,...extra});if(m.events.length>48)m.events.shift();
 const reward=(id,value)=>{if(id!==null&&id!==undefined)m.players[id].meter=clamp(m.players[id].meter+value,0,100);};
 if(kind==='score'){reward(player,25);reward(extra.assist,10);}
 if(kind==='steal'||kind==='block')reward(player,15);
 if(kind==='rebound'&&extra.defensive)reward(player,10);
}
function pose(p,action,duration){p.action=action;p.actionMs=duration;p.actionStart=p.ageMs;}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y;const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
export function createMatch({seed=7,selection=defaultSelection()}={}){
 if(!validateSelection(selection))throw new RangeError('Invalid team or player selection');
 return {tick:0,seed,teamKeys:[...selection.teamKeys],phase:'countdown',phaseMs:T.countdownMs,overtime:false,remainingMs:T.matchMs,shotClockMs:T.shotClockMs,
  possessionTeam:null,score:[0,0],eventId:0,flightId:0,events:[],lastPass:null,
  players:selection.playerKeys.map((key,id)=>({...structuredClone(PLAYERS[key]),id,team:Math.floor(id/2),x:id<2?25+id*7:75-(id-2)*7,y:id%2?38:18,vx:0,vy:0,z:0,facing:id<2?1:-1,
   turbo:100,meter:0,chargeMs:0,cooldownMs:0,jumpMs:0,stunMs:0,action:'idle',actionMs:0,actionStart:0,ageMs:0,power:null,bot:{}})),
  ball:{mode:'loose',x:50,y:28,z:12,vx:0,vy:0,vz:0,lastTeam:null},restartTeam:0};
}
export function movePlayer(p,input,dt,players=[]){
 const length=Math.hypot(input.x,input.y),scale=Math.max(1,length);
 const turboHeld=!!(input.held&A.TURBO),turbo=turboHeld&&p.turbo>0&&length>0;
 p.turbo=clamp(p.turbo+(turboHeld?-T.turboDrain:T.turboFill)*dt,0,100);
 let speed=p.speed*(turbo?1.65:1);
 let dx=input.x/scale,dy=input.y/scale;
 if(p.power?.kind==='dash'){dx=p.power.dx;dy=p.power.dy;speed=p.speed*2;}
 if(p.stunMs>0||p.power?.kind==='windup'){dx=dy=0;}
 const nx=clamp(p.x+dx*speed*dt,2,98),ny=clamp(p.y+dy*speed*dt,2,54);
 const blocked=players.some(other=>other.id!==p.id&&segmentDistance(other,p,{x:nx,y:ny})<T.radius*2&&dist(other,{x:nx,y:ny})<dist(other,p));
 p.vx=blocked?0:(nx-p.x)/dt;p.vy=blocked?0:(ny-p.y)/dt;
 if(!blocked){p.x=nx;p.y=ny;}
 if(Math.abs(dx)>.1)p.facing=dx>0?1:-1;
}
function toss(m){m.phase='live';m.possessionTeam=null;m.shotClockMs=T.shotClockMs;m.ball={mode:'loose',x:50,y:28,z:12,vx:(random(m)-.5)*2,vy:0,vz:0,lastTeam:null};}
function finishRegulation(m){
 if(m.score[0]===m.score[1]){m.overtime=true;m.phase='countdown';m.phaseMs=1500;m.players.forEach((p,i)=>{p.x=i<2?42:58;p.y=i%2?36:20;});emit(m,'overtime');}
 else {m.phase='finished';emit(m,'finish');}
}
function stopFor(m,team,kind){m.phase='deadball';m.phaseMs=T.deadballMs;m.restartTeam=team;m.lastPass=null;emit(m,kind);}
function possess(m,p){
 const b=m.ball,previous=m.possessionTeam;
 if(previous!==p.team||b.rebound)m.shotClockMs=T.shotClockMs;
 if(previous!==p.team)m.lastPass=null;
 m.possessionTeam=p.team;
 m.ball={mode:'held',holder:p.id,x:p.x,y:p.y,z:2,lastTeam:p.team};
 if(b.kind==='pass'&&b.team===p.team&&b.from!==p.id)m.lastPass={from:b.from,to:p.id,tick:m.tick};
 if(b.rebound)emit(m,'rebound',p.id,{defensive:b.lastTeam!==p.team});
}
function pass(m,p,tier='normal'){
 const target=m.players[p.id^1];
 if(tier==='turbo'){if(p.turbo>=T.turboPassCost)p.turbo-=T.turboPassCost;else tier='normal';}
 const speed=T.passSpeed*(tier==='signature'?T.bulletMultiplier:tier==='turbo'?T.turboPassMultiplier:1);
 const lead=dist(p,target)/speed*.3,end={x:clamp(target.x+target.vx*lead,2,98),y:clamp(target.y+target.vy*lead,2,54)};
 m.ball={mode:'flight',id:++m.flightId,kind:'pass',from:p.id,target:target.id,tier,speed,heading:Math.atan2(end.y-p.y,end.x-p.x),team:p.team,lastTeam:p.team,x:p.x,y:p.y,z:2,start:{x:p.x,y:p.y},end,elapsed:0,duration:T.passLifetimeMs};
 p.chargeMs=0;p.power=null;pose(p,'pass',350);emit(m,'pass',p.id,{tier,target:target.id});
}
// Earliest intersection with a catch circle, so a fast pass cannot tunnel or
// choose a later defender merely because their slot comes first.
function contactTime(p,a,b,radius){
 const dx=b.x-a.x,dy=b.y-a.y,px=a.x-p.x,py=a.y-p.y,c=px*px+py*py-radius*radius;
 if(c<=0)return 0;const aa=dx*dx+dy*dy,bb=2*(px*dx+py*dy),disc=bb*bb-4*aa*c;
 if(!aa||disc<0)return Infinity;const t=(-bb-Math.sqrt(disc))/(2*aa);return t>=0&&t<=1?t:Infinity;
}
function updatePass(m,b){
 const old={x:b.x,y:b.y},target=m.players[b.target];
 const desired=Math.atan2(target.y-b.y,target.x-b.x),delta=Math.atan2(Math.sin(desired-b.heading),Math.cos(desired-b.heading));
 b.heading+=clamp(delta,-T.passTurnRate*DT,T.passTurnRate*DT);
 b.x+=Math.cos(b.heading)*b.speed*DT;b.y+=Math.sin(b.heading)*b.speed*DT;b.elapsed+=ms;
 b.z=2+Math.sin(Math.min(1,b.elapsed/b.duration)*Math.PI)*2;
 const catches=m.players.filter(p=>p.id!==b.from&&p.stunMs<=0&&p.z<3).map(p=>({p,t:contactTime(p,old,b,T.passCatchRadius),distance:segmentDistance(p,old,b)})).filter(c=>Number.isFinite(c.t)).sort((a,c)=>a.t-c.t||a.distance-c.distance||a.p.id-c.p.id);
 if(catches.length){possess(m,catches[0].p);return;}
 if(b.x<0||b.x>T.width||b.y<0||b.y>T.height){stopFor(m,1-b.team,'out');return;}
 if(b.elapsed>=b.duration)m.ball={mode:'loose',x:b.x,y:b.y,z:b.z,vx:0,vy:0,vz:0,lastTeam:b.team};
}
function releaseShot(m,p,forcedMiss=false){
 const basket=hoop(p.team),range=dist(p,basket);
 const dunk=range<=p.dunk*(p.power?.kind==='sky'?1.6:1)&&p.turbo>=T.dunkCost&&!forcedMiss;
 const contest=m.players.some(q=>q.team!==p.team&&dist(p,q)<9);
 const window=p.window*(range>32?.75:1)*(contest?.55:1)*(p.power?.kind==='heat'?1.5:1);
 const accurate=!forcedMiss&&(dunk||Math.abs(p.chargeMs-T.shotSweetMs)<=window);
 const points=dunk?2:range>T.threeRange?3:2;
 m.ball={mode:'flight',id:++m.flightId,kind:dunk?'dunk':'shot',from:p.id,team:p.team,lastTeam:p.team,x:p.x,y:p.y,z:2,
  start:{x:p.x,y:p.y},end:basket,elapsed:0,duration:dunk?800:T.shotFlightMs,accurate,points,release:{x:p.x,y:p.y}};
 if(dunk){p.turbo-=T.dunkCost;p.jumpMs=800;}
 p.chargeMs=0;p.power=null;pose(p,dunk?'dunk':'shoot',dunk?800:500);emit(m,dunk?'dunk':'shot',p.id);
}
function signature(m,p,input){
 if(p.meter<100){emit(m,'feedback',p.id,{text:'Meter not full'});return;}
 const owns=m.ball.mode==='held'&&m.ball.holder===p.id;
 if(p.ability!=='dash'&&!owns){emit(m,'feedback',p.id,{text:'Need ball'});return;}
 if(p.power)return;
 p.meter=0;pose(p,'signature',600);emit(m,'signature',p.id,{text:p.move});
 if(p.ability==='dash'){const n=Math.hypot(input.x,input.y);p.power={kind:'windup',ms:T.dashWindupMs,dx:n?input.x/n:p.facing,dy:n?input.y/n:0};}
 else if(p.ability==='pass')pass(m,p,'signature');
 else p.power={kind:p.ability,ms:T.powerMs};
}
function updateBall(m){
 const b=m.ball;
 if(b.mode==='held'){const p=m.players[b.holder];b.x=p.x;b.y=p.y;b.z=2;return;}
 if(b.mode==='flight'){
  if(b.kind==='pass'){updatePass(m,b);return;}
  const old={x:b.x,y:b.y};b.elapsed+=ms;const t=clamp(b.elapsed/b.duration,0,1);
  b.x=b.start.x+(b.end.x-b.start.x)*t;b.y=b.start.y+(b.end.y-b.start.y)*t;
  b.z=b.kind==='pass'?2+Math.sin(t*Math.PI)*2:2+8*t+Math.sin(t*Math.PI)*(b.kind==='dunk'?8:17);
  if(b.kind==='pass'){
   const catcher=m.players.find(p=>p.id!==b.from&&segmentDistance(p,old,b)<3&&p.z<3);
   if(catcher){possess(m,catcher);return;}
  }else{
   const blocker=m.players.find(p=>p.team!==b.team&&p.action==='block'&&p.jumpMs>0&&segmentDistance(p,old,b)<4&&Math.abs(b.z-p.z)<8);
   if(blocker){m.ball={mode:'loose',x:b.x,y:b.y,z:b.z,vx:blocker.facing*7,vy:4,vz:2,lastTeam:blocker.team,rebound:true};m.lastPass=null;emit(m,'block',blocker.id);return;}
  }
  if(t>=1){
   if(b.kind!=='pass'&&b.accurate){m.score[b.team]+=b.points;emit(m,'score',b.from,{points:b.points,assist:m.lastPass&&m.lastPass.to===b.from&&m.tick-m.lastPass.tick<=360?m.lastPass.from:null});
    m.ball={mode:'loose',x:b.x,y:b.y,z:0,vx:0,vy:0,vz:0,lastTeam:b.team};
    if(m.overtime){m.phase='finished';emit(m,'finish');}else if(m.phase==='buzzer')finishRegulation(m);else stopFor(m,1-b.team,'basket');
   }else m.ball={mode:'loose',x:b.x,y:b.y,z:b.z,vx:b.kind==='pass'?0:(b.team===0?-10:10),vy:(random(m)-.5)*14,vz:0,lastTeam:b.team,rebound:b.kind!=='pass'};
  }
  return;
 }
 b.vz=(b.vz||0)-35*DT;b.x+=(b.vx||0)*DT;b.y+=(b.vy||0)*DT;b.z=Math.max(0,b.z+b.vz*DT);
 if(b.z===0){b.vx*=.97;b.vy*=.97;b.vz=0;}
 if(m.phase==='buzzer'&&b.z===0){finishRegulation(m);return;}
 if(b.x<0||b.x>100||b.y<0||b.y>56){if(m.phase==='buzzer')finishRegulation(m);else stopFor(m,b.lastTeam===null?0:1-b.lastTeam,'out');return;}
 if(b.z<4){const candidates=m.players.filter(p=>p.stunMs<=0&&dist(p,b)<3.5).sort((a,c)=>dist(a,b)-dist(c,b)||a.id-c.id);
  if(candidates.length){if(m.phase==='buzzer'){finishRegulation(m);return;}possess(m,candidates[0]);}}
}
export function stepMatch(m,inputs=new Map()){
 if(m.phase==='finished')return;
 m.tick++;
 if(m.phase==='countdown'||m.phase==='deadball'){
  m.phaseMs-=ms;
  if(m.phaseMs<.01){if(m.phase==='countdown')toss(m);else{
   const team=m.restartTeam;m.players.forEach(p=>{p.x=p.team===team?(team===0?12:88):(team===0?63:37);p.y=p.id%2?38:18;p.chargeMs=0;p.power=null;});
   const p=m.players.find(p=>p.team===team);p.y=28;m.phase='live';m.possessionTeam=null;possess(m,p);
  }}return;
 }
 for(const p of m.players){
  p.ageMs+=ms;p.cooldownMs=Math.max(0,p.cooldownMs-ms);p.stunMs=Math.max(0,p.stunMs-ms);p.actionMs=Math.max(0,p.actionMs-ms);
  p.jumpMs=Math.max(0,p.jumpMs-ms);p.z=p.jumpMs>0?Math.sin(Math.PI*(1-p.jumpMs/(p.action==='dunk'?800:700)))*12:0;
  const input=inputs.get(p.id)||neutral();
  if(p.power){p.power.ms-=ms;if(p.power.ms<=0){if(p.power.kind==='windup')p.power={...p.power,kind:'dash',ms:T.dashMs};else p.power=null;}}
  if(m.phase==='live'&&!p.stunMs&&(input.pressed&A.SPECIAL))signature(m,p,input);
  movePlayer(p,input,DT,m.players);
  if(!p.actionMs) p.action=Math.hypot(p.vx,p.vy)>1?(m.ball.holder===p.id?'dribble':'run'):'idle';
  const owns=m.ball.mode==='held'&&m.ball.holder===p.id;
  if(m.phase==='live'&&p.stunMs===0){
   if(owns){
    if(input.pressed&A.PASS){pass(m,p,input.turboActions&A.PASS?'turbo':'normal');continue;}
    if(input.held&A.SHOOT)p.chargeMs+=ms;
    if(input.released&A.SHOOT)releaseShot(m,p);
    else if(p.chargeMs>=T.maxChargeMs)releaseShot(m,p,true);
    else if(!(input.held&A.SHOOT))p.chargeMs=0;
   }else if((input.pressed&A.PASS)&&!p.cooldownMs){
    p.cooldownMs=p.stealRecoveryMs;pose(p,'stagger',220);
    if(m.ball.mode==='held'){const q=m.players[m.ball.holder];if(q.team!==p.team&&dist(p,q)<T.stealRange&&(q.x-p.x)*p.facing>=0){q.stunMs=350;q.chargeMs=0;q.power=null;pose(q,'stagger',350);possess(m,p);emit(m,'steal',p.id);}}
   }
  }
  if(!owns&&(input.pressed&A.SHOOT)&&!p.cooldownMs){p.cooldownMs=T.blockRecoveryMs;p.jumpMs=700;pose(p,'block',700);}
 }
 updateBall(m);
 if(m.phase!=='live'&&m.phase!=='buzzer')return;
 if(m.phase==='live'){
  if(!m.overtime)m.remainingMs=Math.max(0,m.remainingMs-ms);
  if(m.possessionTeam!==null)m.shotClockMs=Math.max(0,m.shotClockMs-ms);
  if(!m.overtime&&m.remainingMs<.01){if(m.ball.mode==='flight'&&m.ball.kind!=='pass')m.phase='buzzer';else finishRegulation(m);}
  else if(m.shotClockMs<.01&&m.possessionTeam!==null&&!(m.ball.mode==='flight'&&m.ball.kind!=='pass')&&!m.ball.rebound)stopFor(m,1-m.possessionTeam,'shotclock');
 }
}
