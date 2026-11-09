import {
	ChevronDown,
	ChevronRight,
	DoorOpen,
	Folder,
	Group,
	Lock,
	LockOpen,
	Minus,
	MoveDown,
	MoveUp,
	Ruler,
	Sofa,
	Square,
	UnfoldVertical,
	Ungroup,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { useAppForm } from "#/components/form/form-hooks.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import { ScrollArea } from "#/components/ui/scroll-area.tsx";
import {
	buildLayerTree,
	type LayerNode,
	nodeRefs,
	selectionState,
} from "#/lib/planner/layer-tree";
import {
	currentFloorOf,
	type PlannerStore,
	usePlanner,
} from "#/lib/planner/store";
import { cn } from "#/lib/utils";

const ICON: Record<string, typeof Sofa> = {
	section: Folder,
	group: Group,
	item: Sofa,
	stair: UnfoldVertical,
	opening: DoorOpen,
	wall: Minus,
	room: Square,
	ruler: Ruler,
};

const nameSchema = z.object({
	name: z.string().trim().max(60, "Máximo 60 caracteres"),
});

type Ref = { kind: string; id: string };
const sameRef = (a: Ref, b: Ref) => a.kind === b.kind && a.id === b.id;

/** Inline group-name editor (TanStack Form + shadcn Input). Enter saves, Esc cancels. */
function GroupRename({
	initial,
	onSave,
	onDone,
}: {
	initial: string;
	onSave: (name: string) => void;
	onDone: () => void;
}) {
	const finished = useRef(false);
	const ref = useRef<HTMLInputElement>(null);
	const form = useAppForm({
		defaultValues: { name: initial },
		validators: { onChange: nameSchema },
		onSubmit: ({ value }) => {
			finished.current = true;
			onSave(value.name);
			onDone();
		},
	});
	useEffect(() => {
		ref.current?.focus();
		ref.current?.select();
	}, []);
	return (
		<form
			className="min-w-0 flex-1"
			onSubmit={(e) => {
				e.preventDefault();
				void form.handleSubmit();
			}}
		>
			<form.Field name="name">
				{(field) => (
					<Input
						ref={ref}
						value={field.state.value}
						aria-label="Nome do grupo"
						className="h-6 px-1.5 text-xs"
						onChange={(e) => field.handleChange(e.target.value)}
						onBlur={() => {
							if (finished.current) return;
							if (field.state.meta.isValid) void form.handleSubmit();
							else onDone();
						}}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								finished.current = true;
								onDone();
							}
							e.stopPropagation();
						}}
					/>
				)}
			</form.Field>
		</form>
	);
}

/** Figma-style layers tree: sections, groups and objects of the current floor, in sync with the canvas selection. */
export function LayersPanel({ store }: { store: PlannerStore }) {
	const project = usePlanner(store, (s) => s.project);
	const selection = usePlanner(store, (s) => s.selection);
	const floor = currentFloorOf(project);
	const tree = useMemo(() => buildLayerTree(floor), [floor]);
	// open/closed overrides by node id; a node without an override uses its own default (`collapsed`)
	const [opens, setOpens] = useState<Record<string, boolean>>({});
	const [renaming, setRenaming] = useState<string | null>(null);

	const selectedItems = selection.filter((s) => s.kind === "item");
	const canGroup = selectedItems.length >= 2;
	const canUngroup = floor.items.some(
		(i) => i.groupId && selectedItems.some((s) => s.id === i.id),
	);
	const canReorder = selectedItems.length > 0;

	const isOpen = (node: LayerNode) => opens[node.id] ?? !node.collapsed;
	const toggle = (node: LayerNode) =>
		setOpens((prev) => ({ ...prev, [node.id]: !isOpen(node) }));

	const onSelect = (node: LayerNode, additive: boolean) => {
		const refs = nodeRefs(node);
		if (!additive) return store.select(refs);
		store.select(
			selectionState(node, selection) === "all"
				? selection.filter((s) => !refs.some((r) => sameRef(r, s)))
				: [
						...selection,
						...refs.filter((r) => !selection.some((s) => sameRef(r, s))),
					],
		);
	};

	const row = (node: LayerNode, depth: number, parent?: LayerNode) => {
		const Icon = ICON[node.kind] ?? Square;
		const isSection = node.kind === "section";
		const state = isSection ? "none" : selectionState(node, selection);
		const open = isOpen(node);
		const hasChildren = (node.children?.length ?? 0) > 0;
		const itemIds = nodeRefs(node)
			.filter((r) => r.kind === "item")
			.map((r) => r.id);
		const locked =
			node.kind === "group"
				? (node.children ?? []).every((c) => c.locked)
				: node.locked;
		const gid = node.kind === "group" ? node.id.slice("group:".length) : null;
		return (
			<li key={node.id}>
				<div
					className={cn(
						"group flex h-7 items-center gap-1 rounded-md pr-1 text-xs",
						isSection
							? "mt-1 cursor-pointer font-semibold text-muted-foreground uppercase tracking-wide"
							: "cursor-pointer hover:bg-accent",
						state === "all" && "bg-primary/15 text-foreground",
						state === "partial" && "bg-primary/5",
					)}
					style={{ paddingLeft: 4 + depth * 14 }}
					onPointerDown={(e) => e.preventDefault()}
					onClick={(e) => {
						if (isSection) return toggle(node);
						onSelect(node, e.shiftKey || e.ctrlKey || e.metaKey);
					}}
					onDoubleClick={() => {
						if (gid) setRenaming(node.id);
					}}
					role="treeitem"
					aria-selected={state === "all"}
					tabIndex={0}
					onKeyDown={(e) => {
						if (e.target !== e.currentTarget) return;
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							if (isSection) toggle(node);
							else onSelect(node, e.shiftKey || e.ctrlKey || e.metaKey);
						}
						if (e.key === "F2" && gid) setRenaming(node.id);
					}}
				>
					<button
						type="button"
						className={cn(
							"flex size-5 shrink-0 items-center justify-center rounded hover:bg-background",
							!hasChildren && "invisible",
						)}
						aria-label={open ? "Recolher" : "Expandir"}
						onClick={(e) => {
							e.stopPropagation();
							toggle(node);
						}}
					>
						{open ? (
							<ChevronDown className="size-3.5" />
						) : (
							<ChevronRight className="size-3.5" />
						)}
					</button>
					{!isSection && (
						<Icon className="size-3.5 shrink-0 text-muted-foreground" />
					)}
					{renaming === node.id && gid ? (
						<GroupRename
							initial={node.label}
							onSave={(name) => store.renameGroup(gid, name)}
							onDone={() => setRenaming(null)}
						/>
					) : (
						<span className="min-w-0 flex-1 truncate">{node.label}</span>
					)}
					{isSection && (
						<span className="font-normal tabular-nums">
							{nodeRefs(node).length}
						</span>
					)}
					{node.shared && (
						<span
							className="rounded bg-muted px-1 text-[10px] text-muted-foreground"
							title="Esta parede também pertence a outro cômodo"
						>
							compartilhada
						</span>
					)}
					{parent?.kind === "group" && node.kind === "item" && (
						<button
							type="button"
							className="hidden size-5 items-center justify-center rounded hover:bg-background group-hover:flex"
							title="Tirar do grupo"
							aria-label="Tirar do grupo"
							onClick={(e) => {
								e.stopPropagation();
								store.removeFromGroup([node.ref?.id ?? ""]);
							}}
						>
							<Ungroup className="size-3.5" />
						</button>
					)}
					{itemIds.length > 0 && (
						<button
							type="button"
							className={cn(
								"size-5 items-center justify-center rounded hover:bg-background",
								locked ? "flex" : "hidden group-hover:flex",
							)}
							title={locked ? "Destravar" : "Travar"}
							aria-label={locked ? "Destravar" : "Travar"}
							onClick={(e) => {
								e.stopPropagation();
								store.setItemsLocked(itemIds, !locked);
							}}
						>
							{locked ? (
								<Lock className="size-3.5" />
							) : (
								<LockOpen className="size-3.5" />
							)}
						</button>
					)}
				</div>
				{hasChildren && open && (
					<ul>{(node.children ?? []).map((c) => row(c, depth + 1, node))}</ul>
				)}
			</li>
		);
	};

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between gap-1 border-b p-2">
				<span className="px-1 font-semibold text-sm">Camadas</span>
				<div className="flex gap-0.5">
					<Button
						size="icon-xs"
						variant="ghost"
						title="Agrupar (Ctrl G)"
						disabled={!canGroup}
						onClick={() => store.groupSelection()}
					>
						<Group />
					</Button>
					<Button
						size="icon-xs"
						variant="ghost"
						title="Desagrupar (Ctrl Shift G)"
						disabled={!canUngroup}
						onClick={() => store.ungroupSelection()}
					>
						<Ungroup />
					</Button>
					<Button
						size="icon-xs"
						variant="ghost"
						title="Subir uma camada (Ctrl ])"
						disabled={!canReorder}
						onClick={() => store.reorderSelection("forward")}
					>
						<MoveUp />
					</Button>
					<Button
						size="icon-xs"
						variant="ghost"
						title="Descer uma camada (Ctrl [)"
						disabled={!canReorder}
						onClick={() => store.reorderSelection("backward")}
					>
						<MoveDown />
					</Button>
				</div>
			</div>
			<ScrollArea className="min-h-0 flex-1">
				{tree.length === 0 ? (
					<p className="p-4 text-center text-muted-foreground text-xs">
						Nada neste piso ainda. Desenhe paredes ou adicione objetos.
					</p>
				) : (
					<ul className="p-2">{tree.map((n) => row(n, 0))}</ul>
				)}
			</ScrollArea>
		</div>
	);
}
