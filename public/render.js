import {A,neutral,getTeam,TUNING as T} from './game/data.js';
import {dunkOption,stepMatch} from './game/simulation.js';
let muted=true,audioContext=null,lastEvent=0,lastMatch=null;
export function setSoundMuted(value){muted=value;if(!muted){try{audioContext??=new AudioContext();audioContext.resume().catch(()=>{});}catch{muted=true;}}}
function sound(kind){if(muted||!audioContext)return;try{const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.connect(gain);gain.connect(audioContext.destination);osc.type=kind==='score'?'square':'triangle';osc.frequency.setValueAtTime(kind==='score'?660:kind==='dunk'?110:230,audioContext.currentTime);osc.frequency.exponentialRampToValueAtTime(kind==='score'?990:55,audioContext.currentTime+.13);gain.gain.setValueAtTime(.025,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.18);osc.start();osc.stop(audioContext.currentTime+.2);}catch{}}
export async function loadSprites(manifest){
 const images=new Map(),failures=[];
 await Promise.all([...new Set(Object.values(manifest).flatMap(e=>e.sources.map(s=>s.image)))].map(path=>new Promise(resolve=>{const img=new Image();img.onload=()=>{images.set(path,img);resolve();};img.onerror=()=>{failures.push(path);resolve();};img.src='/'+path;})));
 return {manifest,images,failures};
}
const project=(x,y,z=0)=>[50+x*5.35+(y-28)*.25,142+y*2.9-z*3.4];
function polygon(ctx,points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function courtLine(ctx,points,color='#fff0cf',width=1){ctx.lineWidth=width;ctx.strokeStyle=color;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...project(...p)):ctx.moveTo(...project(...p)));ctx.stroke();}
function circle(ctx,x,y,r,color,width=1){const pts=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;pts.push([x+Math.cos(a)*r,y+Math.sin(a)*r]);}courtLine(ctx,pts,color,width);}
function text(ctx,value,x,y,size=8,color='#fff1da',align='center'){ctx.font=`${size}px Arcade, monospace`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(value,x,y);}
function stadium(ctx,tick,reduced,teams){
 ctx.fillStyle='#171022';ctx.fillRect(0,0,640,360);
 ctx.fillStyle='#22162f';ctx.fillRect(0,0,640,116);
 // Pixel seats and spectators, drawn deterministically so the background never flickers.
 for(let row=0;row<5;row++)for(let col=0;col<55;col++){const n=(row*139+col*73)%100;const x=col*12+(row%2)*6-8,y=20+row*18;
  ctx.fillStyle=['#49315e','#3a284b','#5c3657'][n%3];ctx.fillRect(x,y+5,9,10);
  if(n<73){const bounce=!reduced&&n<12?Math.round(Math.sin(tick/16+col)*1):0;ctx.fillStyle=['#d6a181','#b77668','#f0cc9a'][n%3];ctx.fillRect(x+3,y+bounce,4,4);ctx.fillStyle=['#6c7c95','#b86265','#647e59','#a37c4f'][n%4];ctx.fillRect(x+2,y+4+bounce,6,6);}}
 ctx.fillStyle='#382045';ctx.fillRect(0,109,640,25);ctx.fillStyle='#84564e';ctx.fillRect(0,133,640,4);
 text(ctx,teams[0].name.toUpperCase(),145,126,7,teams[0].color);text(ctx,'POKÉJAM',320,126,11,'#bbef87');text(ctx,teams[1].name.toUpperCase(),500,126,7,teams[1].color);
 polygon(ctx,[[15,141],[612,141],[634,319],[29,319]],'#59363b');
 polygon(ctx,[project(0,0),project(100,0),project(100,56),project(0,56)],'#d29558');
 for(let x=0;x<100;x+=5)polygon(ctx,[project(x,0),project(x+5,0),project(x+5,56),project(x,56)],x%10?'#d99f63':'#dca66d');
 for(let x=0;x<=100;x+=5)courtLine(ctx,[[x,0],[x,56]],'#c18b55',.4);
 for(let y=8;y<56;y+=8)courtLine(ctx,[[0,y],[100,y]],'#d29a60',.3);
 ctx.lineWidth=1.5;polygon(ctx,[project(1,1),project(99,1),project(99,55),project(1,55)],null,'#ffe8bd');
 polygon(ctx,[project(1,17),project(19,17),project(19,39),project(1,39)],teams[0].dark);
 polygon(ctx,[project(81,17),project(99,17),project(99,39),project(81,39)],teams[1].dark);
 courtLine(ctx,[[1,17],[19,17],[19,39],[1,39]]);courtLine(ctx,[[99,17],[81,17],[81,39],[99,39]]);
 circle(ctx,19,28,9);circle(ctx,81,28,9);circle(ctx,50,28,10,'#ad7850');courtLine(ctx,[[50,1],[50,55]]);
 for(const side of [0,1]){const pts=[];for(let i=0;i<=32;i++){const a=-Math.PI/2+i*Math.PI/32;pts.push([side?94-Math.cos(a)*24:6+Math.cos(a)*24,28+Math.sin(a)*24]);}courtLine(ctx,pts);}
 ctx.save();ctx.translate(...project(50,28));ctx.rotate(-.02);text(ctx,'PJ',0,7,27,'#c58c57');ctx.restore();
 text(ctx,'THE INDIGO ARENA',321,341,9,'#ad859e');
 for(const team of [0,1]){const x=team===0?6:94;const [hx,hy]=project(x,28,10);ctx.strokeStyle='#9e899f';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(hx+(team?23:-23),hy+39);ctx.lineTo(hx+(team?23:-23),hy-20);ctx.lineTo(hx+(team?6:-6),hy-20);ctx.stroke();ctx.fillStyle='#d5cadd';ctx.fillRect(hx-18,hy-22,36,21);ctx.fillStyle='#403847';ctx.fillRect(hx-15,hy-20,30,16);ctx.strokeStyle='#faefdb';ctx.lineWidth=1;ctx.strokeRect(hx-6,hy-14,12,9);}
}
function frameFor(p,assets){const frames=assets.manifest[p.key]?.animations[p.action==='posterized'?'stagger':p.action==='shove'?'signature':p.action]?.[p.facing<0?'left':'right']||assets.manifest[p.key]?.animations.idle.right;if(!frames?.length)return null;const total=frames.reduce((n,f)=>n+f.durationMs,0);let t=((p.ageMs-p.actionStart)||0)%total;return frames.find(f=>(t-=f.durationMs)<0)||frames[0];}
function ball(ctx,x,y,r=4){ctx.fillStyle='#412230';ctx.beginPath();ctx.arc(x+1,y+1,r+.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff963f';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#71321d';ctx.lineWidth=.75;ctx.beginPath();ctx.moveTo(x-r,y);ctx.lineTo(x+r,y);ctx.moveTo(x,y-r);ctx.lineTo(x,y+r);ctx.stroke();ctx.fillStyle='#ffe2a2';ctx.fillRect(x-2,y-2,1.5,1.5);}
export function drawPortrait(ctx,key,assets,tick=0){
 ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.imageSmoothingEnabled=false;
 const p={key,action:'idle',facing:1,ageMs:tick*16,actionStart:0},f=frameFor(p,assets),img=f&&assets.images.get(f.image);if(!img)return;
 const [sx,sy,w,h]=f.rect,[l,t,r,b]=f.bounds??[0,0,w,h],width=r-l,height=b-t;
 const scale=Math.min(assets.manifest[key].portraitScale??2.4,(ctx.canvas.width-16)/width,(ctx.canvas.height-16)/height);
 ctx.drawImage(img,sx+l,sy+t,width,height,(ctx.canvas.width-width*scale)/2,ctx.canvas.height-8-height*scale,width*scale,height*scale);
}
export function renderMatch(ctx,m,{assets,controlledSlot=-1,reducedMotion=false,localPose=null,controlInput=neutral(),finishElapsedMs=0}){
 // The authority freezes at the whistle. Reuse its dead-ball recovery on a
 // disposable copy, so final falls and landings finish without changing results.
 if(m.phase==='finished'&&m.events.findLast(e=>e.kind==='score')?.posterized!==undefined){
  m=structuredClone(m);m.phase='deadball';m.phaseMs=T.deadballMs;
  for(let elapsed=0;elapsed<Math.min(700,finishElapsedMs);elapsed+=1000/60)stepMatch(m);
  m.phase='finished';
 }
 let attachedBall=null;
 ctx.imageSmoothingEnabled=false;ctx.save();
 const recent=m.events.findLast(e=>e.kind==='score');if(!reducedMotion&&recent&&m.tick-recent.tick<12)ctx.translate(Math.sin(m.tick*3)*1.5,Math.cos(m.tick*4));
 const teams=m.teamKeys.map(getTeam);stadium(ctx,m.tick,reducedMotion,teams);
 const players=m.players.map(p=>p.id===controlledSlot&&localPose?localPose:p).sort((a,b)=>a.y-b.y);
 for(const p of players){
  const [x,y]=project(p.x,p.y),[px,py]=project(p.x,p.y,p.z);const selected=p.id===controlledSlot;
  ctx.fillStyle='#50343c88';ctx.beginPath();ctx.ellipse(x,y,15,5,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=selected?'#d6ff98':teams[p.team].color;ctx.lineWidth=selected?2:1;ctx.beginPath();ctx.ellipse(x,y,17,6,0,0,Math.PI*2);ctx.stroke();
  const f=frameFor(p,assets),img=f&&assets.images.get(f.image);const scale=assets.manifest[p.key]?.courtScale??1.85;
  if(img){const [sx,sy,w,h]=f.rect;ctx.save();ctx.translate(px,py);
   if(p.action==='posterized'){
    const elapsed=p.ageMs-p.actionStart,down=elapsed<T.posterFallMs?elapsed/T.posterFallMs:elapsed<T.posterFallMs+T.posterDownMs?1:Math.max(0,1-(elapsed-T.posterFallMs-T.posterDownMs)/T.posterRiseMs);
    ctx.rotate(p.facing*1.4*down);
   }
   ctx.drawImage(img,sx,sy,w,h,-f.pivot[0]*scale,-f.pivot[1]*scale,w*scale,h*scale);ctx.restore();}

  else{ctx.fillStyle=teams[p.team].color;ctx.fillRect(px-9,py-28,18,28);text(ctx,p.name,px,py-34,6);}
  text(ctx,`${p.id+1}${selected?' YOU':''}`,x,y+14,5,selected?'#d6ff98':'#f9e6c7');
  if(p.power){ctx.strokeStyle=p.power.kind==='heat'?'#ffad34':'#c5ec8b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px,py-20,24,0,Math.PI*2);ctx.stroke();}
  if((m.ball.mode==='held'&&m.ball.holder===p.id)||(m.ball.kind==='dunk'&&m.ball.from===p.id)){let bx=px+p.facing*13,by=py-20;
   if(f){bx=px+(f.ballAnchor[0]-f.pivot[0])*scale;by=py+(f.ballAnchor[1]-f.pivot[1])*scale;}
   if(p.action==='dribble'){by=py-5-Math.abs(Math.sin(m.tick*.33))*18;}attachedBall=[bx,by];
   if(selected&&m.ball.mode==='held'){
    const option=dunkOption(p,{...controlInput,pressed:A.SHOOT,turboActions:controlInput.held&A.TURBO?A.SHOOT:0});
    if(option)text(ctx,option.tier==='turbo'?'TURBO DUNK':'DUNK',px,py-67,6,'#d6ff98');
   }
   if(p.chargeMs>0){ctx.fillStyle='#291c35';ctx.fillRect(px-19,py-65,38,5);ctx.fillStyle='#ffe6a4';ctx.fillRect(px-19+T.shotSweetMs/T.maxChargeMs*38-3,py-65,6,5);ctx.fillStyle='#bbef87';ctx.fillRect(px-19+Math.min(1,p.chargeMs/T.maxChargeMs)*36,py-67,2,9);}
  }
  if(m.ball.kind==='pass'&&m.ball.target===p.id){
   ctx.strokeStyle='#d6ff98';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,21,8,0,0,Math.PI*2);ctx.stroke();text(ctx,'PASS',px,py-70,6,'#d6ff98');
  }
  if(p.action==='shove'&&p.actionMs>0){const d=p.shoveDirection||{x:p.facing,y:0},[tx,ty]=project(p.x+d.x*4,p.y+d.y*4,3);ctx.strokeStyle='#fff0bd';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(px,py-10);ctx.lineTo(tx,ty);ctx.stroke();text(ctx,'SHOVE',px,py-65,6,'#ffe09a');}
  if(p.recoveryMs>0)text(ctx,'RECOVER',x,y+23,5,'#ffe09a');

 }
 if(!attachedBall&&m.ball.mode!=='held'){const b=m.ball;
  if(b.kind==='pass'&&b.tier!=='normal'&&!reducedMotion)for(let i=3;i>0;i--){const [tx,ty]=project(b.x-Math.cos(b.heading)*i*.6,b.y-Math.sin(b.heading)*i*.6,b.z);ctx.fillStyle='#ffe2a2';ctx.fillRect(tx-2,ty-2,4,4);}
 const [sx,sy]=project(b.x,b.y);ctx.fillStyle='#563b4766';ctx.beginPath();ctx.ellipse(sx,sy,5,2,0,0,Math.PI*2);ctx.fill();ball(ctx,...project(b.x,b.y,b.z));}
 if(attachedBall)ball(ctx,...attachedBall);
 for(const team of [0,1]){const [x,y]=project(team===0?6:94,28,10);ctx.strokeStyle='#fff3dc';ctx.lineWidth=1;for(let i=-7;i<=7;i+=4){ctx.beginPath();ctx.moveTo(x+i,y+1);ctx.lineTo(x+i*.6,y+11);ctx.stroke();}ctx.strokeStyle='#ed684b';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,11,4,0,0,Math.PI*2);ctx.stroke();}
 const shout=m.events.findLast(e=>['score','signature','block','steal','overtime'].includes(e.kind));
 if(shout&&m.tick-shout.tick<70){const label=shout.kind==='score'&&shout.posterized!==undefined?'POSTERIZED! +2':shout.kind==='score'?`${shout.points===3?'FROM DOWNTOWN!':'BOOM!'} +${shout.points}`:shout.kind==='signature'?shout.text:shout.kind==='block'?'GET THAT OUT!':shout.kind==='steal'?'SWIPED!':'OVERTIME!';text(ctx,label.toUpperCase(),320,18,10,'#ffe09a');}
 ctx.restore();
 if(lastMatch!==m.seed){lastMatch=m.seed;lastEvent=m.eventId;}
 for(const e of m.events)if(e.id>lastEvent){if(['score','dunk','steal','block'].includes(e.kind))sound(e.kind);lastEvent=e.id;}
}
