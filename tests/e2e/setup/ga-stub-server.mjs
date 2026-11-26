import http from 'node:http';

/**
 * Disposable local GA4 Data API stub for browser CI (W5-B).
 * No real Google endpoint is ever called. The application only uses this
 * origin when NOKMEL_DISPOSABLE_TEST_ENV=1 and the endpoint override points at
 * loopback. Synthetic report values are test fixtures, never production data.
 */

let mode = 'ok';

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:3300');
  res.setHeader('content-type', 'application/json');

  if (url.pathname === '/__health') {
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname === '/__control' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (parsed.mode === 'ok' || parsed.mode === 'error') mode = parsed.mode;
      } catch {
        // ignore malformed control payload
      }
      res.end(JSON.stringify({ ok: true, mode }));
    });
    return;
  }
  if (url.pathname === '/token' && req.method === 'POST') {
    if (mode === 'error') {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'stub_failure' }));
      return;
    }
    res.end(JSON.stringify({ access_token: 'e2e-access-token', expires_in: 3600 }));
    return;
  }
  if (url.pathname === '/v1beta/properties/123456789:runReport' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (mode === 'error') {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: { code: 500, message: 'stub failure' } }));
        return;
      }
      let request = {};
      try {
        request = JSON.parse(body);
      } catch {
        // fall through to summary
      }
      const dimension = request?.dimensions?.[0]?.name;
      if (!dimension) {
        res.end(
          JSON.stringify({
            rows: [
              {
                metricValues: [
                  { value: '42' },
                  { value: '60' },
                  { value: '120' },
                  { value: '0.025' },
                ],
              },
            ],
          }),
        );
        return;
      }
      if (dimension === 'pagePath') {
        res.end(
          JSON.stringify({
            rows: [
              { dimensionValues: [{ value: '/' }], metricValues: [{ value: '40' }] },
              { dimensionValues: [{ value: '/pricing' }], metricValues: [{ value: '20' }] },
              { dimensionValues: [{ value: '/join' }], metricValues: [{ value: '10' }] },
              { dimensionValues: [{ value: '/features' }], metricValues: [{ value: '5' }] },
            ],
          }),
        );
        return;
      }
      if (dimension === 'sessionSourceMedium') {
        res.end(
          JSON.stringify({
            rows: [
              {
                dimensionValues: [{ value: 'google / organic' }],
                metricValues: [{ value: '30' }],
              },
              {
                dimensionValues: [{ value: 'direct / (none)' }],
                metricValues: [{ value: '20' }],
              },
            ],
          }),
        );
        return;
      }
      if (dimension === 'eventName') {
        res.end(
          JSON.stringify({
            rows: [
              {
                dimensionValues: [{ value: 'join_cta_click' }],
                metricValues: [{ value: '5' }],
              },
              {
                dimensionValues: [{ value: 'join_request_success' }],
                metricValues: [{ value: '2' }],
              },
            ],
          }),
        );
        return;
      }
      res.end(JSON.stringify({ rows: [] }));
    });
    return;
  }
  if (url.pathname === '/gtag/js') {
    res.setHeader('content-type', 'application/javascript');
    res.end('/* synthetic GA tag stub */');
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(3300, '127.0.0.1', () => {
  console.log('GA4 stub listening on 3300');
});
