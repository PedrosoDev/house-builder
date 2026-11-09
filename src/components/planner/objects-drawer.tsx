import { Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import { ScrollArea } from "#/components/ui/scroll-area.tsx";
import {
	activeSectionIndex,
	groupCatalog,
	sectionsOf,
} from "#/lib/planner/catalog-groups";
import {
	type DrawerMode,
	drawerTitle,
	openingPresetsFor,
} from "#/lib/planner/drawer-mode";
import { type PlannerStore, usePlanner } from "#/lib/planner/store";
import { cn } from "#/lib/utils";
import { Icon, ItemPreview } from "./catalog-panel";

/**
 * Left drawer that replaces the left panel (same size) while the door, window or object mode is active.
 * Objects: a carousel of category icons on top and, below, every category as a section with a sticky title; the
 * carousel highlights the section being read and jumps to a section when clicked. Doors and windows have their own mode.
 */
export function ObjectsDrawer({
	store,
	mode,
	onClose,
}: {
	store: PlannerStore;
	mode: DrawerMode;
	onClose: () => void;
}) {
	const activeItem = usePlanner(store, (s) => s.catalogItemId);
	const activeTool = usePlanner(store, (s) => s.tool);
	const preset = usePlanner(store, (s) => s.openingPreset);
	const [query, setQuery] = useState("");
	const [activeId, setActiveId] = useState<string | null>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const carouselRef = useRef<HTMLDivElement>(null);
	const sectionEls = useRef(new Map<string, HTMLElement>());
	const chipEls = useRef(new Map<string, HTMLElement>());
	const lockUntil = useRef(0);

	const objects = mode === "objects";
	const sections = useMemo(
		() => (objects ? sectionsOf(groupCatalog(query)) : []),
		[objects, query],
	);
	const presets = objects ? [] : openingPresetsFor(mode, query);
	const count = objects
		? sections.reduce((n, s) => n + s.items.length, 0)
		: presets.length;
	const current =
		sections.find((s) => s.id === activeId)?.id ?? sections[0]?.id ?? null;

	// scroll-spy: the carousel follows the section whose title is at the top of the list
	const onScroll = useCallback(() => {
		const list = listRef.current;
		if (!list || Date.now() < lockUntil.current) return;
		const tops = sections.map(
			(s) => sectionEls.current.get(s.id)?.offsetTop ?? 0,
		);
		const i = activeSectionIndex(tops, list.scrollTop, 40);
		if (i >= 0) setActiveId(sections[i].id);
	}, [sections]);

	// keep the highlighted icon visible in the carousel
	useEffect(() => {
		const bar = carouselRef.current;
		const chip = current ? chipEls.current.get(current) : undefined;
		if (!bar || !chip) return;
		bar.scrollTo({
			left: chip.offsetLeft - (bar.clientWidth - chip.clientWidth) / 2,
			behavior: "smooth",
		});
	}, [current]);

	const jumpTo = (id: string) => {
		const list = listRef.current;
		const el = sectionEls.current.get(id);
		if (!list || !el) return;
		setActiveId(id);
		lockUntil.current = Date.now() + 500;
		list.scrollTo({ top: el.offsetTop, behavior: "smooth" });
	};

	const itemCard = (it: (typeof sections)[number]["items"][number]) => {
		const on = activeItem === it.id && activeTool === "item";
		return (
			<button
				key={it.id}
				type="button"
				draggable
				onDragStart={(e) => {
					e.dataTransfer.setData("application/x-planner-item", it.id);
					e.dataTransfer.effectAllowed = "copy";
					store.setDragPayload({ kind: "item", id: it.id });
				}}
				onDragEnd={() => store.setDragPayload(null)}
				onClick={() =>
					store.setCatalogItem(activeItem === it.id ? null : it.id)
				}
				className={cn(
					"flex flex-col rounded-xl bg-muted/60 p-2 text-left transition-colors hover:ring-2 hover:ring-primary",
					on && "bg-primary/10 ring-2 ring-primary",
				)}
			>
				<div className="flex h-16 items-center justify-center rounded-lg bg-background/70">
					<ItemPreview item={it} size={52} />
				</div>
				<span className="mt-1.5 line-clamp-2 text-xs leading-tight font-medium">
					{it.name}
				</span>
				<span className="text-[11px] text-muted-foreground">
					{it.size[0]} × {it.size[2]} cm
				</span>
			</button>
		);
	};

	return (
		<aside
			aria-label={`${drawerTitle(mode)} — catálogo`}
			className="absolute top-3 bottom-3 left-3 z-20 flex w-72 animate-in flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-lg ring-1 ring-black/5 duration-300 fade-in-0 slide-in-from-left-6"
		>
			<header className="flex items-center gap-2 px-3 pt-3 pb-2">
				<h2 className="text-[15px] font-semibold">{drawerTitle(mode)}</h2>
				<span className="text-xs text-muted-foreground">{count} itens</span>
				<Button
					variant="ghost"
					size="icon-sm"
					className="ml-auto"
					aria-label="Fechar e voltar ao painel"
					title="Fechar (Esc)"
					onClick={onClose}
				>
					<X />
				</Button>
			</header>
			<div className="px-3 pb-2">
				<div className="relative">
					<Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
					<Input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={
							objects
								? "Buscar móveis, plantas…"
								: `Buscar em ${drawerTitle(mode).toLowerCase()}…`
						}
						className="h-9 rounded-xl border-0 bg-muted pr-8 pl-8"
						aria-label="Buscar no catálogo"
					/>
					{query && (
						<button
							type="button"
							onClick={() => setQuery("")}
							className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground"
							aria-label="Limpar busca"
						>
							<X className="size-4" />
						</button>
					)}
				</div>
			</div>

			{objects ? (
				<>
					{sections.length > 0 && (
						<div className="relative border-y">
							<div
								ref={carouselRef}
								role="tablist"
								aria-label="Categorias"
								className="flex gap-2.5 overflow-x-auto px-3 py-2.5 [scrollbar-width:none]"
							>
								{sections.map((s) => {
									const on = s.id === current;
									return (
										<button
											key={s.id}
											ref={(el) => {
												if (el) chipEls.current.set(s.id, el);
												else chipEls.current.delete(s.id);
											}}
											type="button"
											role="tab"
											aria-selected={on}
											onClick={() => jumpTo(s.id)}
											className="flex w-14 shrink-0 flex-col items-center gap-1 text-center"
										>
											<span
												className={cn(
													"flex size-11 items-center justify-center rounded-full transition-colors",
													on
														? "bg-foreground text-background"
														: "bg-muted text-foreground/70 hover:bg-muted/70",
												)}
											>
												<Icon name={s.icon} className="size-5" />
											</span>
											<span
												className={cn(
													"w-full truncate text-[11px] leading-tight",
													on ? "font-semibold" : "text-muted-foreground",
												)}
											>
												{s.name}
											</span>
										</button>
									);
								})}
							</div>
							<div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-r from-transparent to-card" />
						</div>
					)}
					<div
						ref={listRef}
						onScroll={onScroll}
						className="relative min-h-0 flex-1 overflow-y-auto"
					>
						{sections.length === 0 ? (
							<p className="py-6 text-center text-sm text-muted-foreground">
								Nenhum objeto encontrado.
							</p>
						) : (
							<>
								{sections.map((s) => (
									<section
										key={s.id}
										ref={(el) => {
											if (el) sectionEls.current.set(s.id, el);
											else sectionEls.current.delete(s.id);
										}}
										aria-label={s.name}
									>
										<h3 className="sticky top-0 z-10 flex items-baseline gap-1.5 border-b bg-card/95 px-3 py-2 backdrop-blur">
											{s.path.length > 0 && (
												<span className="truncate text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
													{s.path.join(" › ")}
												</span>
											)}
											{s.path.length > 0 && (
												<span className="text-muted-foreground/60">›</span>
											)}
											<span className="text-sm font-semibold">{s.name}</span>
											<span className="ml-auto text-xs text-muted-foreground tabular-nums">
												{s.items.length}
											</span>
										</h3>
										<div className="grid grid-cols-2 gap-2 p-3">
											{s.items.map(itemCard)}
										</div>
									</section>
								))}
								<div className="h-48" aria-hidden />
							</>
						)}
					</div>
				</>
			) : (
				<ScrollArea className="min-h-0 flex-1 border-t">
					<div className="p-2">
						{presets.length === 0 ? (
							<p className="py-6 text-center text-sm text-muted-foreground">
								Nada encontrado.
							</p>
						) : (
							<div className="grid grid-cols-2 gap-2">
								{presets.map((p) => {
									const on =
										preset?.kind === p.kind &&
										preset.width === p.width &&
										(activeTool === "door" || activeTool === "window");
									return (
										<button
											key={p.id}
											type="button"
											draggable
											onDragStart={(e) => {
												e.dataTransfer.setData(
													"application/x-planner-opening",
													p.id,
												);
												e.dataTransfer.effectAllowed = "copy";
												store.setDragPayload({
													kind: "opening",
													preset: {
														kind: p.kind,
														width: p.width,
														height: p.height,
														sill: p.sill,
													},
												});
											}}
											onDragEnd={() => store.setDragPayload(null)}
											onClick={() =>
												store.setOpeningPreset(
													{
														kind: p.kind,
														width: p.width,
														height: p.height,
														sill: p.sill,
													},
													p.category === "windows" ? "window" : "door",
												)
											}
											className={cn(
												"flex flex-col items-center gap-1 rounded-xl bg-muted/60 p-3 text-center transition-colors hover:ring-2 hover:ring-primary",
												on && "bg-primary/10 ring-2 ring-primary",
											)}
										>
											<Icon
												name={
													p.category === "windows" ? "AppWindow" : "DoorOpen"
												}
												className="size-8 text-muted-foreground"
											/>
											<span className="text-sm leading-tight font-medium">
												{p.name}
											</span>
											<span className="text-[11px] text-muted-foreground">
												{p.width} × {p.height} cm
											</span>
										</button>
									);
								})}
							</div>
						)}
					</div>
				</ScrollArea>
			)}
			<footer className="border-t px-3 py-2 text-xs text-muted-foreground">
				Clique para posicionar ou arraste para a planta · Esc fecha
			</footer>
		</aside>
	);
}
