import {A,neutral} from './game/data.js';
const buttons={ShiftLeft:A.TURBO,ShiftRight:A.TURBO,KeyJ:A.PASS,KeyK:A.SHOOT,KeyL:A.SPECIAL,Space:A.SWITCH};
const movement=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);
export function createControls(){
 const keys=new Set();let pressed=0,released=0,turboActions=0;
 const turbo=()=>keys.has('ShiftLeft')||keys.has('ShiftRight');
 const consumeEdges=()=>{pressed=released=turboActions=0;};
 return {
  keyDown(code){
   if(!buttons[code]&&!movement.has(code))return false;
   if(!keys.has(code)){const bit=buttons[code]||0;pressed|=bit;if(turbo()&&(bit&(A.PASS|A.SHOOT)))turboActions|=bit;keys.add(code);}
   return true;
  },
  keyUp(code){if(!keys.delete(code))return false;const bit=buttons[code]||0;if(bit!==A.TURBO||!turbo())released|=bit;return true;},
  read(){const i=neutral();i.x=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));i.y=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));for(const key of keys)i.held|=buttons[key]||0;return {...i,pressed,released,turboActions};},
  consumeEdges,
  reset(){keys.clear();consumeEdges();}
 };
}
