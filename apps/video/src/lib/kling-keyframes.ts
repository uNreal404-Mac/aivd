export const KLING_KEYFRAME_MODEL = "kling/v4-reference-to-video";
export const KLING_MAX_MIDDLE_FRAMES = 8;

export type KlingKeyframes<T = string> = { first?: T; middle?: T[]; last?: T };

export function maxKlingFrames(duration: number): number {
  return Math.min(10, Math.floor(duration) + 1);
}

export function orderedKlingFrames<T>(frames: KlingKeyframes<T>): T[] {
  return [...(frames.first === undefined ? [] : [frames.first]), ...(frames.middle ?? []), ...(frames.last === undefined ? [] : [frames.last])];
}

export function mapKlingFrames<T, U>(frames: KlingKeyframes<T>, transform: (frame: T) => U): KlingKeyframes<U> {
  return {
    ...(frames.first === undefined ? {} : { first: transform(frames.first) }),
    ...(frames.middle?.length ? { middle: frames.middle.map(transform) } : {}),
    ...(frames.last === undefined ? {} : { last: transform(frames.last) }),
  };
}
