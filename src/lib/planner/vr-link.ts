/** Porta do servidor de desenvolvimento em HTTPS (`npm run dev:vr`). */
export const VR_DEV_PORT = 3001;

/** Endereço do servidor como o usuário digitou: sempre https (o WebXR só liga em contexto seguro). */
export function normalizeBase(raw: string): string {
	const t = raw.trim().replace(/\/+$/, "");
	if (!t) return "";
	return `https://${t.replace(/^[a-z]+:\/\//i, "")}`;
}

/** Link da visita em VR (rota `/vr/$projectId`) para abrir no navegador do Meta Quest. */
export function vrLink(base: string, projectId: string): string {
	const b = normalizeBase(base);
	return b ? `${b}/vr/${encodeURIComponent(projectId)}` : "";
}

/** Atalho EXPERIMENTAL da Meta: clicar (logado na mesma conta) abre o link no navegador do headset. */
export function metaOpenUrl(link: string): string {
	return link
		? `https://www.oculus.com/open_url/?url=${encodeURIComponent(link)}`
		: "";
}

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?)$/i;

/** Endereço a sugerir no botão "Ver no Quest", a partir de onde o editor foi aberto. */
export function suggestVrBase(origin: string, lanIp: string | null): string {
	let url: URL;
	try {
		url = new URL(origin);
	} catch {
		return "";
	}
	if (LOCAL_HOST.test(url.hostname)) {
		return lanIp ? `https://${lanIp}:${VR_DEV_PORT}` : "";
	}
	if (url.protocol === "https:") return url.origin;
	return `https://${url.hostname}:${VR_DEV_PORT}`;
}

export type NetIface = {
	address: string;
	family: string | number;
	internal: boolean;
};

const VIRTUAL_NAME =
	/vethernet|wsl|hamachi|radmin|vpn|virtual|vmware|vbox|docker|tailscale|zerotier|loopback|bluetooth|hyper-v/i;

function rank(ip: string): number {
	if (ip.startsWith("192.168.")) return 0;
	if (ip.startsWith("10.")) return 1;
	if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
	return 3;
}

/** IPv4 do PC na rede local (Ethernet/Wi-Fi), ignorando adaptadores virtuais, VPNs e link-local. */
export function pickLanAddress(
	ifaces: Record<string, NetIface[] | undefined>,
): string | null {
	const found: string[] = [];
	for (const [name, list] of Object.entries(ifaces)) {
		if (VIRTUAL_NAME.test(name)) continue;
		for (const i of list ?? []) {
			const v4 = i.family === "IPv4" || i.family === 4;
			if (!v4 || i.internal || i.address.startsWith("169.254.")) continue;
			found.push(i.address);
		}
	}
	found.sort((a, b) => rank(a) - rank(b));
	return found[0] ?? null;
}
