import {TEAMS,PLAYERS,getTeam} from './game/data.js';
import {drawPortrait} from './render.js';
const $=id=>document.getElementById(id);
const marks={
 bull:'M14 18 22 30 30 28 40 34 50 28 58 30 66 18 64 38 55 43 50 61 30 61 25 43 16 38Z M30 40 35 43 M45 43 50 40',
 flame:'M40 10C46 26 61 30 59 47C58 62 45 68 33 63C15 58 17 42 27 34L30 45C37 35 29 25 40 10Z',
 leaf:'M60 15C20 12 13 32 24 51C40 69 63 48 60 15Z M21 63 53 25 M30 48 29 31 M39 39 53 39',
 shell:'M28 17 52 17 65 35 60 57 40 67 20 57 15 35Z M28 17 31 36 15 35 M52 17 49 36 65 35 M31 36 49 36 53 52 40 60 27 52Z M27 52 20 57 M53 52 60 57',
 claw:'M20 16 31 20 25 36 17 61 13 60Z M40 12 49 18 42 36 32 63 28 61Z M59 17 67 24 59 39 47 64 43 61Z',
 wolf:'M17 14 34 28 46 28 63 14 60 47 40 66 20 47Z M25 36 35 41 28 44 M55 36 45 41 52 44 M34 51 46 51 40 59Z',
 crown:'M13 26 28 38 40 17 52 38 67 26 59 57 21 57Z M23 64 57 64'
};
function emblem(team){return `<svg class="team-emblem" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="38" fill="#1c1427" stroke="currentColor" stroke-width="2"/><path d="${marks[team.emblem]}" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="miter"/></svg>`;}
function paint(el,team){el.style.setProperty('--team-color',team.color);el.style.setProperty('--team-dark',team.dark);}
function portrait(key,width=160,height=140){return `<canvas width="${width}" height="${height}" data-portrait="${key}" aria-hidden="true"></canvas>`;}
const setText=(el,text)=>{if(el.textContent!==text)el.textContent=text;};

export function createMenu({onCreate,onJoin,onSend,onHome,onInvite}){
 let screen='home',side=0,slot=0,preview=null,data={},roomId=null,lastPhase=null,stamp='',rosterTeam=null;
 const teamGrid=$('team-grid'),seats=$('starter-slots'),playerGrid=$('player-grid');
 for(const team of TEAMS){
  const b=document.createElement('button');b.className='team-choice';b.dataset.teamKey=team.key;paint(b,team);
  b.innerHTML=`<span class="chosen-tag" hidden></span>${emblem(team)}<strong>${team.mascot.toUpperCase()}</strong><small>${team.city}</small>`;
  b.setAttribute('aria-label',team.name);b.onclick=()=>onSend({type:'selectTeam',side,teamKey:team.key});teamGrid.append(b);
 }
 for(let id=0;id<4;id++){
  const b=document.createElement('button');b.className='starter-slot';b.dataset.slot=id;
  b.innerHTML=portrait('tauros',90,75)+'<span><span class="seat-label"></span><strong></strong><small></small></span>';
  b.onclick=()=>{
   if(!data.lobby)return;
   slot=id;side=Math.floor(id/2);preview=data.lobby.playerKeys[id];
   if(!data.session){onSend({type:'join',roomId:data.lobby.roomId,slot:id});return;}
   renderPlayers();renderSeats();refreshPortraits();
  };seats.append(b);
 }
 document.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>{side=Number(b.dataset.side);renderTeams();});
 $('create').onclick=()=>{if($('create').disabled)return;$('create').disabled=true;setText($('create'),'OPENING COURT…');onCreate();};
 $('join-open').onclick=()=>show('join');$('help-open').onclick=()=>show('help');
 document.querySelectorAll('[data-home]').forEach(b=>b.onclick=onHome);
 $('join-form').onsubmit=e=>{
  e.preventDefault();let room=$('room-link').value.trim();try{if(room.includes('://'))room=new URL(room).searchParams.get('room');}catch{room=null;}
  if(!room||!/^[A-Za-z0-9_-]{16}$/.test(room)){setText($('notice'),'Paste a valid court link or 16-character code.');$('notice').hidden=false;return;}
  onJoin(room);
 };
 $('selection-next').onclick=()=>show(screen==='teams'?'players':'matchup');
 $('selection-back').onclick=back;
 $('claim-player').onclick=()=>onSend({type:'claim',slot});
 $('start').onclick=()=>onSend({type:'start'});$('rematch').onclick=()=>onSend({type:'rematch'});$('invite').onclick=onInvite;
 function back(){if(screen==='matchup'&&!data.match)show('players');else if(screen==='players'&&data.session&&!data.lobby?.started)show('teams');else if(!['game','results'].includes(screen))onHome();}
 function show(next){
  if(screen===next)return;
  screen=next;document.body.dataset.screen=next;
  document.querySelectorAll('.screen-page[data-screen]').forEach(el=>el.hidden=el.dataset.screen!==(next==='results'?'game':next));
  const selecting=['teams','players','matchup'].includes(next)&&!data.match;
  $('selection-nav').hidden=!selecting;$('room-tools').hidden=!selecting||!data.lobby;
  $('selection-next').hidden=next==='matchup';$('selection-next').disabled=!data.session||!!data.lobby?.started;
  setText($('selection-next'),next==='teams'?'CHOOSE PLAYERS':'SEE MATCHUP');
  setText($('selection-back'),next==='teams'||!data.session?'HOME':'BACK');
  setText($('step-label'),next==='teams'?'1 / 3 · TEAMS':next==='players'?'2 / 3 · PLAYERS':'3 / 3 · MATCHUP');
  document.body.classList.toggle('playing',['game','results'].includes(next));
  if(next==='players'&&data.lobby){renderSeats();renderPlayers();refreshPortraits();}
  if(next==='matchup'&&data.lobby){renderMatchup();refreshPortraits();}
  const target=next==='game'?$('court'):document.querySelector('.screen-page:not([hidden]) h1')??$('create');
  target?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
 }
 function refreshPortraits(){if(!data.assets)return;document.querySelectorAll('canvas[data-portrait]').forEach(c=>drawPortrait(c.getContext('2d'),c.dataset.portrait,data.assets));}
 function renderTeams(){
  const {lobby,session}=data;if(!lobby)return;
  const teams=lobby.teamKeys.map(getTeam),captain=session&&lobby.captains[side]===session.slot;
  const protectedSide=lobby.slots.slice(side*2,side*2+2).some(s=>s.state!=='ai'&&s.slot!==session?.slot);
  document.querySelectorAll('[data-side]').forEach(b=>{const i=Number(b.dataset.side);b.setAttribute('aria-pressed',String(i===side));setText(b,`SIDE ${i+1} · ${teams[i].short}`);});
  $('team-matchups').innerHTML=teams.map(t=>`<div class="team-preview" data-preview-team="${t.key}">${emblem(t)}<div><strong>${t.name.toUpperCase()}</strong><small>${t.roster.map(k=>PLAYERS[k].name).join(' · ')}</small></div></div>`).join('');
  $('team-matchups').querySelectorAll('[data-preview-team]').forEach(el=>paint(el,getTeam(el.dataset.previewTeam)));
  [...teamGrid.children].forEach(b=>{
   const selected=lobby.teamKeys[side]===b.dataset.teamKey,other=lobby.teamKeys[1-side]===b.dataset.teamKey;
   b.setAttribute('aria-pressed',String(selected));b.disabled=!!lobby.started||!captain||(!selected&&(protectedSide||other));
   const tag=b.querySelector('.chosen-tag'),index=lobby.teamKeys.indexOf(b.dataset.teamKey);tag.hidden=index===-1;setText(tag,`SIDE ${index+1}`);
  });
  setText($('team-hint'),!captain?'This side’s captain chooses its team.':protectedSide?'Team locked: a teammate or reserved player is on this side.':'Arrow keys to browse · Enter to select · Choose a different team on each side');
 }
 function renderSeats(){
  const {lobby,session}=data;if(!lobby)return;
  [...seats.children].forEach((b,i)=>{
   const p=PLAYERS[lobby.playerKeys[i]],team=getTeam(lobby.teamKeys[Math.floor(i/2)]),state=lobby.slots[i].state,own=session?.slot===i;
   paint(b,team);b.setAttribute('aria-pressed',String(i===slot));b.disabled=!session&&state!=='ai';
   const status=own?'YOU':state==='ai'?'AI':state==='reserved'?'RESERVED':state==='pending'?'JOINING':'HUMAN';
   setText(b.querySelector('.seat-label'),`P${i+1} · ${status}`);setText(b.querySelector('strong'),p.name);setText(b.querySelector('small'),team.name);
   b.querySelector('canvas').dataset.portrait=p.key;b.setAttribute('aria-label',`${p.name}, ${team.name}, ${own?'your player':state==='ai'?'available':state}`);
  });
  const full=!session&&lobby.slots.every(s=>s.state!=='ai');
  setText($('draft-hint'),full?'This court is full. Head home to open your own.':!session?'Choose an available slot to join your crew.':lobby.started?'Match in progress. Lineups are locked.':'Three on the roster. Two on the floor. Select a slot, then its Pokémon.');
  $('selection-next').disabled=!session||lobby.started;
 }
 function renderPlayers(){
  const {lobby,session}=data;if(!lobby)return;const targetSide=Math.floor(slot/2),team=getTeam(lobby.teamKeys[targetSide]);
  if(!team.roster.includes(preview))preview=lobby.playerKeys[slot];
  if(rosterTeam!==team.key){
   rosterTeam=team.key;playerGrid.replaceChildren();
   for(const key of team.roster){
    const p=PLAYERS[key],b=document.createElement('button');b.className='player-choice';b.dataset.playerKey=key;paint(b,team);
    b.innerHTML=portrait(key)+`<strong>${p.name}</strong><small>${p.role}</small><em></em>`;
    b.onfocus=b.onmouseenter=()=>{preview=key;renderRatings();};
    b.onclick=()=>{preview=key;onSend({type:'selectPlayer',slot,playerKey:key});};playerGrid.append(b);
   }
  }
  setText($('roster-name'),team.name.toUpperCase());
  const editable=session&&!lobby.started&&(session.slot===slot||(lobby.slots[slot].state==='ai'&&lobby.captains[targetSide]===session.slot));
  [...playerGrid.children].forEach(b=>{
   const selected=lobby.playerKeys[slot]===b.dataset.playerKey,onMate=lobby.playerKeys[slot^1]===b.dataset.playerKey,locked=onMate&&lobby.slots[slot^1].state!=='ai';
   b.disabled=!editable||locked;b.setAttribute('aria-pressed',String(selected));
   const label=selected?'IN THIS SLOT':locked?'PLAYER TAKEN':onMate?'SWAP WITH AI':'SELECT PLAYER';setText(b.querySelector('em'),label);b.setAttribute('aria-label',`${PLAYERS[b.dataset.playerKey].name}, ${label.toLowerCase()}`);
  });
  $('claim-player').hidden=!session||lobby.started||slot===session.slot||lobby.slots[slot].state!=='ai';
  setText($('claim-player'),`Play as P${slot+1} · ${PLAYERS[lobby.playerKeys[slot]].name}`);renderRatings();
 }
 function renderRatings(){
  const p=PLAYERS[preview];if(!p||!data.lobby)return;
  paint($('ratings'),getTeam(data.lobby.teamKeys[Math.floor(slot/2)]));
  $('ratings').innerHTML=`<h2>${p.name}</h2><p class="role">${p.role}</p>`+Object.entries(p.ratings).map(([name,value])=>`<div class="rating-row" aria-label="${name}: ${value} out of 10"><span>${name[0].toUpperCase()+name.slice(1)}</span><span class="rating-bars" aria-hidden="true">${Array.from({length:10},(_,i)=>`<i class="${i<value?'filled':''}"></i>`).join('')}</span><strong>${value}/10</strong></div>`).join('')+`<div class="signature-detail"><small>SIGNATURE · FULL METER + L</small><strong>${p.move}</strong><p>${p.description}</p></div>`;
 }
 function renderMatchup(){
  const {lobby,session,match}=data;if(!lobby)return;
  $('matchup-board').innerHTML=lobby.teamKeys.map((key,i)=>{
   const t=getTeam(key);return `${i?'<div class="versus" aria-hidden="true">VS</div>':''}<div class="matchup-team" data-matchup-team="${key}">${emblem(t)}<p class="city">${t.city.toUpperCase()}</p><h2>${t.mascot.toUpperCase()}</h2><div class="matchup-players">${lobby.playerKeys.slice(i*2,i*2+2).map(k=>{const p=PLAYERS[k];return `<div class="matchup-player">${portrait(k)}<strong>${p.name}</strong><small>SPD ${p.ratings.speed} · SHOT ${p.ratings.shooting}<br>DUNK ${p.ratings.dunk} · STEAL ${p.ratings.steal}</small></div>`;}).join('')}</div></div>`;
  }).join('');
  $('matchup-board').querySelectorAll('[data-matchup-team]').forEach(el=>paint(el,getTeam(el.dataset.matchupTeam)));
  $('start').hidden=!session||lobby.host!==session.slot||!!match;$('start').disabled=lobby.started;
  setText($('matchup-hint'),lobby.host===session?.slot?'Invite your crew or tip off. Empty slots play as AI.':'Your host starts the game.');
 }
 function update(next){
  const previousSession=data.session,previousLobby=data.lobby;data=next;
  if(next.ready!==undefined){$('create').disabled=!next.ready||!!next.busy;setText($('create'),!next.ready?'LOADING ROSTER…':next.busy?'OPENING COURT…':'PLAY');}
  if(next.session?.slot!==previousSession?.slot&&next.session){slot=next.session.slot;side=Math.floor(slot/2);preview=null;}
  const phase=next.match?.phase??null;
  if(next.lobby){
   if(roomId!==next.lobby.roomId){roomId=next.lobby.roomId;slot=next.session?.slot??0;side=Math.floor(slot/2);preview=null;show(next.session?'teams':'players');}
   if(phase!==lastPhase){if(phase==='countdown')show('matchup');else if(phase==='finished')show('results');else if(phase)show('game');else if(lastPhase)show('players');}
   else if(!phase&&previousLobby?.started&&!next.lobby.started)show('players');
   const newStamp=JSON.stringify([next.lobby,next.session?.slot,phase,Object.keys(next.assets?.manifest??{}).length]);
   if(stamp!==newStamp){stamp=newStamp;renderTeams();renderSeats();renderPlayers();renderMatchup();refreshPortraits();}
   $('countdown').hidden=phase!=='countdown';$('matchup-actions').hidden=phase==='countdown';
   if(phase==='countdown')setText($('countdown'),`TIP-OFF IN ${Math.ceil(next.match.phaseMs/1000)}`);
   $('selection-nav').hidden=!!phase||!['teams','players','matchup'].includes(screen);$('room-tools').hidden=$('selection-nav').hidden;
  }else{roomId=null;stamp='';lastPhase=null;if(previousLobby)show('home');refreshPortraits();}
  lastPhase=phase;
 }
 window.addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea,select')||e.target.isContentEditable||['game','results'].includes(screen)||data.match)return;
  if(e.code==='Escape'){e.preventDefault();back();return;}
  if(screen==='home'&&e.code==='Enter'&&!e.target.closest('button,a')){e.preventDefault();$('create').click();return;}
  if(!e.code.startsWith('Arrow'))return;
  const group=e.target.closest('#team-grid,#player-grid,#starter-slots,.side-tabs');if(!group)return;
  const choices=[...group.querySelectorAll('button:not(:disabled)')],index=choices.indexOf(e.target);if(index<0)return;
  e.preventDefault();const delta=e.code==='ArrowLeft'||e.code==='ArrowUp'?-1:1;choices[(index+delta+choices.length)%choices.length]?.focus();
 });
 return {show,update};
}
