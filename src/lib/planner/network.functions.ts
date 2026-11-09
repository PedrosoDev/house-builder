import { createServerFn } from "@tanstack/react-start";
import { pickLanAddress } from "./vr-link";

/** IPv4 do computador que roda o servidor, na rede local (para montar o link que o Quest abre). */
export const getLanAddress = createServerFn({ method: "GET" }).handler(
	async (): Promise<string | null> => {
		const os = await import("node:os");
		return pickLanAddress(os.networkInterfaces());
	},
);
