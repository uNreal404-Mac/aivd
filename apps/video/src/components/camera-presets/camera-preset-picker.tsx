"use client";

import {
  CAMERA_PRESETS,
  isCameraPresetId,
  type CameraPresetId,
} from "@/lib/camera-presets";

type CameraPresetPickerProps = {
  value: CameraPresetId | null;
  onChange: (next: CameraPresetId | null) => void;
  locale?: "en" | "zh";
  disabled?: boolean;
  className?: string;
  label?: string;
};

const chipBaseClassName =
  "rounded-full px-3 py-1 text-xs transition-colors disabled:opacity-50 disabled:pointer-events-none";
const chipActiveClassName = "bg-primary text-primary-foreground";
const chipInactiveClassName = "bg-muted text-muted-foreground hover:text-foreground";

export function CameraPresetPicker(props: CameraPresetPickerProps) {
  const {
    value,
    onChange,
    locale = "en",
    disabled,
    className,
    label,
  } = props;
  const ariaLabel = label ?? (locale === "zh" ? "运镜" : "Camera motion");
  const rootClassName = className
    ? `m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0 ${className}`
    : "m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0";

  return (
    <fieldset aria-label={ariaLabel} className={rootClassName}>
      <button
        type="button"
        aria-pressed={value === null}
        disabled={disabled}
        onClick={() => onChange(null)}
        title={locale === "zh" ? "无运镜" : "No camera motion"}
        className={`${chipBaseClassName} ${
          value === null ? chipActiveClassName : chipInactiveClassName
        }`}
      >
        {locale === "zh" ? "无" : "None"}
      </button>

      {CAMERA_PRESETS.map((preset) => {
        const selected = value === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(preset.id)}
            title={locale === "zh" ? preset.descriptionZh : preset.descriptionEn}
            className={`${chipBaseClassName} ${
              selected ? chipActiveClassName : chipInactiveClassName
            }`}
          >
            {locale === "zh" ? preset.labelZh : preset.labelEn}
          </button>
        );
      })}
    </fieldset>
  );
}

export function CameraPresetSelect(props: CameraPresetPickerProps) {
  const {
    value,
    onChange,
    locale = "en",
    disabled,
    className,
    label,
  } = props;
  const ariaLabel = label ?? (locale === "zh" ? "运镜" : "Camera motion");
  const selectClassName = className
    ? `rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground disabled:opacity-50 ${className}`
    : "rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground disabled:opacity-50";

  return (
    <select
      aria-label={ariaLabel}
      className={selectClassName}
      disabled={disabled}
      value={value ?? ""}
      onChange={(event) => {
        const next = event.target.value;
        onChange(isCameraPresetId(next) ? next : null);
      }}
    >
      <option value="">{locale === "zh" ? "无" : "None"}</option>
      {CAMERA_PRESETS.map((preset) => (
        <option
          key={preset.id}
          value={preset.id}
          title={locale === "zh" ? preset.descriptionZh : preset.descriptionEn}
        >
          {locale === "zh" ? preset.labelZh : preset.labelEn}
        </option>
      ))}
    </select>
  );
}
