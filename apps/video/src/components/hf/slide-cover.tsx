/** Big lettering laid over a carousel picture, the way the reference designs its covers. */
export function SlideCover({ main, sub }: { main: string; sub?: string }) {
  // Slanted CJK looks broken, so Chinese titles stay upright.
  const cjk = /[㐀-鿿]/.test(main);
  return (
    <>
      <span className="hs-slide-shade" aria-hidden="true" />
      <span className={cjk ? "hs-slide-cover hs-slide-cover-cjk" : "hs-slide-cover"} aria-hidden="true">
        <span className="hs-slide-cover-main">{main}</span>
        {sub ? <span className="hs-slide-cover-sub">{sub}</span> : null}
      </span>
    </>
  );
}
