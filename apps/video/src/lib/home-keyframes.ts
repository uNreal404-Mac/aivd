import { mapKlingFrames, orderedKlingFrames, type KlingKeyframes } from '@/lib/kling-keyframes';
import { readyPickerImage, type PickerAsset } from '@/lib/home-media-library';

const workId = /^work:[a-zA-Z0-9_-]+:\d+$/;
export type ReadyHomeFrame = { key: string; name: string; url: string };

function mentionOrder(frames: KlingKeyframes<PickerAsset>) {
  return [
    ...(frames.first ? [`first:${frames.first.id}`] : []),
    ...(frames.middle ?? []).map((item) => `middle:${item.id}`),
    ...(frames.last ? [`last:${frames.last.id}`] : []),
  ];
}

export function remapHomeKeyframeMentions(
  prompt: string,
  previous: KlingKeyframes<PickerAsset>,
  next: KlingKeyframes<PickerAsset>
) {
  const before = mentionOrder(previous);
  const after = mentionOrder(next);
  return prompt.replace(/@(图片|image)(\d+)/gi, (original, type: string, ordinal: string) => {
    const id = before[Number(ordinal) - 1];
    if (!id) return original;
    const index = after.indexOf(id);
    return index === -1 ? '' : `@${type}${index + 1}`;
  });
}

export function canUseHomeKeyframe(asset: PickerAsset, userId?: string) {
  if (!asset.mimeType?.startsWith('image/')) return false;
  return Boolean(asset.file || (userId && (asset.key?.startsWith(`uploads/${userId}/`) || workId.test(asset.id))));
}

/** Preserve roles and slot order even when one stored picture occurs twice. */
export async function prepareHomeKeyframes(
  frames: KlingKeyframes<PickerAsset>,
  userId: string,
  current: () => boolean,
  onUploaded: (asset: PickerAsset, uploaded: ReadyHomeFrame) => void
) {
  const prepared = new Map<string, ReadyHomeFrame>();
  for (const asset of orderedKlingFrames(frames)) {
    if (!current() || !canUseHomeKeyframe(asset, userId)) throw new Error('Keyframe no longer available.');
    if (prepared.has(asset.id)) continue;
    const result = workId.test(asset.id)
      ? { key: asset.id, name: asset.name, url: asset.url }
      : await readyPickerImage(asset, userId);
    if (!current()) throw new Error('Account changed.');
    if (!workId.test(result.key) && !result.key.startsWith(`uploads/${userId}/`))
      throw new Error('Invalid keyframe upload.');
    const frame = { key: result.key, name: asset.name, url: result.url };
    prepared.set(asset.id, frame);
    if (!asset.key) onUploaded(asset, frame);
  }
  return mapKlingFrames(frames, (asset) => prepared.get(asset.id)!);
}
