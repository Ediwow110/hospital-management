const http = require('http');
const { createInMemoryStore } = require('../infrastructure/in-memory-store');
const { createRouter } = require('./router');

function createServer({ store = createInMemoryStore() } = {}) {
  const router = createRouter(store);
  return http.createServer(async (request, response) => {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', async () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const headers = normalizeHeaders(request.headers);
      const result = await router.handle({
        method: request.method,
        path: new URL(request.url, 'http://localhost').pathname,
        headers,
        rawBody,
        ipAddress: request.socket.remoteAddress
      });
      response.writeHead(result.status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(result.body));
    });
  });
}

function normalizeHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value[0] : value]));
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, () => {
    console.log(`HMS API listening on http://localhost:${port}`);
  });
}

module.exports = {
  createServer,
  normalizeHeaders
};
