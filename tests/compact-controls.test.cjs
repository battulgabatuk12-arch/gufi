const {test}=require('node:test');
const assert=require('node:assert/strict');
const {app}=require('./ui-harness.cjs');
function tap(a,x,y){
 const map=a.document.getElementById('map'),p=a.steppe.renderer.worldToScreen(x,y),r=map.getBoundingClientRect();
 const e={pointerId:8,pointerType:'touch',button:0,clientX:r.left+p.x,clientY:r.top+p.y};
 map.dispatch('pointerdown',e);map.dispatch('pointerup',e);
}
function start(){const a=app({width:430,height:900});a.click('start');return a;}
test('a phone tap moves to a destination, stops on arrival, and keeps the joystick and escort active',()=>{
 const a=start(),hero=a.steppe.state.units.find(u=>u.owner===0&&u.type==='hero'),x=hero.x+140,y=hero.y-30;
 tap(a,x,y);a.frames(180);
 assert.ok(Math.hypot(hero.x-x,hero.y-y)<12);assert.equal(a.steppe.heroMode,true);
 assert.equal(a.document.getElementById('heroPad').hidden,false);assert.equal(a.steppe.state.heroControls[0].follow,true);
 const stopped={x:hero.x,y:hero.y};a.frames(20);assert.equal(hero.x,stopped.x);assert.equal(hero.y,stopped.y);
});
test('manual direction replaces a tap destination and releasing it stops the hero',()=>{
 const a=start(),hero=a.steppe.state.units.find(u=>u.owner===0&&u.type==='hero');tap(a,hero.x+250,hero.y-30);a.frames(20);
 const left=a.document.querySelectorAll('[data-dir]').find(b=>b.dataset.dir==='left'),x=hero.x;
 left.dispatch('pointerdown',{pointerId:3});a.frames(12);assert.ok(hero.x<x-10);
 left.dispatch('pointerup',{pointerId:3});a.frames(2);const stopX=hero.x;a.frames(30);
 assert.equal(hero.x,stopX);assert.equal(a.steppe.state.heroControls[0].dx,0);
});
test('panning the map stays where it was dragged until the player uses the joystick',()=>{
 const a=start(),map=a.document.getElementById('map'),before=a.steppe.camera.x;
 map.dispatch('pointerdown',{pointerId:4,pointerType:'touch',button:0,clientX:150,clientY:300});
 map.dispatch('pointermove',{pointerId:4,pointerType:'touch',button:0,clientX:250,clientY:300});
 map.dispatch('pointerup',{pointerId:4,pointerType:'touch',button:0,clientX:250,clientY:300});
 a.frames(15);assert.ok(Math.abs(a.steppe.camera.x-before)>40);
 const right=a.document.querySelectorAll('[data-dir]').find(b=>b.dataset.dir==='right');right.dispatch('pointerdown',{pointerId:5});a.frame();
 const hero=a.steppe.state.units.find(u=>u.owner===0&&u.type==='hero');assert.ok(Math.abs(a.steppe.camera.x-hero.x)<1);
});
test('opening either compact menu stops tap travel and exposes the existing army actions',()=>{
 const a=start(),hero=a.steppe.state.units.find(u=>u.owner===0&&u.type==='hero');
 tap(a,hero.x+200,hero.y);a.frames(10);a.click('mobileOrders');assert.equal(a.document.getElementById('sidebar').classList.contains('open'),true);
 assert.equal(a.steppe.state.heroControls[0].dx,0);const x=hero.x;a.frames(10);assert.equal(hero.x,x);
 a.click('sidebarScrim');tap(a,hero.x+200,hero.y);a.frames(10);a.click('mobileDevelopment');
 assert.equal(a.document.getElementById('developmentDialog').open,true);assert.equal(a.steppe.state.heroControls[0].dx,0);
});
