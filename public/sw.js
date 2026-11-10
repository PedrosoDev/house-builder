// Service worker do PWA. Só guarda o que é estático; dados (server functions/API) sempre vão à rede.
// Troque a versão para invalidar o cache antigo.
const VERSION = "v1";
const CACHE = `house-builder-${VERSION}`;

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
			await self.clients.claim();
		})(),
	);
});

function isHandled(url) {
	return (
		url.origin === self.location.origin &&
		!url.pathname.startsWith("/_serverFn") &&
		!url.pathname.startsWith("/api/")
	);
}

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;
	const url = new URL(request.url);
	if (!isHandled(url)) return;

	if (request.mode === "navigate") {
		// Rede primeiro (o HTML tem dados atuais); sem rede, usa a última cópia.
		event.respondWith(
			(async () => {
				try {
					const res = await fetch(request);
					if (res.ok) (await caches.open(CACHE)).put(request, res.clone());
					return res;
				} catch (err) {
					const cached = await caches.match(request);
					if (cached) return cached;
					throw err;
				}
			})(),
		);
		return;
	}

	// Assets: cache primeiro (arquivos têm hash no nome), atualizando ao buscar na rede.
	event.respondWith(
		(async () => {
			const cached = await caches.match(request);
			if (cached) return cached;
			const res = await fetch(request);
			if (res.ok) (await caches.open(CACHE)).put(request, res.clone());
			return res;
		})(),
	);
});
