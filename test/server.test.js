import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {startServer} from '../server/index.js';
import {request} from 'node:http';
import {reconcileLocal,sampleRemote,reconnectDelay,appendSnapshot} from '../public/connection.js';
import {createMatch} from '../public/game/simulation.js';

test('prediction replays only unacknowledged current-epoch movement without changing outcomes',()=>{
 const match=createMatch();match.phase='live';const snapshot={match,slot:0,controlEpoch:2,ackSeq:4};
 const original=structuredClone(match);const frame={x:1,y:0,held:0,pressed:16,released:0};
 assert.deepEqual(reconcileLocal(snapshot,[]),match.players[0]);
 assert.deepEqual(reconcileLocal(snapshot,[{...frame,seq:5,controlEpoch:1},{...frame,seq:4,controlEpoch:2}]),match.players[0]);
 const predicted=reconcileLocal(snapshot,[{...frame,seq:5,controlEpoch:2}]);assert.ok(predicted.x>match.players[0].x);assert.deepEqual(match,original);
});
test('snapshot sampling interpolates positions, holds unavailable state, and deduplicates ticks/events',()=>{
 const a={match:createMatch(),slot:0,controlEpoch:1,ackSeq:0};a.match.tick=10;a.match.players[0].x=20;
 const b=structuredClone(a);b.match.tick=16;b.match.players[0].x=26;b.match.score[0]=2;b.match.events=[{id:1,kind:'score',tick:16}];
 const buffer=[];assert.equal(appendSnapshot(buffer,a),true);appendSnapshot(buffer,b);assert.equal(appendSnapshot(buffer,b),false,'duplicate tick must not reset interpolation clock');assert.equal(buffer.length,2);
 const middle=sampleRemote(buffer,13);assert.equal(middle.players[0].x,23);assert.equal(middle.score[0],0);assert.equal(middle.events.length,0);
 assert.deepEqual(sampleRemote(buffer,100),b.match);assert.equal(sampleRemote(buffer,16).events.length,1);
 const discontinuous=structuredClone(b);discontinuous.match.phase='finished';assert.equal(sampleRemote([a,discontinuous],13).players[0].x,20);
 for(let tick=17;tick<70;tick++)appendSnapshot(buffer,{...b,match:{...b.match,tick}});assert.ok(buffer.length<=12);
});
test('reconnection backoff starts at half a second and caps at five',()=>{assert.equal(reconnectDelay(0),500);assert.equal(reconnectDelay(20),5000);});

async function client(url){
 const ws=new WebSocket(url.replace('http:','ws:')+'/ws',{origin:url});
 const messages=[];ws.on('message',data=>messages.push(JSON.parse(data)));
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 return {ws,messages,send:m=>ws.send(JSON.stringify(m)),async next(type){for(let i=0;i<100;i++){const index=messages.findIndex(m=>m.type===type);if(index!==-1)return messages.splice(index,1)[0];await new Promise(r=>setTimeout(r,20));}throw new Error(`No ${type} message`);}};
}
test('real HTTP and four sockets share authoritative match and reject invalid traffic',async t=>{
 const server=await startServer();const clients=[];t.after(async()=>{clients.forEach(c=>c.ws.terminate());await server.close();});
 const file=await fetch(server.url+'/game/data.js');assert.equal(file.status,200);
 const traversal=await new Promise(resolve=>{request(server.url+'/%2e%2e%2fpackage.json',r=>{r.resume();resolve(r.statusCode);}).end();});assert.equal(traversal,403);
 const a=await client(server.url);clients.push(a);a.send({type:'create'});const w=await a.next('welcome');
 a.send({type:'selectTeam',side:0,teamKey:'sacramento'});a.send({type:'selectTeam',side:1,teamKey:'toronto'});
 for(let slot=1;slot<4;slot++){const c=await client(server.url);clients.push(c);c.send({type:'join',roomId:w.roomId,slot});await c.next('welcome');}
 a.send({type:'start'});const snapshots=await Promise.all(clients.map(c=>c.next('snapshot')));
 assert.ok(snapshots.every(s=>s.match.players.length===4&&s.match.score.every(n=>n===0)));
 assert.ok(snapshots.every(s=>JSON.stringify(s.match.teamKeys)===JSON.stringify(['sacramento','toronto'])));
 assert.ok(snapshots.every(s=>JSON.stringify(s.match.players.map(p=>p.key))===JSON.stringify(['kingdra','nidoking','tyrantrum','sceptile'])));
 a.send({type:'selectPlayer',slot:0,playerKey:'slowking'});assert.equal((await a.next('error')).code,'MATCH_STARTED');
 a.send({type:'selectPlayer',slot:0,playerKey:'slowking',speed:999});assert.equal((await a.next('error')).code,'BAD_MESSAGE');
 a.ws.send('{');assert.equal((await a.next('error')).code,'BAD_MESSAGE');
 a.send({type:'input',seq:1,controlEpoch:w.controlEpoch,x:2,y:0,held:0,pressed:0,released:0});assert.equal((await a.next('error')).code,'BAD_MESSAGE');
 a.send({type:'input',seq:1,controlEpoch:w.controlEpoch,x:0,y:0,held:0,pressed:0,released:0,score:999});assert.equal((await a.next('error')).code,'BAD_MESSAGE');
 const wrong=new WebSocket(server.url.replace('http:','ws:')+'/ws',{origin:'https://wrong.example'});
 const status=await new Promise(resolve=>{wrong.on('unexpected-response',(_,r)=>{r.resume();resolve(r.statusCode);wrong.terminate();});wrong.on('error',()=>{});});assert.equal(status,403);
});
