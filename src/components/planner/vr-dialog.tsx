import { useStore } from "@tanstack/react-form";
import { Copy, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppForm } from "#/components/form/form-hooks.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog.tsx";
import { FieldGroup } from "#/components/ui/field.tsx";
import { getLanAddress } from "#/lib/planner/network.functions";
import {
	metaOpenUrl,
	normalizeBase,
	suggestVrBase,
	vrLink,
} from "#/lib/planner/vr-link";

const STORAGE_KEY = "house-builder:vr-base";

function readSaved() {
	try {
		return localStorage.getItem(STORAGE_KEY) ?? "";
	} catch {
		return "";
	}
}

/** "Ver no Meta Quest": mostra o link da visita em VR (abre no navegador do Quest, sem instalar nada). */
export function VrDialog({
	projectId,
	open,
	onOpenChange,
}: {
	projectId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [lan, setLan] = useState<string | null>(null);
	const form = useAppForm({ defaultValues: { base: readSaved() } });
	const base = useStore(form.store, (s) => s.values.base);
	const link = vrLink(base, projectId);

	// ao abrir: descobre o IP do PC e, se ainda não há endereço salvo, sugere um
	useEffect(() => {
		if (!open) return;
		let alive = true;
		getLanAddress()
			.then((ip) => {
				if (!alive) return;
				setLan(ip);
				if (!form.getFieldValue("base")) {
					form.setFieldValue("base", suggestVrBase(location.origin, ip));
				}
			})
			.catch(() => {
				if (alive && !form.getFieldValue("base"))
					form.setFieldValue("base", suggestVrBase(location.origin, null));
			});
		return () => {
			alive = false;
		};
	}, [open, form]);

	const remember = () => {
		try {
			localStorage.setItem(STORAGE_KEY, normalizeBase(base));
		} catch {
			// sem armazenamento (janela privada): só não lembra o endereço
		}
	};
	const copy = async () => {
		remember();
		try {
			await navigator.clipboard.writeText(link);
			toast.success("Link copiado");
		} catch {
			toast.error("Não foi possível copiar. Selecione o link e copie à mão.");
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Ver no Meta Quest</DialogTitle>
					<DialogDescription>
						Abra o link abaixo no navegador do Quest e toque em “Entrar em VR”.
						Não precisa instalar nada. O Quest mostra a última versão salva.
					</DialogDescription>
				</DialogHeader>
				<form
					className="flex flex-col gap-4"
					onSubmit={(e) => {
						e.preventDefault();
					}}
				>
					<FieldGroup className="gap-4">
						<form.AppField name="base">
							{(f) => (
								<f.TextField
									label="Endereço do servidor"
									placeholder="https://192.168.0.31:3001"
									description={
										lan
											? `IP deste computador na rede: ${lan}. O Quest precisa estar no mesmo Wi-Fi e o servidor ligado com “npm run dev:vr”.`
											: "Em um site publicado, use o endereço dele (precisa ser HTTPS)."
									}
								/>
							)}
						</form.AppField>
					</FieldGroup>
					<div className="flex flex-col gap-2">
						<span className="text-sm font-medium">Link da visita</span>
						<code
							data-testid="vr-link"
							className="rounded-md border bg-muted px-3 py-2 text-xs break-all select-all"
						>
							{link || "Digite o endereço do servidor"}
						</code>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button type="button" disabled={!link} onClick={() => void copy()}>
							<Copy /> Copiar link
						</Button>
						<Button type="button" variant="outline" disabled={!link} asChild>
							<a
								href={link || undefined}
								target="_blank"
								rel="noreferrer"
								onClick={remember}
							>
								<ExternalLink /> Abrir aqui
							</a>
						</Button>
						<Button type="button" variant="outline" disabled={!link} asChild>
							<a
								href={metaOpenUrl(link) || undefined}
								target="_blank"
								rel="noreferrer"
								onClick={remember}
							>
								<ExternalLink /> Tentar abrir no Quest
							</a>
						</Button>
					</div>
					<p className="text-xs text-muted-foreground">
						“Tentar abrir no Quest” é experimental: usa o atalho da Meta, e só
						funciona com a mesma conta Meta no navegador e no headset. Se nada
						acontecer, copie o link e digite-o no navegador do Quest. A primeira
						vez ele avisa que o certificado não é confiável: toque em “Avançado”
						e continue.
					</p>
				</form>
			</DialogContent>
		</Dialog>
	);
}
