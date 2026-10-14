import test from 'node:test';
import assert from 'node:assert/strict';
import {A,neutral} from '../public/game/data.js';
import {stepMatch} from '../public/game/simulation.js';
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
