import {A,getTeam,neutral} from './game/data.js';
import {createMatch,stepMatch} from './game/simulation.js';
import {chooseBotInput} from './game/bots.js';
import {loadSprites,renderMatch,drawPortrait,setSoundMuted} from './render.js';
import {connectGame,reconcileLocal,sampleRemote,appendSnapshot,reconnectDelay} from './connection.js';
import {createMenu} from './menu.js';
import {createControls} from './controls.js';
const controls=createControls();
const $=id=>document.getElementById(id),canvas=$('court'),ctx=canvas.getContext('2d'),attract=$('attract').getContext('2d');
let assets={manifest:{},images:new Map(),failures:[]},session=null,connection=null,lobby=null,snapshot=null,seq=0,muted=true,ready=false,busy=false;
let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,demo=createMatch({seed:19}),frameTime=performance.now(),acc=0,viewTick=0;
let joiningRoom=new URLSearchParams(location.search).get('room'),lastFeedback=0;
let finalPlayback=null,pendingSwitchSeq=null;
let generation=0,retry=0,retryTimer=null,connected=false,inputReady=false,pendingInputs=[],buffer=[],receivedAt=0,localPose=null;
const notice=message=>{$('notice').textContent=message;$('notice').hidden=!message;};
function saveSession(){try{sessionStorage.setItem('pokejam-session',JSON.stringify(session));}catch{}}
function syncMenu(){menu.update({lobby,session,match:snapshot?.match,assets,reduced,ready,busy});}
function clearControls(){controls.reset();if(session&&snapshot)sendInput();}
function sendInput(){if(!connected||!inputReady||!session)return;const i={type:'input',...controls.read(),seq:++seq,controlEpoch:session.controlEpoch};if(connection?.send(i)){pendingInputs.push(i);if(pendingInputs.length>120)pendingInputs.shift();if(i.pressed&A.SWITCH){pendingSwitchSeq=i.seq;inputReady=false;}}controls.consumeEdges();}
function resetPrediction(){seq=0;pendingSwitchSeq=null;controls.reset();pendingInputs=[];localPose=null;}
function open(action){
 const current=++generation;clearTimeout(retryTimer);connected=false;inputReady=false;connection?.close();
 $('connection-state').textContent='CONNECTING';
 connection=connectGame({onStatus(status){
  if(current!==generation)return;connected=status==='open';
  $('connection-state').textContent=connected?'COURT CONNECTED':status==='closed'?'RECONNECTING':'CONNECTING';
  if(connected)connection.send(action);
  if(status==='closed'){
   busy=false;resetPrediction();syncMenu();notice('Connection lost. Reconnecting — AI covers your spot.');
   if(session||joiningRoom)retryTimer=setTimeout(()=>open(session?{type:'reconnect',roomId:session.roomId,token:session.token}:{type:'inspect',roomId:joiningRoom}),reconnectDelay(retry++));
   else{$('connection-state').textContent='OFFLINE';notice('Could not reach the court. Try Play again.');}
  }
 },onMessage(m){if(current===generation)onMessage(m);}});
}
function onMessage(m){
 if(m.type==='welcome'){inputReady=true;session=m;busy=false;retry=0;saveSession();joiningRoom=m.roomId;history.replaceState(null,'',`?room=${m.roomId}`);resetPrediction();buffer=[];notice('');syncMenu();}
 if(m.type==='lobby'){lobby=m;busy=false;if(!m.started){snapshot=null;finalPlayback=null;buffer=[];lastFeedback=0;resetPrediction();$('player-bar').hidden=true;$('match-overlay').hidden=true;}syncMenu();}
 if(m.type==='snapshot'){
  if(pendingSwitchSeq!==null&&m.ackSeq>=pendingSwitchSeq){pendingSwitchSeq=null;inputReady=true;}
  if(snapshot&&snapshot.match.phase!==m.match.phase)controls.reset();
  if(session&&session.controlEpoch!==m.controlEpoch)resetPrediction();
  if(snapshot&&(snapshot.match.phase!==m.match.phase||snapshot.match.ball.holder!==m.match.ball.holder))localPose=null;
  if(m.match.phase==='finished'&&m.match.events.findLast(e=>e.kind==='score')?.posterized!==undefined){
   const key=`${m.match.seed}:${m.match.events.findLast(e=>e.kind==='score').id}`;if(finalPlayback?.key!==key)finalPlayback={key,at:performance.now()};
  }else finalPlayback=null;
  snapshot=m;if(appendSnapshot(buffer,m))receivedAt=performance.now();
  pendingInputs=pendingInputs.filter(i=>i.seq>m.ackSeq&&i.controlEpoch===m.controlEpoch);
  if(session){session.slot=m.slot;session.controlEpoch=m.controlEpoch;saveSession();}
  $('player-bar').hidden=false;syncMenu();
  if(m.pending)notice('Joining at next stoppage');else if($('notice').textContent==='Joining at next stoppage')notice('');
  const feedback=m.match.events.findLast(e=>e.kind==='feedback'&&e.player===session?.slot&&e.id>lastFeedback);if(feedback){lastFeedback=feedback.id;notice(feedback.text);}
 }
 if(m.type==='error'){
  busy=false;notice(m.message);if(m.code==='SLOT_TAKEN'&&joiningRoom)connection.send({type:'inspect',roomId:joiningRoom});
  if(['ROOM_GONE','SESSION_EXPIRED','SESSION_REPLACED'].includes(m.code)){
   session=null;saveSession();snapshot=lobby=null;finalPlayback=null;buffer=[];resetPrediction();clearTimeout(retryTimer);$('player-bar').hidden=true;$('match-overlay').hidden=true;
   const room=joiningRoom;joiningRoom=null;++generation;connection?.close();connected=false;$('connection-state').textContent='CHOOSE A COURT';
   if(m.code==='SESSION_EXPIRED'&&room){joiningRoom=room;open({type:'inspect',roomId:room});}
  }
  syncMenu();
 }
}
function home(){
 ++generation;clearTimeout(retryTimer);connected=false;inputReady=false;connection?.close();connection=null;
 session=null;saveSession();joiningRoom=null;snapshot=lobby=null;finalPlayback=null;buffer=[];retry=0;lastFeedback=0;busy=false;resetPrediction();
 history.replaceState(null,'','/');$('player-bar').hidden=true;$('match-overlay').hidden=true;$('invite-fallback').hidden=true;
 $('connection-state').textContent='THE INDIGO ARENA';notice('');syncMenu();menu.show('home');
}
const menu=createMenu({
 onCreate(){session=null;saveSession();joiningRoom=null;busy=true;syncMenu();open({type:'create'});notice('Opening your court…');},
 onJoin(room){session=null;saveSession();joiningRoom=room;busy=true;syncMenu();open({type:'inspect',roomId:room});notice('Finding your crew…');},
 onSend(message){if(message.type==='start')setSoundMuted(muted);connection?.send(message);},onHome:home,
 async onInvite(){if(!lobby)return;const link=`${location.origin}/?room=${lobby.roomId}`;try{await navigator.clipboard.writeText(link);notice('Invite copied. Send it to your crew.');}catch{$('invite-fallback').hidden=false;$('invite-fallback').value=link;$('invite-fallback').select();}}
});
window.addEventListener('keydown',e=>{if(document.activeElement===canvas&&snapshot&&controls.keyDown(e.code))e.preventDefault();});
window.addEventListener('keyup',e=>{if(controls.keyUp(e.code))e.preventDefault();});
window.addEventListener('blur',clearControls);canvas.addEventListener('blur',clearControls);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearControls();});canvas.onclick=()=>canvas.focus();
document.querySelector('.brand').onclick=e=>{e.preventDefault();home();};
$('sound').onclick=()=>{muted=!muted;setSoundMuted(muted);$('sound').textContent=muted?'Sound off':'Sound on';$('sound').setAttribute('aria-pressed',String(muted));};
$('motion').onclick=()=>{reduced=!reduced;document.body.classList.toggle('reduced',reduced);$('motion').setAttribute('aria-pressed',String(reduced));syncMenu();};
document.body.classList.toggle('reduced',reduced);$('motion').setAttribute('aria-pressed',String(reduced));
function render(now){
 const elapsed=Math.min(100,now-frameTime);frameTime=now;acc+=elapsed;
 while(acc>=1000/60){if(!snapshot){if(!reduced){if(demo.phase==='finished')demo=createMatch({seed:demo.seed+1});stepMatch(demo,new Map(demo.players.map(p=>[p.id,chooseBotInput(demo,p.id)])));}}else if(session)sendInput();acc-=1000/60;}
 const authoritative=snapshot?.match;
 const m=authoritative?.phase==='finished'?authoritative:authoritative?(sampleRemote(buffer,authoritative.tick+(now-receivedAt)*.06-6)||authoritative):demo;
 if(snapshot&&session&&(authoritative.players[session.slot].flight||authoritative.players[session.slot].knockback||m.players[session.slot].flight||m.players[session.slot].knockback)){localPose=null;}
 else if(snapshot&&session){const predicted=reconcileLocal(snapshot,pendingInputs);if(localPose&&Math.hypot(predicted.x-localPose.x,predicted.y-localPose.y)<4){predicted.x=localPose.x+(predicted.x-localPose.x)*.55;predicted.y=localPose.y+(predicted.y-localPose.y)*.55;}localPose=predicted;}
 const finishElapsedMs=finalPlayback?now-finalPlayback.at:0;
 const resultsReady=m.phase==='finished'&&(!finalPlayback||finishElapsedMs>=700);
 if(snapshot)renderMatch(ctx,m,{assets,controlledSlot:session?.slot??-1,reducedMotion:reduced,localPose,controlInput:controls.read(),finishElapsedMs});
 else if(document.body.dataset.screen==='home')renderMatch(attract,demo,{assets,reducedMotion:reduced});
 if(++viewTick%6===0){
  document.querySelectorAll('.screen-page:not([hidden]) canvas[data-portrait]').forEach(c=>drawPortrait(c.getContext('2d'),c.dataset.portrait,assets,reduced?0:now/16));
  if(snapshot){
   const teams=m.teamKeys.map(getTeam);document.querySelectorAll('.scoreboard .team').forEach((el,i)=>{el.querySelector('span').textContent=teams[i].city.toUpperCase();el.querySelector('strong').textContent=teams[i].mascot.toUpperCase();el.style.color=teams[i].color;});
   $('home-score').textContent=String(m.score[0]).padStart(2,'0');$('away-score').textContent=String(m.score[1]).padStart(2,'0');const seconds=Math.ceil(m.remainingMs/1000);$('clock').textContent=m.overtime?'OT':`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
   $('match-label').textContent=m.overtime?'NEXT BASKET WINS':'ONLINE · 2 ON 2';$('shot-clock').textContent=`SHOT CLOCK ${Math.ceil(m.shotClockMs/1000)}`;
   $('focus-hint').hidden=m.phase==='finished'||document.activeElement===canvas;
   $('match-overlay').hidden=!resultsReady;$('rematch').hidden=!resultsReady||lobby?.host!==session?.slot;
   if(m.phase==='finished'){$('overlay-title').textContent=teams[m.score[0]>m.score[1]?0:1].short+' WINS!';$('overlay-detail').textContent=`${m.score[0]} — ${m.score[1]} · ${lobby?.host===session?.slot?'Run it back?':'Waiting for the host to rematch.'}`;}
   if(session){const p=m.players[session.slot];$('player-name').textContent=p.name;$('turbo').value=p.turbo;$('meter').value=p.meter;$('signature-name').textContent=p.move.toUpperCase();$('power-hint').textContent=p.meter>=100?'SIGNATURE READY · PRESS L':'Score, assist, steal, block. Fill your meter.';$('court-status').textContent=`YOU: ${p.name.toUpperCase()} · ${teams[p.team].short}`;}
  }
 }
 requestAnimationFrame(render);
}
requestAnimationFrame(render);
try{const response=await fetch('/assets/sprites/manifest.json');if(!response.ok)throw new Error();assets=await loadSprites(await response.json());if(assets.failures.length)notice('Some sprites could not load. Labeled players remain playable. Reload to retry.');}catch{notice('Sprite art could not load. Labeled players remain playable. Reload to retry.');}
ready=true;syncMenu();
try{const saved=JSON.parse(sessionStorage.getItem('pokejam-session'));if(saved&&(!joiningRoom||joiningRoom===saved.roomId)){session=saved;joiningRoom=saved.roomId;}}catch{}
if(session)open({type:'reconnect',roomId:session.roomId,token:session.token});else if(joiningRoom)open({type:'inspect',roomId:joiningRoom});
