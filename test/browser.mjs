import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from '../server/index.js';
const server=await startServer();
const browser=await chromium.launch({channel:'msedge',headless:true});
const shots=new URL('../docs/verification/arcade-selection/',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1');
await mkdir(shots,{recursive:true});
const errors=[],contexts=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=10000){const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw Error('Browser condition timed out');await wait(50);}}
async function matchup(page){await page.locator('#selection-next').click();await page.locator('#selection-next').click();await page.locator('#start').waitFor();}
async function tab(){const context=await browser.newContext({viewport:{width:1280,height:960}});contexts.push(context);const page=await context.newPage();const state={latest:null,sent:[],welcome:null,sockets:[]};await page.routeWebSocket('**/ws',ws=>{ws.connectToServer();state.sockets.push(ws);});page.on('pageerror',e=>errors.push(e.message));page.on('websocket',ws=>{ws.on('framereceived',e=>{const m=JSON.parse(e.payload);if(m.type==='snapshot')state.latest=m;if(m.type==='welcome')state.welcome=m;});ws.on('framesent',e=>state.sent.push(JSON.parse(e.payload)));});return {page,context,state};}
try{
 const a=await tab();await a.page.goto(server.url);await a.page.evaluate(()=>document.fonts.ready);await wait(800);
 await a.page.screenshot({path:shots+'/home.png',fullPage:true});
 await a.page.locator('#join-open').click();await a.page.locator('#room-link').fill('invalid');await a.page.locator('#join-form button').click();assert.match(await a.page.locator('#notice').innerText(),/valid court/);await a.page.locator('#join-screen [data-home]').click();
 await a.page.locator('#create').click();await a.page.locator('#team-grid').waitFor();
 await a.page.locator('[data-team-key="sacramento"]').click();await a.page.locator('[data-side="1"]').click();await a.page.locator('[data-team-key="toronto"]').click();
 await a.page.screenshot({path:shots+'/lobby.png',fullPage:true});
 await a.page.locator('#sound').click();assert.equal(await a.page.locator('#sound').innerText(),'Sound on');await a.page.locator('#sound').click();
 await a.page.locator('#motion').click();assert.equal(await a.page.locator('#motion').getAttribute('aria-pressed'),'true');
 await matchup(a.page);await a.page.locator('#start').click();await until(()=>a.state.latest?.match.phase==='live');
 assert.deepEqual(a.state.latest.match.teamKeys,['sacramento','toronto']);const selected=a.state.latest.match.players.map(p=>p.key);
 await a.page.locator('#court').focus();await a.page.keyboard.down('KeyD');await a.page.keyboard.down('Shift');await wait(450);await a.page.locator('#sound').focus();await a.page.keyboard.up('KeyD');await a.page.keyboard.up('Shift');await wait(450);
 assert.equal(a.state.latest.match.players[a.state.latest.slot].vx,0,'blur must stop movement');
 assert.ok(a.state.sent.some(m=>m.type==='input'&&m.x===1&&(m.held&1)));
 await a.page.locator('#court').focus();await a.page.keyboard.press('Space');await until(()=>a.state.latest.slot===1);assert.equal(a.state.latest.controlEpoch,2);
 await a.page.screenshot({path:shots+'/match.png',fullPage:true});
 const oldToken=a.state.welcome.token;await a.state.sockets.at(-1).close({code:1012,reason:'Test interruption'});await until(()=>a.state.welcome.token!==oldToken,15000);assert.equal(a.state.latest.slot,1);
 console.log('PASS home, lobby, keys, blur, switch, sound, motion, reconnect');

 // Keep the solo game running while independently checking a four-human lobby.
 const b=await tab();await b.page.goto(server.url);await b.page.locator('#create').click();await until(()=>b.state.welcome);const room=b.state.welcome.roomId;
 const others=[];for(let slot=1;slot<4;slot++){const c=await tab();others.push(c);await c.page.goto(server.url+'/?room='+room);await c.page.locator(`#starter-slots [data-slot="${slot}"]`).click();await until(()=>c.state.welcome?.slot===slot);}
 await matchup(b.page);await b.page.locator('#start').click();await until(()=>[b,...others].every(c=>c.state.latest?.match.phase==='live'));
 assert.deepEqual([b,...others].map(c=>c.state.latest.slot),[0,1,2,3]);
 await b.page.locator('#court').focus();await b.page.keyboard.press('Space');await wait(200);assert.equal(b.state.latest.slot,0,'human teammate cannot be stolen');
 const full=await tab();await full.page.goto(server.url+'/?room='+room);await full.page.locator('#starter-slots button').first().waitFor();assert.equal(await full.page.locator('#starter-slots button:disabled').count(),4);
 await full.page.setViewportSize({width:390,height:844});await full.page.screenshot({path:shots+'/small.png',fullPage:true});assert.equal(await full.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const missing=await tab();await missing.page.route('**/sprites/tauros/*-Anim.png',route=>route.abort());await missing.page.goto(server.url);await missing.page.locator('#notice').waitFor();assert.match(await missing.page.locator('#notice').innerText(),/sprites could not load/);await missing.page.locator('#create').click();await matchup(missing.page);await missing.page.locator('#start').click();await until(()=>missing.state.latest?.match.phase==='live');await missing.page.screenshot({path:shots+'/fallback.png',fullPage:true});
 await Promise.all([b,...others,full,missing].map(c=>c.context.close()));
 console.log('PASS four humans, protected teammate, full room, small viewport, missing sprite fallback');
 console.log('Waiting for real-time solo match to finish...');
 await until(()=>a.state.latest?.match.phase==='finished',300000);
 assert.notEqual(...a.state.latest.match.score);await a.page.locator('#rematch').waitFor();await a.page.screenshot({path:shots+'/results.png',fullPage:true});
 console.log('PASS full solo match',JSON.stringify(a.state.latest.match.score));
 await a.page.locator('#rematch').click();await a.page.locator('#players-screen').waitFor();await a.page.locator('#selection-next').click();await a.page.locator('#start').click();await until(()=>a.state.latest?.match.phase==='countdown');
 const reset=a.state.latest.match;assert.deepEqual(reset.teamKeys,['sacramento','toronto']);assert.deepEqual(reset.players.map(p=>p.key),selected);assert.deepEqual(reset.score,[0,0]);assert.equal(reset.remainingMs,180000);assert.equal(reset.shotClockMs,24000);for(const p of reset.players){assert.equal(p.meter,0);assert.equal(p.action,'idle');}
 assert.deepEqual(errors,[]);console.log('PASS rematch preserves selection and resets game; zero uncaught browser errors');
}finally{await browser.close();await server.close();}
