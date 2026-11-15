const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const context = vm.createContext({});
vm.runInContext(scripts.find(s => s.includes('// Authoritative,')), context);
const E = context.SteppeEngine;
const copy = value => JSON.parse(JSON.stringify(value));
function world(owner = 0) {
  const s = E.create([0, 1, 2, 3]);
  s.phase = 'playing';
  s.units = [s.units.find(u => u.owner === owner && u.type === 'hero')];
  s.units[0].x = s.units[0].tx = 900;
  s.units[0].y = s.units[0].ty = 500;
  return s;
}
function advance(s, seconds, input) {
  for (let elapsed = 0; elapsed < seconds - 1e-8; elapsed += 1 / 60) {
    if (input) E.command(s, s.units[0].owner, { type: 'heroControl', active: true, ...input });
    E.tick(s, 1 / 60);
  }
}
test('all six embedded scripts parse without syntax errors', () => {
  assert.equal(scripts.length, 6);
  for (const script of scripts) new vm.Script(script);
});
test('hero moves in each of the four requested directions', () => {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const s = world();
    advance(s, .25, { dx, dy });
    assert.ok(Math.abs(s.units[0].x - (900 + dx * 20)) < .01);
    assert.ok(Math.abs(s.units[0].y - (500 + dy * 20)) < .01);
  }
});
test('diagonal movement has the same speed as straight movement', () => {
  const s = world();
  advance(s, .25, { dx: 1, dy: 1 });
  assert.ok(Math.abs(Math.hypot(s.units[0].x - 900, s.units[0].y - 500) - 20) < .01);
});
test('stale input expires and releasing input stops movement', () => {
  const s = world();
  E.command(s, 0, { type: 'heroControl', active: true, dx: 1, dy: 0 });
  advance(s, 1);
  assert.ok(s.units[0].x > 929 && s.units[0].x < 933);
  const x = s.units[0].x;
  advance(s, 1);
  assert.equal(s.units[0].x, x);
  E.command(s, 0, { type: 'heroControl', active: true, dx: 0, dy: 0 });
  advance(s, .25);
  assert.equal(s.units[0].x, x);
});
test('manual control permits disengaging from a nearby enemy', () => {
  const s = world(), enemy = E.create().units.find(u => u.owner === 1 && u.type === 'hero');
  enemy.id = ++s.uid; enemy.x = enemy.tx = 925; enemy.y = enemy.ty = 500; enemy.hold = true;
  s.units.push(enemy);
  advance(s, .25, { dx: -1, dy: 0 });
  assert.ok(s.units[0].x < 885);
  assert.ok(enemy.hp < 90, 'hero still automatically attacks in melee range');
});
test('dash increases speed, costs no gold, and respects its cooldown', () => {
  const s = world();
  E.command(s, 0, { type: 'heroControl', active: true, dx: 1, dy: 0 });
  assert.equal(E.command(s, 0, { type: 'dash' }), true);
  assert.equal(E.command(s, 0, { type: 'dash' }), false);
  advance(s, .25, { dx: 1, dy: 0 });
  assert.ok(Math.abs(s.units[0].x - 950) < .01);
  assert.equal(s.gold[0], 180);
  advance(s, 8);
  assert.equal(E.command(s, 0, { type: 'dash' }), true);
});
test('an owner can only control their own hero and invalid input changes nothing', () => {
  const s = world(), before = JSON.stringify(s);
  for (const [owner, cmd] of [[1, { active: true, dx: 1, dy: 0 }], [0, { active: true, dx: NaN, dy: 0 }], [0, { active: true, dx: 9, dy: 0 }], [0, { active: 'yes', dx: 1, dy: 0 }]]) {
    assert.equal(E.command(s, owner, { type: 'heroControl', ...cmd }), false);
  }
  assert.equal(JSON.stringify(s), before);
  assert.equal(E.command(s, 1, { type: 'dash' }), false);
});
test('hero cannot travel outside the battlefield', () => {
  const s = world(); s.units[0].x = 13; s.units[0].y = 13;
  advance(s, 1, { dx: -1, dy: -1 });
  assert.ok(s.units[0].x >= 12 && s.units[0].y >= 12);
});
test('escort troops follow the hero and stop following when released', () => {
  const s = world(), soldier = E.create().units.find(u => u.owner === 0 && u.type === 'cavalry');
  soldier.id = ++s.uid; soldier.x = soldier.tx = 600; soldier.y = soldier.ty = 500; s.units.push(soldier);
  E.command(s, 0, { type: 'heroControl', active: true, dx: 0, dy: 0 });
  E.command(s, 0, { type: 'escort', follow: true });
  advance(s, 1);
  assert.ok(soldier.x > 670);
  E.command(s, 0, { type: 'escort', follow: false });
  const x = soldier.x;
  advance(s, 1);
  assert.equal(soldier.x, x);
});
test('a map order containing the hero restores army control', () => {
  const s = world();
  E.command(s, 0, { type: 'heroControl', active: true, dx: 1, dy: 0 });
  E.command(s, 0, { type: 'escort', follow: true });
  E.command(s, 0, { type: 'move', ids: [s.units[0].id], x: 800, y: 500 });
  assert.equal(s.heroControls[0].active, false);
  assert.equal(s.heroControls[0].follow, false);
  advance(s, .25);
  assert.ok(s.units[0].x < 900);
});
test('the hero captures neutral camps and mines and earns their income', () => {
  const s = world(), hero = s.units[0], camp = s.camps[4];
  hero.x = hero.tx = camp.x; hero.y = hero.ty = camp.y;
  advance(s, 6.1);
  assert.equal(camp.owner, 0);
  assert.equal(camp.fortLevel, 1);
  assert.equal(camp.fortHp, 260);
  const mine = s.mines[0]; hero.x = hero.tx = mine.x; hero.y = hero.ty = mine.y;
  advance(s, 4.1);
  assert.equal(mine.owner, 0);
  assert.equal(E.rate(s, 0), 9);
  assert.ok(s.gold[0] >= 180 + 40 + 70 + 55);
});
test('owned camps upgrade to stone and enemies cannot buy their fortifications', () => {
  const s = world(); s.gold[0] = 500;
  assert.equal(E.command(s, 1, { type: 'fortify', camp: 0 }), false);
  assert.equal(E.command(s, 0, { type: 'fortify', camp: 0 }), true);
  assert.equal(s.camps[0].fortLevel, 2); assert.equal(s.camps[0].fortHp, 460); assert.equal(s.gold[0], 340);
  assert.equal(E.command(s, 0, { type: 'fortify', camp: 0 }), false);
  s.camps[0].fortHp = 0;
  assert.equal(E.command(s, 0, { type: 'fortify', camp: 0 }), true);
  assert.equal(s.camps[0].fortLevel, 1); assert.equal(s.gold[0], 240);
});
test('repairs restore health only when enemies are clear and a cooldown applies', () => {
  const s = world(), camp = s.camps[0]; camp.fortHp = 100;
  const enemy = E.create().units.find(u => u.owner === 1); enemy.id = ++s.uid; enemy.x = camp.x + 100; enemy.y = camp.y; s.units.push(enemy);
  assert.equal(E.command(s, 0, { type: 'repair', camp: 0 }), false);
  s.units.pop(); assert.equal(E.command(s, 0, { type: 'repair', camp: 0 }), true);
  assert.equal(camp.fortHp, 260); assert.equal(s.gold[0], 140);
  camp.fortHp = 100; assert.equal(E.command(s, 0, { type: 'repair', camp: 0 }), false);
});
test('a camp cannot be occupied until its perimeter is breached', () => {
  const s = world(), camp = s.camps[1], hero = s.units[0];
  hero.x = hero.tx = camp.x; hero.y = hero.ty = camp.y + 85; camp.fortHp = 48;
  advance(s, .5, { dx: 0, dy: -1 });
  assert.equal(camp.owner, 1); assert.equal(camp.capture, 0); assert.ok(camp.fortHp < 48);
  assert.ok(Math.hypot((hero.x-camp.x)/104,(hero.y-camp.y)/74) >= 1.07);
  for (let i = 0; i < 300 && camp.fortHp > 0; i++) advance(s, 1/60, { dx: 0, dy: -1 });
  assert.equal(camp.fortHp, 0);
  E.command(s, 0, { type: 'heroControl', active: false, dx: 0, dy: 0 });
  E.command(s, 0, { type: 'move', ids: [hero.id], x: camp.x, y: camp.y, camp: camp.id }); advance(s, 8);
  assert.equal(camp.owner, 0); assert.equal(camp.fortHp, 260);
});
test('ranking tiers and RP depend on the simulated result', () => {
  const s = world(); s.phase = 'ended'; s.winner = 0; s.kills[0] = 5; s.fortsBuilt[0] = 2;
  assert.equal(E.rankPoints(s, 0).rp, 202);
  assert.equal(E.rankTier(249).name, 'Шинэ дайчин'); assert.equal(E.rankTier(250).name, 'Хүрэл');
  assert.equal(E.rankTier(6000).name, 'Их хаан'); assert.equal(E.rankTier(6000).next, null);
});
test('save roundtrips preserve hero state; 3.2 saves acquire safe defaults', () => {
  const s = world();
  E.command(s, 0, { type: 'heroControl', active: true, dx: 0, dy: 1 });
  E.command(s, 0, { type: 'dash' });
  const saved = copy(E.snapshot(s));
  assert.equal(E.valid(saved), true);
  assert.equal(saved.heroControls[0].dashReady, 8);
  delete saved.heroControls;
  assert.equal(E.valid(saved), true);
  E.initExtras(saved);
  assert.equal(saved.heroControls[0].active, false);
});
test('malformed saves are rejected before simulation or UI can read them', () => {
  const s = copy(E.snapshot(world()));
  const mutations = [v => { v.names = null; }, v => { v.units[0].maxHp = 0; }, v => { v.units.push(copy(v.units[0])); }, v => { v.heroControls[0] = null; }, v => { v.skillReady[1] = {}; }, v => { v.mines[0] = null; }, v => { v.camps[0] = null; }, v => { v.flags[0].primary = 'bad'; }];
  for (const mutate of mutations) { const bad = copy(s); mutate(bad); assert.equal(E.valid(bad), false); }
});
test('compact room snapshots preserve hero cooldowns and fit the relay packet budget', () => {
  const s = E.create([0, 1, 2, 3]); s.phase = 'playing';
  for (let owner = 0; owner < 4; owner++) { s.gold[owner] = 9999; while (E.owned(s, owner).length < E.MAX) E.command(s, owner, { type: 'recruit', unit: 'cavalry', camp: owner }); }
  E.command(s, 2, { type: 'heroControl', active: true, dx: -1, dy: 1 }); E.command(s, 2, { type: 'dash' });
  const ui = scripts.find(s => s.includes('function pack()'));
  const from = ui.indexOf("const types=['hero'"); const to = ui.indexOf('function broadcastState()', from);
  const net = vm.createContext({ E, state: s, paused: false, networkSeq: 0 });
  vm.runInContext(ui.slice(from, to), net);
  const packet = net.pack(), incoming = net.unpack(copy(packet.w));
  assert.ok(Buffer.byteLength(JSON.stringify(packet)) < 50000);
  for (let owner = 0; owner < 4; owner++) assert.equal(E.owned(incoming, owner).length, 60);
  assert.equal(incoming.units.length, 258, 'four full armies plus eighteen neutral guards');
  assert.equal(incoming.heroControls[2].dashReady, 8);
  assert.equal(E.valid(incoming), true);
  const bad = copy(packet.w); bad.u[0][5] = 'not hp';
  assert.throws(() => net.unpack(bad));
});
test('a seeded bot battle stays valid and reaches a result', () => {
  const s = E.create([], {}, { difficulty: 'hard' }); s.phase = 'playing';
  for (let frame = 0; frame < 21610 && s.phase === 'playing'; frame++) E.tick(s, 1 / 30);
  assert.equal(s.phase, 'ended');
  assert.ok([-1, 0, 1, 2, 3].includes(s.winner));
  assert.equal(E.valid(copy(E.snapshot(s))), true);
});
