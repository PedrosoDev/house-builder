import { useEffect, useRef } from "react";
import type { z } from "zod";
import { useAppForm } from "#/components/form/form-hooks.tsx";
import type { PlannerStore } from "#/lib/planner/store";

type Shape = z.ZodObject<z.ZodRawShape>;

/**
 * TanStack Form bound to a store entity. Valid edits are committed straight to the store
 * (coalesced into one undo step), and external changes (drags, undo) flow back into the form.
 */
export function useEntityForm<S extends Shape>({
	store,
	schema,
	values,
	onCommit,
}: {
	store: PlannerStore;
	schema: S;
	values: z.infer<S>;
	onCommit: (patch: Partial<z.infer<S>>) => void;
}) {
	const timer = useRef<number | undefined>(undefined);
	const commitRef = useRef(onCommit);
	commitRef.current = onCommit;

	const commit = (name: string, value: unknown) => {
		const field = schema.shape[name] as z.ZodType | undefined;
		if (!field || !field.safeParse(value).success) return;
		store.beginGesture();
		commitRef.current({ [name]: value } as Partial<z.infer<S>>);
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => store.endGesture(), 600);
	};

	useEffect(
		() => () => {
			window.clearTimeout(timer.current);
			store.endGesture();
		},
		[store],
	);

	const form = useAppForm({
		defaultValues: values as Record<string, unknown>,
		validators: { onChange: schema as never },
		listeners: {
			onChange: ({ fieldApi }) => {
				commit(fieldApi.name, fieldApi.state.value);
			},
		},
	});

	const serialized = JSON.stringify(values);
	useEffect(() => {
		const current = JSON.stringify(form.state.values);
		if (current !== serialized) form.reset(values as Record<string, unknown>);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [serialized]);

	return form;
}
