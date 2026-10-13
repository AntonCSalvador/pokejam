import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from '../server/index.js';
import {TEAMS} from '../public/game/data.js';
const out='docs/verification/arcade-selection';
await mkdir(out,{recursive:true});
const server=await startServer(),browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1140,height:1220}});await page.goto(server.url);
 await page.evaluate(async()=>{
  const {loadSprites}=await import('/render.js');window.atlasAssets=await loadSprites(await (await fetch('/assets/sprites/manifest.json')).json());
  await document.fonts.ready;document.body.replaceChildren();document.body.style.margin='0';
  const canvas=document.createElement('canvas');canvas.id='atlas';canvas.width=1140;canvas.height=1220;document.body.append(canvas);
 });
 assert.deepEqual(await page.evaluate(()=>window.atlasAssets.failures),[]);
 for(const team of TEAMS){
  await page.evaluate(({name,roster})=>{
   const canvas=document.getElementById('atlas'),ctx=canvas.getContext('2d'),assets=window.atlasAssets;
   ctx.imageSmoothingEnabled=false;ctx.fillStyle='#16121f';ctx.fillRect(0,0,1140,1220);ctx.font='18px monospace';ctx.fillStyle='#fff4dc';ctx.fillText(name,18,25);
   const actions=['idle','run','dribble','pass','shoot','dunk','block','stagger','signature'];
   actions.forEach((action,row)=>{
    ctx.fillStyle='#fff4dc';ctx.font='12px monospace';ctx.fillText(action.toUpperCase(),8,62+row*128);
    roster.forEach((key,id)=>['left','right'].forEach((direction,dir)=>{
     const entry=assets.manifest[key],frames=entry.animations[action][direction],f=frames[Math.floor(frames.length/2)],img=assets.images.get(f.image);
     const x=186+(id*2+dir)*171,y=137+row*128,scale=Math.min(1.65,entry.courtScale??1.65),[sx,sy,w,h]=f.rect;
     ctx.fillStyle='#30233e';ctx.fillRect(x-78,y-93,158,115);ctx.drawImage(img,sx,sy,w,h,x-f.pivot[0]*scale,y-f.pivot[1]*scale,w*scale,h*scale);
     if(['dribble','pass','shoot','dunk','signature'].includes(action)){ctx.fillStyle='#ff963f';ctx.beginPath();ctx.arc(x+(f.ballAnchor[0]-f.pivot[0])*scale,y+(f.ballAnchor[1]-f.pivot[1])*scale,4,0,Math.PI*2);ctx.fill();}
     ctx.fillStyle='#d2f0a6';ctx.font='11px monospace';ctx.fillText(key+' '+direction,x-75,y+17);
    }));
   });
  },team);
  await page.locator('#atlas').screenshot({path:`${out}/atlas-${team.key}.png`});
 }
 await page.evaluate(()=>{
  const keys=['aerodactyl','tyrantrum','celebi','kingdra'],assets=window.atlasAssets,ctx=document.getElementById('atlas').getContext('2d');
  ctx.fillStyle='#16121f';ctx.fillRect(0,0,1140,1220);
  keys.forEach((key,row)=>['shoot','dunk'].forEach((action,j)=>{
   const entry=assets.manifest[key],frames=entry.animations[action].right;
   [0,Math.floor(frames.length/2),frames.length-1].forEach((index,i)=>{
    const f=frames[index],x=110+(j*3+i)*185,y=210+row*275,scale=entry.courtScale,[sx,sy,w,h]=f.rect;
    ctx.drawImage(assets.images.get(f.image),sx,sy,w,h,x-f.pivot[0]*scale,y-f.pivot[1]*scale,w*scale,h*scale);
    ctx.fillStyle='#ff963f';ctx.beginPath();ctx.arc(x+(f.ballAnchor[0]-f.pivot[0])*scale,y+(f.ballAnchor[1]-f.pivot[1])*scale,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff4dc';ctx.font='12px monospace';ctx.fillText(`${key} ${action} ${index}`,x-85,y+35);
   });
  }));
 });
 await page.locator('#atlas').screenshot({path:`${out}/atlas-release-samples.png`});
 console.log('PASS seven team atlases: 21 species, nine actions, both directions; extra release samples');
}finally{await browser.close();await server.close();}
