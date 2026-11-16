const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../lib/engine.cjs');
const { app } = require('./ui-harness.cjs');
function state() { const s=E.create([0,1,2,3]);s.phase='playing';s.gold[0]=2000;return s; }
test('training improves current troops, preserves wounds, and applies to future recruits of that class', () => {
  const s=state(),u=E.owned(s,0).find(u=>u.type==='cavalry'),other=E.owned(s,0).find(u=>u.type==='archer');
  u.hp=u.maxHp/2;
  assert.equal(E.command(s,0,{type:'train',unit:'cavalry'}),true);
  assert.equal(s.gold[0],1900);assert.equal(u.level,2);assert.equal(u.maxHp,51);assert.equal(u.hp/u.maxHp,.5);
  assert.equal(other.level,1);assert.equal(E.owned(s,1).find(u=>u.type==='cavalry').level,1);
  const last=s.uid;assert.equal(E.command(s,0,{type:'recruit',unit:'cavalry',camp:0}),true);
  assert.ok(s.units.filter(u=>u.id>last).every(u=>u.level===2&&u.maxHp===51));
  assert.equal(E.command(s,0,{type:'train',unit:'cavalry'}),false,'higher training needs country level 2');
  s.nationXp[0]=100;assert.equal(E.command(s,0,{type:'train',unit:'cavalry'}),true);assert.equal(u.level,3);
});
test('combat grants individual XP, raises strength, and never restores a wounded soldier to full health', () => {
  const s=state(),hero=E.owned(s,0).find(u=>u.type==='hero'),enemy=s.units.find(u=>u.owner===-1);
  s.units=[hero,enemy];hero.x=hero.tx=900;hero.y=hero.ty=500;hero.cd=0;hero.hp=45;hero.xp=28;
  enemy.x=enemy.tx=920;enemy.y=enemy.ty=500;enemy.hp=1;
  E.tick(s,1/30);
  assert.equal(hero.level,2);assert.equal(hero.xp,42);assert.equal(hero.maxHp,104);assert.equal(hero.hp,52);
  assert.equal(s.kills[0],1);assert.equal(s.nationXp[0],10);assert.equal(E.unitPower(hero),1.12);
});
test('capturing a camp develops the country and the soldiers who actually captured it', () => {
  const s=state(),hero=E.owned(s,0)[0],camp=s.camps[4],distant=E.owned(s,0)[1];s.units=[hero,distant];
  hero.x=hero.tx=camp.x;hero.y=hero.ty=camp.y;
  for(let n=0;n<185;n++)E.tick(s,1/30);
  assert.equal(camp.owner,0);assert.equal(E.nationLevel(s,0),2);assert.equal(s.nationXp[0],100);
  assert.equal(hero.xp,20);assert.equal(distant.xp,0);
  assert.ok(s.events.some(e=>e.kind==='nationLevel'&&e.owner===0));
});
test('training keeps veteran progress, enforces maximum levels and rejects unsupported purchases', () => {
  const s=state(),u=E.owned(s,0)[1];u.xp=240;u.level=5;u.maxHp=70;u.hp=35;
  assert.equal(E.command(s,0,{type:'train',unit:'cavalry'}),true);assert.equal(u.xp,240);assert.equal(u.hp,35);
  const before=s.gold[0];assert.equal(E.command(s,0,{type:'train',unit:'guard'}),false);assert.equal(s.gold[0],before);
  s.nationXp[0]=1100;for(let n=0;n<3;n++)assert.equal(E.command(s,0,{type:'train',unit:'cavalry'}),true);
  assert.equal(s.training[0].cavalry,5);assert.equal(E.command(s,0,{type:'train',unit:'cavalry'}),false);
});
test('save and room snapshots preserve developed troops and reject malformed XP', () => {
  const a=app();a.click('start');a.steppe.state.gold[0]=500;a.steppe.command({type:'train',unit:'hero'});
  const w=a.steppe.pack().w,copy=a.steppe.unpack(w),hero=copy.units.find(u=>u.owner===0&&u.type==='hero');
  assert.equal(hero.level,2);assert.equal(hero.maxHp,104);assert.equal(hero.xp,30);assert.equal(copy.training[0].hero,2);
  a.fire('beforeunload');const b=app({saved:a.storage});b.click('resume');assert.equal(b.steppe.state.training[0].hero,2);
  assert.equal(b.steppe.state.units.find(u=>u.type==='hero'&&u.owner===0).level,2);
  copy.units[0].xp=Infinity;assert.equal(E.valid(copy),false);assert.equal(E.valid({...E.create(),units:{}}),false);
});
test('a thumb can slide to another direction, move diagonally, and use dash with a second finger', () => {
  const a=app({width:430,height:932});a.click('start');const pad=a.document.getElementById('heroPad');pad.rect={left:0,top:0,width:168,height:168};
  const hero=a.steppe.state.units.find(u=>u.owner===0&&u.type==='hero'),x=hero.x,y=hero.y;
  pad.dispatch('pointerdown',{pointerId:1,clientX:155,clientY:84});a.frames(12);
  assert.ok(hero.x>x+10);assert.equal(a.steppe.state.heroControls[0].dy,0);
  pad.dispatch('pointermove',{pointerId:1,clientX:150,clientY:20});a.frames(12);
  assert.ok(hero.y<y-5);a.click('heroDash');assert.ok(a.steppe.state.heroControls[0].dashReady>0);
  pad.dispatch('lostpointercapture',{pointerId:1});a.frames(3);assert.equal(a.steppe.state.heroControls[0].dx,0);assert.equal(a.steppe.state.heroControls[0].dy,0);
});
test('opening the development sheet releases movement and purchases update its displayed levels', () => {
  const a=app({width:375,height:667});a.click('start');const right=a.document.querySelectorAll('[data-dir]').find(b=>b.dataset.dir==='right');
  right.dispatch('pointerdown',{pointerId:1});a.frames(10);a.click('mobileDevelopment');assert.equal(a.steppe.state.heroControls[0].dx,0);
  assert.equal(a.document.getElementById('developmentDialog').open,true);a.click('traincavalry');
  assert.equal(a.steppe.state.training[0].cavalry,2);assert.equal(a.document.getElementById('trainingLevelcavalry').textContent,'ТҮВШИН 2');
  a.click('returnToBattle');a.frames(5);assert.equal(a.steppe.state.heroControls[0].dx,0);
});
