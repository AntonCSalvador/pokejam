import test from 'node:test';
import assert from 'node:assert/strict';
import * as data from '../public/game/data.js';
import {createMatch,stepMatch} from '../public/game/simulation.js';
import {chooseBotInput} from '../public/game/bots.js';
import {reconcileLocal} from '../public/connection.js';
const selection=(a,b,players)=>({teamKeys:[a,b],playerKeys:players});
const act=(id,extra={})=>new Map([[id,{...data.neutral(),...extra}]]);

test('catalog constructs all seven franchises without changing original player tuning',()=>{
 assert.equal(data.TEAMS.length,7);assert.equal(Object.keys(data.PLAYERS).length,21);
 assert.deepEqual(data.defaultSelection().playerKeys,['tauros','machamp','heatmor','charizard']);
 assert.deepEqual(createMatch().players.map(p=>[p.speed,p.window,p.dunk,p.stealRecoveryMs]),[[21,95,9,650],[19,105,10,650],[20,135,7,650],[22,105,12,650]]);
 for(const a of data.TEAMS)for(const b of data.TEAMS)if(a!==b){
  const s=selection(a.key,b.key,[...a.roster.slice(0,2),...b.roster.slice(0,2)]),m=createMatch({selection:s});
  assert.equal(data.validateSelection(s),true);assert.deepEqual(m.teamKeys,[a.key,b.key]);
  assert.deepEqual(m.players.map(p=>p.team),[0,0,1,1]);assert.deepEqual(m.players.map(p=>p.key),s.playerKeys);
 }
});
test('invalid or duplicate selections cannot construct a match',()=>{
 for(const s of [null,{},selection('chicago','chicago',['tauros','machamp','tauros','machamp']),selection('fake','miami',[]),selection('chicago','miami',['tauros','tauros','heatmor','charizard']),selection('chicago','miami',['tauros','celebi','heatmor','charizard']),selection('chicago','miami',['tauros','machamp','heatmor']),{teamKeys:'chicago',playerKeys:[]}]){
  assert.throws(()=>createMatch({selection:s}),RangeError);
 }
});
test('species signatures follow swapped slots and sides, with original activation guards',()=>{
 const m=createMatch({selection:selection('sacramento','chicago',['kingdra','nidoking','machamp','tauros'])});m.phase='live';m.ball={mode:'held',holder:1,x:32,y:38,z:2,lastTeam:0};
 m.players.forEach(p=>p.meter=100);
 stepMatch(m,act(3,{pressed:data.A.SPECIAL,y:-1}));assert.equal(m.players[3].power?.kind,'windup');assert.equal(m.players[3].power.dy,-1);
 stepMatch(m,act(0,{pressed:data.A.SPECIAL}));assert.equal(m.players[0].meter,100);assert.equal(m.players[0].power,null);
 m.ball.holder=2;stepMatch(m,act(2,{pressed:data.A.SPECIAL}));assert.equal(m.ball.kind,'pass');assert.equal(m.players[2].meter,0);
 m.ball={mode:'held',holder:0,x:25,y:18,z:2,lastTeam:0};stepMatch(m,act(0,{pressed:data.A.SPECIAL}));assert.equal(m.players[0].power.kind,'heat');assert.equal(m.players[0].meter,0);
 stepMatch(m,act(0,{pressed:data.A.SPECIAL}));assert.equal(m.players[0].meter,0);
});
test('steal rating changes recovery while prediction preserves species identity',()=>{
 const m=createMatch({selection:selection('sacramento','chicago',['nidoking','slowking','hitmontop','tauros'])});m.phase='live';m.ball={mode:'held',holder:1,x:50,y:50,z:2,lastTeam:0};
 stepMatch(m,new Map([[0,{...data.neutral(),pressed:data.A.PASS}],[2,{...data.neutral(),pressed:data.A.PASS}]]));
 assert.equal(m.players[0].cooldownMs,600);assert.equal(m.players[2].cooldownMs,450);
 const snapshot={match:m,slot:0,controlEpoch:2,ackSeq:0},before=structuredClone(m);
 const p=reconcileLocal(snapshot,[{...data.neutral(),seq:1,controlEpoch:2,x:1}]);
 assert.equal(p.key,'nidoking');assert.equal(p.ability,'sky');assert.deepEqual(p.ratings,{speed:4,shooting:4,dunk:10,steal:6});assert.deepEqual(m,before);
 p.ratings.speed=1;assert.equal(data.PLAYERS.nidoking.ratings.speed,4);
});
test('every species completes a seeded bot match with finite positions and valid possession',()=>{
 assert.equal(data.TEAMS.length,7);
 const seen=new Set();
 for(let i=0;i<7;i++)for(const offset of [0,1]){
  const a=data.TEAMS[i],b=data.TEAMS[(i+1)%7],m=createMatch({seed:19+i,selection:selection(a.key,b.key,[...a.roster.slice(offset,offset+2),...b.roster.slice(offset,offset+2)])});
  m.players.forEach(p=>seen.add(p.key));
  for(let tick=0;tick<36000&&m.phase!=='finished';tick++){
   stepMatch(m,new Map(m.players.map(p=>[p.id,chooseBotInput(m,p.id)])));
   assert.ok(m.players.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.meter>=0&&p.meter<=100));
   if(m.ball.mode==='held')assert.ok(m.ball.holder>=0&&m.ball.holder<4);
  }
  assert.equal(m.phase,'finished',a.key+' '+offset);
 }
 assert.equal(seen.size,21);
});
