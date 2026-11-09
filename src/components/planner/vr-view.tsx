import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { boundsOf } from "#/lib/planner/geometry";
import type { Opening, Project } from "#/lib/planner/types";
import {
	arcFloorHit,
	canTeleport,
	moveWithCollision,
	snapTurn,
	spawnPoint,
} from "#/lib/planner/vr-locomotion";
import { stepLevel } from "#/lib/planner/wall-cutaway";
import { buildScene, SKY } from "./view-3d";

const M = 0.01; // cm -> m
const MOVE_SPEED = 1.6; // m/s
const SNAP_DEG = 30;
const DEADZONE = 0.15;
const AIM_ON = 0.6; // empurrar o analógico direito para a frente liga o arco
const AIM_OFF = 0.3; // soltar abaixo disso teleporta
const DOOR_REACH = 6; // m: alcance do raio para abrir/fechar portas
const HOVER_EMISSIVE = "#3ddc84";

type Door = {
	opening: Opening;
	pivots: THREE.Object3D[];
	mats: THREE.MeshStandardMaterial[];
	level: number;
};

type Status =
	| { kind: "checking" }
	| { kind: "ready" }
	| { kind: "active" }
	| { kind: "unavailable"; reason: string };

type Api = { enter: () => Promise<void>; exit: () => void };

/** Visitante virtual: a casa em tamanho real, para andar no Meta Quest (WebXR, sem instalar nada). */
export function VrView({ project }: { project: Project }) {
	const hostRef = useRef<HTMLDivElement>(null);
	const api = useRef<Api | null>(null);
	const [status, setStatus] = useState<Status>({ kind: "checking" });

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		// cópia só da visita: abrir/fechar portas aqui não altera o projeto salvo
		const data = structuredClone(project);
		const floor = data.floors[0];
		const spawn = spawnPoint(floor);

		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		// sem sombras em tempo real: a GPU do Quest 2 precisa dos 72 fps
		renderer.shadowMap.enabled = false;
		renderer.xr.enabled = true;
		renderer.xr.setReferenceSpaceType("local-floor");
		renderer.xr.setFoveation(1);
		host.appendChild(renderer.domElement);
		renderer.domElement.style.display = "block";

		const sky = SKY[data.environment.sky] ?? SKY.day;
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(sky.bg);
		scene.add(new THREE.HemisphereLight("#ffffff", "#8a7f6a", sky.amb));
		const sun = new THREE.DirectionalLight(sky.sunColor, sky.sun);
		sun.position.set(18, 30, 12);
		scene.add(sun);
		// paredes sempre inteiras e teto ligado: é a casa como ela vai ficar
		const content = buildScene(data, { cutaway: false });
		scene.add(content);

		// portas de giro do piso 0 (as versões escondidas das paredes animadas ficam de fora)
		const visibleChain = (o: THREE.Object3D | null) => {
			for (let n = o; n; n = n.parent) if (!n.visible) return false;
			return true;
		};
		const doors = new Map<string, Door>();
		content.traverse((o) => {
			const id = o.userData.openingId as string | undefined;
			if (!id || !visibleChain(o)) return;
			const opening = floor.openings.find((x) => x.id === id);
			const pivots = o.children.filter((c) => c.userData.swing !== undefined);
			if (!opening || pivots.length === 0) return;
			const mats = new Set<THREE.MeshStandardMaterial>();
			for (const p of pivots)
				p.traverse((n) => {
					if ((n as THREE.Mesh).isMesh)
						mats.add((n as THREE.Mesh).material as THREE.MeshStandardMaterial);
				});
			doors.set(id, {
				opening,
				pivots,
				mats: [...mats],
				level: opening.open ? 1 : 0,
			});
		});
		const toggleDoor = (id: string) => {
			const d = doors.get(id);
			if (d) d.opening.open = !d.opening.open;
		};
		const raycaster = new THREE.Raycaster();
		/** Porta (ou obstáculo) que o raio atual encontra primeiro; paredes e móveis escondem portas atrás deles. */
		const pickDoor = (
			range: number,
		): { id: string | null; dist: number } | null => {
			raycaster.far = range;
			for (const hit of raycaster.intersectObject(content, true)) {
				if (!visibleChain(hit.object)) continue;
				for (let n: THREE.Object3D | null = hit.object; n; n = n.parent) {
					const id = n.userData.openingId as string | undefined;
					if (id && doors.has(id)) return { id, dist: hit.distance };
				}
				return { id: null, dist: hit.distance };
			}
			return null;
		};

		// "rig": quem anda é ele; a cabeça (câmera) se move dentro dele
		const rig = new THREE.Group();
		const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 400);
		rig.add(camera);
		scene.add(rig);

		// pré-visualização no computador (fora do VR): órbita simples
		const b = boundsOf(floor.walls.flatMap((w) => [w.a, w.b]));
		const size = Math.max((b.maxX - b.minX) * M, (b.maxY - b.minY) * M, 4);
		const previewPos = new THREE.Vector3(
			spawn.x * M,
			size * 0.8 + 3,
			spawn.y * M + size * 0.9,
		);
		camera.position.copy(previewPos);
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.target.set(spawn.x * M, 0, spawn.y * M);
		controls.maxPolarAngle = Math.PI * 0.495;
		controls.update();

		// controles: raio de apontar, arco e marcador de teleporte
		const controllers = [0, 1].map((i) => {
			const c = renderer.xr.getController(i);
			const ray = new THREE.Line(
				new THREE.BufferGeometry().setFromPoints([
					new THREE.Vector3(0, 0, 0),
					new THREE.Vector3(0, 0, -1),
				]),
				new THREE.LineBasicMaterial({ color: "#ffffff" }),
			);
			c.add(ray);
			c.userData.ray = ray;
			// gatilho apontando para uma porta: abre ou fecha
			c.addEventListener("selectstart", () => {
				const id = c.userData.hover as string | undefined;
				if (id) toggleDoor(id);
			});
			c.addEventListener("connected", (e) => {
				c.userData.hand = (
					e as unknown as { data: XRInputSource }
				).data.handedness;
			});
			c.addEventListener("disconnected", () => {
				c.userData.hand = undefined;
				c.userData.hover = undefined;
			});
			rig.add(c);
			return c;
		});
		const arcMat = new THREE.LineBasicMaterial({ color: "#3ddc84" });
		const arc = new THREE.Line(new THREE.BufferGeometry(), arcMat);
		arc.frustumCulled = false;
		arc.visible = false;
		scene.add(arc);
		const marker = new THREE.Mesh(
			new THREE.RingGeometry(0.15, 0.22, 32).rotateX(-Math.PI / 2),
			new THREE.MeshBasicMaterial({ color: "#3ddc84" }),
		);
		marker.visible = false;
		scene.add(marker);

		const head = new THREE.Vector3();
		const fwd = new THREE.Vector3();
		const origin = new THREE.Vector3();
		const dir = new THREE.Vector3();
		let aiming = false;
		let turnLatched = false;
		let aimTarget: THREE.Vector3 | null = null;
		let last = performance.now();

		const headCm = () => {
			camera.getWorldPosition(head);
			return { x: head.x / M, y: head.z / M };
		};
		/** Move o rig para que a cabeça vá de onde está até `to` (cm da planta). */
		const shiftHeadTo = (to: { x: number; y: number }) => {
			const cur = headCm();
			rig.position.x += (to.x - cur.x) * M;
			rig.position.z += (to.y - cur.y) * M;
		};

		const onFrame = () => {
			const now = performance.now();
			const dt = Math.min((now - last) / 1000, 0.1);
			last = now;
			const session = renderer.xr.getSession();
			if (session) {
				let left: Gamepad | undefined;
				let right: Gamepad | undefined;
				for (const src of session.inputSources) {
					if (src.handedness === "left") left = src.gamepad ?? undefined;
					if (src.handedness === "right") right = src.gamepad ?? undefined;
				}
				// analógico esquerdo: andar (colide com as paredes; portas deixam passar)
				if (left && left.axes.length >= 4) {
					const ax = left.axes[2];
					const ay = left.axes[3];
					if (Math.hypot(ax, ay) > DEADZONE) {
						camera.getWorldDirection(fwd);
						fwd.y = 0;
						if (fwd.lengthSq() > 1e-6) {
							fwd.normalize();
							const cur = headCm();
							const dist = MOVE_SPEED * dt;
							const wx = fwd.x * -ay + -fwd.z * ax;
							const wz = fwd.z * -ay + fwd.x * ax;
							const to = moveWithCollision(floor, cur, {
								x: cur.x + wx * dist * 100,
								y: cur.y + wz * dist * 100,
							});
							shiftHeadTo(to);
						}
					}
				}
				if (right && right.axes.length >= 4) {
					// analógico direito, lado a lado: giro em passos (gira em torno da cabeça)
					const rx = right.axes[2];
					if (Math.abs(rx) > 0.7 && !turnLatched) {
						turnLatched = true;
						const before = headCm();
						rig.rotation.y = snapTurn(
							rig.rotation.y,
							rx > 0 ? 1 : -1,
							SNAP_DEG,
						);
						shiftHeadTo(before);
					} else if (Math.abs(rx) < 0.3) {
						turnLatched = false;
					}
					// analógico direito, para a frente: aponta o arco; soltar teleporta
					const ry = right.axes[3];
					if (!aiming && ry < -AIM_ON) aiming = true;
					if (aiming && ry > -AIM_OFF) {
						aiming = false;
						if (aimTarget) {
							shiftHeadTo({ x: aimTarget.x / M, y: aimTarget.z / M });
							aimTarget = null;
						}
					}
				}
			}
			// raio de cada controle: aponta para portas (verde) e é cortado pelo que estiver na frente
			const hovered = new Set<string>();
			for (const c of controllers) {
				const ray = c.userData.ray as THREE.Line;
				c.userData.hover = undefined;
				ray.visible = !!c.userData.hand;
				if (!c.userData.hand) continue;
				c.getWorldPosition(origin);
				dir.set(0, 0, -1).transformDirection(c.matrixWorld);
				raycaster.set(origin, dir);
				const hit = pickDoor(DOOR_REACH);
				ray.scale.z = hit ? hit.dist : 1.5;
				(ray.material as THREE.LineBasicMaterial).color.set(
					hit?.id ? HOVER_EMISSIVE : "#ffffff",
				);
				if (hit?.id) {
					c.userData.hover = hit.id;
					hovered.add(hit.id);
				}
			}
			// abre/fecha com animação e destaca a porta apontada
			for (const [id, d] of doors) {
				const target = d.opening.open ? 1 : 0;
				if (d.level !== target) {
					d.level = stepLevel(d.level, target, dt);
					for (const p of d.pivots)
						p.rotation.y = d.level * (p.userData.swing as number);
				}
				const on = hovered.has(id);
				for (const m of d.mats) {
					m.emissive.set(on ? HOVER_EMISSIVE : "#000000");
					m.emissiveIntensity = on ? 0.35 : 0;
				}
			}
			// desenha o arco a partir do controle direito
			aimTarget = null;
			arc.visible = false;
			marker.visible = false;
			if (aiming) {
				const c = controllers.find((k) => k.userData.hand === "right");
				if (c) {
					c.getWorldPosition(origin);
					dir.set(0, 0, -1).transformDirection(c.matrixWorld);
					const hit = arcFloorHit(origin, dir, 0);
					if (hit) {
						const ok = canTeleport(floor, headCm(), {
							x: hit.point.x / M,
							y: hit.point.z / M,
						});
						arcMat.color.set(ok ? "#3ddc84" : "#ff5a5a");
						(marker.material as THREE.MeshBasicMaterial).color.set(
							ok ? "#3ddc84" : "#ff5a5a",
						);
						arc.geometry.setFromPoints(
							hit.path.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
						);
						arc.visible = true;
						marker.position.set(hit.point.x, 0.02, hit.point.z);
						marker.visible = true;
						if (ok) aimTarget = new THREE.Vector3(hit.point.x, 0, hit.point.z);
					}
				}
			}
			if (!renderer.xr.isPresenting) controls.update();
			renderer.render(scene, camera);
		};
		renderer.setAnimationLoop(onFrame);

		const resize = () => {
			const w = host.clientWidth;
			const h = host.clientHeight;
			if (w === 0 || h === 0 || renderer.xr.isPresenting) return;
			renderer.setSize(w, h);
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
		};
		const ro = new ResizeObserver(resize);
		ro.observe(host);
		resize();

		renderer.xr.addEventListener("sessionstart", () => {
			controls.enabled = false;
			rig.rotation.set(0, 0, 0);
			rig.position.set(spawn.x * M, 0, spawn.y * M);
			camera.position.set(0, 0, 0);
			setStatus({ kind: "active" });
		});
		renderer.xr.addEventListener("sessionend", () => {
			controls.enabled = true;
			rig.position.set(0, 0, 0);
			rig.rotation.set(0, 0, 0);
			camera.position.copy(previewPos);
			camera.quaternion.identity();
			controls.update();
			resize();
			setStatus({ kind: "ready" });
		});

		// pré-visualização no computador: clicar numa porta abre/fecha (sem limite de alcance)
		const ndc = new THREE.Vector2();
		let down: { x: number; y: number } | null = null;
		const onDown = (e: PointerEvent) => {
			down = { x: e.clientX, y: e.clientY };
		};
		const onUp = (e: PointerEvent) => {
			const d0 = down;
			down = null;
			if (!d0 || renderer.xr.isPresenting) return;
			if (Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 5) return;
			const r = renderer.domElement.getBoundingClientRect();
			ndc.set(
				((e.clientX - r.left) / r.width) * 2 - 1,
				-((e.clientY - r.top) / r.height) * 2 + 1,
			);
			raycaster.setFromCamera(ndc, camera);
			const hit = pickDoor(Number.POSITIVE_INFINITY);
			if (hit?.id) toggleDoor(hit.id);
		};
		renderer.domElement.addEventListener("pointerdown", onDown);
		renderer.domElement.addEventListener("pointerup", onUp);

		// só em desenvolvimento: gancho para os testes no navegador (Playwright)
		if (import.meta.env.DEV) {
			(window as unknown as Record<string, unknown>).__vr = {
				doors: () => [...doors.keys()],
				isOpen: (id: string) => doors.get(id)?.opening.open,
				head: headCm,
				/** Põe a câmera de pré-visualização de frente para a porta e devolve onde ela está na tela. */
				focus: (id: string) => {
					let target: THREE.Object3D | null = null;
					content.traverse((o) => {
						if (o.userData.openingId === id && visibleChain(o)) target = o;
					});
					if (!target) return null;
					const found: THREE.Object3D = target;
					const c = new THREE.Box3()
						.setFromObject(found)
						.getCenter(new THREE.Vector3());
					const normal = new THREE.Vector3(0, 0, 1).transformDirection(
						found.matrixWorld,
					);
					camera.position.copy(c).addScaledVector(normal, 2.2);
					camera.position.y = 1.5;
					controls.target.copy(c);
					controls.update();
					camera.updateMatrixWorld();
					const p = c.clone().project(camera);
					const r = renderer.domElement.getBoundingClientRect();
					return {
						x: r.left + ((p.x + 1) / 2) * r.width,
						y: r.top + ((1 - p.y) / 2) * r.height,
					};
				},
			};
		}

		api.current = {
			enter: async () => {
				const xr = navigator.xr;
				if (!xr) return;
				const s = await xr.requestSession("immersive-vr", {
					optionalFeatures: ["local-floor", "bounded-floor"],
				});
				await renderer.xr.setSession(s);
			},
			exit: () => {
				void renderer.xr.getSession()?.end();
			},
		};

		// o WebXR só existe em contexto seguro (HTTPS) e em navegador com suporte
		if (!window.isSecureContext) {
			setStatus({
				kind: "unavailable",
				reason:
					"Esta página não está em HTTPS, então o navegador desliga o WebXR. Abra o endereço https://…",
			});
		} else if (!navigator.xr) {
			setStatus({
				kind: "unavailable",
				reason:
					"Este navegador não tem WebXR. Abra este link no navegador do Meta Quest.",
			});
		} else {
			navigator.xr
				.isSessionSupported("immersive-vr")
				.then((ok) =>
					setStatus(
						ok
							? { kind: "ready" }
							: {
									kind: "unavailable",
									reason:
										"Este dispositivo não oferece realidade virtual (immersive-vr).",
								},
					),
				)
				.catch(() =>
					setStatus({
						kind: "unavailable",
						reason: "Não foi possível consultar o WebXR.",
					}),
				);
		}

		return () => {
			api.current = null;
			renderer.domElement.removeEventListener("pointerdown", onDown);
			renderer.domElement.removeEventListener("pointerup", onUp);
			if (import.meta.env.DEV)
				delete (window as unknown as Record<string, unknown>).__vr;
			renderer.setAnimationLoop(null);
			ro.disconnect();
			controls.dispose();
			renderer.dispose();
			renderer.domElement.remove();
		};
	}, [project]);

	return (
		<div className="relative h-dvh w-full overflow-hidden bg-background">
			<div ref={hostRef} className="absolute inset-0" />
			<div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-3 p-4">
				<div className="pointer-events-auto flex max-w-md flex-col items-center gap-2 rounded-2xl border bg-background/80 p-4 text-center shadow-lg backdrop-blur">
					<p className="text-base font-semibold">{project.name}</p>
					{status.kind === "checking" && (
						<p className="text-sm text-muted-foreground">Verificando VR…</p>
					)}
					{status.kind === "ready" && (
						<>
							<button
								type="button"
								onClick={() => void api.current?.enter()}
								className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background"
							>
								Entrar em VR
							</button>
							<p className="text-xs text-muted-foreground">
								Analógico esquerdo: andar · direito: girar (lados) e teleportar
								(empurre para a frente e solte) · gatilho apontando para uma
								porta: abrir/fechar
							</p>
						</>
					)}
					{status.kind === "active" && (
						<button
							type="button"
							onClick={() => api.current?.exit()}
							className="rounded-full border px-4 py-2 text-sm"
						>
							Sair da VR
						</button>
					)}
					{status.kind === "unavailable" && (
						<p className="text-sm text-destructive">{status.reason}</p>
					)}
				</div>
			</div>
		</div>
	);
}
