const http = require('node:http'),
  fs = require('node:fs'),
  path = require('node:path');

const host = '0.0.0.0',
  port = Number(process.env.PORT || 8080),
  rootDir = path.resolve(
    process.env.STATIC_ROOT || path.join(__dirname, '..', 'dist', 'marketplace-shell', 'browser'),
  ),
  runtimeConfigPath = path.join(rootDir, 'runtime-config.js'),
  gameApiBaseUrl = (process.env.MARKETPLACE_GAME_API_BASE_URL || 'http://localhost:9001').trim(),
  contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  },
  cacheExtensions = new Set([
    '.css',
    '.gif',
    '.ico',
    '.jpg',
    '.js',
    '.png',
    '.svg',
    '.webp',
    '.woff',
    '.woff2',
  ]),
  runtimeConfigContent = `globalThis.__MARKETPLACE_RUNTIME_CONFIG__ = ${JSON.stringify(
    {
      gameApiBaseUrl,
    },
    null,
    2,
  )};\n`,
  ensureRuntimeConfig = async () => {
    await fs.promises.mkdir(rootDir, { recursive: true });
    await fs.promises.writeFile(runtimeConfigPath, runtimeConfigContent, 'utf8');
  },
  sendFile = (filePath, response) => {
    let extension = path.extname(filePath).toLowerCase(),
      contentType = contentTypes[extension] || 'application/octet-stream';

    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheExtensions.has(extension)
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    });

    fs.createReadStream(filePath).pipe(response);
  },
  serveRequest = async (request, response) => {
    let requestPath = decodeURIComponent((request.url || '/').split('?')[0]),
      normalizedPath = requestPath === '/' ? '/index.html' : requestPath,
      requestedFile = path.normalize(path.join(rootDir, normalizedPath));

    if (!requestedFile.startsWith(rootDir)) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Forbidden');
      return;
    }

    try {
      let stats = await fs.promises.stat(requestedFile).catch(() => null);

      if (stats?.isFile()) {
        sendFile(requestedFile, response);
        return;
      }

      let fallbackFile = path.join(rootDir, 'index.html');
      sendFile(fallbackFile, response);
    } catch {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Static server error');
    }
  };

void ensureRuntimeConfig()
  .then(() => {
    http
      .createServer((request, response) => {
        void serveRequest(request, response);
      })
      .listen(port, host, () => {
        console.log(`Marketplace static server listening on http://${host}:${port}`);
        console.log(`Marketplace game API base URL: ${gameApiBaseUrl}`);
      });
  })
  .catch((error) => {
    console.error('Failed to prepare marketplace runtime config.', error);
    process.exit(1);
  });
