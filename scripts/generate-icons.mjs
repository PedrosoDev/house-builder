// Gera os ícones PNG do PWA em public/icons (sem dependências: rasteriza e comprime com zlib).
// Uso: node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BG = [24, 24, 27]; // zinc-900
const FG = [250, 250, 250];
const ACCENT = [56, 189, 248]; // sky-400

function crc32(buf) {
	let c;
	let crc = 0xffffffff;
	for (let n = 0; n < buf.length; n++) {
		c = (crc ^ buf[n]) & 0xff;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		crc = (crc >>> 8) ^ c;
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
	const raw = Buffer.alloc((size * 4 + 1) * size);
	for (let y = 0; y < size; y++) {
		raw[y * (size * 4 + 1)] = 0;
		for (let x = 0; x < size; x++) {
			const [r, g, b, a] = pixel(x / size, y / size);
			raw.set([r, g, b, a], y * (size * 4 + 1) + 1 + x * 4);
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr.set([8, 6, 0, 0, 0], 8);
	return Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

// Casa em coordenadas 0..1 dentro de uma caixa de lado `s` centrada.
function house(u, v, s) {
	const x = (u - 0.5) / s + 0.5;
	const y = (v - 0.5) / s + 0.5;
	// telhado (triângulo) e corpo
	const roof = y >= 0.16 && y <= 0.46 && Math.abs(x - 0.5) <= (y - 0.16) * (0.4 / 0.3) + 0.0;
	const body = x >= 0.2 && x <= 0.8 && y > 0.46 && y <= 0.84;
	const door = x >= 0.44 && x <= 0.56 && y >= 0.6 && y <= 0.84;
	if (door) return ACCENT;
	if (roof || body) return FG;
	return null;
}

const rounded = (u, v, r) => {
	const dx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0);
	const dy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0);
	return dx * dx + dy * dy <= r * r;
};

mkdirSync("public/icons", { recursive: true });

for (const size of [192, 512]) {
	// "any": cantos arredondados e transparência fora
	writeFileSync(
		`public/icons/icon-${size}.png`,
		png(size, (u, v) => {
			if (!rounded(u, v, 0.18)) return [0, 0, 0, 0];
			const c = house(u, v, 0.8) ?? BG;
			return [...c, 255];
		}),
	);
}

// "maskable": fundo cheio e desenho dentro da zona segura (80 %)
writeFileSync(
	"public/icons/maskable-512.png",
	png(512, (u, v) => [...(house(u, v, 0.62) ?? BG), 255]),
);
console.log("Ícones gerados em public/icons");
