/**
 * The session as a strip: one run per stretch of the same state, width by
 * duration. Shows the last hour; older seconds fall off the left.
 */
export function Timeline({ data }: { data: string }) {
  if (!data) return <div className="timeline empty">The timeline fills in as you work.</div>;
  const runs: { s: string; n: number }[] = [];
  for (const c of data) {
    const last = runs.at(-1);
    if (last && last.s === c) last.n++;
    else runs.push({ s: c, n: 1 });
  }
  const label = { g: "upright", b: "slouching", u: "not in view" } as Record<string, string>;
  return (
    <div className="timeline" role="img" aria-label={`Timeline of the last ${Math.ceil(data.length / 60)} minutes`}>
      {runs.map((r, i) => (
        <span key={i} className={`run run-${r.s}`} style={{ flexGrow: r.n }} title={`${r.n} s ${label[r.s]}`} />
      ))}
    </div>
  );
}
