import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect } from "react";

import { Toaster } from "#/components/ui/sonner.tsx";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "House Builder — projetos de casas em 2D e 3D",
			},
			{ name: "theme-color", content: "#18181b" },
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{ rel: "manifest", href: "/manifest.webmanifest" },
			{ rel: "icon", href: "/icons/icon-192.png", type: "image/png" },
			{ rel: "apple-touch-icon", href: "/icons/icon-192.png" },
		],
	}),
	shellComponent: RootDocument,
});

// Só em produção: em dev o service worker atrapalharia o HMR e o cache dos módulos.
function useRegisterServiceWorker() {
	useEffect(() => {
		if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;
		navigator.serviceWorker.register("/sw.js").catch(() => {});
	}, []);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	useRegisterServiceWorker();
	return (
		<html lang="pt-BR">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Toaster richColors position="bottom-center" />
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
