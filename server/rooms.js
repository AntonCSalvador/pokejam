import {randomBytes} from 'node:crypto';
import {createMatch,stepMatch} from '../public/game/simulation.js';
import {chooseBotInput} from '../public/game/bots.js';
import {A,DT,neutral,getTeam,defaultSelection,validateSelection} from '../public/game/data.js';
const id=()=>randomBytes(12).toString('base64url'),token=()=>randomBytes(32).toString('base64url');
const fields={create:[],inspect:['roomId'],join:['roomId','slot'],claim:['slot'],selectTeam:['side','teamKey'],selectPlayer:['slot','playerKey'],start:[],input:['seq','controlEpoch','x','y','held','pressed','released','turboActions'],reconnect:['roomId','token'],rematch:[]};
function valid(m){
 if(!m||typeof m!=='object'||Array.isArray(m)||!Object.hasOwn(fields,m.type))return false;
 const keys=fields[m.type];if(Object.keys(m).length!==keys.length+1||keys.some(k=>!Object.hasOwn(m,k)))return false;
 if('roomId'in m&&(typeof m.roomId!=='string'||!/^[A-Za-z0-9_-]{16}$/.test(m.roomId)))return false;
 if('slot'in m&&(!Number.isInteger(m.slot)||m.slot<0||m.slot>3))return false;
 if('side'in m&&m.side!==0&&m.side!==1)return false;
 for(const key of ['teamKey','playerKey'])if(key in m&&(typeof m[key]!=='string'||m[key].length>32))return false;
 if('token'in m&&(typeof m.token!=='string'||m.token.length!==43))return false;
 if(m.type==='input')return ['seq','controlEpoch','held','pressed','released','turboActions'].every(k=>Number.isSafeInteger(m[k])&&m[k]>=0)&&m.seq>0&&(m.turboActions&~(A.PASS|A.SHOOT))===0&&(m.turboActions&~m.pressed)===0&&m.turboActions<=6&&['held','pressed','released'].every(k=>m[k]<=31)&&['x','y'].every(k=>Number.isFinite(m[k])&&Math.abs(m[k])<=1);
 return true;
}
const copy=m=>structuredClone(m);
export function createRooms({now=Date.now,matchFactory=createMatch}={}){
 const rooms=new Map(),connections=new Map();let order=0;
 const error=(c,code,message=code.replaceAll('_',' ').toLowerCase())=>c.send({type:'error',code,message});
 const captain=(room,side)=>room.slots.filter(s=>s?.connection&&Math.floor(s.slot/2)===side).sort((a,b)=>a.order-b.order)[0]??room.host;
 function lobby(room){return {type:'lobby',roomId:room.id,host:room.host?.slot??null,started:!!room.match,teamKeys:[...room.selection.teamKeys],playerKeys:[...room.selection.playerKeys],captains:[0,1].map(side=>captain(room,side)?.slot??null),slots:room.slots.map((s,slot)=>({slot,state:!s?'ai':!s.connection?'reserved':s.pending?'pending':'human'}))};}
 function broadcast(room){for(const s of room.slots)if(s?.connection)connections.get(s.connection)?.send(lobby(room));}
 function welcome(c,s){c.send({type:'welcome',roomId:s.room.id,token:s.token,slot:s.slot,controlEpoch:s.epoch});c.send(lobby(s.room));}
 function attach(c,room,slot){
  const s={room,slot,token:token(),connection:c.id,epoch:1,order:++order,queue:[],seq:0,ack:0,last:neutral(),lastAt:now(),until:0,pending:room.match?.phase==='live'||room.match?.phase==='buzzer'};
  c.session=s;room.slots[slot]=s;room.emptyAt=null;if(!room.host?.connection)room.host=s;welcome(c,s);broadcast(room);
 }
 function changeEpoch(s){for(const p of s.room.match?.players||[])if(p.id===s.slot||p.bot.passRequest?.from===s.slot)p.bot.passRequest=null;s.epoch++;s.seq=0;s.ack=0;s.queue=[];s.last=neutral();s.lastAt=now();}
 function receive(cid,m){
  const c=connections.get(cid);if(!c)return;
  c.activeAt=now();if(c.replaced){error(c,'SESSION_REPLACED','This session moved to another tab.');return;}
  if(!valid(m)){error(c,'BAD_MESSAGE','Invalid controls or room request.');return;}
  if(now()-c.rateAt>=1000){c.rateAt=now();c.rate=0;}
  if(++c.rate>120){error(c,'RATE_LIMIT','Too many requests.');return;}
  if(m.type==='inspect'){const room=rooms.get(m.roomId);if(!room)error(c,'ROOM_GONE','Room ended. Create a new room.');else c.send(lobby(room));return;}
  if(m.type==='create'){
   if(c.session){error(c,'ALREADY_JOINED');return;}if(rooms.size>=16){error(c,'SERVER_BUSY','All courts are busy. Try again shortly.');return;}
   const room={id:id(),slots:[null,null,null,null],host:null,match:null,selection:defaultSelection(),emptyAt:null};rooms.set(room.id,room);attach(c,room,0);return;
  }
  if(m.type==='join'){
   if(c.session){error(c,'ALREADY_JOINED');return;}const room=rooms.get(m.roomId);if(!room){error(c,'ROOM_GONE','Room ended. Create a new room.');return;}
   if(room.slots[m.slot]){error(c,room.slots.every(Boolean)?'ROOM_FULL':'SLOT_TAKEN','That spot was taken. Pick an AI spot.');return;}
   attach(c,room,m.slot);return;
  }
  if(m.type==='reconnect'){
   if(c.session){error(c,'ALREADY_JOINED');return;}
   const room=rooms.get(m.roomId);if(!room){error(c,'ROOM_GONE','Room ended. Create a new room.');return;}
   const s=room.slots.find(s=>s&&s.token===m.token&&(s.connection||s.until>now()));if(!s){error(c,'SESSION_EXPIRED','Reservation expired. Pick an available spot.');return;}
   const previous=connections.get(s.connection);if(previous){previous.replaced=true;error(previous,'SESSION_REPLACED','This session moved to another tab.');}
   s.connection=c.id;s.token=token();s.until=0;changeEpoch(s);c.session=s;room.emptyAt=null;if(!room.host?.connection)room.host=s;welcome(c,s);broadcast(room);return;
  }
  const s=c.session;if(!s||s.connection!==cid){error(c,'NOT_JOINED');return;}const room=s.room;
  if(m.type==='selectTeam'||m.type==='selectPlayer'){
   const reject=(code,message)=>{error(c,code,message);c.send(lobby(room));};
   if(room.match){reject('MATCH_STARTED','Lineups are locked until the host returns to selection.');return;}
   const next=copy(room.selection),side=m.type==='selectTeam'?m.side:Math.floor(m.slot/2);
   if(m.type==='selectTeam'){
    if(captain(room,side)!==s){reject('CAPTAIN_ONLY','Only this side’s captain can choose its team.');return;}
    const team=getTeam(m.teamKey);
    if(!team||next.teamKeys[1-side]===m.teamKey){reject('BAD_SELECTION','Choose a different available team.');return;}
    if(next.teamKeys[side]===m.teamKey){c.send(lobby(room));return;}
    if(room.slots.slice(side*2,side*2+2).some(p=>p&&p!==s)){reject('TEAM_LOCKED','A teammate or reserved player is on this side. Keep their team or choose another side.');return;}
    next.teamKeys[side]=m.teamKey;next.playerKeys.splice(side*2,2,...team.roster.slice(0,2));
   }else{
    const occupant=room.slots[m.slot];
    if((occupant&&occupant!==s)||(!occupant&&captain(room,side)!==s)){reject('PLAYER_LOCKED','Choose your player or an AI spot controlled by your captain.');return;}
    if(!getTeam(next.teamKeys[side]).roster.includes(m.playerKey)){reject('BAD_SELECTION','Choose a Pokémon from this team.');return;}
    if(next.playerKeys[m.slot]===m.playerKey){c.send(lobby(room));return;}
    const mate=m.slot^1;
    if(next.playerKeys[mate]===m.playerKey){
     if(room.slots[mate]){reject('PLAYER_LOCKED','That Pokémon belongs to a human or reserved player.');return;}
     next.playerKeys[mate]=next.playerKeys[m.slot];
    }
    next.playerKeys[m.slot]=m.playerKey;
   }
   if(!validateSelection(next)){reject('BAD_SELECTION','Choose two different Pokémon from each team.');return;}
   room.selection=next;broadcast(room);return;
  }
  if(m.type==='claim'){
   if(room.match){error(c,'MATCH_STARTED');return;}if(room.slots[m.slot]&&room.slots[m.slot]!==s){error(c,'SLOT_TAKEN');return;}
   room.slots[s.slot]=null;s.slot=m.slot;room.slots[s.slot]=s;changeEpoch(s);welcome(c,s);broadcast(room);return;
  }
  if(m.type==='start'||m.type==='rematch'){
   if(room.host!==s){error(c,'HOST_ONLY');return;}
   if(m.type==='start'&&!room.match){room.match=matchFactory({seed:randomBytes(4).readUInt32LE(),selection:room.selection});}
   else if(m.type==='rematch'&&room.match?.phase==='finished'){room.match=null;for(const p of room.slots)if(p){p.pending=false;changeEpoch(p);if(p.connection)welcome(connections.get(p.connection),p);}}
   else {error(c,'WRONG_PHASE');return;}broadcast(room);return;
  }
  if(m.type==='input'){
   if(m.controlEpoch!==s.epoch){error(c,'STALE_CONTROL');return;}
   if(m.seq<=s.seq)return;
   if(!room.match||s.pending)return;
   // Identical held frames carry no new intent. Keep every action edge.
   const tail=s.queue.at(-1),heldOnly=i=>!(i.pressed||i.released||i.turboActions);
   if(tail&&heldOnly(tail)&&heldOnly(m)&&['x','y','held'].every(k=>tail[k]===m[k])){s.queue[s.queue.length-1]=m;s.seq=m.seq;s.lastAt=now();return;}
   if(s.queue.length>=15){error(c,'INPUT_BACKLOG','Connection is catching up.');return;}
   s.seq=m.seq;s.lastAt=now();s.queue.push(m);
  }
 }
 function disconnect(cid){
  const c=connections.get(cid);if(!c)return;const s=c.session;connections.delete(cid);
  if(!s||s.connection!==cid)return;
  s.connection=null;s.until=now()+60000;s.queue=[];s.last=neutral();
  const room=s.room;if(room.host===s)room.host=room.slots.filter(s=>s?.connection).sort((a,b)=>a.order-b.order)[0]??null;
  if(!room.slots.some(s=>s?.connection))room.emptyAt=now();broadcast(room);
 }
 function tick(){
  for(const room of rooms.values()){
   for(let i=0;i<4;i++){const s=room.slots[i];if(s&&!s.connection&&s.until<=now()){room.slots[i]=null;broadcast(room);}}
   if(room.emptyAt!==null&&now()-room.emptyAt>=120000){rooms.delete(room.id);continue;}
   const m=room.match;if(!m)continue;
   const inputs=new Map(),handled=new Set();
   for(const s of room.slots)if(s?.pending&&['deadball','countdown','finished'].includes(m.phase)){s.pending=false;changeEpoch(s);if(s.connection)welcome(connections.get(s.connection),s);broadcast(room);}
   // Transfer controls before identifying which slots are currently covered by AI.
   for(let slot=0;slot<4;slot++){
    const s=room.slots[slot];if(!s?.connection||s.pending||handled.has(s))continue;handled.add(s);
    let input;
    if(now()-s.lastAt>=250){s.queue=[];s.ack=s.seq;s.last=neutral();input=neutral();}
    else if(s.queue.length){input=s.queue.shift();s.ack=input.seq;s.last={...input,pressed:0,released:0,turboActions:0};}
    else input={...s.last,pressed:0,released:0,turboActions:0};
    if((input.pressed&A.SWITCH)&&!room.slots[slot^1]){
     room.slots[slot]=null;s.slot=slot^1;room.slots[s.slot]=s;changeEpoch(s);welcome(connections.get(s.connection),s);broadcast(room);inputs.set(s.slot,neutral());
    }else inputs.set(slot,input);
   }
   const ai=new Set(m.players.filter(p=>!room.slots[p.id]?.connection||room.slots[p.id].pending).map(p=>p.id));
   for(const p of m.players){
    const request=p.bot.passRequest;
    if(!request||!ai.has(p.id)||ai.has(request.from)||m.phase!=='live'||m.ball.mode!=='held'||m.ball.holder!==p.id||m.tick>=request.untilTick)p.bot.passRequest=null;
   }
   for(const [slot,input] of inputs){
    const p=m.players[slot],mate=m.players[slot^1];
    const startsDash=(input.pressed&A.SPECIAL)&&p.ability==='dash'&&p.meter>=100&&(!p.power||(p.power.kind!=='windup'&&p.power.ms<=DT*1000));
    if(!startsDash&&m.phase==='live'&&(input.pressed&A.PASS)&&!(input.turboActions&A.PASS)&&!p.stunMs&&!p.recoveryMs&&!p.flight&&!p.knockback&&ai.has(mate.id)&&m.ball.mode==='held'&&m.ball.holder===mate.id){
     mate.bot.passRequest={from:p.id,untilTick:m.tick+18};inputs.set(slot,{...input,pressed:input.pressed&~(A.PASS|A.SHOOT),turboActions:input.turboActions&~(A.PASS|A.SHOOT)});
    }
   }
   for(const slot of ai)inputs.set(slot,chooseBotInput(m,slot));
   stepMatch(m,inputs);
   if(m.tick%3===0||m.phase==='finished')for(const s of room.slots)if(s?.connection){connections.get(s.connection)?.send({type:'snapshot',match:copy(m),slot:s.slot,controlEpoch:s.epoch,ackSeq:s.ack,pending:s.pending});}
  }
 }
 return {connect(send){const cid=id();connections.set(cid,{id:cid,send,session:null,activeAt:now(),rateAt:now(),rate:0,replaced:false});return cid;},receive,disconnect,tick};
}
