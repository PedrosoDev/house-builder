import { useEffect, useRef } from "react";
import { z } from "zod";
import { useAppForm } from "#/components/form/form-hooks.tsx";
import { Input } from "#/components/ui/input.tsx";
import type { Camera } from "#/lib/planner/camera";
import { wallLength } from "#/lib/planner/geometry";
import { formatLengthInput, parseLength } from "#/lib/planner/length-input";
import type { PlannerStore } from "#/lib/planner/store";
import type { Wall } from "#/lib/planner/types";
import { planCentroid, wallLabelAnchor } from "#/lib/planner/wall-label";
import { MIN_WALL_LENGTH } from "#/lib/planner/wall-resize";

type Props = {
	store: PlannerStore;
	wall: Wall;
	walls: Wall[];
	cam: Camera;
	units: "metric" | "imperial";
	onDone: () => void;
};

/**
 * Inline editor for a wall's length, opened by double clicking its measurement (TanStack Form + shadcn Input).
 * Enter applies, Esc cancels. Accepts "4,5", "450cm", "4.5m" (metric) or `12'6"` (imperial).
 */
export function WallLengthEdit({
	store,
	wall,
	walls,
	cam,
	units,
	onDone,
}: Props) {
	const anchor = wallLabelAnchor(wall, cam, planCentroid(walls));
	const finished = useRef(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const schema = z.object({
		length: z
			.string()
			.refine((v) => parseLength(v, units) !== null, {
				message:
					units === "metric"
						? "Use, por exemplo, 4,5 ou 450cm"
						: "Use, por exemplo, 12'6\"",
			})
			.refine(
				(v) =>
					(parseLength(v, units) ?? Number.POSITIVE_INFINITY) >=
					MIN_WALL_LENGTH,
				{
					message: `Mínimo de ${MIN_WALL_LENGTH} cm`,
				},
			),
	});

	const form = useAppForm({
		defaultValues: { length: formatLengthInput(wallLength(wall), units) },
		validators: { onChange: schema },
		onSubmit: ({ value }) => {
			const cm = parseLength(value.length, units);
			finished.current = true;
			if (cm !== null) store.setWallLength(wall.id, cm);
			onDone();
		},
	});

	useEffect(() => {
		inputRef.current?.focus();
		inputRef.current?.select();
	}, []);

	return (
		<form
			className="absolute z-10 w-32 -translate-x-1/2 -translate-y-1/2"
			style={{ left: anchor.x, top: anchor.y }}
			onPointerDown={(e) => e.stopPropagation()}
			onDoubleClick={(e) => e.stopPropagation()}
			onSubmit={(e) => {
				e.preventDefault();
				void form.handleSubmit();
			}}
		>
			<form.Field name="length">
				{(field) => {
					const invalid = !field.state.meta.isValid;
					return (
						<>
							<Input
								ref={inputRef}
								value={field.state.value}
								aria-label="Comprimento da parede"
								aria-invalid={invalid}
								className="h-7 bg-background px-2 text-center text-xs shadow-md"
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
							{invalid && (
								<p
									role="alert"
									className="mt-1 rounded bg-destructive px-1.5 py-0.5 text-center text-[10px] text-white shadow"
								>
									{String(
										field.state.meta.errors[0]?.message ?? "Valor inválido",
									)}
								</p>
							)}
						</>
					);
				}}
			</form.Field>
		</form>
	);
}
