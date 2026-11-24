/** Krea-inspired clean editorial card overlay: frosted top-left capability badge + crisp upright title. */
export function SlideCover({ main, sub }: { main: string; sub?: string }) {
  return (
    <>
      <span className="hs-slide-shade" aria-hidden="true" />
      {sub ? <span className="hs-slide-pill" aria-hidden="true">{sub}</span> : null}
      <span className="hs-slide-cover" aria-hidden="true">
        <span className="hs-slide-cover-main">{main}</span>
      </span>
    </>
  );
}
