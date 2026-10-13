import {A,TUNING as T,neutral,hoop} from './data.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function chooseBotInput(m,id){
 const p=m.players[id],b=m.ball;
 if(m.phase!=='live'&&m.phase!=='buzzer')return neutral();
 const cached=p.bot.input;
 if(m.tick%6!==id%6&&cached)return {...cached,pressed:0,released:0};
 const input=neutral(),basket=hoop(p.team),mate=m.players[id^1];
 let target=b;
 const owns=b.mode==='held'&&b.holder===id;
 if(owns){
  const range=distance(p,basket),defenders=m.players.filter(q=>q.team!==p.team);
  const contested=defenders.some(q=>distance(q,p)<7);
  const mateOpen=!defenders.some(q=>distance(q,mate)<9);
  if(p.chargeMs>0){if(p.chargeMs>=T.shotSweetMs-50)input.released|=A.SHOOT;else input.held|=A.SHOOT;target=p;}
  else if(contested&&mateOpen&&distance(p,mate)>9&&distance(mate,basket)<range+8){input.pressed|=A.PASS;target=p;}
  else if(range<p.dunk&&p.turbo>=T.dunkCost){input.pressed|=A.SHOOT;input.released|=A.SHOOT;target=p;}
  else if((range<31&&!contested)||m.shotClockMs<2500){input.held|=A.SHOOT;input.pressed|=A.SHOOT;target=p;}
  else target={x:basket.x+(p.team===0?-13:13),y:28+Math.sin(m.tick/85+id)*13};
  if(p.meter===100)input.pressed|=A.SPECIAL;
 }else if(b.mode==='held'){
  const holder=m.players[b.holder];
  if(holder.team===p.team)target={x:Math.max(12,Math.min(88,holder.x+(p.team===0?12:-12))),y:holder.y<28?42:14};
  else{
   const mark=m.players[(p.team===0?2:0)+(id%2)];
   target=distance(p,holder)<13?holder:{x:mark.x+(p.team===0?-3:3),y:mark.y};
   if(distance(p,holder)<T.stealRange&&!p.cooldownMs)input.pressed|=A.PASS;
  }
 }else if(b.mode==='flight'&&b.kind!=='pass'){
  target={x:b.x,y:b.y};
  if(b.team!==p.team&&distance(p,b)<6&&!p.cooldownMs)input.pressed|=A.SHOOT;
 }
 let dx=target.x-p.x,dy=target.y-p.y,n=Math.hypot(dx,dy);
 if(n>1){input.x=dx/n;input.y=dy/n;if(n>14&&p.turbo>30)input.held|=A.TURBO;
  const obstacle=m.players.find(q=>q.id!==id&&distance(p,q)<6&&(q.x-p.x)*input.x+(q.y-p.y)*input.y>0);
  if(obstacle){const side=p.y<28?-1:1;input.y=side*.9;input.x*=.45;}
 }
 p.bot.input=input;return input;
}
