// Independent clients with 75 ms delay each direction, including control edges.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
import {startServer} from '../server/index.js';
import {chooseBotInput} from '../public/game/bots.js';
import {A,neutral} from '../public/game/data.js';
import {live,giveBall} from './gameplay-fixtures.js';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label='latency condition',timeout=10000){const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw Error(label);await wait(10);}}
function stateHash(m){const state={...m,players:m.players.map(({bot,...p})=>p)};return createHash('sha256').update(JSON.stringify(state)).digest('hex');}
const totals={},scenarios=[];
function group(server){
 const clients=[],timers=new Set(),events=new Set(),counts={};
 function later(fn){const timer=setTimeout(()=>{timers.delete(timer);fn();},75);timers.add(timer);}
 async function client(){
  const ws=new WebSocket(server.url.replace('http:','ws:')+'/ws',{origin:server.url}),c={ws,welcome:null,latest:null,seq:0,ticks:new Map(),errors:[]};clients.push(c);
  c.send=m=>later(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(m));});
  c.input=fields=>c.send({type:'input',...neutral(),...fields,seq:++c.seq,controlEpoch:c.welcome.controlEpoch});
  ws.on('message',data=>later(()=>{
   const m=JSON.parse(data);if(m.type==='welcome'){c.welcome=m;c.seq=0;}if(m.type==='lobby')c.lobby=m;if(m.type==='error')c.errors.push(m.code);
   if(m.type==='snapshot'){
    // Hash the complete serialized authority before local bot memory changes.
    c.ticks.set(m.match.tick,stateHash(m.match));c.latest=m;
    if(c===clients[0])for(const e of m.match.events)if(!events.has(e.id)){
     events.add(e.id);const key=e.kind==='pass'?`${e.tier}-pass`:e.kind==='dunk'?`${e.tier}-dunk`:e.kind;
     counts[key]=(counts[key]||0)+1;if(e.posterized!==undefined)counts.posterized=(counts.posterized||0)+1;
    }
   }
  }));
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});return c;
 }
 return {clients,counts,client,
  async create(aiSlot=-1,selected=false){
   const host=await client();host.send({type:'create'});await until(()=>host.welcome);
   if(selected){host.send({type:'selectTeam',side:0,teamKey:'boston'});host.send({type:'selectTeam',side:1,teamKey:'golden-state'});await until(()=>host.lobby?.teamKeys.join(',')==='boston,golden-state');host.send({type:'selectPlayer',slot:1,playerKey:'breloom'});host.send({type:'selectPlayer',slot:3,playerKey:'drednaw'});await until(()=>host.lobby.playerKeys[1]==='breloom'&&host.lobby.playerKeys[3]==='drednaw');}
   for(let slot=1;slot<4;slot++){if(slot===aiSlot)continue;const c=await client();c.send({type:'join',roomId:host.welcome.roomId,slot});await until(()=>c.welcome);}return host;
  },
  compare(){const common=[...clients[0].ticks.keys()].filter(t=>clients.every(c=>c.ticks.has(t)));assert.ok(common.length>0);for(const tick of common)assert.equal(new Set(clients.map(c=>c.ticks.get(tick))).size,1,`full authoritative state differs at ${tick}`);for(const c of clients)assert.deepEqual(c.errors,[]);return common.length;},
  async close(){for(const timer of timers)clearTimeout(timer);clients.forEach(c=>c.ws.terminate());await server.close();}
 };
}
function setup(name){
 const m=live();Object.assign(m.players[0],{x:50,y:28});Object.assign(m.players[1],{x:80,y:35});giveBall(m,0);
 if(name.includes('dunk')||name==='posterized'){Object.assign(m.players[0],{x:name==='running-dunk'||name==='turbo-dunk'?81:90,y:28});giveBall(m,0);}
 if(name==='shove'){Object.assign(m.players[2],{x:54,y:28});giveBall(m,2);}
 if(name==='block'){Object.assign(m.players[0],{x:90,y:28});Object.assign(m.players[2],{x:93,y:28});giveBall(m,0);}
 if(name==='posterized')Object.assign(m.players[2],{x:94,y:30});
 if(name==='call'){giveBall(m,1);m.players[1].bot.input=neutral();}
 return m;
}
for(const name of ['normal-pass','turbo-pass','shove','standing-dunk','running-dunk','turbo-dunk','block','posterized','call']){
 const g=group(await startServer({matchFactory:()=>setup(name)}));let movement;
 try{
  const host=await g.create(name==='call'?1:-1);host.send({type:'start'});await until(()=>host.latest?.match.phase==='live');
  if(name==='running-dunk'||name==='turbo-dunk'){host.input({x:1});movement=setInterval(()=>host.input({x:1}),100);await until(()=>host.latest.match.players[0].runUpMs>=150,'run-up');}
  if(name==='block')g.clients.find(c=>c.welcome.slot===2).input({pressed:A.SHOOT});
  if(name.includes('pass')||name==='shove'||name==='call')host.input({pressed:A.PASS,turboActions:name==='turbo-pass'||name==='shove'?A.PASS:0});
  else host.input({x:name==='running-dunk'||name==='turbo-dunk'?1:0,pressed:A.SHOOT,turboActions:name==='turbo-dunk'?A.SHOOT:0});
  const key=name==='call'?'normal-pass':name;await until(()=>g.counts[key]>0,`missing ${name}`);if(name.includes('dunk'))await until(()=>g.counts.score>0,`${name} never scored`);
  if(name==='call'){assert.equal(host.latest.match.events.findLast(e=>e.kind==='pass').player,1);g.counts['AI-call']=1;}
  await wait(200);const common=g.compare();scenarios.push({name,commonTicks:common,counts:{...g.counts}});for(const [k,v] of Object.entries(g.counts))totals[k]=(totals[k]||0)+v;
  console.log(`PASS delayed ${name}: ${common} common ticks`);
 }finally{clearInterval(movement);await g.close();}
}
const g=group(await startServer());let inputLoop,progress;
try{
 const host=await g.create(-1,true);host.send({type:'start'});
 inputLoop=setInterval(()=>{for(const c of g.clients){const s=c.latest;if(!s)continue;const m=s.match,p=m.players[s.slot];let input=neutral();
  if(m.phase==='live'||m.phase==='buzzer'){
   input=chooseBotInput(m,s.slot);
   // The round trip adds ~150 ms to timed release observations.
   if(m.ball.mode==='held'&&m.ball.holder===s.slot&&p.chargeMs>0){input={...input,x:0,y:0,pressed:0,turboActions:0,held:p.chargeMs<300?A.SHOOT:0,released:p.chargeMs>=300?A.SHOOT:0};}
  }
  c.input(input);
 }},1000/60);
 progress=setInterval(()=>console.log('150 ms RTT match:',host.latest?.match.phase,host.latest?.match.score,Math.round((host.latest?.match.remainingMs||0)/1000)),30000);
 await until(()=>g.clients.every(c=>c.latest?.match.phase==='finished'),'full delayed match',300000);clearInterval(inputLoop);
 const common=g.compare();assert.ok(common>3000);assert.deepEqual(host.latest.match.teamKeys,['boston','golden-state']);assert.deepEqual(host.latest.match.players.map(p=>p.key),['celebi','breloom','wartortle','drednaw']);
 for(const [k,v] of Object.entries(g.counts))totals[k]=(totals[k]||0)+v;
 for(const required of ['normal-pass','turbo-pass','shove','standing-dunk','running-dunk','turbo-dunk','block','posterized','AI-call'])assert.ok(totals[required]>0,required);
 const result={delayEachWayMs:75,scenarios,commonTicks:common,score:host.latest.match.score,counts:totals,protocolErrors:g.clients.flatMap(c=>c.errors),comparison:'Complete match state except bot decision memory; SHA-256 per common tick'};
 await writeFile('docs/verification/arcade-selection/gameplay-latency-results.json',JSON.stringify(result,null,2)+'\n');console.log(`PASS four delayed clients: ${common} common ticks; final ${result.score}; complete authoritative state agrees; required actions observed; no protocol errors.`);
}finally{clearInterval(inputLoop);clearInterval(progress);await g.close();}
