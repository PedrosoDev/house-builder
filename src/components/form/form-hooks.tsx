import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { Button } from "#/components/ui/button.tsx";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "#/components/ui/field.tsx";
import { Input } from "#/components/ui/input.tsx";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select.tsx";
import { Slider } from "#/components/ui/slider.tsx";
import { Switch } from "#/components/ui/switch.tsx";
import { Textarea } from "#/components/ui/textarea.tsx";
import { COLOR_SWATCHES } from "#/lib/planner/materials";
import { cn } from "#/lib/utils";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
	createFormHookContexts();

type BaseProps = {
	label: string;
	description?: string;
	className?: string;
	/** Compact, label-left layout used in dense inspector panels. */
	inline?: boolean;
};

function useInvalid() {
	const field = useFieldContext<unknown>();
	const meta = field.state.meta;
	const invalid = meta.isTouched && !meta.isValid;
	return {
		field,
		invalid,
		errors: meta.errors as Array<{ message?: string } | undefined>,
	};
}

function TextField({
	label,
	description,
	className,
	placeholder,
	...rest
}: BaseProps & { placeholder?: string; type?: string; autoFocus?: boolean }) {
	const { field, invalid, errors } = useInvalid();
	return (
		<Field data-invalid={invalid} className={className}>
			<FieldLabel htmlFor={field.name}>{label}</FieldLabel>
			<Input
				id={field.name}
				name={field.name}
				value={(field.state.value as string) ?? ""}
				placeholder={placeholder}
				aria-invalid={invalid}
				onBlur={field.handleBlur}
				onChange={(e) => field.handleChange(e.target.value)}
				{...rest}
			/>
			{description && <FieldDescription>{description}</FieldDescription>}
			{invalid && <FieldError errors={errors} />}
		</Field>
	);
}

function TextAreaField({
	label,
	description,
	className,
	rows = 3,
}: BaseProps & { rows?: number }) {
	const { field, invalid, errors } = useInvalid();
	return (
		<Field data-invalid={invalid} className={className}>
			<FieldLabel htmlFor={field.name}>{label}</FieldLabel>
			<Textarea
				id={field.name}
				rows={rows}
				value={(field.state.value as string) ?? ""}
				aria-invalid={invalid}
				onBlur={field.handleBlur}
				onChange={(e) => field.handleChange(e.target.value)}
			/>
			{description && <FieldDescription>{description}</FieldDescription>}
			{invalid && <FieldError errors={errors} />}
		</Field>
	);
}

function NumberField({
	label,
	description,
	className,
	unit,
	min,
	max,
	step = 1,
}: BaseProps & { unit?: string; min?: number; max?: number; step?: number }) {
	const { field, invalid, errors } = useInvalid();
	const value = field.state.value as number | string;
	return (
		<Field data-invalid={invalid} className={className}>
			<FieldLabel htmlFor={field.name}>{label}</FieldLabel>
			<div className="relative">
				<Input
					id={field.name}
					name={field.name}
					type="number"
					inputMode="decimal"
					min={min}
					max={max}
					step={step}
					value={Number.isNaN(value) ? "" : value}
					aria-invalid={invalid}
					className={cn(unit && "pr-10")}
					onBlur={field.handleBlur}
					onChange={(e) => {
						const raw = e.target.value;
						field.handleChange(
							raw === "" ? (Number.NaN as never) : (Number(raw) as never),
						);
					}}
				/>
				{unit && (
					<span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
						{unit}
					</span>
				)}
			</div>
			{description && <FieldDescription>{description}</FieldDescription>}
			{invalid && <FieldError errors={errors} />}
		</Field>
	);
}

function SelectField({
	label,
	description,
	className,
	options,
	placeholder,
}: BaseProps & {
	options: { value: string; label: string }[];
	placeholder?: string;
}) {
	const { field, invalid, errors } = useInvalid();
	return (
		<Field data-invalid={invalid} className={className}>
			<FieldLabel htmlFor={field.name}>{label}</FieldLabel>
			<Select
				value={(field.state.value as string) ?? ""}
				onValueChange={(v) => field.handleChange(v as never)}
			>
				<SelectTrigger
					id={field.name}
					className="w-full"
					aria-invalid={invalid}
					onBlur={field.handleBlur}
				>
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent>
					{options.map((o) => (
						<SelectItem key={o.value} value={o.value}>
							{o.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{description && <FieldDescription>{description}</FieldDescription>}
			{invalid && <FieldError errors={errors} />}
		</Field>
	);
}

function SwitchField({ label, description, className }: BaseProps) {
	const { field } = useInvalid();
	return (
		<Field orientation="horizontal" className={className}>
			<div className="flex flex-1 flex-col gap-0.5">
				<FieldLabel htmlFor={field.name}>{label}</FieldLabel>
				{description && <FieldDescription>{description}</FieldDescription>}
			</div>
			<Switch
				id={field.name}
				checked={Boolean(field.state.value)}
				onCheckedChange={(v) => field.handleChange(v as never)}
			/>
		</Field>
	);
}

function SliderField({
	label,
	description,
	className,
	min,
	max,
	step = 1,
	unit,
}: BaseProps & { min: number; max: number; step?: number; unit?: string }) {
	const { field } = useInvalid();
	const value = Number(field.state.value) || 0;
	return (
		<Field className={className}>
			<div className="flex items-center justify-between">
				<FieldLabel htmlFor={field.name}>{label}</FieldLabel>
				<span className="text-xs text-muted-foreground tabular-nums">
					{Math.round(value * 100) / 100}
					{unit}
				</span>
			</div>
			<Slider
				id={field.name}
				min={min}
				max={max}
				step={step}
				value={[value]}
				onValueChange={([v]) => field.handleChange(v as never)}
			/>
			{description && <FieldDescription>{description}</FieldDescription>}
		</Field>
	);
}

function ColorField({
	label,
	className,
	swatches = COLOR_SWATCHES,
}: BaseProps & { swatches?: string[] }) {
	const { field } = useInvalid();
	const value = (field.state.value as string) || "#ffffff";
	return (
		<Field className={className}>
			<FieldLabel htmlFor={field.name}>{label}</FieldLabel>
			<div className="flex flex-wrap items-center gap-1.5">
				<input
					id={field.name}
					type="color"
					value={value.length === 7 ? value : "#ffffff"}
					onChange={(e) => field.handleChange(e.target.value as never)}
					className="size-7 cursor-pointer rounded border border-border bg-transparent p-0"
					aria-label={label}
				/>
				{swatches.map((c) => (
					<button
						key={c}
						type="button"
						title={c}
						onClick={() => field.handleChange(c as never)}
						className={cn(
							"size-5 rounded-full border border-border transition-transform hover:scale-110",
							value.toLowerCase() === c && "ring-2 ring-primary ring-offset-1",
						)}
						style={{ background: c }}
					/>
				))}
			</div>
		</Field>
	);
}

function SubmitButton({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	const form = useFormContext();
	return (
		<form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
			{([canSubmit, isSubmitting]) => (
				<Button
					type="submit"
					disabled={!canSubmit || isSubmitting}
					className={className}
				>
					{children}
				</Button>
			)}
		</form.Subscribe>
	);
}

export const { useAppForm, withForm } = createFormHook({
	fieldContext,
	formContext,
	fieldComponents: {
		TextField,
		TextAreaField,
		NumberField,
		SelectField,
		SwitchField,
		SliderField,
		ColorField,
	},
	formComponents: { SubmitButton },
});
