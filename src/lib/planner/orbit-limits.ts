/**
 * Zoom range (m) of the 3D orbit camera for a house of the given size (largest side, m): close enough to look inside a room
 * but never inside the walls, far enough to see the whole house and its surroundings (the scene far plane is 400 m).
 */
export function orbitLimits(sizeM: number): { min: number; max: number } {
	const size = Math.max(sizeM, 3);
	return { min: 1, max: Math.min(Math.max(40, size * 6), 280) };
}
