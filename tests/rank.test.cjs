const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRankService, replayResult, RankError } = require('../lib/rank-service.cjs');
class MemoryStore {
  constructor() { this.data = new Map(); this.counter = 0; }
  async read(key) { const value = this.data.get(key); return value ? structuredClone(value) : null; }
  async write(key, value, etag) {
    const previous = this.data.get(key);
    if (previous && etag !== previous.etag || !previous && etag) { const e = Error('conflict'); e.name = 'BlobPreconditionFailedError'; throw e; }
    this.data.set(key, { value: structuredClone(value), etag: String(++this.counter) });
  }
}
const player = () => ({ playerId: randomUUID(), playerKey: 'a'.repeat(64), name: 'Туршилтын баатар', difficulty: 'normal' });
const fixtureResult = { rp: 200, won: true, kills: 5, forts: 2, camps: 8, seconds: 180 };
test('global ranking starts empty, persists results, and never returns credentials', async () => {
  const store = new MemoryStore(), service = createRankService({ store, now: () => 1000000, simulate: () => fixtureResult });
  assert.equal((await service.leaderboard()).total, 0);
  const p = player(), ticket = await service.start(p);
  const response = await service.finish({ id: ticket.id, token: ticket.token });
  assert.equal(response.player.rp, 200); assert.equal(response.verified, true);
  const otherInstance = createRankService({ store }), publicData = await otherInstance.leaderboard(p.playerId);
  assert.equal(publicData.total, 1); assert.equal(publicData.me.wins, 1);
  assert.equal(JSON.stringify(publicData).includes(p.playerKey), false);
  assert.equal(JSON.stringify(publicData).includes(ticket.token), false);
});
test('retries and simultaneous submissions count a match exactly once', async () => {
  const store = new MemoryStore(), service = createRankService({ store, now: () => 1000000, simulate: () => fixtureResult });
  const p = player(), ticket = await service.start(p), body = { id: ticket.id, token: ticket.token };
  await Promise.all([service.finish(body), service.finish(body), service.finish(body)]);
  const response = await service.finish(body);
  assert.equal(response.player.matches, 1); assert.equal(response.player.rp, 200);
});
test('simultaneous players do not overwrite one another in the shared ladder', async () => {
  const store = new MemoryStore(), service = createRankService({ store, now: () => 1000000, simulate: () => fixtureResult });
  const tickets = await Promise.all([service.start(player()), service.start(player())]);
  await Promise.all(tickets.map(t => service.finish({ id: t.id, token: t.token })));
  assert.equal((await service.leaderboard()).total, 2);
});
test('profile and match secrets are checked; sessions expire; new starts are throttled', async () => {
  let time = 1000000; const service = createRankService({ store: new MemoryStore(), now: () => time, simulate: () => fixtureResult });
  const p = player(), ticket = await service.start(p);
  await assert.rejects(service.start({ ...p, playerKey: 'b'.repeat(64) }), e => e.status === 403);
  await assert.rejects(service.start(p), e => e.status === 429);
  await assert.rejects(service.finish({ id: ticket.id, token: 'b'.repeat(64) }), e => e.status === 403);
  time += 86400001;
  await assert.rejects(service.finish({ id: ticket.id, token: ticket.token }), e => e.status === 410);
});
test('unfinished matches, invalid commands, and accelerated replays cannot earn RP', () => {
  const session = { createdAt: 0, seed: 884, difficulty: 'normal' };
  assert.throws(() => replayResult(session, { frames: 30, commands: [] }, 20000), e => e.status === 400);
  assert.throws(() => replayResult(session, { frames: 10000, commands: [] }, 1000), e => e.status === 400);
  assert.throws(() => replayResult(session, { frames: 30, commands: [{ frame: 0, cmd: { type: 'upgrade', owner: 3 } }, { frame: 0, cmd: { type: 'upgrade' } }] }, 20000), RankError);
  assert.throws(() => replayResult(session, { frames: 30, commands: [{ frame: -1, cmd: { type: 'move' } }] }, 20000), RankError);
});
test('a complete deterministic game is replayed and client-supplied scores are ignored', () => {
  const E = require('../lib/engine.cjs'), session = { createdAt: 0, seed: 103451, difficulty: 'normal' }, state = E.create([0], {}, { seed: session.seed, difficulty: session.difficulty });
  state.phase = 'playing'; let frames = 0;
  while (state.phase === 'playing' && !(E.counts(state)[0] === 0 && E.owned(state, 0).length === 0)) { E.tick(state, 1/30); frames++; }
  const result = replayResult(session, { frames, commands: [], rp: 9999999, winner: 0 }, 800000);
  assert.deepEqual(result, E.rankPoints(state, 0)); assert.ok(result.rp <= 1000);
});
