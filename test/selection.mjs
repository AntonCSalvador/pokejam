import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from '../server/index.js';
import {PLAYERS} from '../public/game/data.js';
const server=await startServer(),browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:960}});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 async function capture(name){for(const [size,width,height]of [['desktop',1280,960],['small',390,844]]){await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`docs/verification/arcade-selection/${name}-${size}.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} fits ${size}`);}await page.setViewportSize({width:1280,height:960});}
 await page.addInitScript(()=>{
  window.testSent=[];const Original=window.WebSocket;window.WebSocket=class extends Original{send(m){window.testSent.push(JSON.parse(m));super.send(m);}constructor(...args){super(...args);window.testSocket=this;this.addEventListener('message',e=>{const m=JSON.parse(e.data);window.testMessages??=[];window.testMessages.push(m);if(m.type==='snapshot')window.testSnapshot=m;if(m.type==='lobby')window.testLobby=m;});}};
 });
 await page.goto(server.url);await page.locator('#create:enabled').waitFor();
 await page.locator('#motion').click();await capture('home');
 await page.locator('#join-open').click();await page.locator('#room-link').fill('invalid');await page.keyboard.press('ArrowLeft');await page.keyboard.press('Escape');
 assert.equal(await page.locator('body').getAttribute('data-screen'),'join','typing controls must stay inside invite field');
 await page.locator('#join-form button').click();assert.match(await page.locator('#notice').innerText(),/valid court/);await page.locator('[data-home]').first().click();
 await page.locator('body').click({position:{x:10,y:150}});await page.keyboard.press('Enter');
 await page.locator('#team-grid').waitFor();
 await page.locator('#team-grid [data-team-key="sacramento"]').click();
 await page.waitForFunction(()=>window.testLobby?.teamKeys[0]==='sacramento');
 await page.locator('[data-side="1"]').click();await page.locator('#team-grid [data-team-key="toronto"]').click();
 await page.waitForFunction(()=>window.testLobby?.teamKeys[1]==='toronto');
 await page.locator('#team-grid [data-team-key="toronto"]').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.evaluate(()=>document.activeElement.dataset.teamKey),'golden-state');
 await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await capture('teams');
 await page.locator('#selection-next').click();await page.locator('#player-grid').waitFor();
 await page.locator('#starter-slots [data-slot="0"]').click();
 await page.locator('#player-grid [data-player-key="nidoking"]').click();
 await page.waitForFunction(()=>window.testLobby?.playerKeys[0]==='nidoking');
 for(const [name,value]of Object.entries(PLAYERS.nidoking.ratings)){const row=page.locator(`.rating-row[aria-label="${name}: ${value} out of 10"]`);assert.equal(await row.locator('.filled').count(),value);assert.equal(await row.locator('strong').innerText(),`${value}/10`);}
 assert.equal(await page.locator('.signature-detail p').innerText(),PLAYERS.nidoking.description);
 await page.locator('#starter-slots [data-slot="1"]').click();await page.locator('#player-grid [data-player-key="slowking"]').click();
 await page.waitForFunction(()=>window.testLobby?.playerKeys[1]==='slowking');
 await page.locator('#player-grid [data-player-key="slowking"]').focus();
 await page.evaluate(()=>testSocket.send(JSON.stringify({type:'selectPlayer',slot:3,playerKey:'aerodactyl'})));
 await page.waitForFunction(()=>window.testLobby?.playerKeys[3]==='aerodactyl');
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.playerKey),'slowking');
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'solid','keyboard focus stays visible');
 await capture('players');
 await page.keyboard.press('Escape');await page.locator('#team-grid').waitFor();await page.locator('#selection-next').click();
 assert.deepEqual(await page.evaluate(()=>testLobby.playerKeys),['nidoking','slowking','tyrantrum','aerodactyl']);
 // A teammate edits only their own starter. The host cannot overwrite it.
 const guest=await browser.newPage();guest.setDefaultTimeout(10000);guest.on('pageerror',e=>errors.push(e.message));
 const room=await page.evaluate(()=>testLobby.roomId);await guest.goto(`${server.url}/?room=${room}`);await guest.locator('#starter-slots [data-slot="1"]').click();
 await guest.locator('#player-grid [data-player-key="kingdra"]:enabled').click();await page.waitForFunction(()=>testLobby.playerKeys[1]==='kingdra');
 await page.locator('#starter-slots [data-slot="1"]').click();assert.equal(await page.locator('#player-grid button:disabled').count(),3);
 await guest.locator('#player-grid [data-player-key="slowking"]').click();await page.waitForFunction(()=>testLobby.playerKeys[1]==='slowking');
 assert.equal(await page.evaluate(()=>testSent.filter(m=>m.type==='input').length),0,'menu keys emit no gameplay input');
 for(const slot of [2,3]){const teammate=await browser.newPage();await teammate.goto(`${server.url}/?room=${room}`);await teammate.locator(`#starter-slots [data-slot="${slot}"]`).click();await page.waitForFunction(i=>testLobby.slots[i].state==='human',slot);}
 const full=await browser.newPage();await full.goto(`${server.url}/?room=${room}`);await full.locator('#players-screen').waitFor();assert.equal(await full.locator('#starter-slots button:disabled').count(),4);assert.match(await full.locator('#draft-hint').innerText(),/court is full/);await full.locator('#selection-back').click();await full.locator('#home-screen').waitFor();
 await page.locator('#selection-next').click();await page.locator('#start').waitFor();
 assert.match(await page.locator('#matchup-screen').innerText(),/KINGDRAS/i);
 await capture('matchup');
 await page.locator('#start').click();await page.waitForFunction(()=>window.testSnapshot?.match.phase==='countdown');
 assert.equal(await page.locator('#matchup-screen').isVisible(),true);
 await page.waitForFunction(()=>window.testSnapshot?.match.phase==='live');
 assert.match(await page.locator('.scoreboard').innerText(),/KINGDRAS/i);assert.match(await page.locator('.scoreboard').innerText(),/TYRANTRUMS/i);
 assert.deepEqual(await page.evaluate(()=>testSnapshot.match.players.map(p=>p.key)),['nidoking','slowking','tyrantrum','aerodactyl']);
 const portraitCheck=await page.evaluate(async()=>{
  const {loadSprites,drawPortrait}=await import('/render.js'),{PLAYERS}=await import('/game/data.js');const assets=await loadSprites(await (await fetch('/assets/sprites/manifest.json')).json());
  const canvas=document.createElement('canvas');canvas.width=220;canvas.height=140;const ctx=canvas.getContext('2d');
  return {failures:assets.failures,drawn:Object.keys(PLAYERS).filter(key=>{drawPortrait(ctx,key,assets);return ctx.getImageData(0,0,220,140).data.some((v,i)=>i%4===3&&v>0);}).length};
 });
 assert.equal(portraitCheck.drawn,21);assert.deepEqual(portraitCheck.failures,[]);assert.deepEqual(errors,[]);
 await page.screenshot({path:'docs/verification/arcade-selection/court-selected.png',fullPage:true});
 // A rejected create returns to a usable title action without a reload.
 const rejected=await browser.newPage();rejected.setDefaultTimeout(10000);
 await rejected.routeWebSocket('**/ws',ws=>ws.onMessage(()=>ws.send(JSON.stringify({type:'error',code:'SERVER_FULL',message:'Courts are busy. Try again.'}))));
 await rejected.goto(server.url);await rejected.locator('#create').click();await rejected.locator('#create:enabled').waitFor();assert.match(await rejected.locator('#notice').innerText(),/busy/);
 console.log('PASS selected franchises, authoritative species, 21 portraits, no browser errors');
}finally{await browser.close();await server.close();}
