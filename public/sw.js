/* DuctForge offline shell.
 *
 * WHY THIS FILE EXISTS.
 *
 * Without it, "install to home screen" was a bookmark with a nicer icon: tap it
 * in a plant room with no signal and you got the browser's dinosaur. That is a
 * fair thing to be annoyed about, because DuctForge is the one kind of app that
 * has no excuse — every calculation runs in the browser, every saved takeoff is
 * in localStorage on the device, and nothing is ever uploaded. The ONLY reason
 * it needed the network was to fetch its own HTML and JavaScript.
 *
 * So: cache the shell, and the install becomes what it looks like.
 *
 * THE STRATEGY, and why each part is what it is.
 *
 *   Navigations      network first, cache second.
 *                    Online, you always get the current deploy — a cached HTML
 *                    document is the one thing that must never go stale, since
 *                    it names the JavaScript chunks. Offline, you get the last
 *                    copy of that page, and if you have never opened that page
 *                    before, the workspace at "/".
 *
 *   Hashed assets    cache first.
 *                    /_next/static/* filenames contain a content hash, so the
 *                    file at a given URL can never change. Revalidating it is
 *                    pure latency. Fonts, icons and the brand marks are stable
 *                    for the same reason.
 *
 *   Everything else  stale while revalidate. Serve what we have, fetch a fresh
 *                    copy for next time.
 *
 *   RSC payloads     not handled at all. Next's client router fetches these for
 *                    in-app navigation; when one fails it falls back to a full
 *                    page load, which lands on the navigation branch above and
 *                    is served from cache. Caching them as well would mean two
 *                    copies of every page that could disagree.
 *
 * Nothing here caches a POST, a cross-origin request, or anything with a query
 * string it did not put there. There is no server to talk to and no telemetry:
 * this worker only ever re-serves files this origin already sent.
 *
 * VERSION is a manual bump. It exists to evict everything at once if the
 * caching rules themselves change — routine deploys do not need it, because
 * navigations are network-first and static assets are content-hashed.
 */

const VERSION = "v1";
const SHELL = `ductforge-shell-${VERSION}`;
const RUNTIME = `ductforge-runtime-${VERSION}`;

/* Precached on install so the FIRST offline open works, not just a repeat of a
 * page you happened to visit while online. Five documents, a few kilobytes
 * each — the guides are here because the moment you need the guide is the
 * moment you are standing in front of the duct, not at your desk. */
const ROUTES = ["/", "/standards", "/guide", "/guide/bn", "/guide/hi"];

const PRECACHE_ASSETS = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/** Content-hashed or otherwise immutable. Safe to serve without asking. */
const IMMUTABLE = /^\/(?:_next\/static|fonts|icons|brand)\//;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      /* Deliberately not cache.addAll: that rejects the whole install if a
       * single entry fails, and an install that fails leaves the user with no
       * offline support at all rather than four fifths of it. */
      await Promise.all(
        [...ROUTES, ...PRECACHE_ASSETS].map(async (path) => {
          try {
            const res = await fetch(path, { cache: "reload" });
            if (res.ok) await cache.put(path, res);
          } catch {
            /* No network during install. The runtime handlers will fill it. */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("ductforge-") && k !== SHELL && k !== RUNTIME)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  /* Next's client-router payloads — see the header comment. */
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return;

  if (request.mode === "navigate") {
    event.respondWith(navigation(request));
  } else if (IMMUTABLE.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function navigation(request) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(request);
    /* Only a real 200 is worth keeping. Caching a 404 or a 500 would pin it
     * for as long as the user stays offline. */
    if (res.ok && res.status === 200) cache.put(request, res.clone());
    return res;
  } catch {
    return (
      (await cache.match(request, { ignoreSearch: true })) ??
      (await cache.match("/")) ??
      new Response(offlinePage(), {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit ?? fresh;
}

/* The last resort: offline, and this page was never cached. Inline, in the
 * brand's own colours, because by definition no stylesheet is reachable. */
function offlinePage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline — DuctForge</title>
<style>
  :root{color-scheme:light}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#F7F3EB;color:#221D17;padding:24px;
    font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
  main{max-width:26rem;text-align:center}
  h1{font-size:1.5rem;font-weight:700;margin:0 0 .75rem;letter-spacing:-.02em}
  p{margin:0 0 1.5rem;line-height:1.55}
  a{display:inline-block;background:#E87D4A;color:#221D17;text-decoration:none;
    font-weight:700;padding:.7rem 1.4rem;border-radius:999px}
</style></head><body><main>
<h1>You're offline</h1>
<p>This page hasn't been saved to your device yet. The takeoff workspace has — open it and keep working.</p>
<a href="/">Open the workspace</a>
</main></body></html>`;
}
