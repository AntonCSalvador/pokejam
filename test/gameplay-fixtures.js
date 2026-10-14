import {createMatch,stepMatch} from '../public/game/simulation.js';
import {neutral} from '../public/game/data.js';
export function live(selection){const m=createMatch({selection});m.phase='live';m.players.forEach((p,i)=>{p.x=20+i*18;p.y=i%2?48:8;});return m;}
export function giveBall(m,id){const p=m.players[id];m.ball={mode:'held',holder:id,x:p.x,y:p.y,z:2,lastTeam:p.team};m.possessionTeam=p.team;}
export const act=(id,fields={})=>new Map([[id,{...neutral(),...fields}]]);
export function advance(m,ticks,inputs=new Map()){for(let i=0;i<ticks;i++)stepMatch(m,inputs);return m;}
