import {A,PLAYERS,getTeam,neutral} from './game/data.js';
import {createMatch,stepMatch} from './game/simulation.js';
import {chooseBotInput} from './game/bots.js';
import {loadSprites,renderMatch,drawPortrait,setSoundMuted} from './render.js';
import {connectGame,reconcileLocal,sampleRemote,appendSnapshot,reconnectDelay} from './connection.js';
const $=id=>document.getElementById(id),canvas=$('court'),ctx=canvas.getContext('2d');
let assets={manifest:{},images:new Map(),failures:[]},session=null,connection=null,lobby=null,snapshot=null,seq=0,keys=new Set(),pressed=0,released=0,muted=true;
let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,demo=createMatch({seed:19}),frameTime=performance.now(),acc=0,viewTick=0;
let joiningRoom=new URLSearchParams(location.search).get('room'),lastFeedback=0;
let generation=0,retry=0,retryTimer=null,connected=false,pendingInputs=[],buffer=[],receivedAt=0,localPose=null;
const notice=(message)=>{$('notice').textContent=message;$('notice').hidden=!message;};
function saveSession(){try{sessionStorage.setItem('pokejam-session',JSON.stringify(session));}catch{}}
function clearControls(){keys.clear();pressed=released=0;if(session&&snapshot)sendInput();}
function input(){const i=neutral();i.x=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));i.y=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));for(const [key,bit]of Object.entries(buttons))if(keys.has(key))i.held|=bit;i.pressed=pressed;i.released=released;return i;}
function sendInput(){if(!connected||!session)return;const i={type:'input',...input(),seq:++seq,controlEpoch:session.controlEpoch};if(connection?.send(i)){pendingInputs.push(i);if(pendingInputs.length>120)pendingInputs.shift();}pressed=released=0;}
function resetPrediction(){seq=0;keys.clear();pressed=released=0;pendingInputs=[];localPose=null;}
function open(action){
 const current=++generation;clearTimeout(retryTimer);connected=false;connection?.close();
 $('connection-state').textContent='CONNECTING';
 connection=connectGame({onStatus(status){
  if(current!==generation)return;connected=status==='open';
  $('connection-state').textContent=connected?'COURT CONNECTED':status==='closed'?'RECONNECTING':'CONNECTING';
  if(connected)connection.send(action);
  if(status==='closed'){
   resetPrediction();notice('Connection lost. Reconnecting — AI covers your spot.');
   if(session||joiningRoom)retryTimer=setTimeout(()=>open(session?{type:'reconnect',roomId:session.roomId,token:session.token}:{type:'inspect',roomId:joiningRoom}),reconnectDelay(retry++));
   else{$('connection-state').textContent='OFFLINE';notice('Could not reach the court. Try opening a new court.');}
  }
 },onMessage(m){if(current===generation)onMessage(m);}});
}
function updateLobby(){
 if(!lobby)return;
 $('intro').hidden=true;$('lobby').hidden=!!snapshot;$('slots').replaceChildren();
 $('start').hidden=!session||lobby.host!==session.slot;$('start').disabled=!!lobby.started;
 $('lobby-hint').textContent=session?'Empty spots play as AI. Friends can join either side.':'Choose an available Pokémon to join this court.';
 for(const [slot,key] of lobby.playerKeys.entries()){const p={...PLAYERS[key],team:Math.floor(slot/2)},state=lobby.slots[slot].state,chosen=session?.slot===slot;const b=document.createElement('button');b.className='slot'+(chosen?' selected':'');b.disabled=!chosen&&state!=='ai';b.setAttribute('aria-label',`${p.name}, ${getTeam(lobby.teamKeys[p.team]).name}, ${chosen?'your player':state==='ai'?'available':state}`);
  const portrait=document.createElement('canvas');portrait.width=220;portrait.height=105;portrait.setAttribute('aria-hidden','true');drawPortrait(portrait.getContext('2d'),p.key,assets);
  const name=document.createElement('strong');name.textContent=p.name;const role=document.createElement('small');role.textContent=p.role+' · '+p.move;const ownership=document.createElement('em');ownership.textContent=chosen?'YOUR PLAYER':state==='ai'?'AI · CLICK TO PLAY':state==='reserved'?'RECONNECTING':state==='pending'?'JOINING':'HUMAN PLAYER';b.append(portrait,name,role,ownership);
  b.onclick=()=>{if(chosen)return;connection.send(session?{type:'claim',slot}:{type:'join',roomId:lobby.roomId,slot});};$('slots').append(b);
 }
}
function onMessage(m){
 if(m.type==='welcome'){session=m;retry=0;saveSession();joiningRoom=m.roomId;history.replaceState(null,'',`?room=${m.roomId}`);resetPrediction();buffer=[];notice('');}
 if(m.type==='lobby'){lobby=m;if(!m.started){snapshot=null;buffer=[];lastFeedback=0;resetPrediction();document.body.classList.remove('playing');$('player-bar').hidden=true;$('match-overlay').hidden=true;}updateLobby();}
 if(m.type==='snapshot'){
  const first=!snapshot;
  if(session&&session.controlEpoch!==m.controlEpoch)resetPrediction();
  if(snapshot&&(snapshot.match.phase!==m.match.phase||snapshot.match.ball.holder!==m.match.ball.holder))localPose=null;
  snapshot=m;if(appendSnapshot(buffer,m))receivedAt=performance.now();
  pendingInputs=pendingInputs.filter(i=>i.seq>m.ackSeq&&i.controlEpoch===m.controlEpoch);
  if(session){session.slot=m.slot;session.controlEpoch=m.controlEpoch;saveSession();}
  $('intro').hidden=true;$('lobby').hidden=true;$('player-bar').hidden=false;document.body.classList.add('playing');
  if(first){canvas.focus({preventScroll:true});document.querySelector('.arena').scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});}
  if(m.pending)notice('Joining at next stoppage');else if($('notice').textContent==='Joining at next stoppage')notice('');
  const feedback=m.match.events.findLast(e=>e.kind==='feedback'&&e.player===session?.slot&&e.id>lastFeedback);if(feedback){lastFeedback=feedback.id;notice(feedback.text);}
 }
 if(m.type==='error'){
  notice(m.message);if(m.code==='SLOT_TAKEN'&&joiningRoom)connection.send({type:'inspect',roomId:joiningRoom});
  if(['ROOM_GONE','SESSION_EXPIRED','SESSION_REPLACED'].includes(m.code)){
   session=null;saveSession();snapshot=null;buffer=[];resetPrediction();clearTimeout(retryTimer);document.body.classList.remove('playing');$('intro').hidden=false;$('lobby').hidden=true;$('player-bar').hidden=true;$('match-overlay').hidden=true;
   const room=joiningRoom;joiningRoom=null;++generation;connection?.close();connected=false;$('connection-state').textContent='CHOOSE A COURT';
   if(m.code==='SESSION_EXPIRED'&&room){joiningRoom=room;open({type:'inspect',roomId:room});}
  }
 }
}
const buttons={ShiftLeft:A.TURBO,ShiftRight:A.TURBO,KeyJ:A.PASS,KeyK:A.SHOOT,KeyL:A.SPECIAL,Space:A.SWITCH};
const moveKeys=['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
window.addEventListener('keydown',e=>{if(document.activeElement!==canvas||!snapshot||(!buttons[e.code]&&!moveKeys.includes(e.code)))return;e.preventDefault();if(!keys.has(e.code))pressed|=buttons[e.code]||0;keys.add(e.code);});
window.addEventListener('keyup',e=>{if(keys.has(e.code)){released|=buttons[e.code]||0;keys.delete(e.code);e.preventDefault();}});
window.addEventListener('blur',clearControls);canvas.addEventListener('blur',clearControls);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearControls();});canvas.onclick=()=>canvas.focus();
document.querySelector('.brand').onclick=e=>{
 e.preventDefault();++generation;clearTimeout(retryTimer);connected=false;connection?.close();connection=null;
 session=null;saveSession();joiningRoom=null;snapshot=lobby=null;buffer=[];retry=0;lastFeedback=0;resetPrediction();
 history.replaceState(null,'','/');document.body.classList.remove('playing');$('intro').hidden=false;$('lobby').hidden=true;$('player-bar').hidden=true;$('match-overlay').hidden=true;$('invite-fallback').hidden=true;
 $('connection-state').textContent='ARCADE BASKETBALL';$('court-status').textContent='THE INDIGO ARENA';notice('');
};
$('create').onclick=()=>{session=null;saveSession();open({type:'create'});notice('Opening your court…');};
$('join-form').onsubmit=e=>{e.preventDefault();let room=$('room-link').value.trim();try{if(room.includes('://'))room=new URL(room).searchParams.get('room');}catch{room=null;}if(!room||!/^[A-Za-z0-9_-]{16}$/.test(room)){notice('Paste a valid court link or 16-character code.');return;}session=null;saveSession();joiningRoom=room;open({type:'inspect',roomId:room});};
$('start').onclick=()=>{connection.send({type:'start'});setSoundMuted(muted);};
$('rematch').onclick=()=>connection.send({type:'rematch'});
$('invite').onclick=async()=>{const link=`${location.origin}/?room=${lobby.roomId}`;try{await navigator.clipboard.writeText(link);notice('Invite copied. Send it to your crew.');}catch{$('invite-fallback').hidden=false;$('invite-fallback').value=link;$('invite-fallback').select();}};
$('sound').onclick=()=>{muted=!muted;setSoundMuted(muted);$('sound').textContent=muted?'Sound off':'Sound on';$('sound').setAttribute('aria-pressed',String(muted));};
$('motion').onclick=()=>{reduced=!reduced;document.body.classList.toggle('reduced',reduced);$('motion').setAttribute('aria-pressed',String(reduced));};
function render(now){
 const elapsed=Math.min(100,now-frameTime);frameTime=now;acc+=elapsed;
 while(acc>=1000/60){if(!snapshot){if(demo.phase==='finished')demo=createMatch({seed:demo.seed+1});stepMatch(demo,new Map(demo.players.map(p=>[p.id,chooseBotInput(demo,p.id)])));}else if(session)sendInput();acc-=1000/60;}
 const authoritative=snapshot?.match;
 const m=authoritative?(sampleRemote(buffer,authoritative.tick+(now-receivedAt)*.06-6)||authoritative):demo;
 if(snapshot&&session){const predicted=reconcileLocal(snapshot,pendingInputs);if(localPose&&Math.hypot(predicted.x-localPose.x,predicted.y-localPose.y)<4){predicted.x=localPose.x+(predicted.x-localPose.x)*.55;predicted.y=localPose.y+(predicted.y-localPose.y)*.55;}localPose=predicted;}
 renderMatch(ctx,m,{assets,controlledSlot:session?.slot??-1,reducedMotion:reduced,localPose});
 if(++viewTick%6===0){
  const teams=m.teamKeys.map(getTeam);document.querySelectorAll('.scoreboard .team').forEach((el,i)=>{el.querySelector('span').textContent=teams[i].city.toUpperCase();el.querySelector('strong').textContent=teams[i].mascot.toUpperCase();el.style.color=teams[i].color;});
  $('chi-score').textContent=String(m.score[0]).padStart(2,'0');$('mia-score').textContent=String(m.score[1]).padStart(2,'0');const seconds=Math.ceil(m.remainingMs/1000);$('clock').textContent=m.overtime?'OT':`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  $('match-label').textContent=snapshot?(m.overtime?'NEXT BASKET WINS':'ONLINE · 2 ON 2'):'EXHIBITION PREVIEW';$('shot-clock').textContent=`SHOT CLOCK ${Math.ceil(m.shotClockMs/1000)}`;
  $('focus-hint').hidden=!snapshot||m.phase==='finished'||document.activeElement===canvas;
  const overlay=!!snapshot&&['countdown','finished'].includes(m.phase);$('match-overlay').hidden=!overlay;$('rematch').hidden=m.phase!=='finished'||lobby?.host!==session?.slot;
  if(overlay){$('overlay-title').textContent=m.phase==='countdown'?String(Math.ceil(m.phaseMs/1000)):teams[m.score[0]>m.score[1]?0:1].short+' WINS!';$('overlay-detail').textContent=m.phase==='countdown'?'Get ready to jam.':`${m.score[0]} — ${m.score[1]} · ${lobby?.host===session?.slot?'Run it back?':'Waiting for the host to rematch.'}`;}
  if(session&&snapshot){const p=m.players[session.slot];$('player-name').textContent=p.name;$('turbo').value=p.turbo;$('meter').value=p.meter;$('signature-name').textContent=p.move.toUpperCase();$('power-hint').textContent=p.meter>=100?'SIGNATURE READY · PRESS L':'Score, assist, steal, block. Fill your meter.';$('court-status').textContent=`YOU: ${p.name.toUpperCase()} · ${teams[p.team].short}`;}
 }
 requestAnimationFrame(render);
}
requestAnimationFrame(render);
try{const response=await fetch('/assets/sprites/manifest.json');if(!response.ok)throw new Error();assets=await loadSprites(await response.json());if(assets.failures.length)notice('Some sprites could not load. Labeled players remain playable. Reload to retry.');updateLobby();}catch{notice('Sprite art could not load. Labeled players remain playable. Reload to retry.');}
try{const saved=JSON.parse(sessionStorage.getItem('pokejam-session'));if(saved&&(!joiningRoom||joiningRoom===saved.roomId)){session=saved;joiningRoom=saved.roomId;}}catch{}
if(session)open({type:'reconnect',roomId:session.roomId,token:session.token});else if(joiningRoom)open({type:'inspect',roomId:joiningRoom});
