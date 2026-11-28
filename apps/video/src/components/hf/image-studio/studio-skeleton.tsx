// Route-level loading state for the image studio, shaped like the page: the
// photo stack and title in the middle, the creation bar pinned to the bottom.
// No text: it renders before the locale is known.
import "../ai-image-studio.css";

export function ImageStudioLoading() {
  return (
    <div className="is-root" aria-busy="true" aria-label="Loading">
      <div className="is-first">
        <div className="is-hero">
          <div className="is-stack">
            {[1, 2, 3, 4].map((index) => (
              <span key={index} className={`is-card is-card-${index} du-skel`} />
            ))}
          </div>
          <span className="du-skel du-skel-line is-skel-title" />
          <span className="du-skel du-skel-line is-skel-sub" />
        </div>
        <div className="is-dock">
          <span className="du-skel is-bar is-skel-bar" />
        </div>
      </div>
    </div>
  );
}
