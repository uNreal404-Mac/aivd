'use client';

import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { HomeMediaPicker } from '@/components/hf/home-media-picker';
import type { PickerAsset } from '@/lib/home-media-library';
import {
  KLING_MAX_MIDDLE_FRAMES,
  maxKlingFrames,
  orderedKlingFrames,
  type KlingKeyframes,
} from '@/lib/kling-keyframes';
import './home-keyframes.css';

type Role = 'first' | 'middle' | 'last';
type Frames = KlingKeyframes<PickerAsset>;

export function HomeKeyframes({
  frames,
  onChange,
  lang,
  duration,
  userId,
}: {
  frames: Frames;
  onChange: (next: Frames) => void;
  lang: string;
  duration: number;
  userId?: string;
}) {
  const zh = lang.startsWith('zh');
  const [role, setRole] = useState<Role | null>(null);
  const [dragged, setDragged] = useState<number | null>(null);
  const roles: Role[] = ['first', 'middle', 'last'];
  const middle = frames.middle ?? [];
  const names = zh
    ? { first: '首帧', middle: '中间帧', last: '尾帧' }
    : { first: 'First', middle: 'Middle', last: 'Last' };
  const maximum = maxKlingFrames(duration);
  const total = orderedKlingFrames(frames).length;
  const capacity = (slot: Role) =>
    slot === 'middle'
      ? Math.min(KLING_MAX_MIDDLE_FRAMES, maximum - Number(Boolean(frames.first)) - Number(Boolean(frames.last)))
      : frames[slot] || total < maximum
        ? 1
        : 0;
  const items = (slot: Role | null): PickerAsset[] => {
    if (slot === 'middle') return middle;
    const asset = slot ? frames[slot] : undefined;
    return asset ? [asset] : [];
  };
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= middle.length) return;
    const reordered = [...middle];
    reordered.splice(to, 0, ...reordered.splice(from, 1));
    onChange({ ...frames, middle: reordered });
  };
  const remove = (id: string) =>
    onChange({
      first: frames.first?.id === id ? undefined : frames.first,
      middle: middle.filter((item) => item.id !== id),
      last: frames.last?.id === id ? undefined : frames.last,
    });
  return (
    <div className="du-keyframes">
      <HomeMediaPicker
        lang={lang}
        initialTab="upload"
        userId={userId}
        homepage
        keyframeOnly
        open={Boolean(role)}
        onClose={() => setRole(null)}
        maxSelected={role ? capacity(role) : 1}
        selectedIds={items(role).map((item) => item.id)}
        onSelect={(selected) => {
          if (role) onChange({ ...frames, [role]: role === 'middle' ? selected : selected[0] });
        }}
        onDelete={remove}
      />
      <div className="du-keyframe-slots">
        {roles.map((slot) => {
          const selected = items(slot);
          const first = selected[0];
          return (
            <div className="du-keyframe-slot" key={slot}>
              <button
                type="button"
                className="du-keyframe-choose"
                data-keyframe={slot}
                aria-label={zh ? `选择${names[slot]}` : `Choose ${names[slot].toLowerCase()} keyframes`}
                disabled={capacity(slot) < 1}
                onClick={() => setRole(slot)}
              >
                {first ? <img src={first.url} alt="" /> : <Plus size={14} />}
                <span>
                  {names[slot]}
                  {selected.length > 1 ? ` · ${selected.length}` : ''}
                </span>
              </button>
              {first && slot !== 'middle' ? (
                <button
                  className="du-keyframe-remove"
                  type="button"
                  aria-label={zh ? `移除${names[slot]}` : `Remove ${names[slot].toLowerCase()} frame`}
                  onClick={() => onChange({ ...frames, [slot]: undefined })}
                >
                  <X size={11} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {middle.length ? (
        <div className="du-keyframe-order" aria-label={zh ? '中间帧顺序' : 'Middle frame order'}>
          {middle.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={event => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', String(index));
                setDragged(index);
              }}
              onDragEnd={() => setDragged(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragged !== null) move(dragged, index);
                setDragged(null);
              }}
            >
              <img src={item.url} alt={item.name} />
              <span>{index + 1}</span>
              <button
                type="button"
                disabled={index === 0}
                aria-label={zh ? `前移中间帧 ${index + 1}` : `Move middle frame ${index + 1} earlier`}
                onClick={() => move(index, index - 1)}
              >
                <ArrowLeft size={11} />
              </button>
              <button
                type="button"
                disabled={index === middle.length - 1}
                aria-label={zh ? `后移中间帧 ${index + 1}` : `Move middle frame ${index + 1} later`}
                onClick={() => move(index, index + 1)}
              >
                <ArrowRight size={11} />
              </button>
              <button
                type="button"
                aria-label={zh ? `移除中间帧 ${index + 1}` : `Remove middle frame ${index + 1}`}
                onClick={() => onChange({ ...frames, middle: middle.filter((_, i) => i !== index) })}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
