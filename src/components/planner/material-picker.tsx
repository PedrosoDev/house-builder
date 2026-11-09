import { useMemo } from "react";
import { Field, FieldLabel } from "#/components/ui/field.tsx";
import { Slider } from "#/components/ui/slider.tsx";
import {
	COLOR_SWATCHES,
	TEXTURE_FAMILIES,
	textureById,
} from "#/lib/planner/materials";
import { materialDataUrl } from "#/lib/planner/textures";
import type { MaterialRef } from "#/lib/planner/types";
import { cn } from "#/lib/utils";

type Props = {
	value: MaterialRef;
	onChange: (m: MaterialRef) => void;
	scope?: "wall" | "floor" | "roof";
	compact?: boolean;
};

export function MaterialPicker({
	value,
	onChange,
	scope = "wall",
	compact,
}: Props) {
	const families = useMemo(
		() =>
			TEXTURE_FAMILIES.filter((t) => t.scope === "both" || t.scope === scope),
		[scope],
	);
	const fam = textureById(value.texture);
	const colors = fam ? fam.colors : COLOR_SWATCHES;

	return (
		<div className="flex flex-col gap-3">
			<div className="grid grid-cols-5 gap-1.5">
				<button
					type="button"
					onClick={() => onChange({ ...value, texture: null })}
					className={cn(
						"flex aspect-square items-center justify-center rounded-md border text-[10px] text-muted-foreground",
						!value.texture && "ring-2 ring-primary",
					)}
					style={{ background: value.color }}
					title="Cor lisa"
				>
					Lisa
				</button>
				{families.map((t) => {
					const url = materialDataUrl({
						texture: t.id,
						color: t.colors[0],
						scale: 1,
						rotation: 0,
					});
					return (
						<button
							key={t.id}
							type="button"
							title={t.label}
							onClick={() =>
								onChange({
									...value,
									texture: t.id,
									color: fam?.id === t.id ? value.color : t.colors[0],
								})
							}
							className={cn(
								"aspect-square overflow-hidden rounded-md border bg-cover",
								value.texture === t.id && "ring-2 ring-primary",
							)}
							style={{
								backgroundImage: url ? `url(${url})` : undefined,
								backgroundColor: t.colors[0],
								backgroundSize: "200%",
							}}
						/>
					);
				})}
			</div>
			{fam && <p className="text-xs text-muted-foreground">{fam.label}</p>}
			<Field>
				<FieldLabel>Cor</FieldLabel>
				<div className="flex flex-wrap items-center gap-1.5">
					<input
						type="color"
						value={value.color.length === 7 ? value.color : "#ffffff"}
						onChange={(e) => onChange({ ...value, color: e.target.value })}
						className="size-7 cursor-pointer rounded border border-border bg-transparent p-0"
						aria-label="Escolher cor"
					/>
					{colors.map((c) => (
						<button
							key={c}
							type="button"
							onClick={() => onChange({ ...value, color: c })}
							className={cn(
								"size-5 rounded-full border border-border transition-transform hover:scale-110",
								value.color.toLowerCase() === c.toLowerCase() &&
									"ring-2 ring-primary ring-offset-1",
							)}
							style={{ background: c }}
							title={c}
						/>
					))}
				</div>
			</Field>
			{value.texture && !compact && (
				<>
					<Field>
						<FieldLabel>Escala ({value.scale.toFixed(1)}×)</FieldLabel>
						<Slider
							min={0.25}
							max={4}
							step={0.25}
							value={[value.scale]}
							onValueChange={([v]) => onChange({ ...value, scale: v })}
						/>
					</Field>
					<Field>
						<FieldLabel>Rotação ({value.rotation}°)</FieldLabel>
						<Slider
							min={0}
							max={90}
							step={45}
							value={[value.rotation]}
							onValueChange={([v]) => onChange({ ...value, rotation: v })}
						/>
					</Field>
				</>
			)}
		</div>
	);
}
