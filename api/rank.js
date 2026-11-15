const { createRankService, RankError } = require('../lib/rank-service.cjs');
const service = createRankService();
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'https://game.invalid');
      return send(200, await service.leaderboard(url.searchParams.get('player')));
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return send(405, { error: 'GET эсвэл POST ашиглана.' }); }
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) throw new RankError(403, 'Хүсэлтийн хаяг тохирохгүй байна.');
    if (Number(req.headers['content-length']) > 2500000) throw new RankError(413, 'Аяны өгөгдөл хэт том байна.');
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || Buffer.byteLength(JSON.stringify(body)) > 2500000) throw new RankError(413, 'Аяны өгөгдөл хэт том байна.');
    if (body.action === 'start') return send(200, await service.start(body));
    if (body.action === 'finish') return send(200, await service.finish(body));
    return send(400, { error: 'Аяны үйлдэл буруу байна.' });
  } catch (error) {
    if (error instanceof SyntaxError) return send(400, { error: 'JSON өгөгдөл буруу байна.' });
    if (error instanceof RankError) return send(error.status, { error: error.message });
    console.warn('rank-storage-unavailable', error?.name || 'Error');
    return send(503, { error: 'Эрэмбийн сан түр холбогдохгүй байна. Дараа дахин оролдоорой.' });
  }
};
