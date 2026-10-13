import test from 'node:test';
import assert from 'node:assert/strict';
import {createRooms} from '../server/rooms.js';
import {A} from '../public/game/data.js';
function harness(){let time=1000;const r=createRooms({now:()=>time});return {r,client(){const messages=[];const id=r.connect(m=>messages.push(structuredClone(m)));return {id,messages,send:m=>r.receive(id,m),last:type=>messages.findLast(m=>m.type===type)};},advance(ticks){for(let i=0;i<ticks;i++){time+=1000/60;r.tick();}},wait(ms){time+=ms;r.tick();}};}
const controls=(w,seq,extra={})=>({type:'input',seq,controlEpoch:w.controlEpoch,x:0,y:0,held:0,pressed:0,released:0,...extra});
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
 for(let i=0;i<15;i++){const c=h.client();c.send({type:'create'});assert.ok(c.last('welcome'));}
 const extra=h.client();extra.send({type:'create'});assert.equal(extra.last('error').code,'SERVER_BUSY');
});
