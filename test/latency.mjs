// Four independent input clients, with 75 ms delay in each direction.
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {startServer} from '../server/index.js';
import {chooseBotInput} from '../public/game/bots.js';
import {A,neutral} from '../public/game/data.js';
const server=await startServer(),clients=[],timers=new Set();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function later(fn){const timer=setTimeout(()=>{timers.delete(timer);fn();},75);timers.add(timer);}
async function until(fn,timeout=10000){const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw Error('Latency test timed out');await wait(20);}}
async function client(){
 const ws=new WebSocket(server.url.replace('http:','ws:')+'/ws',{origin:server.url});const c={ws,welcome:null,latest:null,seq:0,ticks:new Map(),errors:[]};clients.push(c);
 c.send=m=>later(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(m));});
 ws.on('message',data=>later(()=>{const m=JSON.parse(data);if(m.type==='welcome')c.welcome=m;if(m.type==='lobby')c.lobby=m;if(m.type==='error')c.errors.push(m.code);if(m.type==='snapshot'){c.latest=m;c.ticks.set(m.match.tick,JSON.stringify([m.match.teamKeys,m.match.players.map(p=>[p.key,p.ability]),m.match.score,m.match.ball.holder??null,m.match.phase]));}}));
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});return c;
}
let inputLoop,progress;
try{
 const host=await client();host.send({type:'create'});await until(()=>host.welcome);
 host.send({type:'selectTeam',side:0,teamKey:'boston'});host.send({type:'selectTeam',side:1,teamKey:'golden-state'});await until(()=>host.lobby?.teamKeys.join(',')==='boston,golden-state');
 host.send({type:'selectPlayer',slot:1,playerKey:'breloom'});host.send({type:'selectPlayer',slot:3,playerKey:'drednaw'});await until(()=>host.lobby.playerKeys[1]==='breloom'&&host.lobby.playerKeys[3]==='drednaw');
 for(let slot=1;slot<4;slot++){const c=await client();c.send({type:'join',roomId:host.welcome.roomId,slot});await until(()=>c.welcome);}
 host.send({type:'start'});
 inputLoop=setInterval(()=>{for(const c of clients){const s=c.latest;if(!s)continue;const m=s.match,p=m.players[s.slot];let input=neutral();
  if(m.phase==='live'||m.phase==='buzzer'){
   input=chooseBotInput(m,s.slot);
   // Time releases from delayed charge observations: the round trip adds ~150 ms.
   if(m.ball.mode==='held'&&m.ball.holder===s.slot&&p.chargeMs>0){input.x=input.y=0;input.pressed=0;input.held=p.chargeMs<300?A.SHOOT:0;input.released=p.chargeMs>=300?A.SHOOT:0;}
  }
  c.send({type:'input',...input,seq:++c.seq,controlEpoch:c.welcome.controlEpoch});
 }},1000/60);
 progress=setInterval(()=>console.log('150 ms RTT match:',clients[0].latest?.match.phase,clients[0].latest?.match.score,Math.round((clients[0].latest?.match.remainingMs||0)/1000)),30000);
 await until(()=>clients.every(c=>c.latest?.match.phase==='finished'),300000);
 const common=[...clients[0].ticks.keys()].filter(t=>clients.every(c=>c.ticks.has(t)));assert.ok(common.length>3000);
 for(const tick of common)assert.equal(new Set(clients.map(c=>c.ticks.get(tick))).size,1,`clients disagree at ${tick}`);
 for(const c of clients)assert.deepEqual(c.errors,[]);
 assert.deepEqual(clients[0].latest.match.teamKeys,['boston','golden-state']);assert.deepEqual(clients[0].latest.match.players.map(p=>p.key),['celebi','breloom','wartortle','drednaw']);
 console.log(`PASS four delayed clients: ${common.length} common ticks; final score ${clients[0].latest.match.score}; identical franchises, species, abilities, score, ownership, phase; no protocol errors.`);
}finally{clearInterval(inputLoop);clearInterval(progress);for(const timer of timers)clearTimeout(timer);for(const c of clients)c.ws.terminate();await server.close();}
