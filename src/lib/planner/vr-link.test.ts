import { describe, expect, it } from "vitest";
import {
	metaOpenUrl,
	normalizeBase,
	pickLanAddress,
	suggestVrBase,
	vrLink,
} from "./vr-link";

describe("normalizeBase (endereço do servidor digitado pelo usuário)", () => {
	it("completa com https:// quando falta o protocolo", () => {
		expect(normalizeBase("192.168.0.31:3001")).toBe(
			"https://192.168.0.31:3001",
		);
	});

	it("troca http:// por https:// (o WebXR só liga em HTTPS)", () => {
		expect(normalizeBase("http://192.168.0.31:3001")).toBe(
			"https://192.168.0.31:3001",
		);
	});

	it("tira espaços e barras no fim", () => {
		expect(normalizeBase("  https://casa.app/// ")).toBe("https://casa.app");
	});

	it("vazio continua vazio", () => {
		expect(normalizeBase("   ")).toBe("");
	});
});

describe("vrLink", () => {
	it("monta o link da visita em VR do projeto", () => {
		expect(vrLink("192.168.0.31:3001", "proj_abc")).toBe(
			"https://192.168.0.31:3001/vr/proj_abc",
		);
	});

	it("sem endereço não há link", () => {
		expect(vrLink("", "proj_abc")).toBe("");
	});

	it("codifica ids com caracteres especiais", () => {
		expect(vrLink("casa.app", "a b/c")).toBe("https://casa.app/vr/a%20b%2Fc");
	});
});

describe("metaOpenUrl (atalho experimental para abrir direto no headset)", () => {
	it("embrulha o link codificado na URL open_url da Meta", () => {
		const link = "https://192.168.0.31:3001/vr/proj_abc";
		const url = metaOpenUrl(link);
		expect(url.startsWith("https://www.oculus.com/open_url/?url=")).toBe(true);
		expect(decodeURIComponent(url.split("?url=")[1])).toBe(link);
	});

	it("sem link devolve vazio", () => {
		expect(metaOpenUrl("")).toBe("");
	});
});

describe("suggestVrBase (qual endereço sugerir no botão)", () => {
	it("no localhost, sugere o IP da rede na porta do modo VR", () => {
		expect(suggestVrBase("http://localhost:3000", "192.168.0.31")).toBe(
			"https://192.168.0.31:3001",
		);
	});

	it("no localhost sem IP conhecido, deixa em branco para o usuário digitar", () => {
		expect(suggestVrBase("http://localhost:3000", null)).toBe("");
	});

	it("em um site publicado (https), usa o próprio endereço", () => {
		expect(suggestVrBase("https://casa.app", "192.168.0.31")).toBe(
			"https://casa.app",
		);
	});

	it("acessado por IP da rede em HTTP, troca para https na porta do modo VR", () => {
		expect(suggestVrBase("http://192.168.0.31:3000", null)).toBe(
			"https://192.168.0.31:3001",
		);
	});
});

describe("pickLanAddress (IP do PC na rede local)", () => {
	const v4 = (address: string, internal = false) => ({
		address,
		family: "IPv4",
		internal,
	});

	it("prefere o Ethernet/Wi-Fi a adaptadores virtuais e VPNs", () => {
		const ip = pickLanAddress({
			"vEthernet (WSL)": [v4("172.28.80.1")],
			"Radmin VPN": [v4("26.138.239.163")],
			Hamachi: [v4("25.32.236.11")],
			Ethernet: [v4("192.168.0.31")],
		});
		expect(ip).toBe("192.168.0.31");
	});

	it("ignora loopback, IPv6 e endereço link-local", () => {
		const ip = pickLanAddress({
			lo: [v4("127.0.0.1", true)],
			Wi_Fi: [
				{ address: "fe80::1", family: "IPv6", internal: false },
				v4("169.254.10.2"),
				v4("10.0.0.8"),
			],
		});
		expect(ip).toBe("10.0.0.8");
	});

	it("entre redes privadas, 192.168 vem antes de 10. e de 172.16/12", () => {
		expect(
			pickLanAddress({
				a: [v4("172.20.0.5")],
				b: [v4("10.1.1.1")],
				c: [v4("192.168.1.9")],
			}),
		).toBe("192.168.1.9");
	});

	it("sem nenhuma rede utilizável devolve null", () => {
		expect(pickLanAddress({ lo: [v4("127.0.0.1", true)] })).toBeNull();
	});
});
