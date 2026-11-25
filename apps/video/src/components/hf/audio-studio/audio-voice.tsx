"use client";

import { type CSSProperties, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ListFilter, Pause, Pencil, Play, X } from "lucide-react";
import { usePresence } from "@/hooks/use-presence";
import { voiceGender, voiceHue, voiceTag, voiceWave } from "./audio-data";
import { AudioPopover, useDismissLayer } from "./audio-popover";

type Voice = { id: string; name: string };
type Gender = "all" | "F" | "M";

const hueStyle = (name: string) => ({ "--au-hue": voiceHue(name) }) as CSSProperties;

/** A voice's drawn waveform; while it plays, the part already heard turns bright. */
function VoiceWave({ name }: { name: string }) {
  const bars = voiceWave(name);
  const draw = bars.map((height, index) => <span key={index} style={{ height: `${height}%` }} />);
  return (
    <span className="au-wave" data-au-voice={name} aria-hidden="true">
      <span className="au-wave-bars">{draw}</span>
      <span className="au-wave-bars au-wave-done">{draw}</span>
      <span className="au-wave-head" />
    </span>
  );
}

/**
 * The chosen voice, at the top of the settings like the reference's voice
 * card: its colour, "Change" in the corner, play and the name at the foot.
 * Pressing anywhere but play opens the voice picker.
 */
export function AudioVoiceCard({
  zh,
  voice,
  open,
  onOpen,
  triggerRef,
  playing,
  onPreview,
}: {
  zh: boolean;
  voice: Voice;
  open: boolean;
  onOpen: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  playing: boolean;
  onPreview: () => void;
}) {
  const tag = voiceTag(voice.name, zh);
  return (
    <div className="au-vcard" style={hueStyle(voice.name)}>
      <button
        ref={triggerRef}
        type="button"
        className="au-vcard-open"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={zh ? `音色：${voice.name}${tag ? `，${tag}` : ""}。更换音色` : `Voice: ${voice.name}${tag ? `, ${tag}` : ""}. Change voice`}
        onClick={onOpen}
      >
        <span className="au-vcard-change" aria-hidden="true">
          <Pencil className="h-4 w-4" />
          {zh ? "更换" : "Change"}
        </span>
      </button>
      <span className="au-orb au-vcard-orb" aria-hidden="true" />
      <div className="au-vcard-foot">
        <button
          type="button"
          className={playing ? "au-vcard-play au-vcard-play-on" : "au-vcard-play"}
          aria-pressed={playing}
          aria-label={playing ? (zh ? `停止试听 ${voice.name}` : `Stop ${voice.name}`) : zh ? `试听 ${voice.name}` : `Preview ${voice.name}`}
          onClick={onPreview}
        >
          {playing ? <Pause key="stop" data-swap="" className="h-4 w-4" fill="currentColor" aria-hidden="true" /> : <Play key="play" data-swap="" className="h-4 w-4" fill="currentColor" aria-hidden="true" />}
        </button>
        <span className="au-vcard-text">
          <span className="au-vcard-name">{voice.name}</span>
          {tag ? <span className="au-vcard-tag">{tag}</span> : null}
        </span>
      </div>
    </div>
  );
}

/**
 * The voice picker, measured from the reference: on wide screens a panel over
 * the top-left of the stage (657 × 612, less on short windows; it keeps its
 * size while the filter narrows the grid) with a title, a close button and
 * a three-column grid of voices; on phones a bottom sheet with two columns.
 * Each voice plays from its own button; pressing the card chooses it and
 * closes the picker. A filter narrows the grid by gender. Escape, a click
 * outside and the close button all close it and return focus to the card.
 */
export function AudioVoicePicker({
  open,
  onClose,
  anchorRef,
  stageRef,
  zh,
  voices,
  value,
  onChange,
  previewing,
  onPreview,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  stageRef: RefObject<HTMLElement | null>;
  zh: boolean;
  voices: Voice[];
  value: string;
  onChange: (id: string) => void;
  previewing: string | null;
  onPreview: (name: string) => void;
}) {
  const { mounted, state } = usePresence(open);
  const panelRef = useRef<HTMLDialogElement>(null);
  const filterRef = useRef<HTMLButtonElement>(null);
  const [gender, setGender] = useState<Gender>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  // On phones the sheet is modal: closing it from the dimmed page (a tap
  // outside) puts focus back on the voice card too.
  const wideRef = useRef(wide);
  wideRef.current = wide;
  useDismissLayer(open, panelRef, anchorRef, () => {
    onClose();
    if (!wideRef.current) anchorRef.current?.focus({ preventScroll: true });
  });

  useEffect(() => {
    if (!open) setFilterOpen(false);
  }, [open]);

  useLayoutEffect(() => {
    if (!mounted) {
      setBox(null);
      return;
    }
    // Re-render only when the place actually changes (scrolling the grid
    // also reaches the scroll listener below).
    const same = (a: typeof box, b: NonNullable<typeof box>) =>
      a !== null && a.top === b.top && a.left === b.left && a.width === b.width && a.maxHeight === b.maxHeight;
    const place = () => {
      const isWide = window.innerWidth >= 1024;
      setWide(isWide);
      const stage = stageRef.current?.getBoundingClientRect();
      const top = stage ? Math.max(12, Math.round(stage.top)) : 0;
      const next =
        isWide && stage
          ? { top, left: Math.round(stage.left), width: Math.min(657, Math.round(stage.width)), maxHeight: Math.min(612, window.innerHeight - top - 12) }
          : { top: 0, left: 0, width: 0, maxHeight: 0 };
      setBox((current) => (same(current, next) ? current : next));
    };
    place();
    // The page scrolls on to its text below: the picker follows the stage.
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [mounted, stageRef]);

  // Focus the chosen voice once the picker is placed.
  const placed = box !== null;
  useEffect(() => {
    if (!open || !placed) return;
    const panel = panelRef.current;
    if (!panel || panel.contains(document.activeElement)) return;
    const target = panel.querySelector<HTMLElement>('.au-vpick-main[aria-pressed="true"]') ?? panel.querySelector<HTMLElement>(".au-vpick-main");
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest" });
  }, [open, placed]);

  if (!mounted || typeof document === "undefined") return null;

  const shown = gender === "all" ? voices : voices.filter((item) => voiceGender(item.name) === gender);
  const genders: { id: Gender; label: string }[] = [
    { id: "all", label: zh ? "全部" : "All" },
    { id: "F", label: zh ? "女声" : "Female" },
    { id: "M", label: zh ? "男声" : "Male" },
  ];
  const close = () => {
    onClose();
    anchorRef.current?.focus();
  };

  const panel = (
    <dialog
      ref={panelRef}
      open
      aria-modal={wide ? undefined : true}
      aria-labelledby="au-vpicker-title"
      data-presence={wide ? "pop" : "sheet"}
      data-state={state}
      className={wide ? "au-vpicker" : "au-vpicker au-vpicker-sheet"}
      style={
        wide && box
          ? { top: box.top, left: box.left, width: box.width, height: box.maxHeight }
          : box
            ? undefined
            : { visibility: "hidden" }
      }
    >
      {wide ? null : <span className="au-vpicker-grabber" aria-hidden="true" />}
      <div className="au-vpicker-head">
        <h2 id="au-vpicker-title" className="au-vpicker-title">
          {zh ? "挑选音色" : "Choose a voice"}
        </h2>
        <p className="au-vpicker-sub">
          {zh ? "点 ▶ 试听，点卡片选择。生成配音时会朗读你填写的台词。" : "Press ▶ to preview a voice, then select its card for your voiceover."}
        </p>
        <button type="button" className="au-vpicker-close" aria-label={zh ? "关闭" : "Close"} onClick={close}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="au-vpicker-body">
        <div className="au-vpicker-bar">
          <span className="au-vpicker-label">{zh ? "音色" : "Voices"}</span>
          <button
            ref={filterRef}
            type="button"
            className={gender === "all" ? "au-vfilter" : "au-vfilter au-vfilter-on"}
            aria-haspopup="dialog"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((current) => !current)}
          >
            <ListFilter className="h-4 w-4" aria-hidden="true" />
            {gender === "all" ? (zh ? "筛选" : "Filter") : genders.find((item) => item.id === gender)?.label}
            {gender === "all" ? null : <span className="au-filter-dot" aria-hidden="true" />}
          </button>
          <AudioPopover
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            anchorRef={filterRef}
            label={zh ? "筛选音色" : "Filter voices"}
            placement="below-end"
            width={188}
            className="au-pop-menu"
          >
            <p className="au-pop-head">{zh ? "性别" : "Gender"}</p>
            <div className="au-pop-list">
              {genders.map((item) => {
                const on = gender === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={on}
                    className="au-menu-row"
                    onClick={() => {
                      setGender(item.id);
                      setFilterOpen(false);
                      filterRef.current?.focus();
                    }}
                  >
                    <span className="flex-1 text-left">{item.label}</span>
                    {on ? <Check className="h-4 w-4 du-check-pop" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          </AudioPopover>
        </div>
        <div className="au-vgrid">
          {shown.map((item) => {
            const on = item.id === value;
            const playing = previewing === item.name;
            const tag = voiceTag(item.name, zh);
            return (
              <div key={item.id} className="au-vpick" data-on={on || undefined} data-playing={playing || undefined} style={hueStyle(item.name)}>
                <button
                  type="button"
                  className="au-vpick-main"
                  aria-pressed={on}
                  aria-label={tag ? `${item.name}${zh ? "，" : ", "}${tag}` : item.name}
                  onClick={() => {
                    onChange(item.id);
                    close();
                  }}
                />
                <span className="au-vpick-top" aria-hidden="true">
                  <span className="au-orb" />
                  <span className="au-vpick-text">
                    <span className="au-vpick-name">{item.name}</span>
                    <span className="au-vpick-tag">{tag}</span>
                  </span>
                </span>
                <span className="au-vpick-foot">
                  <button
                    type="button"
                    className="au-vpick-play"
                    aria-pressed={playing}
                    aria-label={playing ? (zh ? `停止试听 ${item.name}` : `Stop ${item.name}`) : zh ? `试听 ${item.name}` : `Preview ${item.name}`}
                    onClick={() => onPreview(item.name)}
                  >
                    {playing ? <Pause key="stop" data-swap="" className="h-4 w-4" fill="currentColor" aria-hidden="true" /> : <Play key="play" data-swap="" className="h-4 w-4" fill="currentColor" aria-hidden="true" />}
                  </button>
                  <VoiceWave name={item.name} />
                </span>
              </div>
            );
          })}
          {shown.length === 0 ? <p className="au-pop-none">{zh ? "这一类还没有音色" : "No voices of this kind"}</p> : null}
        </div>
      </div>
    </dialog>
  );

  return createPortal(
    wide ? (
      panel
    ) : (
      <>
        {/* A tap here closes the sheet (useDismissLayer); keeping the press
            from focusing the page lets focus land back on the voice card. */}
        <div className="au-vpicker-scrim" data-presence="fade" data-state={state} aria-hidden="true" onMouseDown={(event) => event.preventDefault()} />
        {panel}
      </>
    ),
    document.body,
  );
}
