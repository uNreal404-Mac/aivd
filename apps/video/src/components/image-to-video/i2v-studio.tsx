"use client";

import { useEffect, useRef, useState } from "react";

import {
  ALLOWED_TYPES,
  I2V_MODELS,
  MAX_BYTES,
  MAX_PROMPT_LENGTH,
  aspectRatiosFor,
  canSubmit,
  durationsFor,
  extractVideoUuid,
  fetchJobStatus,
  isTerminalJobState,
  newIdempotencyKey,
  normalizeSettings,
  submitImageToVideo,
  uploadImage,
  validateImageFile,
  type I2VModelId,
} from "@/lib/image-to-video";

const EMPTY_PLACEHOLDER = "/images/placeholders/i2v-empty.svg";

const MAX_MB = Math.round(MAX_BYTES / (1024 * 1024));

const POLL_INTERVAL_MS = 5_000;
const JOB_CAP_MS = 15 * 60 * 1_000;
const NO_UUID_LOCK_MS = 10_000;

const PROMPT_TIPS = [
  "Describe the camera move, not only the subject.",
  "Keep the motion small so the subject stays recognisable.",
  "Name the light or mood to steer the final look.",
];

interface I2VStudioProps {
  generationEnabled: boolean;
}

interface ActiveJob {
  uuid: string;
  status: string;
}

export function I2VStudio({ generationEnabled }: I2VStudioProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const idempotencyKeyRef = useRef<string>(newIdempotencyKey());
  const submittingRef = useRef(false);
  const noUuidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
  const [pendingLock, setPendingLock] = useState(false);
  const [noUuidLock, setNoUuidLock] = useState(false);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [jobVideoUrl, setJobVideoUrl] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (noUuidTimerRef.current) {
        clearTimeout(noUuidTimerRef.current);
        noUuidTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const job = activeJob;
    if (!job) {
      return;
    }
    if (isTerminalJobState(job.status)) {
      return;
    }

    const uuid = job.uuid;
    const startedAt = Date.now();
    let cancelled = false;
    let finished = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const stopInterval = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const capJob = () => {
      if (cancelled || finished) {
        return;
      }
      finished = true;
      stopInterval();
      setSubmitNotice("Still generating — check My creations.");
      setActiveJob(null);
      idempotencyKeyRef.current = newIdempotencyKey();
    };

    const poll = async () => {
      if (cancelled || finished) {
        return;
      }

      if (Date.now() - startedAt >= JOB_CAP_MS) {
        capJob();
        return;
      }

      const result = await fetchJobStatus(uuid);

      if (cancelled || finished) {
        return;
      }

      const status = result?.status;

      if (typeof status === "string") {
        if (status === "COMPLETED") {
          finished = true;
          stopInterval();
          setActiveJob({ uuid, status });
          setSubmitNotice("Done.");
          setJobVideoUrl(result?.videoUrl ?? null);
          setJobError(null);
          idempotencyKeyRef.current = newIdempotencyKey();
          return;
        }

        if (status === "FAILED") {
          finished = true;
          stopInterval();
          setActiveJob({ uuid, status });
          setSubmitNotice(null);
          setJobError(result?.errorMessage ?? "Generation failed.");
          idempotencyKeyRef.current = newIdempotencyKey();
          return;
        }

        setActiveJob({ uuid, status });
        setSubmitNotice(`Generating… (${status})`);
      }

      if (Date.now() - startedAt >= JOB_CAP_MS) {
        capJob();
      }
    };

    intervalId = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);
    void poll();

    return () => {
      cancelled = true;
      stopInterval();
    };
  }, [activeJob?.uuid]);

  function openPicker() {
    inputRef.current?.click();
  }

  function clearImage() {
    setFileName(null);
    setImageKey(null);
    setPreviewUrl(null);
    setUploadError(null);
    setUploading(false);
    setPendingLock(false);
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

    setPendingLock(false);
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
    if (submittingRef.current) {
      return;
    }

    if (activeJob && !isTerminalJobState(activeJob.status)) {
      return;
    }

    if (generationEnabled !== true || !imageKey || pendingLock || noUuidLock) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitNotice(null);
    setJobVideoUrl(null);
    setJobError(null);

    try {
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

      if (result.ok) {
        const videoUuid = extractVideoUuid(result.data);

        if (videoUuid) {
          setActiveJob({ uuid: videoUuid, status: "PENDING" });
          setSubmitNotice("Generating… (PENDING)");
        } else {
          setSubmitNotice("Submitted — your video is being generated.");
          idempotencyKeyRef.current = newIdempotencyKey();
          setNoUuidLock(true);
          if (noUuidTimerRef.current) {
            clearTimeout(noUuidTimerRef.current);
          }
          noUuidTimerRef.current = setTimeout(() => {
            setNoUuidLock(false);
            noUuidTimerRef.current = null;
          }, NO_UUID_LOCK_MS);
        }
      } else if (result.reason === "pending") {
        setSubmitNotice(result.message);
        setPendingLock(true);
      } else if (result.reason === "error") {
        setSubmitError(result.message);
        if (!result.retryable) {
          idempotencyKeyRef.current = newIdempotencyKey();
        }
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const formReady = canSubmit({ imageKey, prompt, uploading });
  const jobRunning = activeJob !== null && !isTerminalJobState(activeJob.status);
  const generateDisabled =
    !generationEnabled ||
    !formReady ||
    submitting ||
    pendingLock ||
    noUuidLock ||
    jobRunning;

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
          <h1 className="i2v-title">Image to Video</h1>
          <p className="i2v-subtitle">
            Bring a still frame to life with a short, directed camera move.
          </p>
        </header>

        <section className="i2v-panel" aria-labelledby="i2v-image-label">
          <span className="i2v-label" id="i2v-image-label">
            Source image
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
                <img src={previewUrl} alt="Your uploaded keyframe" />
              </div>
              <div className="i2v-preview__meta">
                <span className="i2v-preview__name" title={fileName ?? undefined}>
                  {fileName ?? "Uploaded image"}
                </span>
              </div>
              <div className="i2v-preview__actions">
                <button
                  type="button"
                  className="i2v-button i2v-button--small"
                  onClick={openPicker}
                >
                  Replace
                </button>
                <button
                  type="button"
                  className="i2v-button i2v-button--small i2v-button--ghost"
                  onClick={clearImage}
                >
                  Remove
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
                  <span className="i2v-dropzone__title">Uploading…</span>
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
                    Drop an image or click to browse
                  </span>
                  <span className="i2v-dropzone__hint">
                    JPG, PNG, WEBP or GIF, up to {MAX_MB}MB
                  </span>
                </>
              )}
            </button>
          )}

          <p className="i2v-help" id="i2v-image-help">
            One image up to {MAX_MB}MB. Wide or square frames work best.
          </p>

          <p className="i2v-error" id="i2v-image-error" role="alert">
            {uploadError ?? ""}
          </p>
        </section>

        <section className="i2v-panel" aria-label="Motion settings">
          <div className="i2v-field">
            <label className="i2v-label" htmlFor="i2v-prompt">
              Describe the motion
            </label>
            <textarea
              id="i2v-prompt"
              className="i2v-textarea"
              value={prompt}
              maxLength={MAX_PROMPT_LENGTH}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Slow push in while the subject turns toward the light"
              aria-describedby="i2v-prompt-counter"
            />
            <span className="i2v-counter" id="i2v-prompt-counter">
              {prompt.length}/{MAX_PROMPT_LENGTH}
            </span>
          </div>

          <div className="i2v-field">
            <label className="i2v-label" htmlFor="i2v-model">
              Model
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
            <legend className="i2v-label">Duration</legend>
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
            <legend className="i2v-label">Aspect ratio</legend>
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
            {jobRunning ? (
              <>
                <span className="i2v-spinner" aria-hidden="true" />
                <span>Generating…</span>
              </>
            ) : submitting ? (
              <>
                <span className="i2v-spinner" aria-hidden="true" />
                <span>Sending…</span>
              </>
            ) : generationEnabled ? (
              "Generate video"
            ) : (
              "Generation is paused"
            )}
          </button>

          {!generationEnabled ? (
            <p className="i2v-help">Video generation is not open yet.</p>
          ) : null}

          <p className="i2v-help">
            <output>{submitNotice ?? ""}</output>
          </p>

          {activeJob?.status === "COMPLETED" && jobVideoUrl ? (
            <video controls src={jobVideoUrl} className="i2v-result" />
          ) : null}

          <p className="i2v-error" role="alert">
            {submitError ?? jobError ?? ""}
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
                  alt="Your uploaded keyframe"
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
                  Your video will appear here
                </p>
              </div>
            )}
          </div>
        </div>

        <section className="i2v-tips" aria-labelledby="i2v-tips-title">
          <h2 className="i2v-tips__title" id="i2v-tips-title">
            Tips
          </h2>
          <ul className="i2v-tips__list">
            {PROMPT_TIPS.map((tip) => (
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
