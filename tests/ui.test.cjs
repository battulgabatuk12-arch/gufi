const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app, Broker } = require('./ui-harness.cjs');
const SAVE = 'mongol-baatruud-steppe-save-v1';
test('desktop start, keyboard movement, dash, pause, and strategy toggle', () => {
  const a = app(); a.click('startShortcut');
  assert.equal(a.steppe.heroMode, true);
  const hero = a.steppe.state.units.find(u => u.owner === 0 && u.type === 'hero'), x = hero.x;
  a.fire('keydown', { key: 'd' }); a.frames(15); a.fire('keyup', { key: 'd' }); a.frame();
  assert.ok(hero.x > x + 15);
  a.fire('keydown', { key: ' ' }); a.fire('keyup', { key: ' ' });
  assert.ok(a.steppe.state.heroControls[0].dashReady > 0);
  a.click('pause'); const t = a.steppe.state.time; a.frames(10); assert.equal(a.steppe.state.time, t);
  a.click('unpause'); a.click('heroToggle'); assert.equal(a.steppe.heroMode, false);
  a.fire('keydown', { key: 'h' }); a.fire('keyup', { key: 'h' }); assert.equal(a.steppe.heroMode, true);
});
test('phone direction buttons move and release, and pointer cancellation clears them', () => {
  const a = app({ width: 390, height: 844 }); a.click('startShortcut');
  assert.equal(a.document.getElementById('heroPad').hidden, false);
  const button = a.document.querySelectorAll('[data-dir]').find(b => b.dataset.dir === 'right');
  const hero = a.steppe.state.units.find(u => u.owner === 0 && u.type === 'hero'), x = hero.x;
  button.dispatch('pointerdown', { pointerId: 1 }); a.frames(15); button.dispatch('pointercancel', { pointerId: 1 }); a.frames(2);
  assert.ok(hero.x > x + 15);
  assert.equal(a.steppe.state.heroControls[0].dx, 0);
  assert.equal(button.classList.contains('pressed'), false);
  a.click('heroEscort'); assert.equal(a.steppe.escortOn, false);
});
test('save and resume restore selected difficulty and speed; a new game resets speed', () => {
  const a = app(); a.document.querySelectorAll('[data-diff]').find(b => b.dataset.diff === 'hard').click();
  a.click('start'); a.click('speed'); a.click('speed'); a.frames(4); a.fire('beforeunload');
  const b = app({ saved: a.storage }); assert.equal(b.document.getElementById('resume').hidden, false);
  b.click('resume');
  assert.equal(b.steppe.difficulty, 'hard'); assert.equal(b.steppe.speed, 2);
  assert.equal(b.document.getElementById('speed').querySelector('small').textContent, '2×');
  b.click('newGame'); b.click('start'); assert.equal(b.steppe.speed, 1);
  assert.equal(b.document.getElementById('speed').querySelector('small').textContent, '1×');
});
test('invalid saved games hide resume and fall back to a playable game', () => {
  const a = app({ saved: [[SAVE, '{broken json']] }); assert.equal(a.document.getElementById('resume').hidden, true);
  a.steppe.startSolo(true); a.frame(); assert.equal(a.steppe.state.phase, 'playing');
});
test('tab visibility saves and pauses solo play without stale movement', () => {
  const a = app(); a.click('start'); a.fire('keydown', { key: 'w' }); a.frames(5);
  a.document.hidden = true; a.document.dispatch('visibilitychange');
  assert.equal(a.steppe.paused, true); assert.ok(a.storage.has(SAVE));
  a.document.hidden = false; a.document.dispatch('visibilitychange'); a.click('unpause'); a.frames(5);
  assert.equal(a.steppe.state.heroControls[0].dy, 0);
});
test('host and guest exchange room, hero controls, escort, and dash packets', () => {
  const broker = new Broker(), host = app({ broker }), guest = app({ broker });
  host.click('friendLaunch'); host.click('createRoom'); broker.flush();
  const code = host.document.getElementById('roomCode').textContent; assert.match(code, /^\d{6}$/);
  guest.click('friendLaunch'); guest.document.getElementById('roomCodeInput').value = code; guest.click('joinRoom'); broker.flush();
  assert.equal(host.document.getElementById('launchOnline').disabled, false);
  host.click('launchOnline'); broker.flush();
  assert.equal(guest.steppe.role, 'guest'); assert.equal(guest.steppe.mine, 1); assert.equal(guest.steppe.heroMode, true);
  assert.equal(host.steppe.state.heroControls[1].active, true);
  assert.equal(host.steppe.state.heroControls[1].follow, true, 'burst of start commands must all reach the host');
  const hero = host.steppe.state.units.find(u => u.owner === 1 && u.type === 'hero'), x = hero.x;
  guest.fire('keydown', { key: 'd' });
  for (let i = 0; i < 20; i++) { guest.frame(); host.frame(); }
  guest.fire('keyup', { key: 'd' });
  assert.ok(hero.x > x + 15);
  guest.click('heroDash'); broker.flush(); assert.ok(host.steppe.state.heroControls[1].dashReady > 0);
  guest.click('heroEscort'); broker.flush(); assert.equal(host.steppe.state.heroControls[1].follow, false);
});
test('the new lobby launches play and the fortification button upgrades an owned camp', () => {
  const a = app({ width: 390, height: 844 });
  assert.equal(a.document.getElementById('launchpad').hidden, false);
  a.click('startShortcut'); assert.equal(a.document.getElementById('launchpad').hidden, true);
  assert.equal(a.document.getElementById('fortTools').hidden, false);
  a.click('fortify'); assert.equal(a.steppe.state.camps[0].fortLevel, 2);
  assert.equal(a.steppe.state.camps[0].fortHp, 460);
  a.click('newGame'); assert.equal(a.document.getElementById('launchpad').hidden, false);
});
test('ranked play uses fixed steps and exact save/resume positions reproduce the command log', async () => {
  const ticket = { id: '0bd2bfe3-78e0-4071-b8bd-c796e7a606af', token: 'a'.repeat(64), seed: 93472, difficulty: 'normal', version: '4.0' };
  const fetchImpl = async () => ({ ok: true, json: async () => ticket });
  const a = app({ fetchImpl }); a.document.getElementById('playerNickname').value = 'Туршилтын баатар'; await a.click('rankedStart');
  assert.equal(a.steppe.ranked, true); assert.equal(a.steppe.speed, 1);
  a.fire('keydown', { key: 'd' }); a.frames(23); a.fire('keyup', { key: 'd' }); a.frame(); a.fire('beforeunload');
  const b = app({ fetchImpl, saved: a.storage }); b.click('homeResume');
  b.fire('keydown', { key: 'w' }); b.frames(19); b.fire('keyup', { key: 'w' }); b.frame();
  const E = require('../lib/engine.cjs'), expected = E.create([0], {}, { seed: ticket.seed, difficulty: ticket.difficulty }); expected.phase = 'playing';
  const commands = b.steppe.replay; let cursor = 0;
  for (let frame = 0; frame <= b.steppe.simFrame; frame++) {
    while (cursor < commands.length && commands[cursor].frame === frame) assert.equal(E.command(expected, 0, commands[cursor++].cmd), true);
    if (frame < b.steppe.simFrame) E.tick(expected, 1/30);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(b.context.SteppeEngine.snapshot(b.steppe.state))), JSON.parse(JSON.stringify(E.snapshot(expected))));
});
