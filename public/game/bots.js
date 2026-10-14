import {A,TUNING as T,neutral,hoop} from './data.js';
import {dunkOption} from './simulation.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function chooseBotInput(m,id){
 const p=m.players[id],b=m.ball;
 const owns=b.mode==='held'&&b.holder===id;
 if(p.bot.passRequest&&(!owns||m.phase!=='live'||m.tick>=p.bot.passRequest.untilTick))p.bot.passRequest=null;
 if((m.phase!=='live'&&m.phase!=='buzzer')||p.stunMs||p.recoveryMs||p.flight||p.knockback)return neutral();
 const cached=p.bot.input;
 if(m.tick%6!==id%6&&cached)return {...cached,pressed:0,released:0,turboActions:0};
 const input=neutral(),basket=hoop(p.team),mate=m.players[id^1];
 let target=b;
 if(owns){
  const range=distance(p,basket),defenders=m.players.filter(q=>q.team!==p.team);
  const contested=defenders.some(q=>distance(q,p)<7);
  const mateOpen=!defenders.some(q=>distance(q,mate)<9);
  if(p.bot.passRequest){p.bot.passRequest=null;input.pressed|=A.PASS;target=p;}
  else if(p.chargeMs>0){if(p.chargeMs>=T.shotSweetMs-50)input.released|=A.SHOOT;else input.held|=A.SHOOT;target=p;}
  else if(contested&&mateOpen&&distance(p,mate)>9&&distance(mate,basket)<range+8){input.pressed|=A.PASS;if(p.turbo>=25&&distance(p,mate)>18)input.turboActions|=A.PASS;target=p;}
  else if(dunkOption(p,{...input,x:p.team===0?1:-1,turboActions:p.turbo>=40?A.SHOOT:0})){input.pressed|=A.SHOOT;if(p.turbo>=40)input.turboActions|=A.SHOOT;target=basket;}
  else if((range<31&&!contested)||m.shotClockMs<2500){input.held|=A.SHOOT;input.pressed|=A.SHOOT;target=p;}
  else target={x:basket.x+(p.team===0?-13:13),y:28+Math.sin(m.tick/85+id)*13};
  if(p.meter===100&&!(input.pressed&A.PASS))input.pressed|=A.SPECIAL;
 }else if(b.mode==='held'){
  const holder=m.players[b.holder];
  if(holder.team===p.team)target={x:Math.max(12,Math.min(88,holder.x+(p.team===0?12:-12))),y:holder.y<28?42:14};
  else{
   const mark=m.players[(p.team===0?2:0)+(id%2)];
   target=distance(p,holder)<13?holder:{x:mark.x+(p.team===0?-3:3),y:mark.y};
   if(!p.cooldownMs&&distance(p,holder)<=T.shoveRange&&p.turbo>=40&&holder.z<=3&&!holder.stunMs&&!holder.shoveProtectionMs){input.pressed|=A.PASS;input.turboActions|=A.PASS;}
   else if(distance(p,holder)<T.stealRange&&!p.cooldownMs)input.pressed|=A.PASS;
  }
 }else if(b.mode==='flight'&&b.kind==='pass'&&b.target===id){target={x:b.x+Math.cos(b.heading)*3,y:b.y+Math.sin(b.heading)*3};
 }else if(b.mode==='flight'&&b.kind!=='pass'){
  target={x:b.x,y:b.y};
  if(b.team!==p.team&&distance(p,b)<6&&!p.cooldownMs)input.pressed|=A.SHOOT;
 }
 let dx=target.x-p.x,dy=target.y-p.y,n=Math.hypot(dx,dy);
 if(n>1){input.x=dx/n;input.y=dy/n;if(n>14&&p.turbo>30)input.held|=A.TURBO;
  const obstacle=m.players.find(q=>q.id!==id&&distance(p,q)<6&&(q.x-p.x)*input.x+(q.y-p.y)*input.y>0);
  if(obstacle&&!(input.turboActions&A.PASS)&&!(input.pressed&A.SHOOT)){const side=p.y<28?-1:1;input.y=side*.9;input.x*=.45;}
 }
 p.bot.input=input;return input;
}
