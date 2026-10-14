import test from 'node:test';
import assert from 'node:assert/strict';
import {A,neutral} from '../public/game/data.js';
import {createControls} from '../public/controls.js';

test('combo remembers modifier before release',()=>{
 const c=createControls();for(const key of ['ShiftLeft','KeyJ'])c.keyDown(key);
 c.keyUp('KeyJ');c.keyUp('ShiftLeft');
 assert.equal(c.read().turboActions,A.PASS);assert.equal(c.read().held,0);
 assert.ok(c.read().pressed&A.PASS);assert.ok(c.read().released&A.PASS);
 c.consumeEdges();assert.equal(c.read().turboActions,0);c.reset();assert.deepEqual(c.read(),neutral());
});
test('later Shift does not rewrite action',()=>{
 const c=createControls();c.keyDown('KeyJ');c.keyDown('ShiftLeft');assert.equal(c.read().turboActions,0);
 c.consumeEdges();c.keyDown('KeyJ');assert.equal(c.read().pressed,0);assert.equal(c.read().turboActions,0);
 c.reset();assert.deepEqual(c.read(),neutral());assert.equal(c.keyDown('KeyQ'),false);
});
test('either Shift keeps turbo active',()=>{
 const c=createControls();c.keyDown('ShiftLeft');c.keyDown('ShiftRight');c.keyUp('ShiftLeft');
 assert.ok(c.read().held&A.TURBO);c.keyDown('KeyK');assert.equal(c.read().turboActions,A.SHOOT);
 c.keyUp('ShiftRight');assert.equal(c.read().held&A.TURBO,0);
});

test('OS repeat after a reset stays neutral until release and fresh press',()=>{
 const c=createControls();for(const key of ['KeyK','Space','ShiftLeft','ArrowRight']){c.keyDown(key);c.reset();assert.equal(c.keyDown(key,true),true);assert.deepEqual(c.read(),neutral());c.keyUp(key);c.keyDown(key);assert.notDeepEqual(c.read(),neutral());c.reset();}
});
