import {
	Copy,
	FlipHorizontal2,
	Group,
	Lock,
	LockOpen,
	RotateCw,
	Scissors,
	Trash2,
	Ungroup,
} from "lucide-react";
import { z } from "zod";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import { FieldGroup, FieldLegend, FieldSet } from "#/components/ui/field.tsx";
import { Separator } from "#/components/ui/separator.tsx";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "#/components/ui/tabs.tsx";
import { itemById, OPENING_PRESETS } from "#/lib/planner/catalog";
import {
	formatArea,
	formatLength,
	polygonArea,
	polygonPerimeter,
	wallLength,
} from "#/lib/planner/geometry";
import { ROOM_TYPES, roomTypeLabel } from "#/lib/planner/materials";
import {
	currentFloorOf,
	type PlannerStore,
	usePlanner,
} from "#/lib/planner/store";
import type {
	Floor,
	Item,
	Opening,
	Room,
	RoomType,
	Stair,
	Wall,
} from "#/lib/planner/types";
import { useEntityForm } from "./entity-form";
import { MaterialPicker } from "./material-picker";

type Props = { store: PlannerStore };

export function PropertiesPanel({ store }: Props) {
	const project = usePlanner(store, (s) => s.project);
	const selection = usePlanner(store, (s) => s.selection);
	const floor = currentFloorOf(project);

	let body: React.ReactNode;
	if (selection.length === 0) {
		body = <FloorAndProject store={store} floor={floor} />;
	} else if (selection.length > 1) {
		body = <MultiSelection store={store} count={selection.length} />;
	} else {
		const s = selection[0];
		if (s.kind === "wall") {
			const w = floor.walls.find((x) => x.id === s.id);
			body = w ? (
				<WallForm key={w.id} store={store} wall={w} floor={floor} />
			) : null;
		} else if (s.kind === "room") {
			const r = floor.rooms.find((x) => x.id === s.id);
			body = r ? <RoomForm key={r.id} store={store} room={r} /> : null;
		} else if (s.kind === "opening") {
			const o = floor.openings.find((x) => x.id === s.id);
			body = o ? <OpeningForm key={o.id} store={store} opening={o} /> : null;
		} else if (s.kind === "item") {
			const i = floor.items.find((x) => x.id === s.id);
			body = i ? <ItemForm key={i.id} store={store} item={i} /> : null;
		} else if (s.kind === "stair") {
			const i = floor.stairs.find((x) => x.id === s.id);
			body = i ? <StairForm key={i.id} store={store} stair={i} /> : null;
		} else if (s.kind === "ruler") {
			const r = floor.rulers.find((x) => x.id === s.id);
			body = r ? (
				<div className="flex flex-col gap-3 p-4">
					<Header title="Régua" />
					<p className="text-sm text-muted-foreground">
						Comprimento:{" "}
						{formatLength(
							Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y),
							project.units,
						)}
					</p>
					<Button
						variant="destructive"
						size="sm"
						onClick={() => store.deleteSelection()}
					>
						<Trash2 /> Remover
					</Button>
				</div>
			) : null;
		}
	}

	return (
		<div className="max-h-[calc(100dvh-5.5rem)] overflow-y-auto pb-4">
			<div
				key={selection.map((s) => `${s.kind}:${s.id}`).join("|") || "none"}
				className="animate-in duration-200 fade-in-0 slide-in-from-right-3"
			>
				{body}
			</div>
		</div>
	);
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
	return (
		<div className="flex items-center justify-between gap-2">
			<h3 className="text-sm font-semibold">{title}</h3>
			{subtitle && <Badge variant="secondary">{subtitle}</Badge>}
		</div>
	);
}

function Actions({
	store,
	extra,
}: {
	store: PlannerStore;
	extra?: React.ReactNode;
}) {
	return (
		<div className="flex flex-wrap gap-1.5">
			<Button
				size="sm"
				variant="outline"
				onClick={() => store.duplicateSelection()}
				title="Duplicar (Ctrl+D)"
			>
				<Copy /> Duplicar
			</Button>
			{extra}
			<Button
				size="sm"
				variant="destructive"
				onClick={() => store.deleteSelection()}
				title="Excluir (Del)"
			>
				<Trash2 /> Excluir
			</Button>
		</div>
	);
}

// ---------------------------------------------------------------- multi

function MultiSelection({
	store,
	count,
}: {
	store: PlannerStore;
	count: number;
}) {
	return (
		<div className="flex flex-col gap-3 p-4">
			<Header title="Seleção múltipla" subtitle={`${count} itens`} />
			<Actions
				store={store}
				extra={
					<>
						<Button
							size="sm"
							variant="outline"
							onClick={() => store.groupSelection()}
						>
							<Group /> Agrupar
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => store.ungroupSelection()}
						>
							<Ungroup /> Desagrupar
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => store.rotateSelection(90)}
						>
							<RotateCw /> 90°
						</Button>
					</>
				}
			/>
			<p className="text-xs text-muted-foreground">
				Use as setas para mover a seleção (Shift = passos maiores).
			</p>
		</div>
	);
}

// ---------------------------------------------------------------- wall

const wallSchema = z.object({
	thickness: z
		.number("Informe um número")
		.min(4, "Mínimo 4 cm")
		.max(100, "Máximo 100 cm"),
	height: z
		.number("Informe um número")
		.min(0, "Use 0 para a altura do piso")
		.max(1000, "Máximo 10 m"),
	partition: z.boolean(),
	hidden: z.boolean(),
});

function WallForm({
	store,
	wall,
	floor,
}: {
	store: PlannerStore;
	wall: Wall;
	floor: Floor;
}) {
	const units = store.getState().project.units;
	const form = useEntityForm({
		store,
		schema: wallSchema,
		values: {
			thickness: wall.thickness,
			height: wall.height ?? 0,
			partition: wall.partition,
			hidden: wall.hidden,
		},
		onCommit: (p) => {
			const patch: Partial<Wall> = {};
			if (p.thickness !== undefined) patch.thickness = p.thickness;
			if (p.height !== undefined)
				patch.height = p.height === 0 ? null : p.height;
			if (p.partition !== undefined) patch.partition = p.partition;
			if (p.hidden !== undefined) patch.hidden = p.hidden;
			store.updateWall(wall.id, patch);
		},
	});
	const openings = floor.openings.filter((o) => o.wallId === wall.id).length;
	return (
		<div className="flex flex-col gap-4 p-4">
			<Header
				title={wall.partition ? "Divisória" : "Parede"}
				subtitle={formatLength(wallLength(wall), units)}
			/>
			<Tabs defaultValue="shape">
				<TabsList className="w-full">
					<TabsTrigger value="shape">Forma</TabsTrigger>
					<TabsTrigger value="a">Lado A</TabsTrigger>
					<TabsTrigger value="b">Lado B</TabsTrigger>
				</TabsList>
				<TabsContent value="shape" className="mt-4">
					<form onSubmit={(e) => e.preventDefault()}>
						<FieldGroup className="gap-4">
							<div className="grid grid-cols-2 gap-3">
								<form.AppField name="thickness">
									{(f) => (
										<f.NumberField
											label="Espessura"
											unit="cm"
											min={4}
											max={100}
										/>
									)}
								</form.AppField>
								<form.AppField name="height">
									{(f) => (
										<f.NumberField
											label="Altura"
											unit="cm"
											min={0}
											max={1000}
											description="0 = piso"
										/>
									)}
								</form.AppField>
							</div>
							<form.AppField name="partition">
								{(f) => (
									<f.SwitchField
										label="Divisória"
										description="Parede interna fina"
									/>
								)}
							</form.AppField>
							<form.AppField name="hidden">
								{(f) => <f.SwitchField label="Ocultar no 3D" />}
							</form.AppField>
						</FieldGroup>
					</form>
					<p className="mt-3 text-xs text-muted-foreground">
						{openings} abertura(s) nesta parede.
					</p>
				</TabsContent>
				<TabsContent value="a" className="mt-4">
					<MaterialPicker
						value={wall.left}
						onChange={(m) => store.updateWall(wall.id, { left: m })}
					/>
				</TabsContent>
				<TabsContent value="b" className="mt-4">
					<MaterialPicker
						value={wall.right}
						onChange={(m) => store.updateWall(wall.id, { right: m })}
					/>
				</TabsContent>
			</Tabs>
			<Separator />
			<Actions
				store={store}
				extra={
					<Button
						size="sm"
						variant="outline"
						onClick={() => store.splitSelectedWall()}
					>
						<Scissors /> Dividir
					</Button>
				}
			/>
		</div>
	);
}

// ---------------------------------------------------------------- room

const roomSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Dê um nome ao cômodo")
		.max(60, "Máximo 60 caracteres"),
	type: z.string(),
	floorOffset: z.number("Informe um número").min(-100).max(100),
	ceiling: z.boolean(),
});

function RoomForm({ store, room }: { store: PlannerStore; room: Room }) {
	const units = store.getState().project.units;
	const form = useEntityForm({
		store,
		schema: roomSchema,
		values: {
			name: room.name,
			type: room.type as string,
			floorOffset: room.floorOffset,
			ceiling: room.ceiling,
		},
		onCommit: (p) => {
			const patch: Partial<Room> = {};
			if (p.name !== undefined) patch.name = p.name;
			if (p.type !== undefined) patch.type = p.type as RoomType;
			if (p.floorOffset !== undefined) patch.floorOffset = p.floorOffset;
			if (p.ceiling !== undefined) patch.ceiling = p.ceiling;
			store.updateRoom(room.id, patch);
		},
	});
	return (
		<div className="flex flex-col gap-4 p-4">
			<Header
				title="Cômodo"
				subtitle={formatArea(polygonArea(room.points), units)}
			/>
			<p className="-mt-2 text-xs text-muted-foreground">
				{roomTypeLabel(room.type)} · perímetro{" "}
				{formatLength(polygonPerimeter(room.points), units)}
			</p>
			<form onSubmit={(e) => e.preventDefault()}>
				<FieldGroup className="gap-4">
					<form.AppField name="name">
						{(f) => <f.TextField label="Nome" />}
					</form.AppField>
					<form.AppField name="type">
						{(f) => (
							<f.SelectField
								label="Tipo"
								options={ROOM_TYPES.map((r) => ({
									value: r.id,
									label: r.label,
								}))}
							/>
						)}
					</form.AppField>
					<form.AppField name="floorOffset">
						{(f) => (
							<f.NumberField
								label="Desnível do piso"
								unit="cm"
								min={-100}
								max={100}
							/>
						)}
					</form.AppField>
					<form.AppField name="ceiling">
						{(f) => (
							<f.SwitchField label="Forro" description="Mostra o teto no 3D" />
						)}
					</form.AppField>
				</FieldGroup>
			</form>
			<FieldSet>
				<FieldLegend variant="label">Piso</FieldLegend>
				<MaterialPicker
					value={room.floor}
					scope="floor"
					onChange={(m) => store.updateRoom(room.id, { floor: m })}
				/>
			</FieldSet>
			<Separator />
			<Actions store={store} />
		</div>
	);
}

// ---------------------------------------------------------------- opening

const openingSchema = z.object({
	kind: z.string(),
	width: z
		.number("Informe um número")
		.min(30, "Mínimo 30 cm")
		.max(500, "Máximo 500 cm"),
	height: z
		.number("Informe um número")
		.min(30, "Mínimo 30 cm")
		.max(400, "Máximo 400 cm"),
	sill: z.number("Informe um número").min(0, "Não pode ser negativo").max(300),
	flip: z.boolean(),
	mirror: z.boolean(),
	open: z.boolean(),
});

const OPENING_KINDS = [
	{ value: "door", label: "Porta" },
	{ value: "doubleDoor", label: "Porta dupla" },
	{ value: "slidingDoor", label: "Porta de correr" },
	{ value: "window", label: "Janela" },
	{ value: "arch", label: "Arco" },
	{ value: "garage", label: "Portão de garagem" },
];

function OpeningForm({
	store,
	opening,
}: {
	store: PlannerStore;
	opening: Opening;
}) {
	const form = useEntityForm({
		store,
		schema: openingSchema,
		values: {
			kind: opening.kind as string,
			width: opening.width,
			height: opening.height,
			sill: opening.sill,
			flip: opening.flip,
			mirror: opening.mirror,
			open: opening.open,
		},
		onCommit: (p) => store.updateOpening(opening.id, p as Partial<Opening>),
	});
	return (
		<div className="flex flex-col gap-4 p-4">
			<Header
				title={
					OPENING_KINDS.find((k) => k.value === opening.kind)?.label ??
					"Abertura"
				}
			/>
			<form onSubmit={(e) => e.preventDefault()}>
				<FieldGroup className="gap-4">
					<form.AppField name="kind">
						{(f) => <f.SelectField label="Tipo" options={OPENING_KINDS} />}
					</form.AppField>
					<div className="grid grid-cols-3 gap-3">
						<form.AppField name="width">
							{(f) => (
								<f.NumberField label="Largura" unit="cm" min={30} max={500} />
							)}
						</form.AppField>
						<form.AppField name="height">
							{(f) => (
								<f.NumberField label="Altura" unit="cm" min={30} max={400} />
							)}
						</form.AppField>
						<form.AppField name="sill">
							{(f) => (
								<f.NumberField label="Peitoril" unit="cm" min={0} max={300} />
							)}
						</form.AppField>
					</div>
					<form.AppField name="flip">
						{(f) => <f.SwitchField label="Inverter dobradiça" />}
					</form.AppField>
					<form.AppField name="mirror">
						{(f) => <f.SwitchField label="Abrir para o outro lado" />}
					</form.AppField>
					<form.AppField name="open">
						{(f) => <f.SwitchField label="Aberta no 3D" />}
					</form.AppField>
				</FieldGroup>
			</form>
			<FieldSet>
				<FieldLegend variant="label">Moldura / folha</FieldLegend>
				<MaterialPicker
					compact
					value={opening.frame}
					onChange={(m) => store.updateOpening(opening.id, { frame: m })}
				/>
			</FieldSet>
			<div className="flex flex-wrap gap-1.5">
				{OPENING_PRESETS.filter((p) => p.kind === opening.kind).map((p) => (
					<Button
						key={p.id}
						size="xs"
						variant="outline"
						onClick={() =>
							store.updateOpening(opening.id, {
								width: p.width,
								height: p.height,
								sill: p.sill,
							})
						}
					>
						{p.name}
					</Button>
				))}
			</div>
			<Separator />
			<Actions store={store} />
		</div>
	);
}

// ---------------------------------------------------------------- item

const itemSchema = z.object({
	label: z.string().trim().min(1, "Informe um nome").max(60),
	w: z.number("Informe um número").min(5, "Mínimo 5 cm").max(3000),
	d: z.number("Informe um número").min(5, "Mínimo 5 cm").max(3000),
	h: z.number("Informe um número").min(1, "Mínimo 1 cm").max(1500),
	elevation: z.number("Informe um número").min(0).max(1000),
	rotation: z.number("Informe um número").min(0).max(360),
	color: z.string(),
	accent: z.string(),
	locked: z.boolean(),
	flipped: z.boolean(),
});

function ItemForm({ store, item }: { store: PlannerStore; item: Item }) {
	const def = itemById(item.catalogId);
	const form = useEntityForm({
		store,
		schema: itemSchema,
		values: {
			label: item.label,
			w: round(item.w),
			d: round(item.d),
			h: round(item.h),
			elevation: round(item.elevation),
			rotation: round(item.rotation),
			color: item.color,
			accent: item.accent,
			locked: item.locked,
			flipped: item.flipped,
		},
		onCommit: (p) => store.updateItem(item.id, p as Partial<Item>),
	});
	return (
		<div className="flex flex-col gap-4 p-4">
			<Header title={item.label} subtitle={def ? def.name : "Objeto"} />
			<form onSubmit={(e) => e.preventDefault()}>
				<FieldGroup className="gap-4">
					<form.AppField name="label">
						{(f) => <f.TextField label="Nome" />}
					</form.AppField>
					<div className="grid grid-cols-3 gap-3">
						<form.AppField name="w">
							{(f) => <f.NumberField label="Largura" unit="cm" />}
						</form.AppField>
						<form.AppField name="d">
							{(f) => <f.NumberField label="Prof." unit="cm" />}
						</form.AppField>
						<form.AppField name="h">
							{(f) => <f.NumberField label="Altura" unit="cm" />}
						</form.AppField>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<form.AppField name="rotation">
							{(f) => (
								<f.NumberField
									label="Rotação"
									unit="°"
									min={0}
									max={360}
									step={15}
								/>
							)}
						</form.AppField>
						<form.AppField name="elevation">
							{(f) => <f.NumberField label="Elevação" unit="cm" />}
						</form.AppField>
					</div>
					<form.AppField name="color">
						{(f) => <f.ColorField label="Cor principal" />}
					</form.AppField>
					<form.AppField name="accent">
						{(f) => <f.ColorField label="Cor secundária" />}
					</form.AppField>
					<form.AppField name="locked">
						{(f) => <f.SwitchField label="Travar posição" />}
					</form.AppField>
					<form.AppField name="flipped">
						{(f) => <f.SwitchField label="Espelhar" />}
					</form.AppField>
				</FieldGroup>
			</form>
			<Separator />
			<Actions
				store={store}
				extra={
					<>
						<Button
							size="sm"
							variant="outline"
							onClick={() => store.rotateSelection(90)}
						>
							<RotateCw /> 90°
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => store.flipSelection()}
						>
							<FlipHorizontal2 /> Espelhar
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => store.lockSelection(!item.locked)}
						>
							{item.locked ? <LockOpen /> : <Lock />}{" "}
							{item.locked ? "Destravar" : "Travar"}
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => store.resetMaterials()}
						>
							Restaurar cores
						</Button>
					</>
				}
			/>
		</div>
	);
}

const round = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- stair

const stairSchema = z.object({
	width: z.number("Informe um número").min(40).max(400),
	length: z.number("Informe um número").min(80).max(1000),
	steps: z
		.number("Informe um número")
		.int("Use um número inteiro")
		.min(3)
		.max(40),
	rotation: z.number("Informe um número").min(0).max(360),
	color: z.string(),
});

function StairForm({ store, stair }: { store: PlannerStore; stair: Stair }) {
	const form = useEntityForm({
		store,
		schema: stairSchema,
		values: {
			width: stair.width,
			length: stair.length,
			steps: stair.steps,
			rotation: round(stair.rotation),
			color: stair.color,
		},
		onCommit: (p) => store.updateStair(stair.id, p as Partial<Stair>),
	});
	return (
		<div className="flex flex-col gap-4 p-4">
			<Header title="Escada" />
			<form onSubmit={(e) => e.preventDefault()}>
				<FieldGroup className="gap-4">
					<div className="grid grid-cols-2 gap-3">
						<form.AppField name="width">
							{(f) => <f.NumberField label="Largura" unit="cm" />}
						</form.AppField>
						<form.AppField name="length">
							{(f) => <f.NumberField label="Comprimento" unit="cm" />}
						</form.AppField>
						<form.AppField name="steps">
							{(f) => <f.NumberField label="Degraus" min={3} max={40} />}
						</form.AppField>
						<form.AppField name="rotation">
							{(f) => <f.NumberField label="Rotação" unit="°" step={15} />}
						</form.AppField>
					</div>
					<form.AppField name="color">
						{(f) => <f.ColorField label="Cor" />}
					</form.AppField>
				</FieldGroup>
			</form>
			<Separator />
			<Actions store={store} />
		</div>
	);
}

// ---------------------------------------------------------------- floor & project

const floorSchema = z.object({
	name: z.string().trim().min(1, "Informe um nome").max(40),
	height: z
		.number("Informe um número")
		.min(180, "Mínimo 180 cm")
		.max(600, "Máximo 600 cm"),
	roofKind: z.string(),
	pitch: z.number("Informe um número").min(5).max(70),
	overhang: z.number("Informe um número").min(0).max(200),
});

const projectSchema = z.object({
	name: z.string().trim().min(1, "Informe um nome").max(120),
	units: z.string(),
	sky: z.string(),
	groundColor: z.string(),
	showGround: z.boolean(),
	north: z.number("Informe um número").min(0).max(360),
});

function FloorAndProject({
	store,
	floor,
}: {
	store: PlannerStore;
	floor: Floor;
}) {
	const project = usePlanner(store, (s) => s.project);
	const floorForm = useEntityForm({
		store,
		schema: floorSchema,
		values: {
			name: floor.name,
			height: floor.height,
			roofKind: floor.roof.kind as string,
			pitch: floor.roof.pitch,
			overhang: floor.roof.overhang,
		},
		onCommit: (p) => {
			if (p.name !== undefined) store.renameFloor(floor.id, p.name);
			if (p.height !== undefined) store.setFloorHeight(floor.id, p.height);
			if (p.roofKind !== undefined)
				store.updateRoof(
					{ kind: p.roofKind as Floor["roof"]["kind"] },
					floor.id,
				);
			if (p.pitch !== undefined) store.updateRoof({ pitch: p.pitch }, floor.id);
			if (p.overhang !== undefined)
				store.updateRoof({ overhang: p.overhang }, floor.id);
		},
	});
	const projForm = useEntityForm({
		store,
		schema: projectSchema,
		values: {
			name: project.name,
			units: project.units as string,
			sky: project.environment.sky as string,
			groundColor: project.environment.groundColor,
			showGround: project.environment.showGround,
			north: project.environment.north,
		},
		onCommit: (p) => {
			if (p.name !== undefined) store.rename(p.name);
			if (p.units !== undefined)
				store.setUnits(p.units as "metric" | "imperial");
			if (p.sky !== undefined) store.setEnvironment({ sky: p.sky as never });
			if (p.groundColor !== undefined)
				store.setEnvironment({ groundColor: p.groundColor });
			if (p.showGround !== undefined)
				store.setEnvironment({ showGround: p.showGround });
			if (p.north !== undefined) store.setEnvironment({ north: p.north });
		},
	});
	const totalArea = project.floors.reduce(
		(s, f) => s + f.rooms.reduce((a, r) => a + polygonArea(r.points), 0),
		0,
	);
	return (
		<div className="flex flex-col gap-4 p-4">
			<Header title="Projeto" subtitle={formatArea(totalArea, project.units)} />
			<Tabs defaultValue="floor">
				<TabsList className="w-full">
					<TabsTrigger value="floor">Piso atual</TabsTrigger>
					<TabsTrigger value="project">Projeto</TabsTrigger>
				</TabsList>
				<TabsContent value="floor" className="mt-4">
					<form onSubmit={(e) => e.preventDefault()}>
						<FieldGroup className="gap-4">
							<floorForm.AppField name="name">
								{(f) => <f.TextField label="Nome do piso" />}
							</floorForm.AppField>
							<floorForm.AppField name="height">
								{(f) => (
									<f.NumberField
										label="Pé-direito"
										unit="cm"
										min={180}
										max={600}
									/>
								)}
							</floorForm.AppField>
							<floorForm.AppField name="roofKind">
								{(f) => (
									<f.SelectField
										label="Telhado"
										options={[
											{ value: "none", label: "Sem telhado" },
											{ value: "gable", label: "Duas águas" },
											{ value: "hip", label: "Quatro águas" },
											{ value: "shed", label: "Uma água" },
											{ value: "flat", label: "Laje plana" },
										]}
									/>
								)}
							</floorForm.AppField>
							{floor.roof.kind !== "none" && floor.roof.kind !== "flat" && (
								<floorForm.AppField name="pitch">
									{(f) => (
										<f.SliderField
											label="Inclinação"
											min={5}
											max={70}
											unit="°"
										/>
									)}
								</floorForm.AppField>
							)}
							{floor.roof.kind !== "none" && (
								<floorForm.AppField name="overhang">
									{(f) => (
										<f.SliderField
											label="Beiral"
											min={0}
											max={200}
											step={5}
											unit=" cm"
										/>
									)}
								</floorForm.AppField>
							)}
						</FieldGroup>
					</form>
					{floor.roof.kind !== "none" && (
						<FieldSet className="mt-4">
							<FieldLegend variant="label">Material do telhado</FieldLegend>
							<MaterialPicker
								scope="roof"
								value={floor.roof.material}
								onChange={(m) => store.updateRoof({ material: m }, floor.id)}
							/>
						</FieldSet>
					)}
				</TabsContent>
				<TabsContent value="project" className="mt-4">
					<form onSubmit={(e) => e.preventDefault()}>
						<FieldGroup className="gap-4">
							<projForm.AppField name="name">
								{(f) => <f.TextField label="Nome do projeto" />}
							</projForm.AppField>
							<projForm.AppField name="units">
								{(f) => (
									<f.SelectField
										label="Unidades"
										options={[
											{ value: "metric", label: "Métrico (m, cm)" },
											{ value: "imperial", label: "Imperial (ft, in)" },
										]}
									/>
								)}
							</projForm.AppField>
							<projForm.AppField name="sky">
								{(f) => (
									<f.SelectField
										label="Ambiente 3D"
										options={[
											{ value: "day", label: "Dia" },
											{ value: "evening", label: "Entardecer" },
											{ value: "night", label: "Noite" },
											{ value: "clear", label: "Estúdio" },
										]}
									/>
								)}
							</projForm.AppField>
							<projForm.AppField name="north">
								{(f) => (
									<f.SliderField
										label="Posição do sol"
										min={0}
										max={360}
										step={5}
										unit="°"
									/>
								)}
							</projForm.AppField>
							<projForm.AppField name="showGround">
								{(f) => <f.SwitchField label="Mostrar terreno" />}
							</projForm.AppField>
							<projForm.AppField name="groundColor">
								{(f) => (
									<f.ColorField
										label="Cor do terreno"
										swatches={[
											"#8fae7c",
											"#6a994e",
											"#b8a98a",
											"#cfcfcf",
											"#e9e2d4",
										]}
									/>
								)}
							</projForm.AppField>
						</FieldGroup>
					</form>
				</TabsContent>
			</Tabs>
		</div>
	);
}
