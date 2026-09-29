import { timelineAxis } from "./stats.ts";

const LABEL: Record<string, string> = { g: "Upright", b: "Slouching", u: "Not in view" };

/**
 * The session as a strip: one run per stretch of the same state, width by
 * duration. Shows the last hour; older seconds fall off the left.
 */
export function Timeline({ data }: { data: string }) {
  if (data.length < 2) return <p className="timeline-empty">Your posture over time appears here.</p>;
  const runs: { s: string; n: number }[] = [];
  for (const c of data) {
    const last = runs.at(-1);
    if (last && last.s === c) last.n++;
    else runs.push({ s: c, n: 1 });
  }
  const present = new Set(data);
  const [start, mid, end] = timelineAxis(data.length);
  return (
    <figure className="timeline-fig">
      <div className="timeline" role="img" aria-label={`Posture from ${start} until now`}>
        {runs.map((r, i) => (
          <span key={i} className={`run run-${r.s}`} style={{ flexGrow: r.n }} title={`${r.n} s ${LABEL[r.s].toLowerCase()}`} />
        ))}
      </div>
      <div className="axis" aria-hidden="true"><span>{start}</span><span>{mid}</span><span>{end}</span></div>
      <figcaption className="legend">
        {(["g", "b", "u"] as const).filter((k) => present.has(k)).map((k) => (
          <span key={k}><i className={`dot run-${k}`} aria-hidden="true" />{LABEL[k]}</span>
        ))}
      </figcaption>
    </figure>
  );
}
