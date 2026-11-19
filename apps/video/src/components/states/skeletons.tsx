// Route-level loading skeletons, shaped like the pages they stand in for so
// nothing jumps when the real page arrives. No text: they render before the
// locale is known.

const Line = ({ width }: { width: string }) => <span className="du-skel du-skel-line" style={{ width }} />;
const Block = ({ height, width = "100%", radius }: { height: number; width?: string; radius?: number }) => (
  <span className="du-skel" style={{ height, width, borderRadius: radius }} />
);

/** Video and audio studios: settings panel and a stage. */
export function StudioSkeleton() {
  return (
    <div className="du-skel-studio" aria-busy="true" aria-label="Loading">
      <div className="du-skel-panel">
        <div className="du-skel-row">
          <Block height={34} radius={10} />
          <Block height={34} radius={10} />
        </div>
        <Block height={120} radius={16} />
        <Block height={150} radius={16} />
        <Block height={130} radius={16} />
        <Block height={58} radius={14} />
        <div className="du-skel-row">
          <Block height={58} radius={14} />
          <Block height={58} radius={14} />
        </div>
        <Block height={48} radius={14} />
      </div>
      <div className="du-skel-stage">
        <div className="du-skel-row">
          <Block height={30} width="96px" radius={10} />
          <Block height={30} width="96px" radius={10} />
        </div>
        <Line width="36%" />
        <Line width="52%" />
        <div className="du-skel-grid">
          <Block height={220} radius={16} />
          <Block height={220} radius={16} />
          <Block height={220} radius={16} />
        </div>
      </div>
    </div>
  );
}

/** Image studio: photo stack, title and the composer. */
export function ImageStudioSkeleton() {
  return (
    <div className="du-skel-center" aria-busy="true" aria-label="Loading">
      <div className="du-skel-row">
        <Block height={110} width="84px" radius={14} />
        <Block height={110} width="84px" radius={14} />
        <Block height={110} width="84px" radius={14} />
      </div>
      <Line width="320px" />
      <Line width="420px" />
      <Block height={120} width="min(1030px, 100%)" radius={22} />
    </div>
  );
}

/** Signed-in pages: a heading and a grid of cards. */
export function PageSkeleton() {
  return (
    <div className="du-skel-page" aria-busy="true" aria-label="Loading">
      <Line width="200px" />
      <Line width="320px" />
      <div className="du-skel-row">
        <Block height={34} width="90px" radius={10} />
        <Block height={34} width="90px" radius={10} />
        <Block height={34} width="90px" radius={10} />
      </div>
      <div className="du-skel-grid">
        {Array.from({ length: 8 }, (_, index) => (
          <Block key={index} height={200} radius={16} />
        ))}
      </div>
    </div>
  );
}

/** A grid of placeholder cards for lists that load on the client. */
export function GridSkeleton({ count = 8, height = 220 }: { count?: number; height?: number }) {
  return (
    <div className="du-skel-grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, index) => (
        <Block key={index} height={height} radius={16} />
      ))}
    </div>
  );
}
