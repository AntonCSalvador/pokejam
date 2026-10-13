export const DT=1/60;
export const A={TURBO:1,PASS:2,SHOOT:4,SPECIAL:8,SWITCH:16};
export const TEAMS=[
  {key:'chicago',name:'Chicago Tauros',city:'Chicago',mascot:'Tauros',short:'CHI',color:'#ee4c59',dark:'#671f35',roster:['tauros','machamp','hitmontop'],emblem:'bull'},
  {key:'miami',name:'Miami Heatmors',city:'Miami',mascot:'Heatmors',short:'MIA',color:'#ffb33b',dark:'#803b20',roster:['heatmor','charizard','infernape'],emblem:'flame'},
  {key:'boston',name:'Boston Celebis',city:'Boston',mascot:'Celebis',short:'BOS',color:'#7bcd88',dark:'#245a45',roster:['celebi','gallade','breloom'],emblem:'leaf'},
  {key:'golden-state',name:'Golden State Wartortles',city:'Golden State',mascot:'Wartortles',short:'GSW',color:'#80baff',dark:'#244e8a',roster:['wartortle','blastoise','drednaw'],emblem:'shell'},
  {key:'toronto',name:'Toronto Tyrantrums',city:'Toronto',mascot:'Tyrantrums',short:'TOR',color:'#ed7d9d',dark:'#6b315a',roster:['tyrantrum','sceptile','aerodactyl'],emblem:'claw'},
  {key:'minnesota',name:'Minnesota Lycanrocs',city:'Minnesota',mascot:'Lycanrocs',short:'MIN',color:'#9edce7',dark:'#284e65',roster:['lycanroc','mightyena','lucario'],emblem:'wolf'},
  {key:'sacramento',name:'Sacramento Kingdras',city:'Sacramento',mascot:'Kingdras',short:'SAC',color:'#c4a0f2',dark:'#503674',roster:['kingdra','nidoking','slowking'],emblem:'crown'}
];
const profiles=[
  ['tauros','Tauros','POWER FORWARD','Raging Bull','dash',5,4,5,5],
  ['machamp','Machamp','PLAYMAKER','Bullet Pass','pass',3,5,6,5],
  ['hitmontop','Hitmontop','STEAL SPECIALIST','Spin Cycle','dash',8,3,3,9],
  ['heatmor','Heatmor','SHARPSHOOTER','Heat Check','heat',4,8,3,5],
  ['charizard','Charizard','HIGH FLYER','Sky Slam','sky',6,5,8,5],
  ['infernape','Infernape','FAST-BREAK GUARD','Flame Drive','dash',9,5,5,6],
  ['celebi','Celebi','CRAFTY PLAYMAKER','Future Assist','pass',7,6,2,8],
  ['gallade','Gallade','PRECISION SCORER','Sharp Shooter','heat',7,7,5,6],
  ['breloom','Breloom','BALL HAWK','Spore Step','dash',6,4,5,10],
  ['wartortle','Wartortle','SPLASH GUARD','Splash Zone','heat',7,8,2,6],
  ['blastoise','Blastoise','LONG-RANGE CANNON','Hydro Cannon','heat',2,10,6,4],
  ['drednaw','Drednaw','PAINT ENFORCER','Jawbreaker','sky',3,3,9,8],
  ['tyrantrum','Tyrantrum','RIM DESTROYER','Jurassic Jam','sky',3,3,10,4],
  ['sceptile','Sceptile','QUICK SLASHER','Leaf Break','dash',10,5,5,7],
  ['aerodactyl','Aerodactyl','AERIAL FINISHER','Fossil Flight','sky',8,4,9,6],
  ['lycanroc','Lycanroc','BREAKAWAY SCORER','Rock Rush','dash',10,4,5,8],
  ['mightyena','Mightyena','PRESSURE DEFENDER','Pack Attack','dash',8,3,4,10],
  ['lucario','Lucario','TWO-WAY PLAYMAKER','Aura Assist','pass',7,6,6,7],
  ['kingdra','Kingdra','PERIMETER ACE','Royal Flush','heat',5,10,3,5],
  ['nidoking','Nidoking','POWER FINISHER','Crown Crusher','sky',4,4,10,6],
  ['slowking','Slowking','COURT GENERAL',"King's Assist",'pass',2,8,4,6]
];
const descriptions={dash:'Wind up, then dash in your chosen direction. Works without the ball.',pass:'Fire one faster pass to your teammate. Requires the ball.',heat:'Widen your shot timing window for up to 5 seconds. Requires the ball.',sky:'Extend your dunk range for up to 5 seconds. Requires the ball.'};
// Menu ratings and authoritative mechanics derive from the same profile.
export const PLAYERS=Object.fromEntries(profiles.map(([key,name,role,move,ability,speed,shooting,dunk,steal])=>[key,
  {key,name,role,move,ability,description:descriptions[ability],ratings:{speed,shooting,dunk,steal},speed:16+speed,window:55+10*shooting,dunk:4+dunk,stealRecoveryMs:900-50*steal}
]));
export const getTeam=key=>TEAMS.find(t=>t.key===key);
export const defaultSelection=()=>({teamKeys:['chicago','miami'],playerKeys:['tauros','machamp','heatmor','charizard']});
export function validateSelection(value){
  if(!value||!Array.isArray(value.teamKeys)||value.teamKeys.length!==2||!Array.isArray(value.playerKeys)||value.playerKeys.length!==4||value.teamKeys[0]===value.teamKeys[1])return false;
  return value.teamKeys.every((key,side)=>{const team=getTeam(key),pair=value.playerKeys.slice(side*2,side*2+2);return !!team&&pair[0]!==pair[1]&&pair.every(p=>team.roster.includes(p));});
}
export const ROSTER=defaultSelection().playerKeys.map((key,id)=>({...PLAYERS[key],team:Math.floor(id/2)}));
export const TUNING={width:100,height:56,matchMs:180000,shotClockMs:24000,countdownMs:3000,deadballMs:1250,
  radius:1.65,threeRange:24,shotSweetMs:450,maxChargeMs:1050,shotFlightMs:950,passSpeed:65,
  stealRange:4,stealRecoveryMs:650,blockRecoveryMs:750,turboDrain:32,turboFill:20,dunkCost:20,
  dashWindupMs:200,dashMs:450,powerMs:5000,bulletMultiplier:1.8};
export const neutral=()=>({seq:0,controlEpoch:0,x:0,y:0,held:0,pressed:0,released:0});
export const hoop=team=>({x:team===0?94:6,y:28});
