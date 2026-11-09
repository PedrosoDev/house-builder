import { PanelLeftOpen, X } from "lucide-react";
import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button.tsx";
import { TooltipProvider } from "#/components/ui/tooltip.tsx";
import { drawerMode } from "#/lib/planner/drawer-mode";
import { parseProjectJson, planPngDataUrl } from "#/lib/planner/export";
import { saveProject } from "#/lib/planner/projects.functions";
import { PlannerStore, usePlanner } from "#/lib/planner/store";
import type { Project } from "#/lib/planner/types";
import { DEFAULT_VIEW3D, viewLayout } from "#/lib/planner/view-layout";
import type { WallMode } from "#/lib/planner/wall-cutaway";
import { cn } from "#/lib/utils";
import { AssistantPanel } from "./assistant-panel";
import { Dock } from "./dock";
import { LeftPanel } from "./left-panel";
import { ObjectsDrawer } from "./objects-drawer";
import { PlanCanvas } from "./plan-canvas";
import { PropertiesPanel } from "./properties-panel";
import { TopActions } from "./top-actions";
import { useDelayedUnmount } from "./use-delayed-unmount";
import type { Camera3D } from "./view-3d";
import { ViewSelector } from "./view-selector";

const View3D = lazy(() =>
	import("./view-3d").then((m) => ({ default: m.View3D })),
);

export function Editor({ initial }: { initial: Project }) {
	const store = useMemo(() => new PlannerStore(initial), [initial]);
	const view = usePlanner(store, (s) => s.view);
	const dirty = usePlanner(store, (s) => s.dirty);
	const tool = usePlanner(store, (s) => s.tool);
	const [cam3, setCam3] = useState<Camera3D>(DEFAULT_VIEW3D.camera);
	const [cutaway, setCutaway] = useState(DEFAULT_VIEW3D.cutaway);
	const [wallMode, setWallMode] = useState<WallMode>(DEFAULT_VIEW3D.wallMode);
	const [saving, setSaving] = useState(false);
	const [leftOpen, setLeftOpen] = useState(true);
	const [catalogOpen, setCatalogOpen] = useState(false);
	const [assistantOpen, setAssistantOpen] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);

	const save = useCallback(
		async (silent = true) => {
			setSaving(true);
			try {
				let thumbnail: string | undefined;
				const svg = document.querySelector<SVGSVGElement>(
					".planner-canvas svg",
				);
				if (svg) {
					try {
						thumbnail = await planPngDataUrl(
							svg,
							store.getState().project,
							360,
						);
					} catch {
						thumbnail = undefined;
					}
				}
				const project = store.getState().project;
				await saveProject({
					data: { project, thumbnail: thumbnail ?? undefined },
				});
				store.markSaved(new Date().toISOString());
				if (!silent) toast.success("Projeto salvo");
			} catch (e) {
				toast.error(
					`Falha ao salvar: ${e instanceof Error ? e.message : "erro desconhecido"}`,
				);
			} finally {
				setSaving(false);
			}
		},
		[store],
	);

	// autosave
	useEffect(() => {
		if (!dirty) return;
		const id = window.setTimeout(() => void save(true), 2500);
		return () => window.clearTimeout(id);
	}, [dirty, save]);

	useEffect(() => {
		const handler = (e: BeforeUnloadEvent) => {
			if (store.getState().dirty) e.preventDefault();
		};
		const keys = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
				e.preventDefault();
				void save(false);
			}
		};
		window.addEventListener("beforeunload", handler);
		window.addEventListener("keydown", keys);
		return () => {
			window.removeEventListener("beforeunload", handler);
			window.removeEventListener("keydown", keys);
		};
	}, [store, save]);

	const onImport = async (file: File | undefined) => {
		if (!file) return;
		try {
			const p = parseProjectJson(await file.text());
			store.load({ ...p, id: store.getState().project.id });
			store.mutate((d) => {
				d.name = p.name;
			});
			toast.success(`“${p.name}” importado`);
			window.dispatchEvent(new Event("planner:fit"));
		} catch (e) {
			toast.error(
				`Arquivo inválido: ${e instanceof Error ? e.message : "formato desconhecido"}`,
			);
		}
		if (fileRef.current) fileRef.current.value = "";
	};

	// parts of the canvas covered by the floating panels (the 2D canvas fits and centres in what is left)
	// 2D plan and 3D view slide/fade into each other: each section stays mounted while it fades out
	const layout = viewLayout(view);
	const planMounted = useDelayedUnmount(layout.plan.show, 300);
	const threeMounted = useDelayedUnmount(layout.three.show, 300);
	const drawer = drawerMode(tool, catalogOpen);
	const closeDrawer = useCallback(() => {
		setCatalogOpen(false);
		store.setCatalogItem(null);
		store.setTool("select");
	}, [store]);
	const insets2d = useMemo(
		() => ({
			left: drawer || leftOpen ? 300 : 0,
			right: view === "split" ? 0 : 344,
			top: 56,
			bottom: 96,
		}),
		[leftOpen, view, drawer],
	);

	useEffect(() => {
		if (!catalogOpen && !assistantOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			setCatalogOpen(false);
			setAssistantOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [catalogOpen, assistantOpen]);

	return (
		<TooltipProvider delayDuration={300}>
			<div className="relative h-dvh overflow-hidden bg-background text-foreground">
				{/* canvas: full-bleed, the floating panels sit on top of it */}
				<main className="absolute inset-0 overflow-hidden">
					{planMounted && (
						<section
							className={cn(
								"absolute inset-y-0 animate-in transition-[left,width,opacity] duration-300 ease-out fade-in-0",
								view === "split" && "border-r",
								!layout.plan.show && "pointer-events-none opacity-0",
							)}
							style={{
								left: `${layout.plan.left}%`,
								width: `${layout.plan.width}%`,
							}}
							aria-label="Planta 2D"
							aria-hidden={!layout.plan.show}
						>
							<PlanCanvas store={store} insets={insets2d} />
						</section>
					)}
					{threeMounted && (
						<section
							className={cn(
								"absolute inset-y-0 z-[1] animate-in bg-background transition-[left,width,opacity] duration-300 ease-out fade-in-0",
								!layout.three.show && "pointer-events-none opacity-0",
							)}
							style={{
								left: `${layout.three.left}%`,
								width: `${layout.three.width}%`,
							}}
							aria-label="Visualização 3D"
							aria-hidden={!layout.three.show}
						>
							<Suspense
								fallback={
									<div className="flex size-full items-center justify-center text-sm text-muted-foreground">
										Carregando 3D…
									</div>
								}
							>
								<View3D
									store={store}
									mode={cam3}
									cutaway={cutaway}
									wallMode={wallMode}
								/>
							</Suspense>
							{cam3 === "walk" && (
								<div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground ring-1 ring-border backdrop-blur">
									WASD para andar · Shift corre · arraste para olhar
								</div>
							)}
						</section>
					)}
				</main>

				{drawer ? (
					<ObjectsDrawer
						key={drawer}
						store={store}
						mode={drawer}
						onClose={closeDrawer}
					/>
				) : leftOpen ? (
					<LeftPanel
						store={store}
						saving={saving}
						onCollapse={() => setLeftOpen(false)}
						onImport={() => fileRef.current?.click()}
					/>
				) : (
					<Button
						variant="secondary"
						size="icon"
						className="absolute top-3 left-3 z-20 shadow-md"
						aria-label="Abrir painel de projeto e camadas"
						title="Abrir painel"
						onClick={() => setLeftOpen(true)}
					>
						<PanelLeftOpen />
					</Button>
				)}

				<ViewSelector
					view={view}
					onView={(v) => store.setView(v)}
					cam3={cam3}
					onCam3={setCam3}
					wallMode={wallMode}
					onWallMode={setWallMode}
					cutaway={cutaway}
					onCutaway={setCutaway}
				/>
				<TopActions
					store={store}
					saving={saving}
					onSave={() => void save(false)}
					assistantOpen={assistantOpen}
					onToggleAssistant={() => setAssistantOpen((o) => !o)}
				/>

				{/* editor (properties) on the right */}
				<aside
					aria-label="Propriedades"
					className="absolute top-16 right-3 z-20 w-80 overflow-hidden rounded-2xl bg-card text-card-foreground shadow-lg ring-1 ring-black/5"
				>
					<PropertiesPanel store={store} />
				</aside>

				{assistantOpen && (
					<section
						aria-label="Assistente"
						className="absolute top-16 right-3 z-40 flex h-[min(30rem,calc(100dvh-6rem))] w-80 flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-2xl ring-1 ring-black/5"
					>
						<div className="flex items-center justify-between border-b px-4 py-2.5">
							<h2 className="text-sm font-semibold">Assistente</h2>
							<Button
								variant="ghost"
								size="icon-xs"
								aria-label="Fechar assistente"
								onClick={() => setAssistantOpen(false)}
							>
								<X />
							</Button>
						</div>
						<div className="min-h-0 flex-1">
							<AssistantPanel store={store} />
						</div>
					</section>
				)}

				<Dock
					store={store}
					catalogOpen={drawer === "objects"}
					onToggleCatalog={() =>
						drawer === "objects" ? closeDrawer() : setCatalogOpen(true)
					}
					onPickTool={() => setCatalogOpen(false)}
					insets={{ left: insets2d.left, right: insets2d.right }}
				/>

				<input
					ref={fileRef}
					type="file"
					accept=".json,application/json"
					className="hidden"
					onChange={(e) => void onImport(e.target.files?.[0])}
				/>
			</div>
		</TooltipProvider>
	);
}
