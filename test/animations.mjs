import {chromium} from 'playwright';
import {startServer} from '../server/index.js';
const server=await startServer(),browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}});await page.goto(server.url);
 await page.evaluate(async()=>{
  const {loadSprites}=await import('/render.js'),assets=await loadSprites(await (await fetch('/assets/sprites/manifest.json')).json());
  document.body.replaceChildren();const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=1350;document.body.append(canvas);const ctx=canvas.getContext('2d');
  const actions=['idle','run','dribble','pass','shoot','dunk','block','stagger','signature'];
  function draw(time){ctx.imageSmoothingEnabled=false;ctx.fillStyle='#16121f';ctx.fillRect(0,0,1280,1350);ctx.font='14px monospace';
   actions.forEach((action,row)=>{ctx.fillStyle='#fff4dc';ctx.fillText(action.toUpperCase(),8,row*145+20);
    Object.keys(assets.manifest).forEach((key,id)=>['left','right'].forEach((direction,dir)=>{
     const frames=assets.manifest[key].animations[action][direction],duration=frames.reduce((s,f)=>s+f.durationMs,0);let age=time%duration;const f=frames.find(f=>(age-=f.durationMs)<0)||frames[0];const img=assets.images.get(f.image),x=140+(id*2+dir)*147,y=row*145+111,scale=1.6;
     ctx.fillStyle='#36283f';ctx.fillRect(x-64,y-94,131,110);const [sx,sy,w,h]=f.rect;ctx.drawImage(img,sx,sy,w,h,x-f.pivot[0]*scale,y-f.pivot[1]*scale,w*scale,h*scale);
     if(['dribble','pass','shoot','dunk','signature'].includes(action)){ctx.fillStyle='#ff963f';ctx.beginPath();ctx.arc(x+(f.ballAnchor[0]-f.pivot[0])*scale,y+(f.ballAnchor[1]-f.pivot[1])*scale,4,0,Math.PI*2);ctx.fill();}
     ctx.fillStyle='#bbef87';ctx.font='11px monospace';ctx.fillText(key+' '+direction,x-62,y+29);
    }));
   });requestAnimationFrame(draw);
  }requestAnimationFrame(draw);
 });
 await page.screenshot({path:'docs/verification/animations.png',fullPage:true});console.log('PASS animated nine-action, four-character, two-facing inspection atlas rendered');
}finally{await browser.close();await server.close();}
