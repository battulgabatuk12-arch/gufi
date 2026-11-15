const { randomBytes, randomUUID, createHash } = require('node:crypto');
const E = require('./engine.cjs');
const PREFIX = 'mongol-baatruud/season-1/';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SECRET = /^[a-f0-9]{64}$/;
const digest = s => createHash('sha256').update(s).digest('hex');
const cleanName = value => String(value || '').replace(/[<>\x00-\x1f]/g, '').trim().slice(0, 18);
class RankError extends Error { constructor(status, message) { super(message); this.status = status; } }
const conflict = error => /AlreadyExists|PreconditionFailed/.test(error?.name || '') || [409, 412].includes(error?.status) || /already exists|precondition/i.test(error?.message || '');

class BlobJsonStore {
  async client() { return import('@vercel/blob'); }
  async read(key) {
    const { get } = await this.client();
    const result = await get(PREFIX + key, { access: 'private', useCache: false });
    if (!result) return null;
    if (result.statusCode !== 200 || !result.stream) throw new RankError(503, 'Эрэмбийн сан түр завсарлаж байна.');
    return { value: await new Response(result.stream).json(), etag: result.blob.etag };
  }
  async write(key, value, etag, ttlDays) {
    const { put } = await this.client();
    return put(PREFIX + key, JSON.stringify(value), {
      access: 'private', addRandomSuffix: false, contentType: 'application/json',
      cacheControlMaxAge: 60, allowOverwrite: !!etag, ...(etag ? { ifMatch: etag } : {}), ...(ttlDays ? { ttlDays } : {})
    });
  }
}

function replayResult(session, body, now) {
  if (!Number.isInteger(body.frames) || body.frames < 1 || body.frames > 21601) throw new RankError(400, 'Аяны хугацаа буруу байна.');
  if (body.frames > Math.floor((now - session.createdAt + 5000) * .03)) throw new RankError(400, 'Аяны хугацаа серверийн хугацаатай тохирохгүй байна.');
  if (!Array.isArray(body.commands) || body.commands.length > 15000) throw new RankError(400, 'Тушаалын тоо буруу байна.');
  const types = new Set(['heroControl', 'escort', 'dash', 'flag', 'skill', 'move', 'stop', 'recruit', 'upgrade', 'fortify', 'repair']);
  let previous = -1;
  for (const entry of body.commands) {
    if (!entry || !Number.isInteger(entry.frame) || entry.frame < previous || entry.frame > body.frames || entry.frame < 0 || !entry.cmd || !types.has(entry.cmd.type)) throw new RankError(400, 'Тушаалын дараалал буруу байна.');
    previous = entry.frame;
  }
  const state = E.create([0], {}, { seed: session.seed, difficulty: session.difficulty });
  state.phase = 'playing'; let cursor = 0;
  for (let frame = 0; frame <= body.frames; frame++) {
    while (cursor < body.commands.length && body.commands[cursor].frame === frame) {
      if (!E.command(state, 0, body.commands[cursor++].cmd)) throw new RankError(400, 'Аяны тушаал баталгаажсангүй.');
    }
    if (frame === body.frames) break;
    if (state.phase !== 'playing') throw new RankError(400, 'Аян дууссаны дараах өгөгдөл байна.');
    E.tick(state, 1 / 30);
  }
  const defeated = E.counts(state)[0] === 0 && E.owned(state, 0).length === 0;
  if (state.phase !== 'ended' && !defeated) throw new RankError(400, 'Эхлээд аянаа дуусгаарай.');
  return E.rankPoints(state, 0);
}

function createRankService({ store = new BlobJsonStore(), now = Date.now, simulate = replayResult } = {}) {
  async function start(body) {
    if (!UUID.test(body.playerId || '') || !SECRET.test(body.playerKey || '')) throw new RankError(400, 'Тоглогчийн профайл буруу байна.');
    const name = cleanName(body.name); if (!name) throw new RankError(400, 'Баатрын хочоо бичээрэй.');
    const key = 'players/' + body.playerId + '.json', time = now();
    let player = await store.read(key);
    if (player && player.value.keyHash !== digest(body.playerKey)) throw new RankError(403, 'Энэ профайлын эрх тохирохгүй байна.');
    if (player && time - player.value.lastStarted < 15000) throw new RankError(429, 'Шинэ аян эхлэхээс өмнө 15 секунд хүлээгээрэй.');
    const record = { id: body.playerId, keyHash: digest(body.playerKey), lastStarted: time };
    try { await store.write(key, record, player?.etag); }
    catch (error) { if (conflict(error)) throw new RankError(409, 'Профайл шинэчлэгдсэн байна. Дахин оролдоорой.'); throw error; }
    const id = randomUUID(), token = randomBytes(32).toString('hex'), seed = randomBytes(4).readUInt32LE();
    const difficulty = body.difficulty === 'hard' ? 'hard' : 'normal';
    await store.write('sessions/' + id + '.json', { id, tokenHash: digest(token), playerId: body.playerId, name, seed, difficulty, createdAt: time }, null, 2);
    return { id, token, seed, difficulty, version: '4.0', expiresAt: time + 86400000 };
  }
  async function addResult(session, result) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const current = await store.read('leaderboard.json');
      const league = current?.value || { season: 1, players: {}, processed: {} };
      if (league.processed[session.id]) return league.players[session.playerId];
      if (!league.players[session.playerId] && Object.keys(league.players).length >= 10000) throw new RankError(503, 'Улирлын бүртгэл дүүрсэн байна.');
      const player = league.players[session.playerId] || { id: session.playerId, rp: 0, wins: 0, matches: 0, kills: 0, forts: 0 };
      Object.assign(player, { name: session.name, rp: player.rp + result.rp, wins: player.wins + Number(result.won), matches: player.matches + 1, kills: player.kills + result.kills, forts: player.forts + result.forts, updatedAt: now() });
      league.players[session.playerId] = player; league.processed[session.id] = now();
      for (const [id, time] of Object.entries(league.processed)) if (now() - time > 7 * 86400000) delete league.processed[id];
      try { await store.write('leaderboard.json', league, current?.etag); return player; }
      catch (error) { if (!conflict(error)) throw error; }
    }
    throw new RankError(409, 'Эрэмбэ шинэчлэгдэж байна. Дүнгээ дахин явуулаарай.');
  }
  async function finish(body) {
    if (!UUID.test(body.id || '') || !SECRET.test(body.token || '')) throw new RankError(400, 'Аяны тасалбар буруу байна.');
    const stored = await store.read('sessions/' + body.id + '.json'), session = stored?.value;
    if (!session || session.tokenHash !== digest(body.token)) throw new RankError(403, 'Аяны эрх баталгаажсангүй.');
    if (now() - session.createdAt > 86400000) throw new RankError(410, 'Энэ аяны дүн илгээх 24 цагийн хугацаа дууссан.');
    const resultKey = 'results/' + session.id + '.json';
    let entry = await store.read(resultKey);
    if (!entry) {
      const result = simulate(session, body, now());
      try { await store.write(resultKey, result, null, 8); entry = { value: result }; }
      catch (error) { if (!conflict(error)) throw error; entry = await store.read(resultKey); if (!entry) throw error; }
    }
    const player = await addResult(session, entry.value);
    return { result: entry.value, player, verified: true };
  }
  async function leaderboard(playerId) {
    const current = await store.read('leaderboard.json'), players = Object.values(current?.value.players || {});
    players.sort((a, b) => b.rp - a.rp || b.wins - a.wins || a.updatedAt - b.updatedAt || a.id.localeCompare(b.id));
    return { season: 1, total: players.length, players: players.slice(0, 50), me: players.find(p => p.id === playerId) || null };
  }
  return { start, finish, leaderboard };
}
module.exports = { createRankService, replayResult, RankError, BlobJsonStore, digest };
