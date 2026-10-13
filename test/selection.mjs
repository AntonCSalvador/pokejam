import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from '../server/index.js';
const server=await startServer(),browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:960}});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const Original=window.WebSocket;window.WebSocket=class extends Original{constructor(...args){super(...args);window.testSocket=this;this.addEventListener('message',e=>{const m=JSON.parse(e.data);window.testMessages??=[];window.testMessages.push(m);if(m.type==='snapshot')window.testSnapshot=m;if(m.type==='lobby')window.testLobby=m;});}};
 });
 await page.goto(server.url);await page.locator('#create').click();await page.waitForFunction(()=>window.testLobby);
 await page.evaluate(()=>{testSocket.send(JSON.stringify({type:'selectTeam',side:0,teamKey:'sacramento'}));testSocket.send(JSON.stringify({type:'selectTeam',side:1,teamKey:'toronto'}));});
 await page.waitForFunction(()=>window.testLobby?.teamKeys[1]==='toronto');await page.locator('#start').click();
 await page.waitForFunction(()=>window.testSnapshot?.match.phase==='live');
 assert.match(await page.locator('.scoreboard').innerText(),/KINGDRAS/i);assert.match(await page.locator('.scoreboard').innerText(),/TYRANTRUMS/i);
 assert.deepEqual(await page.evaluate(()=>testSnapshot.match.players.map(p=>p.key)),['kingdra','nidoking','tyrantrum','sceptile']);
 const portraitCheck=await page.evaluate(async()=>{
  const {loadSprites,drawPortrait}=await import('/render.js'),{PLAYERS}=await import('/game/data.js');const assets=await loadSprites(await (await fetch('/assets/sprites/manifest.json')).json());
  const canvas=document.createElement('canvas');canvas.width=220;canvas.height=140;const ctx=canvas.getContext('2d');
  return {failures:assets.failures,drawn:Object.keys(PLAYERS).filter(key=>{drawPortrait(ctx,key,assets);return ctx.getImageData(0,0,220,140).data.some((v,i)=>i%4===3&&v>0);}).length};
 });
 assert.equal(portraitCheck.drawn,21);assert.deepEqual(portraitCheck.failures,[]);assert.deepEqual(errors,[]);
 await page.screenshot({path:'docs/verification/arcade-selection/court-selected.png',fullPage:true});
 console.log('PASS selected franchises, authoritative species, 21 portraits, no browser errors');
}finally{await browser.close();await server.close();}
