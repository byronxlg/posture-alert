// Small pure helpers for UI copy, kept out of the components so they can be unit tested.

/** "under a minute", "12 min", "1 h 5 min". */
export function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "under a minute";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
