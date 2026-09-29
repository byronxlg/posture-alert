/** The mark: a plumb line, bent when an alert is active. */
export function Plumb({ bent, size }: { bent: boolean; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="plumb">
      <circle cx="16" cy="16" r="15" className="plumb-disc" />
      <path d={bent ? "M16 7 Q 24 15 19 25" : "M16 7 L16 25"} className="plumb-stroke" />
    </svg>
  );
}
