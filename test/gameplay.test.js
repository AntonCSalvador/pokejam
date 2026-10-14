import test from 'node:test';
import assert from 'node:assert/strict';
import {A,neutral} from '../public/game/data.js';
import {stepMatch,movePlayer} from '../public/game/simulation.js';
import * as simulation from '../public/game/simulation.js';
import {live,giveBall,act,advance} from './gameplay-fixtures.js';
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<.0001,`${actual} != ${expected}`);

test('pass catches moving teammate and preserves clock without meter reward',()=>{
 const m=live();Object.assign(m.players[0],{x:20,y:20});Object.assign(m.players[1],{x:48,y:20,vx:19,vy:0});giveBall(m,0);m.shotClockMs=12000;
 stepMatch(m,act(0,{pressed:A.PASS}));
 for(let i=0;i<100&&m.ball.mode==='flight';i++)stepMatch(m,act(1,{x:1}));
 assert.equal(m.ball.holder,1);assert.ok(m.shotClockMs<12000);assert.deepEqual(m.players.map(p=>p.meter),[0,0,0,0]);assert.equal(m.lastPass.from,0);
});
test('pass uses first segment contact, ignoring stunned and high players',()=>{
 for(const skip of [false,true]){
  const m=live();Object.assign(m.players[0],{x:20,y:28});Object.assign(m.players[1],{x:80,y:28});giveBall(m,0);stepMatch(m,act(0,{pressed:A.PASS}));
  Object.assign(m.ball,{x:40,y:28,heading:0,speed:600});Object.assign(m.players[2],{x:49,y:28});Object.assign(m.players[3],{x:45,y:28,stunMs:skip?500:0});
  stepMatch(m);assert.equal(m.ball.holder,skip?2:3);
 }
 const m=live();Object.assign(m.players[0],{x:20,y:28});Object.assign(m.players[1],{x:80,y:28});giveBall(m,0);stepMatch(m,act(0,{pressed:A.PASS}));
 Object.assign(m.ball,{x:40,y:28,heading:0,speed:600});Object.assign(m.players[2],{x:49,y:28});Object.assign(m.players[3],{x:45,y:28,jumpMs:350,action:'block'});stepMatch(m);assert.equal(m.ball.holder,2);
});
test('pass tiers spend resource once and expired passes become loose',()=>{
 for(const [tier,id,energy,wantSpeed,wantEnergy] of [['normal',0,100,65,100],['turbo',0,10,87.75,1/3],['normal',0,9,65,9+1/3],['signature',1,100,117,100]]){
  const m=live(),p=m.players[id];p.turbo=energy;p.meter=100;giveBall(m,id);
  stepMatch(m,act(id,tier==='signature'?{pressed:A.SPECIAL}:{pressed:A.PASS,turboActions:energy===100?0:A.PASS}));
  assert.equal(m.ball.tier,tier);near(m.ball.speed,wantSpeed);near(p.turbo,wantEnergy);assert.equal(p.meter,tier==='signature'?0:100);
  m.ball.elapsed=2195;stepMatch(m);assert.equal(m.ball.mode,'loose');
 }
});

const shove=()=>({pressed:A.PASS,turboActions:A.PASS});
function contact(){const m=live();Object.assign(m.players[0],{x:50,y:28});Object.assign(m.players[2],{x:54,y:28});giveBall(m,2);return m;}
test('shove miss spends resource and recovery, insufficient turbo never steals',()=>{
 for(const energy of [24,25,100]){
  const m=contact(),p=m.players[0];p.turbo=energy;m.players[2].x=60;
  stepMatch(m,act(0,{...shove(),held:A.TURBO}));
  if(energy<25){assert.equal(p.cooldownMs,0);assert.equal(m.events.at(-1).text,'Need 25 turbo to shove');}
  else {assert.equal(p.cooldownMs,900);assert.equal(p.recoveryMs,300);near(p.turbo,Math.max(0,energy-25-32/60));assert.equal(p.action,'shove');}
 }
});
test('shove hit spills loose ball and cancels charge without meter reward',()=>{
 const m=contact(),p=m.players[0],q=m.players[2];q.chargeMs=300;q.power={kind:'heat',ms:2000};m.lastPass={from:3,to:2,tick:0};
 stepMatch(m,act(0,shove()));assert.equal(q.stunMs,400);assert.equal(m.ball.mode,'loose');assert.equal(m.ball.lastTeam,0);assert.equal(m.lastPass,null);assert.equal(q.chargeMs,0);assert.equal(q.power,null);assert.equal(p.meter,0);
 const start=q.x;advance(m,9);near(q.x-start,5);assert.ok(q.stunMs>0);assert.equal(m.score[0],0);
});
test('shove reach, movement cone, facing, teammates and airborne immunity',()=>{
 for(const [dx,dy,input,hit] of [[4.5,0,{},true],[4.51,0,{},false],[-4,0,{},false],[0,4,{y:1},true],[2,3.4,{},true],[1,4,{},false]]){
  const m=contact();Object.assign(m.players[2],{x:50+dx,y:28+dy});stepMatch(m,act(0,{...shove(),...input}));assert.equal(m.players[2].stunMs>0,hit,`${dx},${dy}`);
 }
 const m=contact();Object.assign(m.players[1],{x:54,y:28});Object.assign(m.players[2],{x:70,jumpMs:350,action:'block'});stepMatch(m,act(0,shove()));assert.equal(m.players[1].stunMs,0);
 const high=contact();Object.assign(high.players[2],{jumpMs:350,action:'block'});stepMatch(high,act(0,shove()));assert.equal(high.players[2].stunMs,0);
});
test('simultaneous shoves trade, held inputs do not repeat, protection cannot extend stun',()=>{
 const m=contact();giveBall(m,1);stepMatch(m,new Map([[0,{...neutral(),...shove()}],[2,{...neutral(),...shove()}]]));assert.equal(m.players[0].stunMs,400);assert.equal(m.players[2].stunMs,400);
 const n=contact();stepMatch(n,act(0,shove()));advance(n,24);assert.equal(n.players[2].stunMs,0);assert.ok(n.players[2].shoveProtectionMs>0);
 Object.assign(n.players[0],{x:n.players[2].x-4,cooldownMs:0,recoveryMs:0});stepMatch(n,act(0,shove()));assert.equal(n.players[2].stunMs,0);
 const count=n.events.filter(e=>e.kind==='shove').length;advance(n,70,act(0,{held:A.PASS|A.TURBO}));assert.equal(n.events.filter(e=>e.kind==='shove').length,count);
});
test('knockback stops at bounds or a ground body and recovery moves at forty percent',()=>{
 for(const body of [false,true]){
  const m=contact();Object.assign(m.players[0],{x:body?50:92});Object.assign(m.players[2],{x:body?54:96});if(body)Object.assign(m.players[3],{x:60,y:28});
  stepMatch(m,act(0,shove()));advance(m,10);assert.ok(m.players[2].x<=(body?56.7:98)+.001);
 }
 const m=live(),p=m.players[0];p.recoveryMs=300;const x=p.x;movePlayer(p,{...neutral(),x:1,held:A.TURBO},1/60,m.players);near(p.x-x,p.speed*.4/60);
 const n=contact();n.players[2].x=53.4;n.players[2].z=12;movePlayer(n.players[0],{...neutral(),x:1},1/60,n.players);assert.ok(n.players[0].x>50);
});

function dunkCourt(x=90){const m=live();Object.assign(m.players[0],{x,y:28,turbo:0});giveBall(m,0);return m;}
test('standing dunk needs no turbo and committed player carries ball to rim once',()=>{
 const m=dunkCourt(),p=m.players[0];assert.equal(typeof simulation.dunkOption,'function');
 const option=simulation.dunkOption(p,neutral());assert.equal(option.cost,0);near(option.reach,4.95);assert.equal(option.duration,500);assert.equal(option.peakHeight,11);
 stepMatch(m,act(0,{pressed:A.SHOOT}));assert.equal(m.ball.kind,'dunk');assert.equal(p.flight.id,m.ball.id);
 advance(m,15,act(0,{x:-1,pressed:A.PASS|A.SPECIAL|A.SHOOT,released:A.SHOOT}));assert.ok(p.x>90);assert.ok(p.z>8);near(m.ball.x,p.x);near(m.ball.z,p.z+2);
 advance(m,16);assert.deepEqual(m.score,[2,0]);assert.equal(p.flight.kind,'landing');advance(m,13);assert.equal(p.z,0);assert.equal(p.flight,null);
 advance(m,80);assert.equal(m.events.filter(e=>e.kind==='score').length,1);assert.equal(p.runUpMs,0);assert.equal(p.shotArmed,false);
});
test('running and turbo dunk tiers require actual forward run-up and resource',()=>{
 for(const turbo of [false,true]){
  const m=dunkCourt(82),p=m.players[0];p.turbo=turbo?100:0;advance(m,10,act(0,{x:1}));assert.ok(p.runUpMs>=150);
  const input={...neutral(),x:1,pressed:A.SHOOT,turboActions:turbo?A.SHOOT:0};const o=simulation.dunkOption(p,input);
  assert.equal(o.tier,turbo?'turbo':'running');near(o.reach,turbo?11.25:9);assert.equal(o.duration,turbo?750:650);assert.equal(o.peakHeight,turbo?18:14);
  p.power={kind:'sky',ms:1000};near(simulation.dunkOption(p,input).reach,o.reach*1.6);p.power=null;
  stepMatch(m,act(0,input));assert.equal(p.flight.tier,o.tier);
 }
 for(const kind of ['one-frame','blocked','backwards','stopped']){
  const m=dunkCourt(82),p=m.players[0];if(kind==='blocked')Object.assign(m.players[2],{x:85.3,y:28});
  advance(m,kind==='one-frame'?1:10,act(0,{x:kind==='backwards'?-1:1}));if(kind==='stopped')stepMatch(m);
  assert.ok(p.runUpMs<150,kind);assert.equal(simulation.dunkOption(p,{...neutral(),x:1}),null,kind);
 }
 const m=dunkCourt(88),p=m.players[0];p.turbo=19;stepMatch(m,act(0,{pressed:A.SHOOT,turboActions:A.SHOOT,held:A.SHOOT}));assert.equal(p.flight,null);assert.equal(p.shotArmed,true);assert.ok(p.turbo>=19);
});
test('shot armed outside dunk range stays shot and held K never arms after loss or catch',()=>{
 const m=dunkCourt(80),p=m.players[0];stepMatch(m,act(0,{pressed:A.SHOOT,held:A.SHOOT}));p.x=91;advance(m,25,act(0,{held:A.SHOOT}));stepMatch(m,act(0,{released:A.SHOOT}));assert.equal(m.ball.kind,'shot');
 const n=dunkCourt(80);stepMatch(n,act(0,{pressed:A.SHOOT,held:A.SHOOT}));giveBall(n,1);stepMatch(n,act(0,{held:A.SHOOT}));giveBall(n,0);advance(n,28,act(0,{held:A.SHOOT}));stepMatch(n,act(0,{released:A.SHOOT}));assert.equal(n.ball.mode,'held');assert.equal(n.players[0].shotArmed,false);
 const d=dunkCourt();stepMatch(d,act(0,{pressed:A.SHOOT,held:A.SHOOT}));advance(d,120,act(0,{held:A.SHOOT}));giveBall(d,0);stepMatch(d,act(0,{released:A.SHOOT}));assert.equal(d.ball.mode,'held');
});
test('low shove cancels dunk once; high dunk ignores ground shove and can be blocked',()=>{
 const m=dunkCourt();stepMatch(m,act(0,{pressed:A.SHOOT}));Object.assign(m.players[2],{x:94,y:28});stepMatch(m,act(2,shove()));assert.equal(m.ball.mode,'loose');assert.notEqual(m.players[0].flight?.kind,'dunk');advance(m,60);assert.deepEqual(m.score,[0,0]);
 const n=dunkCourt();stepMatch(n,act(0,{pressed:A.SHOOT}));advance(n,12);Object.assign(n.players[2],{x:n.players[0].x+4,y:28});stepMatch(n,act(2,shove()));assert.equal(n.ball.kind,'dunk');assert.equal(n.players[0].stunMs,0);
 const b=dunkCourt();Object.assign(b.players[2],{x:93,y:28});stepMatch(b,new Map([[0,{...neutral(),pressed:A.SHOOT}],[2,{...neutral(),pressed:A.SHOOT}]]));assert.equal(b.ball.mode,'loose');assert.equal(b.players[0].flight.kind,'landing');advance(b,65);assert.deepEqual(b.score,[0,0]);assert.equal(b.events.filter(e=>e.kind==='block').length,1);
 const same=dunkCourt();Object.assign(same.players[2],{x:94,y:28});stepMatch(same,new Map([[0,{...neutral(),pressed:A.SHOOT}],[2,{...neutral(),...shove()}]]));assert.equal(same.players[0].flight,null);assert.equal(same.ball.mode,'loose');
});
test('dunk released before buzzer scores once and overtime clears old action state',()=>{
 const m=dunkCourt();m.remainingMs=1;stepMatch(m,act(0,{pressed:A.SHOOT}));assert.equal(m.phase,'buzzer');advance(m,60,act(0,{pressed:A.SHOOT}));assert.equal(m.phase,'finished');assert.deepEqual(m.score,[2,0]);
 const n=dunkCourt();n.phase='buzzer';stepMatch(n,act(0,{pressed:A.SHOOT}));assert.notEqual(n.ball.kind,'dunk');
 const tie=dunkCourt();tie.remainingMs=1;Object.assign(tie.players[2],{recoveryMs:300,stunMs:400,runUpMs:150,shotArmed:true});stepMatch(tie);assert.equal(tie.phase,'countdown');assert.equal(tie.players[2].stunMs,0);assert.equal(tie.players[2].recoveryMs,0);assert.equal(tie.players[2].shotArmed,false);
});
