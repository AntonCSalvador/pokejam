import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {WebSocket} from 'ws';
import {startServer} from '../server/index.js';
import {live,giveBall} from './gameplay-fixtures.js';
import {A,TEAMS} from '../public/game/data.js';
const selected=new Set(process.argv.slice(2));
const out='docs/verification/arcade-selection';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[],results=[];let expectedBacklogRejections=0;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,timeout=7000){const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw Error(label);await wait(10);}}
function scenario(name){
 const m=live();m.seed=123;Object.assign(m.players[0],{x:50,y:28});Object.assign(m.players[1],{x:70,y:28});giveBall(m,0);
 if(name.includes('dunk')||name.includes('poster')){Object.assign(m.players[0],{x:name.includes('running')||name.includes('turbo')?81:90,y:28,turbo:name.includes('turbo')?100:0});giveBall(m,0);}
 if(name.includes('poster'))Object.assign(m.players[2],{x:94,y:30});
 if(name==='final-poster')m.overtime=true;
 if(name==='rematch'){Object.assign(m.players[0],{x:90,y:28});giveBall(m,0);m.overtime=true;}
 if(name==='blocked-dunk')Object.assign(m.players[2],{x:93,y:28});
 if(name.startsWith('shove')){Object.assign(m.players[2],{x:name==='shove-hit'?54:60,y:28});giveBall(m,2);}
 if(name.includes('pass')){m.players[0].x=30;m.players[1].x=80;giveBall(m,0);}
 if(name==='intercept')Object.assign(m.players[3],{x:60,y:28});
 if(name==='call')giveBall(m,1);
 return m;
}
async function run(name,body,{ai=false,reduced=false}={}){
 if(selected.size&&!selected.has(name))return;
 const server=await startServer({matchFactory:()=>scenario(name)}),context=await browser.newContext({viewport:{width:1280,height:960},reducedMotion:reduced?'reduce':'no-preference'}),page=await context.newPage(),peers=[];
 const state={latest:null,sent:[],snapshots:[],sockets:[],welcome:null,finishAt:null};
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text());});
 await page.routeWebSocket('**/ws',ws=>{const upstream=ws.connectToServer();state.sockets.push(ws);if(name==='rematch')upstream.onMessage(async data=>{await wait(75);if(!state.closed)ws.send(data);});ws.onMessage(data=>{const m=JSON.parse(data);if(name.startsWith('switch-')&&m.type==='input'&&(m.pressed&A.SWITCH)&&!state.droppedSwitch){state.droppedSwitch=true;if(name==='switch-backlog'){for(let n=0;n<15;n++)upstream.send(JSON.stringify({...m,seq:m.seq+n,pressed:A.SHOOT}));upstream.send(JSON.stringify({...m,seq:m.seq+15}));}return;}upstream.send(data);});});
 page.on('websocket',ws=>{ws.on('framesent',e=>state.sent.push(JSON.parse(e.payload)));ws.on('framereceived',e=>{const m=JSON.parse(e.payload);if(m.type==='welcome')state.welcome=m;if(m.type==='error'){if(name==='switch-backlog'&&m.code==='INPUT_BACKLOG'){state.expectedBacklog=true;expectedBacklogRejections++;}else errors.push(`${name}: ${m.code}`);}if(m.type==='snapshot'){state.latest=m;state.snapshots.push(m);if(m.match.phase==='finished')state.finishAt??=Date.now();}});});
 try{
  await page.goto(server.url);await page.locator('#create').click();await until(()=>state.welcome,'welcome');
  for(const slot of [1,2,3]){if(ai&&slot===1)continue;const ws=new WebSocket(server.url.replace('http:','ws:')+'/ws',{origin:server.url});const peer={ws,welcome:null,seq:0};ws.on('message',data=>{const m=JSON.parse(data);if(m.type==='welcome')peer.welcome=m;if(m.type==='error')errors.push(m.code);});await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'join',roomId:state.welcome.roomId,slot}));await until(()=>peer.welcome,'peer');peers.push(peer);}
  await page.keyboard.press('KeyJ');assert.equal(state.sent.some(m=>m.type==='input'),false,'menu excludes gameplay keys');
  await page.locator('#selection-next').click();await page.locator('#selection-next').click();await page.locator('#start').click();await until(()=>state.latest?.match.phase==='live','live');await page.locator('#court').focus();
  const send=(slot,fields)=>{const p=peers.find(p=>p.welcome.slot===slot);p.ws.send(JSON.stringify({type:'input',seq:++p.seq,controlEpoch:p.welcome.controlEpoch,x:0,y:0,held:0,pressed:0,released:0,turboActions:0,...fields}));};
  const event=kind=>state.latest.match.events.findLast(e=>e.kind===kind);
  const clip=await page.locator('#court').boundingBox();
  const capture=label=>page.screenshot({clip,path:`${out}/gameplay-${label}.png`,animations:'allow'});
  await body({page,state,send,event,capture});results.push(name);console.log('PASS',name);
 }finally{state.closed=true;peers.forEach(p=>p.ws.terminate());await context.close();await server.close();}
}
try{
 await run('rematch',async({page,state,event})=>{
  await page.locator('#player-bar').waitFor();await page.locator('#court').focus();
  await page.keyboard.press('KeyK');await until(()=>event('score'),'overtime score');await page.locator('#rematch').waitFor();
  const sent=state.sent.length;await wait(150);assert.equal(state.sent.length,sent,'finished clients send no gameplay inputs');
  const epoch=state.welcome.controlEpoch;await page.locator('#rematch').click();await page.locator('#players-screen').waitFor();await until(()=>state.welcome.controlEpoch>epoch,'new rematch epoch');
  await page.locator('#selection-next').click();await page.locator('#start').click();await until(()=>state.latest?.controlEpoch>epoch&&state.latest.match.phase==='live','rematch restarted');assert.deepEqual(state.latest.match.score,[0,0]);assert.deepEqual(errors,[],'rematch must stop old-epoch inputs before server resets controls');
 });
 for(const name of ['switch-dropped','switch-backlog'])await run(name,async({page,state})=>{
  const token=state.welcome.token;await page.keyboard.press('Space');await until(()=>state.droppedSwitch,'switch sent');
  await until(()=>state.welcome.token!==token,'unacknowledged switch must recover within three seconds',3000);
  if(name==='switch-backlog')assert.equal(state.expectedBacklog,true);
  await page.keyboard.down('KeyW');await until(()=>state.latest.match.players[0].vy<0,'controls resume');await page.keyboard.up('KeyW');
  assert.equal(state.latest.slot,0);assert.ok(state.latest.controlEpoch>1);
 });
 await run('held-dunk',async({page,state,event})=>{
  await page.keyboard.down('KeyK');await until(()=>event('score'),'score');await until(()=>state.latest.match.phase==='live','restart');
  const count=state.sent.filter(i=>i.type==='input'&&(i.pressed&A.SHOOT)).length;
  await page.keyboard.down('KeyK');await wait(150);assert.equal(state.sent.filter(i=>i.type==='input'&&(i.pressed&A.SHOOT)).length,count,'OS repeat after reset cannot create a fresh action');
  assert.equal(state.latest.match.players[0].jumpMs,0);await page.keyboard.up('KeyK');await page.keyboard.press('KeyK');await until(()=>state.latest.match.players[0].jumpMs>0,'release and repress acts again');
 });
 // This fails on the old presentation: the results immediately cover the fall.
 await run('final-poster',async({page,state,event,capture})=>{
  await page.keyboard.press('KeyK');await until(()=>event('score'),'final score');assert.equal(event('score').posterized,2);assert.equal(state.latest.match.phase,'finished');
  assert.equal(await page.locator('#match-overlay').isVisible(),false,'final fall must play before results');
  await capture('final-fall');await wait(Math.max(0,250-(Date.now()-state.finishAt)));assert.equal(await page.locator('#match-overlay').isVisible(),false);await capture('final-down');
  await wait(Math.max(0,525-(Date.now()-state.finishAt)));await capture('final-rise');await page.locator('#match-overlay').waitFor();assert.ok(Date.now()-state.finishAt>=700);assert.ok(Date.now()-state.finishAt<1500,'duplicate final snapshots cannot restart playback');
 });
 for(const name of ['normal-pass','turbo-pass','intercept','call'])await run(name,async({page,state,send,event,capture})=>{
  if(name!=='call')send(1,{y:1});
  if(name==='turbo-pass'){await page.keyboard.down('ShiftLeft');await page.keyboard.press('KeyJ');await page.keyboard.up('ShiftLeft');}else await page.keyboard.press('KeyJ');
  await until(()=>event('pass'),'pass');assert.equal(event('pass').tier,name==='turbo-pass'?'turbo':'normal');if(name==='call')assert.equal(event('pass').player,1);
  await wait(150);await capture(name);await until(()=>state.latest.match.ball.mode==='held','catch');assert.equal(state.latest.match.ball.holder,name==='intercept'?3:name==='call'?0:1);
  if(name==='call'){await page.keyboard.down('ShiftLeft');await page.keyboard.press('Space');await until(()=>state.latest.slot===1,'switch');await wait(70);assert.equal(state.sent.findLast(i=>i.type==='input').held,0);await page.keyboard.up('ShiftLeft');}
 },{ai:name==='call'});
 for(const name of ['shove-hit','shove-miss'])await run(name,async({page,state,event,capture})=>{
  // A quick chord, released before the next render/input frame, still shoves.
  await page.evaluate(()=>{for(const [type,code] of [['keydown','ShiftLeft'],['keydown','KeyJ'],['keyup','KeyJ'],['keyup','ShiftLeft']])document.activeElement.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true}));});
  await until(()=>event('shove'),'shove');assert.equal(event('shove').victim,name==='shove-hit'?2:null);assert.ok(state.latest.match.players[0].turbo<80);assert.equal(state.sent.findLast(i=>i.pressed&A.PASS).turboActions,A.PASS);
  if(name==='shove-hit'){assert.ok(state.latest.match.players[2].stunMs>0);assert.equal(state.latest.match.ball.mode,'loose');}
  await wait(100);await capture(name);await wait(350);assert.equal(state.latest.match.players[0].recoveryMs,0);
 });
 for(const name of ['standing-dunk','running-dunk','turbo-dunk','blocked-dunk','poster','poster-reduced'])await run(name,async({page,state,send,event,capture})=>{
  if(name.includes('running')||name.includes('turbo')){await page.keyboard.down('KeyD');await until(()=>state.latest.match.players[0].runUpMs>=150&&state.latest.match.players[0].x>=85.2,'run-up');}
  if(name==='turbo-dunk')await page.keyboard.down('ShiftLeft');if(name==='blocked-dunk')send(2,{pressed:A.SHOOT});
  await page.keyboard.press('KeyK');await until(()=>event('dunk'),'dunk');await page.keyboard.up('KeyD');await page.keyboard.up('ShiftLeft');
  if(name==='blocked-dunk'){await until(()=>event('block'),'block');assert.deepEqual(state.latest.match.score,[0,0]);await capture(name);return;}
  assert.equal(event('dunk').tier,name==='running-dunk'?'running':name==='turbo-dunk'?'turbo':'standing');await wait(180);await capture(name);
  if(name==='poster')await page.keyboard.down('ShiftLeft');
  await until(()=>event('score'),'score');assert.equal(state.latest.match.score[0],2);
  if(name.startsWith('poster')){assert.equal(event('score').posterized,2);await capture(name+'-fall');await wait(180);await capture(name+'-down');await wait(220);await capture(name+'-rise');await wait(350);assert.equal(state.latest.match.players[2].stunMs,0);if(name==='poster')assert.equal(state.sent.findLast(i=>i.type==='input').held,0,'phase reset clears held controls');}
 },{reduced:name==='poster-reduced'});
 await run('controls',async({page,state,event})=>{
  await page.evaluate(()=>{for(const code of ['KeyJ','ShiftLeft'])document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));});await until(()=>event('pass'),'normal order');assert.equal(event('pass').tier,'normal');
  await page.locator('#sound').focus();await wait(80);let i=state.sent.findLast(i=>i.type==='input');assert.equal(i.held|i.pressed|i.turboActions,0);
  await page.locator('#court').focus();await page.keyboard.down('ShiftLeft');await page.keyboard.down('ShiftRight');await page.keyboard.up('ShiftLeft');await wait(80);i=state.sent.findLast(i=>i.type==='input');assert.ok(i.held&A.TURBO);await page.keyboard.up('ShiftRight');
  const token=state.welcome.token;await state.sockets.at(-1).close({code:1012});await until(()=>state.welcome.token!==token,'reconnect',10000);await wait(80);i=state.sent.findLast(i=>i.type==='input');assert.equal(i.held|i.pressed|i.turboActions,0);
 });
 // Actual renderer, every profile in both directions: inspect composed poses.
 if(!selected.size){const server=await startServer(),page=await browser.newPage({viewport:{width:1200,height:1610}});
 try{
  await page.goto(server.url);await page.evaluate(async()=>{const r=await import('/render.js');window.r=r;window.assets=await r.loadSprites(await (await fetch('/assets/sprites/manifest.json')).json());await document.fonts.ready;const c=document.createElement('canvas');c.id='atlas';c.width=1200;c.height=1610;document.body.append(c);});
  for(const team of TEAMS){await page.evaluate(async team=>{
   const {createMatch}=await import('/game/simulation.js'),{PLAYERS}=await import('/game/data.js');const c=document.getElementById('atlas'),ctx=c.getContext('2d'),tile=document.createElement('canvas');tile.width=640;tile.height=360;
   ctx.fillStyle='#171022';ctx.fillRect(0,0,1200,1610);ctx.font='16px monospace';ctx.fillStyle='#ffe09a';ctx.fillText(team.name,12,20);
   const poses=[['shove',100],['fall',75],['down',300],['rise',575],['standing',250],['running',325],['turbo',375]];
   poses.forEach(([label,elapsed],row)=>team.roster.forEach((key,col)=>[-1,1].forEach((facing,side)=>{
    const m=createMatch(),p=Object.assign(m.players[0],PLAYERS[key],{x:50,y:28,facing,ageMs:elapsed,actionStart:0,action:row===0?'shove':row<4?'posterized':'dunk',z:row<4?0:[11,14,18][row-4]});m.players=[p];m.ball={mode:'flight',kind:row>=4?'dunk':'pass',from:0,x:50,y:28,z:p.z+2};m.phase='live';m.tick=20;
    if(row>=4)p.flight={kind:'dunk',tier:label};const before=JSON.stringify(m);window.r.renderMatch(tile.getContext('2d'),m,{assets:window.assets,reducedMotion:true});if(JSON.stringify(m)!==before)throw Error('renderer mutated state');
    const x=(col*2+side)*200,y=30+row*225;ctx.drawImage(tile,220,65,200,205,x,y,200,205);ctx.fillStyle='#d6ff98';ctx.font='10px monospace';ctx.fillText(`${key} ${facing<0?'L':'R'} ${label}`,x+4,y+220);
   })));
  },team);await page.locator('#atlas').screenshot({path:`${out}/gameplay-atlas-${team.key}.png`});}
 }finally{await page.close();await server.close();}}
 assert.deepEqual(errors,[]);if(!selected.size)await writeFile(`${out}/gameplay-results.json`,JSON.stringify({scenarios:results,unexpectedErrors:errors,expectedBacklogRejections,atlases:7},null,2)+'\n');console.log(`PASS ${results.length} gameplay scenarios; ${selected.size?'targeted run':'seven atlases'}; zero unexpected browser/protocol errors`);
}finally{await browser.close();}
