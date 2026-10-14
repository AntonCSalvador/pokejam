import test from 'node:test';
import assert from 'node:assert/strict';
import {createRooms} from '../server/rooms.js';
import {A,neutral} from '../public/game/data.js';
import {live,giveBall} from './gameplay-fixtures.js';
function harness(options={}){let time=1000;const r=createRooms({now:()=>time,...options});return {r,client(){const messages=[];const id=r.connect(m=>messages.push(structuredClone(m)));return {id,messages,send:m=>r.receive(id,m),last:type=>messages.findLast(m=>m.type===type)};},advance(ticks){for(let i=0;i<ticks;i++){time+=1000/60;r.tick();}},wait(ms){time+=ms;r.tick();}};}
const controls=(w,seq,extra={})=>({type:'input',seq,controlEpoch:w.controlEpoch,x:0,y:0,held:0,pressed:0,released:0,turboActions:0,...extra});
test('captains choose valid franchises and starters without overwriting people',()=>{
 const h=harness(),a=h.client();a.send({type:'create'});const roomId=a.last('welcome').roomId;
 assert.deepEqual(a.last('lobby').teamKeys,['chicago','miami']);assert.deepEqual(a.last('lobby').captains,[0,0]);
 a.send({type:'selectTeam',side:0,teamKey:'sacramento'});a.send({type:'selectTeam',side:1,teamKey:'toronto'});
 assert.deepEqual(a.last('lobby').playerKeys,['kingdra','nidoking','tyrantrum','sceptile']);
 a.send({type:'selectPlayer',slot:0,playerKey:'nidoking'});assert.deepEqual(a.last('lobby').playerKeys.slice(0,2),['nidoking','kingdra']);
 a.send({type:'selectPlayer',slot:1,playerKey:'slowking'});assert.deepEqual(a.last('lobby').playerKeys.slice(0,2),['nidoking','slowking']);
 const b=h.client();b.send({type:'join',roomId,slot:2});assert.deepEqual(a.last('lobby').captains,[0,2]);
 const before=a.last('lobby').playerKeys;
 a.send({type:'selectPlayer',slot:2,playerKey:'aerodactyl'});assert.equal(a.last('error').code,'PLAYER_LOCKED');assert.deepEqual(a.last('lobby').playerKeys,before);
 a.send({type:'selectTeam',side:1,teamKey:'miami'});assert.equal(a.last('error').code,'CAPTAIN_ONLY');
 b.send({type:'selectTeam',side:1,teamKey:'sacramento'});assert.equal(b.last('error').code,'BAD_SELECTION');
 b.send({type:'selectTeam',side:1,teamKey:'boston'});assert.deepEqual(b.last('lobby').playerKeys.slice(2),['celebi','gallade']);
 b.send({type:'selectPlayer',slot:3,playerKey:'tauros'});assert.equal(b.last('error').code,'BAD_SELECTION');
 b.send({type:'selectPlayer',slot:2,playerKey:'breloom'});assert.equal(b.last('lobby').playerKeys[2],'breloom');
 b.send({type:'selectTeam',side:1,teamKey:'boston'});assert.equal(b.last('lobby').playerKeys[2],'breloom');
});
test('joining races, reserved slots and reconnect handoff protect selected species',()=>{
 const h=harness(),a=h.client();a.send({type:'create'});const w=a.last('welcome');
 const b=h.client();b.send({type:'join',roomId:w.roomId,slot:1});
 a.send({type:'selectPlayer',slot:1,playerKey:'hitmontop'});assert.equal(a.last('error').code,'PLAYER_LOCKED');
 a.send({type:'selectTeam',side:0,teamKey:'boston'});assert.equal(a.last('error').code,'TEAM_LOCKED');
 b.send({type:'selectPlayer',slot:1,playerKey:'hitmontop'});assert.equal(b.last('lobby').playerKeys[1],'hitmontop');
 h.r.disconnect(a.id);assert.equal(b.last('lobby').host,1);assert.deepEqual(b.last('lobby').captains,[1,1]);
 b.send({type:'selectPlayer',slot:1,playerKey:'tauros'});assert.equal(b.last('error').code,'PLAYER_LOCKED');
 b.send({type:'selectTeam',side:0,teamKey:'boston'});assert.equal(b.last('error').code,'TEAM_LOCKED');
 const c=h.client();c.send({type:'reconnect',roomId:w.roomId,token:w.token});assert.deepEqual(c.last('lobby').captains,[0,1]);assert.equal(c.last('lobby').playerKeys[1],'hitmontop');
 const d=h.client();d.send({type:'reconnect',roomId:w.roomId,token:c.last('welcome').token});
 c.send({type:'selectPlayer',slot:0,playerKey:'machamp'});assert.equal(c.last('error').code,'SESSION_REPLACED');
 d.send({type:'claim',slot:2});assert.deepEqual(d.last('lobby').captains,[1,2]);
 d.send({type:'selectPlayer',slot:2,playerKey:'charizard'});assert.deepEqual(d.last('lobby').playerKeys.slice(2),['charizard','heatmor']);
 b.send({type:'selectPlayer',slot:0,playerKey:'machamp'});assert.equal(b.last('lobby').playerKeys[0],'machamp');
});
test('match freezes validated selection and rematch preserves species but resets game state',()=>{
 const h=harness(),a=h.client();a.send({type:'create'});
 a.send({type:'selectTeam',side:0,teamKey:'sacramento'});a.send({type:'selectPlayer',slot:1,playerKey:'slowking'});a.send({type:'start'});h.advance(3);
 assert.deepEqual(a.last('snapshot').match.players.map(p=>p.key),['kingdra','slowking','heatmor','charizard']);
 a.send({type:'selectPlayer',slot:0,playerKey:'nidoking'});assert.equal(a.last('error').code,'MATCH_STARTED');
 let finished=false;for(let i=0;i<12000&&!finished;i++){h.advance(3);finished=a.last('snapshot')?.match.phase==='finished';a.messages.length=0;}
 assert.equal(finished,true);a.send({type:'rematch'});assert.equal(a.last('lobby').started,false);assert.equal(a.last('lobby').playerKeys[1],'slowking');
 a.send({type:'start'});h.advance(3);assert.deepEqual(a.last('snapshot').match.score,[0,0]);assert.equal(a.last('snapshot').match.players[1].meter,0);
});
test('four slots are unique; fifth human and duplicate claims cannot overwrite them',()=>{
 const h=harness(),a=h.client();a.send({type:'create'});const roomId=a.last('welcome').roomId;
 const clients=[a];for(let slot=1;slot<4;slot++){const c=h.client();c.send({type:'join',roomId,slot});assert.equal(c.last('welcome').slot,slot);clients.push(c);}
 const fifth=h.client();fifth.send({type:'join',roomId,slot:1});assert.equal(fifth.last('error').code,'ROOM_FULL');
 a.send({type:'claim',slot:1});assert.equal(a.last('error').code,'SLOT_TAKEN');
 a.send({type:'start'});h.advance(183);
 assert.ok(clients.every(c=>c.last('snapshot').match.players.length===4));
});
test('AI switching preserves character state and refuses human or reserved teammates',()=>{
 const h=harness(),a=h.client();a.send({type:'create'});a.send({type:'start'});h.advance(183);
 const old=a.last('welcome');a.send(controls(old,1,{pressed:A.SWITCH}));h.advance(3);assert.equal(a.last('welcome').slot,1);
 const b=h.client();b.send({type:'join',roomId:old.roomId,slot:0});
 a.send(controls(a.last('welcome'),1,{pressed:A.SWITCH}));h.advance(3);assert.equal(a.last('welcome').slot,1);
 h.r.disconnect(b.id);a.send(controls(a.last('welcome'),2,{pressed:A.SWITCH}));h.advance(3);assert.equal(a.last('welcome').slot,1);
});
test('reconnect rotates token and rejects the replaced socket and stale control epoch',()=>{
 const h=harness(),a=h.client();a.send({type:'create'});const first=a.last('welcome');a.send({type:'start'});h.advance(183);
 const b=h.client();b.send({type:'reconnect',roomId:first.roomId,token:first.token});const second=b.last('welcome');
 assert.equal(second.slot,first.slot);assert.notEqual(second.token,first.token);assert.ok(second.controlEpoch>first.controlEpoch);
 a.send(controls(first,1,{x:1}));assert.equal(a.last('error').code,'SESSION_REPLACED');
 b.send(controls(first,2,{x:1}));assert.equal(b.last('error').code,'STALE_CONTROL');
 const c=h.client();c.send({type:'reconnect',roomId:first.roomId,token:first.token});assert.equal(c.last('error').code,'SESSION_EXPIRED');
});
test('stale movement stops; reservations expire at 60 seconds and empty rooms at two minutes',()=>{
 const h=harness(),a=h.client();a.send({type:'create'});const w=a.last('welcome');a.send({type:'start'});h.advance(183);
 a.send(controls(w,1,{x:-1}));h.advance(20);const x=a.last('snapshot').match.players[0].x;h.advance(6);assert.equal(a.last('snapshot').match.players[0].x,x);
 h.r.disconnect(a.id);h.wait(60001);const b=h.client();b.send({type:'reconnect',roomId:w.roomId,token:w.token});assert.equal(b.last('error').code,'SESSION_EXPIRED');
 h.wait(60001);b.send({type:'inspect',roomId:w.roomId});assert.equal(b.last('error').code,'ROOM_GONE');
});
test('room cap, host transfer, malformed axes and input flooding fail safely',()=>{
 const h=harness(),a=h.client();a.send({type:'create'});const w=a.last('welcome');const b=h.client();b.send({type:'join',roomId:w.roomId,slot:2});h.r.disconnect(a.id);b.send({type:'start'});h.advance(3);assert.ok(b.last('snapshot'));
 b.send(controls(b.last('welcome'),1,{x:Infinity}));assert.equal(b.last('error').code,'BAD_MESSAGE');
 for(let seq=1;seq<=130;seq++)b.send(controls(b.last('welcome'),seq));assert.equal(b.last('error').code,'RATE_LIMIT');
 for(let i=0;i<15;i++){const c=h.client();c.send({type:'create'});assert.ok(c.last('welcome'));}
 const extra=h.client();extra.send({type:'create'});assert.equal(extra.last('error').code,'SERVER_BUSY');
});
test('short shoot tap survives a delayed batch and old switch-epoch actions are discarded',()=>{
 const h=harness(),a=h.client();a.send({type:'create'});const w=a.last('welcome');a.send({type:'start'});h.advance(183);
 h.wait(75);a.send(controls(w,1,{pressed:A.SHOOT,released:A.SHOOT}));h.advance(3);
 assert.equal(a.last('snapshot').match.players[0].action,'block');assert.ok(a.last('snapshot').match.players[0].jumpMs>0);
 a.send(controls(w,2,{pressed:A.SWITCH}));a.send(controls(w,3,{x:1,held:A.SHOOT}));h.advance(3);
 const switched=a.last('snapshot');assert.equal(switched.slot,1);assert.equal(switched.controlEpoch,w.controlEpoch+1);assert.equal(switched.match.players[1].chargeMs,0);assert.equal(switched.ackSeq,0);
});

test('room validates latched modifiers and preserves a quick turbo shoot chord',()=>{
 const h=harness(),a=h.client();a.send({type:'create'});const w=a.last('welcome');a.send({type:'start'});h.advance(183);
 for(const turboActions of [A.SPECIAL,-1,.5,A.PASS]){a.send(controls(w,1,{turboActions}));assert.equal(a.last('error').code,'BAD_MESSAGE');}
 a.messages.length=0;a.send(controls(w,1,{pressed:A.SHOOT,released:A.SHOOT,turboActions:A.SHOOT}));h.advance(3);
 assert.equal(a.last('error'),undefined);assert.equal(a.last('snapshot').match.players[0].action,'block');
 const start=a.last('snapshot').match.players[0].actionStart;h.advance(6);assert.equal(a.last('snapshot').match.players[0].actionStart,start);
});

function passRoom(){const m=live();giveBall(m,1);m.players[1].bot.input=neutral();const h=harness({matchFactory:()=>m}),a=h.client();a.send({type:'create'});a.send({type:'start'});return {m,h,a};}
test('J requests a normal pass from AI holder exactly once',()=>{
 const {m,h,a}=passRoom();a.send(controls(a.last('welcome'),1,{pressed:A.PASS}));h.advance(2);
 assert.equal(m.ball.kind,'pass');assert.equal(m.ball.from,1);assert.equal(m.ball.tier,'normal');assert.equal(m.players[1].bot.passRequest,null);
 h.advance(6);assert.equal(m.events.filter(e=>e.kind==='pass'&&e.player===1).length,1);
});
test('AI pass requests expire, replace and cancel on possession or phase changes',()=>{
 for(const reason of ['expiry','possession','phase']){
  const {m,h,a}=passRoom();m.players[1].stunMs=600;a.send(controls(a.last('welcome'),1,{pressed:A.PASS}));h.advance(1);assert.equal(m.players[1].bot.passRequest.untilTick,18);
  a.send(controls(a.last('welcome'),2,{pressed:A.PASS}));h.advance(1);assert.equal(m.players[1].bot.passRequest.untilTick,19);
  if(reason==='possession')giveBall(m,2);if(reason==='phase'){m.phase='deadball';m.phaseMs=1000;}h.advance(reason==='expiry'?19:1);assert.equal(m.players[1].bot.passRequest,null);
 }
});
test('AI pass call cannot command humans and reconnect clears pending request',()=>{
 const {m,h,a}=passRoom(),b=h.client();b.send({type:'join',roomId:a.last('welcome').roomId,slot:1});const w=b.last('welcome');
 // Pending humans still have AI coverage, but active humans never receive injected actions.
 h.r.disconnect(b.id);a.send(controls(a.last('welcome'),1,{pressed:A.PASS}));h.advance(1);assert.ok(m.players[1].bot.passRequest);
 const c=h.client();c.send({type:'reconnect',roomId:w.roomId,token:w.token});m.phase='deadball';m.phaseMs=1;h.advance(1);giveBall(m,1);m.players[1].bot.passRequest={from:0,untilTick:m.tick+18};h.advance(1);assert.equal(m.players[1].bot.passRequest,null);assert.equal(m.ball.holder,1);
 a.send(controls(a.last('welcome'),2,{pressed:A.PASS}));h.advance(8);assert.equal(m.ball.holder,1);assert.equal(m.events.filter(e=>e.kind==='pass').length,0);
 const d=passRoom(),mate=d.h.client();mate.send({type:'join',roomId:d.a.last('welcome').roomId,slot:1});d.h.r.disconnect(mate.id);d.a.send(controls(d.a.last('welcome'),1,{pressed:A.PASS}));d.h.advance(2);assert.equal(d.m.ball.kind,'pass');
});
test('Shift J remains shove with teammate ball and disabled callers cannot request',()=>{
 const {m,h,a}=passRoom();a.send(controls(a.last('welcome'),1,{pressed:A.PASS,turboActions:A.PASS}));h.advance(1);assert.equal(m.players[0].action,'shove');assert.equal(m.players[1].bot.passRequest,null);
 for(const fields of [{stunMs:200},{recoveryMs:200},{flight:{id:1,kind:'landing',start:{x:20,y:8,z:10},end:{x:20,y:8,z:0},elapsed:0,duration:500}}]){
  const r=passRoom();Object.assign(r.m.players[0],fields);r.a.send(controls(r.a.last('welcome'),1,{pressed:A.PASS}));r.h.advance(1);assert.equal(r.m.players[1].bot.passRequest,null);
 }
});
test('switch and disconnect preserve committed dunk and shove state',()=>{
 for(const kind of ['dunk','shove']){
  const {m,h,a}=passRoom();if(kind==='dunk'){Object.assign(m.players[0],{x:90,y:28});giveBall(m,0);}
  a.send(controls(a.last('welcome'),1,{pressed:kind==='dunk'?A.SHOOT:A.PASS,turboActions:kind==='dunk'?A.SHOOT:A.PASS}));h.advance(1);const energy=m.players[0].turbo,id=m.players[0].flight?.id;
  a.send(controls(a.last('welcome'),2,{pressed:A.SWITCH}));h.advance(1);assert.equal(a.last('welcome').slot,1);if(kind==='dunk')assert.equal(m.players[0].flight.id,id);else assert.ok(m.players[0].recoveryMs>0);
  h.r.disconnect(a.id);h.advance(3);assert.ok(m.players[0].turbo>=energy);assert.equal(m.events.filter(e=>e.kind===kind&&e.player===0).length,1);
 }
});

test('caller control loss cancels an unconsumed AI request',()=>{
 for(const reconnect of [false,true]){
  const {m,h,a}=passRoom();m.players[1].stunMs=300;const w=a.last('welcome');a.send(controls(w,1,{pressed:A.PASS}));h.advance(1);assert.ok(m.players[1].bot.passRequest);
  if(reconnect){const next=h.client();next.send({type:'reconnect',roomId:w.roomId,token:w.token});}else h.r.disconnect(a.id);
  h.advance(1);assert.equal(m.players[1].bot.passRequest,null);
 }
});
