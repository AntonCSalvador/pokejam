import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from '../server/index.js';
let server=await startServer();const browser=await chromium.launch({channel:'msedge',headless:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=12000){const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw Error('Recovery condition timed out');await wait(30);}}
const errors=[];
async function tab(delay=0){
 const context=await browser.newContext({viewport:{width:1280,height:960}}),page=await context.newPage(),state={latest:null,welcome:null,sockets:[],suppress:false,snapshots:[]};
 await page.routeWebSocket('**/ws',ws=>{const upstream=ws.connectToServer();state.sockets.push(ws);upstream.onMessage(m=>setTimeout(()=>{if(!page.isClosed())ws.send(m);},delay));upstream.onClose((code,reason)=>setTimeout(()=>{if(!page.isClosed())ws.close({code,reason});},delay));ws.onMessage(m=>{if(!state.suppress)setTimeout(()=>{if(!page.isClosed())upstream.send(m);},delay);});});
 page.on('pageerror',e=>errors.push(e.message));page.on('websocket',ws=>ws.on('framereceived',e=>{const m=JSON.parse(e.payload);if(m.type==='welcome')state.welcome=m;if(m.type==='snapshot'){state.latest=m;state.snapshots.push(m);}}));
 return {context,page,state};
}
try{
 const a=await tab(75);await a.page.goto(server.url);await a.page.locator('#create').click();await until(()=>a.state.welcome);await a.page.locator('#selection-next').click();await a.page.locator('#selection-next').click();await a.page.locator('#start').click();await until(()=>a.state.latest?.match.phase==='live');
 const b=await tab(75);await b.page.goto(server.url+'/?room='+a.state.welcome.roomId);await b.page.locator('#starter-slots [data-slot="1"]').click();await until(()=>b.state.welcome);
 await until(()=>b.state.latest?.pending===true);await until(()=>b.state.latest?.pending===false,35000);assert.equal(b.state.latest.slot,1);
 await until(()=>a.state.latest.match.phase==='live');a.state.snapshots=[];await a.page.locator('#court').focus();await a.page.keyboard.down('KeyW');await wait(800);await a.page.keyboard.up('KeyW');await wait(300);assert.ok(a.state.snapshots.some(s=>s.match.players[0].vy<0));
 await a.page.screenshot({path:'docs/verification/arcade-selection/gameplay-delayed-coop.png',fullPage:true});console.log('PASS two-browser co-op at 150 ms RTT; late join transferred at stoppage; movement acknowledged');
 // A duplicate tab uses the exact token from this tab; old controller must recover visibly.
 const c=await tab();await c.page.addInitScript(s=>sessionStorage.setItem('pokejam-session',JSON.stringify(s)),b.state.welcome);await c.page.goto(server.url+'/?room='+a.state.welcome.roomId);await until(()=>c.state.welcome);await b.page.locator('#create').waitFor();assert.match(await b.page.locator('#notice').innerText(),/another tab/);
 console.log('PASS duplicate token replaces controller and restores old-tab home');
 // Actual server restart: original room cannot be revived from a stale token.
 const port=Number(new URL(server.url).port);await server.close();server=await startServer({port});await a.page.locator('#create').waitFor({timeout:15000});assert.match(await a.page.locator('#notice').innerText(),/Room ended/);
 assert.deepEqual(errors,[]);console.log('PASS restart shows room-ended recovery; zero uncaught browser errors');console.log('Browser:',browser.version());
}finally{await browser.close();await server.close();}
