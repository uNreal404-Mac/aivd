/** Minimal cinema cover overlay: kept ultra-quiet so the video/image frame breathes cleanly. */
export function SlideCover({ main, sub }: { main: string; sub?: string }) {
  return (
    <>
      <span className="hs-slide-shade" aria-hidden="true" />
      <span className="hs-slide-cover" aria-hidden="true">
        {sub ? <span className="hs-slide-subtag">{sub}</span> : null}
        <span className="hs-slide-cover-main">{main}</span>
      </span>
    </>
  );
}
