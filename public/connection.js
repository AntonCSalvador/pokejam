import {DT} from './game/data.js';
import {movePlayer} from './game/simulation.js';
export const reconnectDelay=attempt=>Math.min(5000,500*2**Math.min(10,Math.max(0,attempt)));
export function reconcileLocal(snapshot,pendingInputs){
 const p=structuredClone(snapshot.match.players[snapshot.slot]);
 if(snapshot.pending||!['live','buzzer'].includes(snapshot.match.phase))return p;
 for(const input of pendingInputs)if(input.seq>snapshot.ackSeq&&input.controlEpoch===snapshot.controlEpoch)movePlayer(p,input,DT,snapshot.match.players);
 return p;
}
export function appendSnapshot(buffer,snapshot){
 if(buffer.length&&snapshot.match.tick<=buffer.at(-1).match.tick)return false;
 buffer.push(snapshot);if(buffer.length>12)buffer.shift();return true;
}
export function sampleRemote(buffer,targetTick){
 if(!buffer.length)return null;
 const upper=buffer.findIndex(s=>s.match.tick>targetTick);
 if(upper===-1)return structuredClone(buffer.at(-1).match);
 if(upper===0)return structuredClone(buffer[0].match);
 const a=buffer[upper-1].match,b=buffer[upper].match,result=structuredClone(a);
 if(a.phase!==b.phase)return result;
 const t=(targetTick-a.tick)/(b.tick-a.tick),lerp=(x,y)=>x+(y-x)*t;
 result.tick=targetTick;
 for(const p of result.players){const q=b.players[p.id];for(const key of ['x','y','z','ageMs'])p[key]=lerp(p[key],q[key]);}
 const sameBall=a.ball.mode===b.ball.mode&&a.ball.holder===b.ball.holder&&a.ball.from===b.ball.from&&a.ball.kind===b.ball.kind&&a.ball.id===b.ball.id;
 if(sameBall)for(const key of ['x','y','z'])result.ball[key]=lerp(a.ball[key],b.ball[key]);
 return result;
}
export function connectGame({onMessage,onStatus}){
 const socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);
 socket.addEventListener('open',()=>onStatus('open'));
 socket.addEventListener('message',e=>{try{onMessage(JSON.parse(e.data));}catch(err){console.error('Unable to process game message',err);onStatus('error');}});
 socket.addEventListener('close',()=>onStatus('closed'));
 socket.addEventListener('error',()=>onStatus('error'));
 return {send(message){if(socket.readyState!==WebSocket.OPEN)return false;socket.send(JSON.stringify(message));return true;},close(){socket.close();}};
}
