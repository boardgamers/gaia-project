/* Network adapter for running the E2E harness inside sandboxes whose
 * TLS-intercepting egress proxy rejects Chromium's post-quantum ClientHello
 * (every https:// navigation dies with net::ERR_CONNECTION_CLOSED while
 * OpenSSL-based clients like curl/node pass — observed with Chromium 141's
 * always-on X25519MLKEM768 key share, which no flag or policy disables in
 * the Playwright headless shell).
 *
 * Strategy: the browser never opens a TLS connection at all.
 *  - Every HTTP(S) request is intercepted with context.route() and fulfilled
 *    via Playwright's Node-side APIRequestContext (OpenSSL; honors the
 *    HTTPS_PROXY proxy option; trusts the proxy CA via NODE_EXTRA_CA_CERTS).
 *  - Every WebSocket is intercepted with context.routeWebSocket() and
 *    bridged over a manual CONNECT tunnel using playwright-core's bundled
 *    `ws` client (Supabase Realtime is plain JSON text frames).
 *
 * Set NODE_EXTRA_CA_CERTS to the proxy CA bundle when using this adapter —
 * TLS verification stays ON.
 */

/* eslint-disable no-console */
const fs = require("fs");
const https = require("https");
const net = require("net");
const path = require("path");
const tls = require("tls");

function bundledWs() {
  const candidates = [];
  try {
    const coreDir = path.dirname(require.resolve("playwright-core"));
    candidates.push(path.join(coreDir, "utilsBundle.js"), path.join(coreDir, "lib", "utilsBundle.js"));
  } catch (err) {
    /* fall through */
  }
  try {
    candidates.push(
      path.join(path.dirname(require.resolve("playwright")), "node_modules", "playwright-core", "lib", "utilsBundle.js")
    );
  } catch (err) {
    /* fall through */
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const bundle = require(candidate);
      if (bundle.ws) {
        return bundle.ws;
      }
    }
  }
  throw new Error("could not locate playwright-core's bundled ws client");
}

function caOptions() {
  const caPath = process.env.NODE_EXTRA_CA_CERTS;
  return caPath && fs.existsSync(caPath) ? { ca: fs.readFileSync(caPath) } : {};
}

/** https.Agent that reaches the target through an HTTP CONNECT tunnel. */
class ConnectTunnelAgent extends https.Agent {
  constructor(proxyUrl) {
    super({ keepAlive: false });
    this.proxy = new URL(proxyUrl);
  }

  createConnection(options, callback) {
    const targetHost = options.host;
    const targetPort = options.port || 443;
    const socket = net.connect(Number(this.proxy.port), this.proxy.hostname, () => {
      socket.write(`CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n\r\n`);
    });
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString();
      if (!buffer.includes("\r\n\r\n")) {
        return;
      }
      socket.removeListener("data", onData);
      if (!/^HTTP\/1\.[01] 200/.test(buffer)) {
        callback(new Error(`proxy CONNECT to ${targetHost}:${targetPort} failed: ${buffer.split("\r\n")[0]}`));
        socket.destroy();
        return;
      }
      const secure = tls.connect({
        socket,
        servername: targetHost,
        ...caOptions(),
      });
      secure.once("secureConnect", () => callback(null, secure));
      secure.once("error", (err) => callback(err));
    };
    socket.on("data", onData);
    socket.once("error", (err) => callback(err));
  }
}

/**
 * Attach the interception adapter to a browser context. Call before any
 * page in the context navigates.
 */
async function interceptContextNetwork(context, requestContext, proxyUrl, label = "") {
  const WsClient = bundledWs();
  const agent = new ConnectTunnelAgent(proxyUrl);

  await context.route("**/*", async (route) => {
    try {
      const response = await requestContext.fetch(route.request(), { maxRedirects: 0 });
      await route.fulfill({ response });
    } catch (err) {
      console.log(
        `  [${label} net] ${route.request().method()} ${route.request().url()} failed: ${err.message.split("\n")[0]}`
      );
      await route.abort().catch(() => undefined);
    }
  });

  await context.routeWebSocket(/.*/, (route) => {
    const target = new WsClient(route.url(), { agent, ...caOptions() });
    const queued = [];
    target.on("open", () => {
      for (const message of queued) {
        target.send(message);
      }
      queued.length = 0;
    });
    route.onMessage((message) => {
      if (target.readyState === 1) {
        target.send(message);
      } else {
        queued.push(message);
      }
    });
    target.on("message", (data) => route.send(data.toString()));
    target.on("close", (code, reason) =>
      route.close({ code, reason: reason ? reason.toString() : undefined }).catch(() => undefined)
    );
    target.on("error", (err) => {
      console.log(`  [${label} ws] ${route.url()} error: ${err.message}`);
      route.close({ code: 1011 }).catch(() => undefined);
    });
    route.onClose(() => target.close());
  });
}

module.exports = { interceptContextNetwork };
