// Run-persistent guardian gates. Terrain/encounter identity never depends on unlock state.
export const GUARDIAN_COLOR = '#ff3fa8';
export const guardianId = key => `${key}:guardian`;
export const gateLocked = (map, run) => !!map?.guardian && !run.unlockedGates.has(map.key);
export const portalLocked = (map, run, portal) => portal.kind === 'down' && gateLocked(map, run);

// Ordinary kills made during this visit roll back on death; an opened gate never does.
export function restoreDefeated(run, before) {
  const permanent = new Set([...run.unlockedGates].map(guardianId));
  for (const id of run.defeated) if (!before.has(id) && !permanent.has(id)) run.defeated.delete(id);
}
