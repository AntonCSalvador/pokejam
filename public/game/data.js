export const DT=1/60;
export const A={TURBO:1,PASS:2,SHOOT:4,SPECIAL:8,SWITCH:16};
export const TEAMS=[
  {name:'Chicago Tauros',short:'CHI',color:'#ee4c59',dark:'#671f35'},
  {name:'Miami Heatmors',short:'MIA',color:'#ffb33b',dark:'#803b20'}
];
export const ROSTER=[
  {key:'tauros',name:'Tauros',team:0,role:'POWER FORWARD',move:'Raging Bull',speed:21,window:95,dunk:9},
  {key:'machamp',name:'Machamp',team:0,role:'PLAYMAKER',move:'Bullet Pass',speed:19,window:105,dunk:10},
  {key:'heatmor',name:'Heatmor',team:1,role:'SHARPSHOOTER',move:'Heat Check',speed:20,window:135,dunk:7},
  {key:'charizard',name:'Charizard',team:1,role:'HIGH FLYER',move:'Sky Slam',speed:22,window:105,dunk:12}
];
export const TUNING={width:100,height:56,matchMs:180000,shotClockMs:24000,countdownMs:3000,deadballMs:1250,
  radius:1.65,threeRange:24,shotSweetMs:450,maxChargeMs:1050,shotFlightMs:950,passSpeed:65,
  stealRange:4,stealRecoveryMs:650,blockRecoveryMs:750,turboDrain:32,turboFill:20,dunkCost:20};
export const neutral=()=>({seq:0,controlEpoch:0,x:0,y:0,held:0,pressed:0,released:0});
export const hoop=team=>({x:team===0?94:6,y:28});
