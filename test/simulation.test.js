import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, stepMatch, movePlayer } from '../public/game/simulation.js';
import { A } from '../public/game/data.js';
import { chooseBotInput } from '../public/game/bots.js';
const input = (fields={}) => ({x:0,y:0,held:0,pressed:0,released:0,...fields});
function advance(m, ticks, inputs=new Map()) { for(let i=0;i<ticks;i++) stepMatch(m,inputs); }
function live() {
  const m=createMatch({seed:7}); advance(m,180);
  m.phase='live'; m.ball={mode:'held',holder:0,x:60,y:28,z:2,lastTeam:0};
  Object.assign(m.players[0],{x:60,y:28});
  Object.assign(m.players[1],{x:50,y:45});
  Object.assign(m.players[2],{x:20,y:10});
  Object.assign(m.players[3],{x:20,y:45});
  m.possessionTeam=0; m.shotClockMs=24000;
  return m;
}
function shoot(m,id=0,ticks=27) {
  stepMatch(m,new Map([[id,input({held:A.SHOOT,pressed:A.SHOOT})]]));
  advance(m,ticks-1,new Map([[id,input({held:A.SHOOT})]]));
  stepMatch(m,new Map([[id,input({released:A.SHOOT})]]));
}
test('movement normalizes diagonals and keeps depleted turbo within court',()=>{
  const m=live(), a=structuredClone(m.players[0]),b=structuredClone(a);
  movePlayer(a,input({x:1}),1,[]); movePlayer(b,input({x:1,y:1}),1,[]);
  assert.ok(Math.abs(Math.hypot(b.x-60,b.y-28)-(a.x-60))<0.001);
  a.x=99;a.turbo=0;movePlayer(a,input({x:1,held:A.TURBO}),1,[]);assert.ok(a.x<=98);
});
test('timed three-point shot scores once and restarts for conceding side',()=>{
  const m=live();shoot(m);advance(m,90);
  assert.deepEqual(m.score,[3,0]);assert.equal(m.phase,'deadball');
  advance(m,90);assert.deepEqual(m.score,[3,0]);assert.equal(m.players[m.ball.holder].team,1);
});
test('mistimed shot rebounds instead of scoring',()=>{
  const m=live();shoot(m,0,4);advance(m,70);
  assert.deepEqual(m.score,[0,0]);assert.equal(m.ball.mode,'loose');
});
test('pass can be intercepted without resetting clock for a teammate',()=>{
  const m=live();Object.assign(m.players[1],{x:80,y:28});
  stepMatch(m,new Map([[0,input({pressed:A.PASS})]]));advance(m,35);
  assert.equal(m.ball.holder,1);assert.ok(m.shotClockMs<23800);
  const n=live();Object.assign(n.players[1],{x:80,y:28});Object.assign(n.players[2],{x:70,y:28});
  stepMatch(n,new Map([[0,input({pressed:A.PASS})]]));advance(n,30);
  assert.equal(n.ball.holder,2);assert.equal(n.possessionTeam,1);
});
test('short tap creates one airborne dunk, with defensive block window',()=>{
  const m=live();Object.assign(m.players[0],{x:87,y:28});
  stepMatch(m,new Map([[0,input({pressed:A.SHOOT,released:A.SHOOT})]]));
  assert.equal(m.ball.kind,'dunk');assert.deepEqual(m.score,[0,0]);advance(m,65);assert.deepEqual(m.score,[2,0]);
  const n=live();Object.assign(n.players[0],{x:87,y:28});Object.assign(n.players[2],{x:89,y:28});
  stepMatch(n,new Map([[0,input({pressed:A.SHOOT,released:A.SHOOT})],[2,input({pressed:A.SHOOT})]]));
  advance(n,65);assert.deepEqual(n.score,[0,0]);assert.ok(n.events.some(e=>e.kind==='block'));
});
test('steal requires facing and range and cannot repeat while held',()=>{
  const m=live();Object.assign(m.players[2],{x:62,y:28,facing:-1});
  stepMatch(m,new Map([[2,input({pressed:A.PASS})]]));assert.equal(m.ball.holder,2);
  advance(m,20,new Map([[0,input({held:A.PASS})]]));assert.equal(m.ball.holder,2);
});
test('shot clock and out-of-bounds produce opponent possession',()=>{
  const m=live();m.shotClockMs=1;stepMatch(m);assert.equal(m.phase,'deadball');advance(m,76);assert.equal(m.players[m.ball.holder].team,1);
  const n=live();n.ball={mode:'loose',x:101,y:28,z:0,vx:0,vy:0,lastTeam:0};stepMatch(n);advance(n,76);assert.equal(n.players[n.ball.holder].team,1);
});
test('buzzer honors released shot once, then finishes or starts overtime',()=>{
  const m=live();m.remainingMs=480;shoot(m);advance(m,100);assert.deepEqual(m.score,[3,0]);assert.equal(m.phase,'finished');
  const n=live();n.remainingMs=1;stepMatch(n);assert.equal(n.overtime,true);assert.notEqual(n.phase,'finished');
});
test('buzzer shot remains blockable and cannot be followed by another shot',()=>{
  const m=live();m.score=[2,0];m.remainingMs=20;Object.assign(m.players[0],{x:87,y:28});Object.assign(m.players[2],{x:89,y:28});
  stepMatch(m,new Map([[0,input({pressed:A.SHOOT,released:A.SHOOT})],[2,input({pressed:A.SHOOT})]]));
  advance(m,120);assert.deepEqual(m.score,[2,0]);assert.equal(m.phase,'finished');
});
test('neutral stale input cancels charge rather than launching an unwanted shot',()=>{
  const m=live();stepMatch(m,new Map([[0,input({held:A.SHOOT,pressed:A.SHOOT})]]));
  stepMatch(m);assert.equal(m.players[0].chargeMs,0);assert.equal(m.ball.mode,'held');
});
test('score, assist and defense reward real plays but ordinary passes give no meter',()=>{
  const m=live();shoot(m);advance(m,65);assert.equal(m.players[0].meter,25);
  const n=live();Object.assign(n.players[1],{x:65,y:28});stepMatch(n,new Map([[0,input({pressed:A.PASS})]]));advance(n,20);
  assert.equal(n.players[0].meter,0);assert.equal(n.ball.holder,1);shoot(n,1);advance(n,65);
  assert.equal(n.players[0].meter,10);assert.equal(n.players[1].meter,25);
  const s=live();Object.assign(s.players[2],{x:62,y:28,facing:-1});stepMatch(s,new Map([[2,input({pressed:A.PASS})]]));assert.equal(s.players[2].meter,15);
});
test('all signatures spend once when eligible, and preserve counters',()=>{
 for(let id=0;id<4;id++){
  const m=live();m.ball.holder=id;const p=m.players[id];p.meter=100;
  stepMatch(m,new Map([[id,input({pressed:A.SPECIAL})]]));assert.equal(p.meter,0);
  if(id===0)assert.equal(p.power.kind,'windup');
  if(id===1)assert.equal(m.ball.kind,'pass');
  if(id===2)assert.equal(p.power.kind,'heat');
  if(id===3)assert.equal(p.power.kind,'sky');
  stepMatch(m,new Map([[id,input({pressed:A.SPECIAL})]]));assert.equal(p.meter,0);
 }
 const n=live();n.players[2].meter=100;stepMatch(n,new Map([[2,input({pressed:A.SPECIAL})]]));assert.equal(n.players[2].meter,100);
});
test('pending powers expire after five seconds or passing and meter caps at 100',()=>{
 const m=live();m.ball.holder=2;m.players[2].meter=100;stepMatch(m,new Map([[2,input({pressed:A.SPECIAL})]]));advance(m,301);assert.equal(m.players[2].power,null);
 const n=live();n.players[0].meter=95;shoot(n);advance(n,65);assert.equal(n.players[0].meter,100);
});
test('bots finish reproducible games without invalid states or endless possession',()=>{
 for(const seed of [7,19,42]){
  const m=createMatch({seed});
  for(let tick=0;tick<36000&&m.phase!=='finished';tick++){
   stepMatch(m,new Map(m.players.map(p=>[p.id,chooseBotInput(m,p.id)])));
   assert.ok(m.players.every(p=>Number.isFinite(p.x)&&p.meter>=0&&p.meter<=100));
  }
  assert.equal(m.phase,'finished',`seed ${seed} stuck at ${m.score}`);assert.ok(m.score[0]+m.score[1]>0);
 }
});
test('bot decisions change only decision memory, never authoritative facing or physics',()=>{
 const m=live();m.tick=2;Object.assign(m.players[2],{x:62,y:28,facing:1});const before=structuredClone(m);
 chooseBotInput(m,2);before.players[2].bot=structuredClone(m.players[2].bot);assert.deepEqual(m,before);
});
