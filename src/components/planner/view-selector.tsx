import { Eye, Footprints, Orbit } from "lucide-react";
import { ToggleGroup } from "radix-ui";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip.tsx";
import type { ViewMode } from "#/lib/planner/types";
import type { WallMode } from "#/lib/planner/wall-cutaway";
import { cn } from "#/lib/utils";
import { useSlidingPill } from "./use-sliding-pill";
import type { Camera3D } from "./view-3d";

/** Radio-like group whose selected option is a white pill that slides to the option you pick. */
function Segmented<T extends string>({
	label,
	value,
	options,
	onChange,
	disabled,
}: {
	label: string;
	value: T;
	options: {
		value: T;
		label: React.ReactNode;
		title?: string;
		aria?: string;
	}[];
	onChange: (v: T) => void;
	disabled?: boolean;
}) {
	const { register, containerRef, pill, ready } = useSlidingPill(value);
	return (
		<ToggleGroup.Root
			ref={containerRef as React.Ref<HTMLDivElement>}
			type="single"
			value={value}
			onValueChange={(v) => v && onChange(v as T)}
			aria-label={label}
			disabled={disabled}
			className={cn(
				"relative flex items-center gap-0.5 transition-opacity duration-200",
				disabled && "opacity-50",
			)}
		>
			{pill && (
				<span
					aria-hidden
					className={cn(
						"pointer-events-none absolute z-0 rounded-xl bg-white/90 shadow-sm dark:bg-white/20",
						ready &&
							"transition-[left,top,width,height] duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)]",
					)}
					style={pill}
				/>
			)}
			{options.map((o) => {
				const on = o.value === value;
				return (
					<Tooltip key={o.value}>
						<TooltipTrigger asChild>
							<ToggleGroup.Item
								ref={register(o.value)}
								value={o.value}
								aria-label={o.aria}
								className={cn(
									"relative z-10 flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary/60",
									on
										? "font-semibold text-foreground"
										: "text-foreground/75 hover:bg-white/45 hover:text-foreground dark:hover:bg-white/10",
								)}
							>
								{o.label}
							</ToggleGroup.Item>
						</TooltipTrigger>
						{o.title && <TooltipContent>{o.title}</TooltipContent>}
					</Tooltip>
				);
			})}
		</ToggleGroup.Root>
	);
}

const Divider = () => (
	<span className="mx-1 h-5 w-px shrink-0 bg-foreground/15" />
);

/**
 * Frosted-glass view selector (top centre): 2D / 2D+3D / 3D and, when a 3D view is open, how the walls are drawn
 * (full / automatic cut-away / low), the camera and the ceiling cut. The 3D controls unfold smoothly (the bar grows from
 * its centre) and the selected options are white pills that slide.
 */
export function ViewSelector({
	view,
	onView,
	cam3,
	onCam3,
	wallMode,
	onWallMode,
	cutaway,
	onCutaway,
}: {
	view: ViewMode;
	onView: (v: ViewMode) => void;
	cam3: Camera3D;
	onCam3: (c: Camera3D) => void;
	wallMode: WallMode;
	onWallMode: (m: WallMode) => void;
	cutaway: boolean;
	onCutaway: (v: boolean) => void;
}) {
	const show3d = view !== "2d";
	return (
		<div
			role="toolbar"
			aria-label="Visualização"
			className="absolute top-3 left-1/2 z-30 flex -translate-x-1/2 items-center rounded-2xl border border-white/70 bg-white/50 p-1 shadow-[0_8px_28px_rgba(20,30,50,0.16),inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/15 dark:bg-white/10"
		>
			<Segmented
				label="Modo de visualização"
				value={view}
				onChange={onView}
				options={[
					{ value: "2d", label: "2D" },
					{ value: "split", label: "2D + 3D" },
					{ value: "3d", label: "3D" },
				]}
			/>
			<div
				aria-hidden={!show3d}
				inert={!show3d}
				className={cn(
					"flex items-center overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out",
					show3d ? "max-w-[34rem] opacity-100" : "max-w-0 opacity-0",
				)}
			>
				<Divider />
				<Segmented
					label="Paredes no 3D"
					value={wallMode}
					onChange={onWallMode}
					disabled={cam3 === "walk"}
					options={[
						{ value: "up", label: "Inteiras", title: "Paredes inteiras" },
						{
							value: "cut",
							label: "Auto",
							title:
								"Automático: abaixa sozinho as paredes que ficam entre a câmera e o cômodo, mantendo a divisão dos cômodos",
						},
						{
							value: "down",
							label: "Baixas",
							title: "Todas as paredes baixas",
						},
					]}
				/>
				<Divider />
				<Segmented
					label="Câmera 3D"
					value={cam3}
					onChange={onCam3}
					options={[
						{
							value: "orbit",
							aria: "Órbita",
							label: <Orbit className="size-4" />,
							title: "Órbita",
						},
						{
							value: "walk",
							aria: "Caminhar",
							label: <Footprints className="size-4" />,
							title: "Caminhar (WASD)",
						},
					]}
				/>
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							aria-pressed={cutaway}
							aria-label="Esconder teto e telhado"
							onClick={() => onCutaway(!cutaway)}
							className={cn(
								"ml-0.5 flex items-center justify-center rounded-xl px-2.5 py-1.5 transition-colors duration-200",
								cutaway
									? "bg-white/90 text-foreground shadow-sm dark:bg-white/20"
									: "text-foreground/75 hover:bg-white/45 dark:hover:bg-white/10",
							)}
						>
							<Eye className="size-4" />
						</button>
					</TooltipTrigger>
					<TooltipContent>Esconde teto e telhado</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
}
