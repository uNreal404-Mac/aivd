"use client";

import { useState } from "react";
import styles from "./seedance-support-page.module.css";

export function SeedanceFilmPreview({ src, poster, name, playLabel }: {
  src: string;
  poster: string;
  name: string;
  playLabel: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <video
        className={styles.filmFrame}
        src={src}
        poster={poster}
        aria-label={name}
        autoPlay
        controls
        playsInline
        tabIndex={0}
        ref={(player) => player?.focus({ preventScroll: true })}
      />
    );
  }

  return (
    <form action={src} method="get" onSubmit={(event) => {
      event.preventDefault();
      setPlaying(true);
    }}>
      <button type="submit" className={styles.filmFrame} aria-label={playLabel}>
        <img width={640} height={360} src={poster} alt="" loading="lazy" decoding="async" fetchPriority="low" />
        <span className={styles.filmPlay} aria-hidden="true">▶</span>
      </button>
    </form>
  );
}
