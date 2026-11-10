import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const publicDir = resolve(import.meta.dirname, "../../../public");
const read = (file: string) => readFileSync(resolve(publicDir, file), "utf-8");

describe("manifest.webmanifest", () => {
	const manifest = JSON.parse(read("manifest.webmanifest"));

	it("tem os campos exigidos para instalar no computador", () => {
		expect(manifest.name).toBe("House Builder");
		expect(manifest.short_name).toBeTruthy();
		expect(manifest.start_url).toBe("/");
		expect(manifest.scope).toBe("/");
		expect(manifest.display).toBe("standalone");
		expect(manifest.lang).toBe("pt-BR");
		expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
		expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
	});

	it("traz ícones PNG de 192 e 512 (um deles maskable) que existem em public/", () => {
		const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
		expect(sizes).toContain("192x192");
		expect(sizes).toContain("512x512");
		expect(
			manifest.icons.some((i: { purpose?: string }) =>
				i.purpose?.includes("maskable"),
			),
		).toBe(true);
		for (const icon of manifest.icons) {
			expect(icon.type).toBe("image/png");
			expect(existsSync(resolve(publicDir, icon.src.replace(/^\//, "")))).toBe(
				true,
			);
		}
	});
});

type Listener = (event: unknown) => void;

/** Executa public/sw.js num sandbox e devolve os listeners registrados e o que ele guardou. */
function loadServiceWorker() {
	const listeners: Record<string, Listener> = {};
	const store = new Map<string, Response>();
	const caches = {
		open: async () => ({
			put: async (req: Request | string, res: Response) => {
				store.set(typeof req === "string" ? req : req.url, res);
			},
			addAll: async () => {},
		}),
		match: async (req: Request | string) =>
			store.get(typeof req === "string" ? req : req.url),
		keys: async () => [],
		delete: async () => true,
	};
	const self = {
		addEventListener: (type: string, fn: Listener) => {
			listeners[type] = fn;
		},
		skipWaiting: () => {},
		clients: { claim: async () => {} },
		location: { origin: "https://app.test" },
	};
	vm.runInNewContext(read("sw.js"), {
		self,
		caches,
		URL,
		Response,
		fetch: async () => new Response("net"),
	});
	return { listeners, store };
}

function fetchEvent(
	url: string,
	init: { method?: string; mode?: string } = {},
) {
	let responded: Promise<Response> | undefined;
	return {
		request: {
			url,
			method: init.method ?? "GET",
			mode: init.mode ?? "no-cors",
		},
		respondWith: (p: Promise<Response>) => {
			responded = p;
		},
		get handled() {
			return responded !== undefined;
		},
	};
}

describe("sw.js", () => {
	it("registra install, activate e fetch", () => {
		const { listeners } = loadServiceWorker();
		expect(listeners.install).toBeTypeOf("function");
		expect(listeners.activate).toBeTypeOf("function");
		expect(listeners.fetch).toBeTypeOf("function");
	});

	it("nunca intercepta server functions, API, POST nem outras origens", () => {
		const { listeners } = loadServiceWorker();
		for (const e of [
			fetchEvent("https://app.test/_serverFn/abc"),
			fetchEvent("https://app.test/api/auth/session"),
			fetchEvent("https://app.test/projects/1", { method: "POST" }),
			fetchEvent("https://cdn.outro.com/lib.js"),
		]) {
			listeners.fetch(e);
			expect(e.handled).toBe(false);
		}
	});

	it("intercepta assets estáticos e navegações", () => {
		const { listeners } = loadServiceWorker();
		for (const e of [
			fetchEvent("https://app.test/assets/index-abc.js"),
			fetchEvent("https://app.test/icons/icon-192.png"),
			fetchEvent("https://app.test/projects/1", { mode: "navigate" }),
		]) {
			listeners.fetch(e);
			expect(e.handled).toBe(true);
		}
	});

	it("navegação sem rede cai na cópia guardada", async () => {
		const { listeners, store } = loadServiceWorker();
		store.set("https://app.test/projects/1", new Response("guardada"));
		const e = fetchEvent("https://app.test/projects/1", { mode: "navigate" });
		// força falha de rede
		const ctxFail = loadServiceWorkerOffline(store);
		ctxFail.fetch(e);
		const res = await (e as unknown as { _p: Promise<Response> })._p;
		expect(await res.text()).toBe("guardada");
		void listeners;
	});
});

function loadServiceWorkerOffline(store: Map<string, Response>) {
	const listeners: Record<string, Listener> = {};
	const caches = {
		open: async () => ({ put: async () => {}, addAll: async () => {} }),
		match: async (req: Request | string) =>
			store.get(typeof req === "string" ? req : req.url),
		keys: async () => [],
		delete: async () => true,
	};
	const self = {
		addEventListener: (t: string, fn: Listener) => {
			listeners[t] = fn;
		},
		skipWaiting: () => {},
		clients: { claim: async () => {} },
		location: { origin: "https://app.test" },
	};
	vm.runInNewContext(read("sw.js"), {
		self,
		caches,
		URL,
		Response,
		fetch: async () => {
			throw new TypeError("offline");
		},
	});
	return {
		fetch: (e: { respondWith: (p: Promise<Response>) => void }) => {
			const orig = e.respondWith;
			e.respondWith = (p) => {
				(e as unknown as { _p: Promise<Response> })._p = p;
				orig(p);
			};
			listeners.fetch(e);
		},
	};
}
