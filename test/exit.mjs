import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from '../server/index.js';
const server=await startServer(),browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();await page.goto(server.url);await page.locator('#create').click();await page.locator('#team-grid').waitFor();const original=page.url();
 await page.reload();await page.locator('#team-grid').waitFor();assert.equal(page.url(),original,'ordinary reload must recover the existing room');
 await page.locator('.brand').click();await page.waitForTimeout(900);assert.equal(await page.locator('#home-screen').isVisible(),true,'Home must leave the court');assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('pokejam-session'))),null);
 await page.reload();await page.locator('#create').waitFor();await page.locator('#create').click();await page.locator('#team-grid').waitFor();assert.notEqual(page.url(),original,'new court must not restore the abandoned room');
 await page.locator('#selection-next').click();await page.locator('#selection-next').click();
 await page.locator('#start').click();await page.waitForTimeout(3300);await page.locator('.brand').click();await page.locator('#create').waitFor();assert.equal(await page.locator('#player-bar').isVisible(),false);
 console.log('PASS ordinary reload recovers; Home exits lobby and live match; new court stays new');
}finally{await browser.close();await server.close();}
