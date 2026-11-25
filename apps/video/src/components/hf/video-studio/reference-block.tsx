"use client";

import { Image as ImageIcon, Loader2, Plus, Shirt, UserRound, X } from "lucide-react";

export type ReferenceThumb = { key: string; url: string; name: string };

type DropBind = {
  onDragEnter: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent) => void;
  /** Taken off here: the studio root handles paste once for the whole page. */
  onPaste?: (event: React.ClipboardEvent) => void;
};

/** The @ token a reference image is mentioned by in the prompt. */
export function referenceToken(index: number, zh: boolean): string {
  return `@${zh ? "图片" : "Image"}${index + 1}`;
}

/**
 * "Add reference": opens the media library (or takes a dropped or pasted
 * image). Once images are attached they show here as thumbnails; a click on
 * one mentions it in the prompt, the corner button removes it. Images only:
 * the models here take no video or audio references.
 */
export function ReferenceBlock({
  zh,
  references,
  max,
  uploading,
  dropOver,
  dropBind: { onPaste: _paste, ...dropBind },
  onOpen,
  onMention,
  onRemove,
}: {
  zh: boolean;
  references: ReferenceThumb[];
  /** How many images the model accepts; 0 means text only. */
  max: number;
  uploading: boolean;
  dropOver: boolean;
  dropBind: DropBind;
  onOpen: () => void;
  onMention: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const dropLabel = zh ? "松开即可添加图片" : "Drop to add images";
  const limit = zh ? `图片，最多 ${max} 张` : max === 1 ? "Image, 1 at most" : `Images, up to ${max}`;

  if (references.length === 0) {
    return (
      <div className="vst-ref">
        <button
          type="button"
          className={`vst-ref-drop sr-drop ${dropOver ? "sr-drop-on" : ""}`}
          data-drop-label={dropLabel}
          disabled={uploading || max === 0}
          onClick={onOpen}
          {...dropBind}
        >
          <span className="vst-ref-icons" aria-hidden="true">
            <span>
              <ImageIcon />
            </span>
            <span>
              <UserRound />
            </span>
            <span>
              <Shirt />
            </span>
          </span>
          <span className="vst-ref-title">
            {uploading ? (
              <>
                <Loader2 className="vst-spin animate-spin" aria-hidden="true" />
                {zh ? "上传中…" : "Uploading…"}
              </>
            ) : zh ? (
              "添加参考"
            ) : (
              "Add reference"
            )}
          </span>
          <span className="vst-ref-sub">
            {max === 0 ? (zh ? "这个模型只用文字生成" : "This model works from text only") : limit}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`vst-ref vst-ref-filled sr-drop ${dropOver ? "sr-drop-on" : ""}`}
      data-drop-label={dropLabel}
      aria-busy={uploading || undefined}
      {...dropBind}
    >
      <div className="vst-ref-grid">
        {references.map((item, index) => {
          const token = referenceToken(index, zh);
          return (
            <div key={item.key} className="vst-ref-thumb">
              <button
                type="button"
                className="vst-ref-pick"
                title={zh ? `在提示词里插入 ${token}` : `Mention ${token} in the prompt`}
                onClick={() => onMention(index)}
              >
                <img src={item.url} alt={zh ? `参考图片 ${index + 1}` : `Reference image ${index + 1}`} />
                <span className="vst-ref-tag">{token}</span>
              </button>
              <button
                type="button"
                className="vst-ref-remove"
                onClick={() => onRemove(index)}
                aria-label={zh ? `移除参考图片 ${index + 1}` : `Remove reference image ${index + 1}`}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          );
        })}
        {references.length < max ? (
          <button type="button" className="vst-ref-add" disabled={uploading} onClick={onOpen} aria-label={zh ? "添加参考图片" : "Add reference image"}>
            {uploading ? <Loader2 className="vst-spin animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      <p className="vst-ref-hint">
        {uploading
          ? zh
            ? "上传中…"
            : "Uploading…"
          : zh
            ? `点图片可在提示词里 @ 引用 · 最多 ${max} 张`
            : `Click an image to @mention it · up to ${max}`}
      </p>
    </div>
  );
}
