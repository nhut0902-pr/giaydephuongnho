// Cloudflare Worker entry point (ES Module format)
// Injects environment variables from Cloudflare bindings into process.env
// then delegates to Express app via manual Request→Response bridge

import app from './server.js';
const { bootstrapApp } = app;

let bootstrapped = false;

function injectEnv(env) {
  const keys = [
    'PORT', 'JWT_SECRET', 'SESSION_SECRET',
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
    'IMAGEKIT_URL', 'IMAGEKIT_PUBLIC_KEY', 'IMAGEKIT_PRIVATE_KEY',
    'GMAIL_USER', 'GMAIL_APP_PASSWORD',
    'TURNSTILE_SECRET',
    'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN',
    'APP_URL', 'GOOGLE_CALLBACK_URL',
    'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT',
    'DATABASE_URL', 'DATABASE_AUTH_TOKEN',
    'RECAPTCHA_SECRET'
  ];

  for (const key of keys) {
    if (env[key] !== undefined && env[key] !== null) {
      process.env[key] = String(env[key]);
    }
  }
}

// Convert Web API Request → Express req/res → Web API Response
function handleWithExpress(request, expressApp) {
  return new Promise(async (resolve) => {
    const url = new URL(request.url);

    // Build headers object
    const headers = {};
    for (const [key, value] of request.headers.entries()) {
      headers[key.toLowerCase()] = value;
    }

    // Read body for non-GET/HEAD requests
    const body = ['GET', 'HEAD'].includes(request.method) ? null : await request.text();

    // Create a mock IncomingMessage-like object
    const { Readable } = require('node:stream');
    const readable = new Readable({ read() {} });
    if (body) readable.push(body);
    readable.push(null);

    const req = Object.assign(readable, {
      method: request.method,
      url: url.pathname + url.search,
      headers,
      connection: {
        encrypted: url.protocol === 'https:',
        remoteAddress: headers['cf-connecting-ip'] || '127.0.0.1'
      },
      socket: {
        encrypted: url.protocol === 'https:',
        remoteAddress: headers['cf-connecting-ip'] || '127.0.0.1'
      }
    });

    // Build a mock ServerResponse-like object
    const chunks = [];
    let statusCode = 200;
    const resHeaders = {};

    const res = {
      statusCode: 200,
      _headers: {},
      _headersSent: false,
      headersSent: false,
      writable: true,
      writableEnded: false,
      writableFinished: false,

      setHeader(name, value) {
        this._headers[name.toLowerCase()] = value;
        resHeaders[name.toLowerCase()] = value;
      },
      getHeader(name) { return this._headers[name.toLowerCase()]; },
      removeHeader(name) {
        delete this._headers[name.toLowerCase()];
        delete resHeaders[name.toLowerCase()];
      },
      hasHeader(name) { return name.toLowerCase() in this._headers; },

      writeHead(code, reasonOrHeaders, maybeHeaders) {
        statusCode = code;
        this.statusCode = code;
        const hdrs = typeof reasonOrHeaders === 'object' ? reasonOrHeaders : maybeHeaders;
        if (hdrs) {
          for (const [k, v] of Object.entries(hdrs)) {
            this.setHeader(k, v);
          }
        }
        this._headersSent = true;
        this.headersSent = true;
      },

      write(chunk) {
        if (typeof chunk === 'string') {
          chunks.push(new TextEncoder().encode(chunk));
        } else if (chunk instanceof Uint8Array) {
          chunks.push(chunk);
        } else if (Buffer.isBuffer(chunk)) {
          chunks.push(new Uint8Array(chunk));
        } else if (chunk) {
          chunks.push(new TextEncoder().encode(String(chunk)));
        }
        return true;
      },

      end(chunk) {
        if (chunk) this.write(chunk);
        statusCode = this.statusCode;
        this.writableEnded = true;
        this.writableFinished = true;

        // Merge all chunks
        const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }

        resolve(new Response(merged.length > 0 ? merged : null, {
          status: statusCode,
          headers: resHeaders
        }));
      },

      // Express convenience methods
      header(name, value) {
        if (value !== undefined) { this.setHeader(name, value); return this; }
        return this.getHeader(name);
      },
      set(name, value) { return this.header(name, value); },
      get(name) { return this.getHeader(name); },
      status(code) { this.statusCode = code; statusCode = code; return this; },
      json(data) {
        this.setHeader('content-type', 'application/json');
        this.end(JSON.stringify(data));
      },
      send(data) {
        if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
          return this.json(data);
        }
        if (!this.getHeader('content-type')) {
          this.setHeader('content-type', typeof data === 'string' ? 'text/html; charset=utf-8' : 'application/octet-stream');
        }
        this.end(typeof data === 'string' ? data : data);
      },
      redirect(statusOrUrl, maybeUrl) {
        const redirectUrl = maybeUrl || statusOrUrl;
        const redirectStatus = maybeUrl ? statusOrUrl : 302;
        this.statusCode = redirectStatus;
        statusCode = redirectStatus;
        this.setHeader('location', redirectUrl);
        this.end();
      },
      type(ct) { this.setHeader('content-type', ct); return this; },
      sendStatus(code) { this.statusCode = code; statusCode = code; this.end(String(code)); },

      // Stream/event stubs for piping (e.g. PDFKit)
      on() { return this; },
      once() { return this; },
      emit() { return this; },
      pipe() { return this; },
      unpipe() { return this; },
      addListener() { return this; },
      removeListener() { return this; },

      get finished() { return this.writableFinished; }
    };

    expressApp(req, res);
  });
}

export default {
  async fetch(request, env, ctx) {
    // Inject env vars on each request (fast/idempotent)
    injectEnv(env);

    // Bootstrap DB schema once
    if (!bootstrapped) {
      try {
        await bootstrapApp();
        bootstrapped = true;
      } catch (err) {
        console.error('Bootstrap failed:', err);
        return new Response(
          JSON.stringify({ error: 'Server initialization failed', details: err.message }),
          { status: 500, headers: { 'content-type': 'application/json' } }
        );
      }
    }

    return handleWithExpress(request, app);
  }
};
