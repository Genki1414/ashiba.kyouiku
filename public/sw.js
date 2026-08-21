/* 現場は電波が悪い。一度開いた画面は、圏外でも開けるようにする。

   ・画面と部品は「まず網、駄目なら手元」（network first）。
     新しく直したものがすぐ届くのを優先し、圏外なら手元の写しを出す。
   ・記録を書きに行くもの（/api/）は写さない。圏外なら失敗させる。
     古い記録を掴んだまま進むより、失敗が分かる方がよい。 */

const CACHE = "ashiba-v1";
/* 圏外のときに出す画面。
   読み込むものがあると出せないので、字も色も1枚に書いた素のHTMLにしてある */
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/icon-192.png"])).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) =>
      Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  /* 別のところへの取りに行きは触らない */
  if (url.origin !== self.location.origin) return;
  /* 記録のやりとりは写さない */
  if (url.pathname.startsWith("/api/")) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        /* 画面そのものが無ければ、圏外の知らせを出す */
        if (req.mode === "navigate") {
          const off = await caches.match(OFFLINE);
          if (off) return off;
        }
        return Response.error();
      }),
  );
});
