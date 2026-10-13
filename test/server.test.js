import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {startServer} from '../server/index.js';
import {request} from 'node:http';

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
 for(let slot=1;slot<4;slot++){const c=await client(server.url);clients.push(c);c.send({type:'join',roomId:w.roomId,slot});await c.next('welcome');}
 a.send({type:'start'});const snapshots=await Promise.all(clients.map(c=>c.next('snapshot')));
 assert.ok(snapshots.every(s=>s.match.players.length===4&&s.match.score.every(n=>n===0)));
 a.ws.send('{');assert.equal((await a.next('error')).code,'BAD_MESSAGE');
 a.send({type:'input',seq:1,controlEpoch:w.controlEpoch,x:2,y:0,held:0,pressed:0,released:0});assert.equal((await a.next('error')).code,'BAD_MESSAGE');
 a.send({type:'input',seq:1,controlEpoch:w.controlEpoch,x:0,y:0,held:0,pressed:0,released:0,score:999});assert.equal((await a.next('error')).code,'BAD_MESSAGE');
 const wrong=new WebSocket(server.url.replace('http:','ws:')+'/ws',{origin:'https://wrong.example'});
 const status=await new Promise(resolve=>{wrong.on('unexpected-response',(_,r)=>{r.resume();resolve(r.statusCode);wrong.terminate();});wrong.on('error',()=>{});});assert.equal(status,403);
});
