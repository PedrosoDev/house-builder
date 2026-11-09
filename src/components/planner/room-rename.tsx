import { useEffect, useRef } from "react";
import { z } from "zod";
import { useAppForm } from "#/components/form/form-hooks.tsx";
import { Input } from "#/components/ui/input.tsx";
import { type Camera, toScreen } from "#/lib/planner/camera";
import { polygonCentroid } from "#/lib/planner/geometry";
import type { PlannerStore } from "#/lib/planner/store";
import type { Room } from "#/lib/planner/types";

const schema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Dê um nome ao cômodo")
		.max(60, "Máximo 60 caracteres"),
});

/** Inline room-name editor opened by double click (TanStack Form + shadcn Input). Enter saves, Esc cancels. */
export function RoomRename({
	store,
	room,
	cam,
	onDone,
}: {
	store: PlannerStore;
	room: Room;
	cam: Camera;
	onDone: () => void;
}) {
	const c = toScreen(cam, polygonCentroid(room.points));
	const finished = useRef(false);
	const form = useAppForm({
		defaultValues: { name: room.name },
		validators: { onChange: schema },
		onSubmit: ({ value }) => {
			finished.current = true;
			store.updateRoom(room.id, { name: value.name.trim() });
			onDone();
		},
	});
	const inputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		inputRef.current?.focus();
		inputRef.current?.select();
	}, []);

	return (
		<form
			className="absolute z-10 w-44 -translate-x-1/2 -translate-y-1/2"
			style={{ left: c.x, top: c.y }}
			onPointerDown={(e) => e.stopPropagation()}
			onDoubleClick={(e) => e.stopPropagation()}
			onSubmit={(e) => {
				e.preventDefault();
				void form.handleSubmit();
			}}
		>
			<form.Field name="name">
				{(field) => (
					<Input
						ref={inputRef}
						value={field.state.value}
						aria-label="Nome do cômodo"
						aria-invalid={!field.state.meta.isValid}
						className="h-8 bg-background text-center text-sm shadow-md"
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
