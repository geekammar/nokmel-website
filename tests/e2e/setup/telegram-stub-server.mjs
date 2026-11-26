import http from 'node:http';

/**
 * Disposable local Telegram Bot API stub for browser CI (W5-C).
 * Synthetic messages only; the application uses this origin only under the
 * explicit disposable-test override. No real Telegram bot is contacted.
 */

let mode = 'ok';
const messages = [];

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:3301');
  res.setHeader('content-type', 'application/json');

  if (url.pathname === '/__health') {
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname === '/__messages') {
    res.end(JSON.stringify(messages));
    return;
  }
  if (url.pathname === '/__reset' && req.method === 'POST') {
    messages.length = 0;
    mode = 'ok';
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname === '/__control' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const parsed = JSON.parse(body);
      if (['ok', 'fail', 'uncertain'].includes(parsed.mode)) mode = parsed.mode;
    } catch {
      // ignore malformed control payload
    }
    res.end(JSON.stringify({ ok: true, mode }));
    return;
  }
  if (/^\/bot[^/]+\/getMe$/.test(url.pathname) && req.method === 'GET') {
    res.end(
      JSON.stringify({
        ok: true,
        result: { id: 42, is_bot: true, username: 'nokmel_e2e_bot', first_name: 'Nokmel E2E' },
      }),
    );
    return;
  }
  if (/^\/bot[^/]+\/sendMessage$/.test(url.pathname) && req.method === 'POST') {
    const body = await readBody(req);
    let parsed = {};
    try {
      parsed = JSON.parse(body);
    } catch {
      // ignore
    }
    if (mode === 'fail') {
      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, description: 'stub rejected' }));
      return;
    }
    if (mode === 'uncertain') {
      res.statusCode = 502;
      res.end(JSON.stringify({ ok: false, description: 'stub ambiguous' }));
      return;
    }
    messages.push({
      chat_id: parsed.chat_id,
      text: parsed.text,
      parse_mode: parsed.parse_mode ?? null,
    });
    res.end(JSON.stringify({ ok: true, result: { message_id: messages.length } }));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ ok: false, description: 'not_found' }));
});

server.listen(3301, '127.0.0.1', () => {
  console.log('Telegram stub listening on 3301');
});
