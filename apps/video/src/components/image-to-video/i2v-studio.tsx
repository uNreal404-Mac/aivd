"use client";

import { useRef, useState } from "react";

import {
  ALLOWED_TYPES,
  I2V_MODELS,
  MAX_BYTES,
  MAX_PROMPT_LENGTH,
  aspectRatiosFor,
  canSubmit,
  durationsFor,
  newIdempotencyKey,
  normalizeSettings,
  submitImageToVideo,
  uploadImage,
  validateImageFile,
  type I2VModelId,
} from "@/lib/image-to-video";

const EMPTY_PLACEHOLDER = "/images/placeholders/i2v-empty.svg";

const MAX_MB = Math.round(MAX_BYTES / (1024 * 1024));

interface I2VStudioProps {
  generationEnabled: boolean;
  locale: string;
}

export function I2VStudio({ generationEnabled, locale }: I2VStudioProps) {
  const isChinese = locale.toLowerCase().startsWith("zh");
  const copy = isChinese
    ? {
        title: "图片生成视频",
        subtitle: "用简洁明确的镜头指令，让静态画面自然动起来。",
        sourceImage: "起始图片",
        uploadedAlt: "你上传的关键帧",
        uploaded: "已上传图片",
        replace: "替换",
        remove: "移除",
        uploading: "上传中…",
        drop: "拖入图片或点击浏览",
        fileHint: `JPG、PNG、WEBP 或 GIF，最大 ${MAX_MB}MB`,
        imageHelp: `每次上传一张图片，最大 ${MAX_MB}MB。横向或方形画面效果更佳。`,
        motionSettings: "运动设置",
        describeMotion: "描述运动方式",
        promptPlaceholder: "镜头缓慢推进，同时主体转向光线",
        model: "模型",
        duration: "时长",
        aspect: "画面比例",
        sending: "提交中…",
        generate: "生成视频",
        paused: "生成已暂停",
        notOpen: "视频生成功能暂未开放。",
        result: "你的视频会显示在这里",
        tipsTitle: "提示",
        tips: ["描述镜头运动，而不只是主体。", "适度控制动作幅度，让主体保持清晰可辨。", "写明光线或氛围，引导最终画面效果。"],
      }
    : {
        title: "Image to Video",
        subtitle: "Bring a still frame to life with a short, directed camera move.",
        sourceImage: "Source image",
        uploadedAlt: "Your uploaded keyframe",
        uploaded: "Uploaded image",
        replace: "Replace",
        remove: "Remove",
        uploading: "Uploading…",
        drop: "Drop an image or click to browse",
        fileHint: `JPG, PNG, WEBP or GIF, up to ${MAX_MB}MB`,
        imageHelp: `One image up to ${MAX_MB}MB. Wide or square frames work best.`,
        motionSettings: "Motion settings",
        describeMotion: "Describe the motion",
        promptPlaceholder: "Slow push in while the subject turns toward the light",
        model: "Model",
        duration: "Duration",
        aspect: "Aspect ratio",
        sending: "Sending…",
        generate: "Generate video",
        paused: "Generation is paused",
        notOpen: "Video generation is not open yet.",
        result: "Your video will appear here",
        tipsTitle: "Tips",
        tips: ["Describe the camera move, not only the subject.", "Keep the motion small so the subject stays recognisable.", "Name the light or mood to steer the final look."],
      };
  const inputRef = useRef<HTMLInputElement>(null);
  const idempotencyKeyRef = useRef<string>(newIdempotencyKey());

  const [fileName, setFileName] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<I2VModelId>(I2V_MODELS[0].id);
  const [duration, setDuration] = useState<number>(
    durationsFor(I2V_MODELS[0].id)[0],
  );
  const [aspectRatio, setAspectRatio] = useState<string>(
    aspectRatiosFor(I2V_MODELS[0].id)[0],
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function openPicker() {
    inputRef.current?.click();
  }

  function clearImage() {
    setFileName(null);
    setImageKey(null);
    setPreviewUrl(null);
    setUploadError(null);
    setUploading(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleFile(file: File) {
    const validationError = validateImageFile({
      type: file.type,
      size: file.size,
    });

    if (validationError) {
      setFileName(null);
      setImageKey(null);
      setPreviewUrl(null);
      setUploading(false);
      setUploadError(validationError);
      return;
    }

    setUploadError(null);
    setFileName(file.name);
    setImageKey(null);
    setPreviewUrl(null);
    setUploading(true);

    const result = await uploadImage(file);

    setUploading(false);

    if (result.ok) {
      setImageKey(result.key);
      setPreviewUrl(result.url.length > 0 ? result.url : null);
      return;
    }

    setImageKey(null);
    setPreviewUrl(null);
    setUploadError(result.message);
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      void handleFile(file);
    }

    event.target.value = "";
  }

  function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      void handleFile(file);
    }
  }

  function handleModelChange(nextModel: I2VModelId) {
    setModel(nextModel);
    const normalized = normalizeSettings(nextModel, duration, aspectRatio);
    setDuration(normalized.duration);
    setAspectRatio(normalized.aspectRatio);
  }

  async function handleGenerate() {
    if (generationEnabled !== true || !imageKey) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const result = await submitImageToVideo(
      {
        model,
        prompt: prompt.trim(),
        duration,
        aspectRatio,
        imageKey,
      },
      {
        enabled: generationEnabled,
        idempotencyKey: idempotencyKeyRef.current,
      },
    );

    idempotencyKeyRef.current = newIdempotencyKey();

    setSubmitting(false);

    if (!result.ok && result.reason === "error") {
      setSubmitError(result.message);
    }
  }

  const formReady = canSubmit({ imageKey, prompt, uploading });
  const generateDisabled = !generationEnabled || !formReady || submitting;

  const dropzoneClassName = [
    "i2v-dropzone",
    dragActive ? "i2v-dropzone--active" : "",
    uploadError ? "i2v-dropzone--error" : "",
    uploading ? "i2v-dropzone--busy" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="i2v-studio">
      <div className="i2v-studio__left">
        <header className="i2v-header">
          <h1 className="i2v-title">{copy.title}</h1>
          <p className="i2v-subtitle">
            {copy.subtitle}
          </p>
        </header>

        <section className="i2v-panel" aria-labelledby="i2v-image-label">
          <span className="i2v-label" id="i2v-image-label">
            {copy.sourceImage}
          </span>

          <input
            ref={inputRef}
            className="i2v-sr-only"
            id="i2v-image-input"
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            aria-labelledby="i2v-image-label"
            aria-describedby="i2v-image-help i2v-image-error"
            onChange={handleInputChange}
          />

          {previewUrl ? (
            <div className="i2v-preview">
              <div className="i2v-preview__thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt={copy.uploadedAlt} />
              </div>
              <div className="i2v-preview__meta">
                <span className="i2v-preview__name" title={fileName ?? undefined}>
                  {fileName ?? copy.uploaded}
                </span>
              </div>
              <div className="i2v-preview__actions">
                <button
                  type="button"
                  className="i2v-button i2v-button--small"
                  onClick={openPicker}
                >
                  {copy.replace}
                </button>
                <button
                  type="button"
                  className="i2v-button i2v-button--small i2v-button--ghost"
                  onClick={clearImage}
                >
                  {copy.remove}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={dropzoneClassName}
              onClick={openPicker}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <span className="i2v-spinner" aria-hidden="true" />
                  <span className="i2v-dropzone__title">{copy.uploading}</span>
                </>
              ) : (
                <>
                  <svg
                    className="i2v-dropzone__icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="18" height="16" rx="3" />
                    <path d="M3 15l4.5-4.5L12 15l3.5-3.5L21 17" />
                    <circle cx="8.5" cy="9" r="1.5" />
                  </svg>
                  <span className="i2v-dropzone__title">
                    {copy.drop}
                  </span>
                  <span className="i2v-dropzone__hint">
                    {copy.fileHint}
                  </span>
                </>
              )}
            </button>
          )}

          <p className="i2v-help" id="i2v-image-help">
            {copy.imageHelp}
          </p>

          <p className="i2v-error" id="i2v-image-error" role="alert">
            {uploadError ?? ""}
          </p>
        </section>

        <section className="i2v-panel" aria-label={copy.motionSettings}>
          <div className="i2v-field">
            <label className="i2v-label" htmlFor="i2v-prompt">
              {copy.describeMotion}
            </label>
            <textarea
              id="i2v-prompt"
              className="i2v-textarea"
              value={prompt}
              maxLength={MAX_PROMPT_LENGTH}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={copy.promptPlaceholder}
              aria-describedby="i2v-prompt-counter"
            />
            <span className="i2v-counter" id="i2v-prompt-counter">
              {prompt.length}/{MAX_PROMPT_LENGTH}
            </span>
          </div>

          <div className="i2v-field">
            <label className="i2v-label" htmlFor="i2v-model">
              {copy.model}
            </label>
            <select
              id="i2v-model"
              className="i2v-select"
              value={model}
              onChange={(event) =>
                handleModelChange(event.target.value as I2VModelId)
              }
            >
              {I2V_MODELS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="i2v-field">
            <legend className="i2v-label">{copy.duration}</legend>
            <div className="i2v-chips">
              {durationsFor(model).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={
                    option === duration
                      ? "i2v-chip i2v-chip--active"
                      : "i2v-chip"
                  }
                  aria-pressed={option === duration}
                  onClick={() => setDuration(option)}
                >
                  {option}s
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="i2v-field">
            <legend className="i2v-label">{copy.aspect}</legend>
            <div className="i2v-chips">
              {aspectRatiosFor(model).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={
                    option === aspectRatio
                      ? "i2v-chip i2v-chip--active"
                      : "i2v-chip"
                  }
                  aria-pressed={option === aspectRatio}
                  onClick={() => setAspectRatio(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            className="i2v-button i2v-button--primary i2v-button--block"
            disabled={generateDisabled}
            onClick={() => void handleGenerate()}
          >
            {submitting ? (
              <>
                <span className="i2v-spinner" aria-hidden="true" />
                <span>{copy.sending}</span>
              </>
            ) : generationEnabled ? (
              copy.generate
            ) : (
              copy.paused
            )}
          </button>

          {!generationEnabled ? (
            <p className="i2v-help">{copy.notOpen}</p>
          ) : null}

          <p className="i2v-error" role="alert">
            {submitError ?? ""}
          </p>
        </section>
      </div>

      <div className="i2v-studio__right">
        <div className="i2v-stage">
          <div className="i2v-stage__frame">
            {previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="i2v-stage__media"
                  src={previewUrl}
                  alt={copy.uploadedAlt}
                />
              </>
            ) : (
              <div className="i2v-stage__empty">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="i2v-stage__emptyImage"
                  src={EMPTY_PLACEHOLDER}
                  alt=""
                  aria-hidden="true"
                />
                <p className="i2v-stage__emptyText">
                  {copy.result}
                </p>
              </div>
            )}
          </div>
        </div>

        <section className="i2v-tips" aria-labelledby="i2v-tips-title">
          <h2 className="i2v-tips__title" id="i2v-tips-title">
            {copy.tipsTitle}
          </h2>
          <ul className="i2v-tips__list">
            {copy.tips.map((tip) => (
              <li className="i2v-tips__item" key={tip}>
                {tip}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
