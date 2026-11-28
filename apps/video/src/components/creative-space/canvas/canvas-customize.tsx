"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { CanvasFloatingPanel } from "./canvas-floating-panel";
import { CanvasAppearance } from "./canvas-appearance";
import { canvasViewDefaults, type CanvasViewOptions } from "./canvas-view";
import "./canvas-customize.css";

type Section = "interaction" | "notifications" | "wires" | "grid" | "layout" | "background" | "theme" | "wireColor";
const sections: { id: Section; zh: string; en: string }[] = [
  { id: "interaction", zh: "交互操作", en: "Interaction" },
  { id: "notifications", zh: "生成通知", en: "Notifications" },
  { id: "wires", zh: "连线设置", en: "Connections" },
  { id: "grid", zh: "网格与显示", en: "Grid & display" },
  { id: "layout", zh: "节点与布局", en: "Nodes & layout" },
  { id: "background", zh: "自定义背景", en: "Background image" },
  { id: "theme", zh: "画布主题", en: "Canvas theme" },
  { id: "wireColor", zh: "连线色彩", en: "Wire colours" },
];
const successSounds = [
  ["clear", "清脆", "Clear"], ["soft", "柔和", "Soft"], ["bell", "铃声", "Bell"], ["bubble", "气泡", "Bubble"],
  ["arpeggio", "旋律", "Arpeggio"], ["piano", "竖琴", "Harp"], ["wood", "木琴", "Wood"], ["horn", "号角", "Horn"],
  ["crystal", "水晶", "Crystal"], ["morning", "晨光", "Morning"],
] as const;
const failureSounds = [
  ["descending", "下行", "Descending"], ["low", "低沉", "Low"], ["tap", "叩击", "Tap"], ["cuckoo", "哨鸣", "Whistle"],
  ["alert", "警示", "Alert"], ["sigh", "叹息", "Sigh"], ["drop", "坠落", "Drop"],
  ["minor", "小调", "Minor"], ["fog", "雾笛", "Fog"], ["crack", "碎裂", "Crack"],
] as const;

export function playCanvasNoticeSound(id: string, failed = false) {
  try {
    const context = new AudioContext();
    const base = failed ? 220 : 660;
    const variants: Record<string, number[]> = {
      clear: [1, 1.5], soft: [1, 1.25], bell: [1, 2], bubble: [1.4, 1.8], arpeggio: [1, 1.25, 1.5],
      piano: [1, 1.33, 1.66], wood: [1.5, 1], horn: [1, 1.5, 2], crystal: [2, 2.5], morning: [1, 1.5, 2],
      descending: [1.5, 1], low: [0.8, 0.65], tap: [1.2], cuckoo: [1.4, 1], alert: [1, 1, 1],
      sigh: [1.4, 1.1, 0.8], drop: [1.8, 0.9], minor: [1.5, 1.2, 1], fog: [0.7, 0.6], crack: [2, 0.7],
    };
    const notes = variants[id] ?? [1];
    notes.forEach((ratio, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = failed ? "triangle" : "sine";
      oscillator.frequency.value = base * ratio;
      oscillator.connect(gain); gain.connect(context.destination);
      const start = context.currentTime + index * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);
      oscillator.start(start); oscillator.stop(start + 0.18);
    });
    window.setTimeout(() => void context.close(), notes.length * 120 + 500);
  } catch { /* Sound is optional when the browser blocks audio. */ }
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="ncc-control ncc-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}
function Slider({ label, value, min, max, step = 1, unit = "", onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void;
}) {
  return <label className="ncc-control ncc-slider"><span>{label}</span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /><output>{Number.isInteger(value) ? value : Number(value.toFixed(2))}{unit}</output></label>;
}
function Segmented<T extends string>({ label, value, choices, onChange }: {
  label: string; value: T; choices: { value: T; label: string }[]; onChange: (value: T) => void;
}) {
  return <div className="ncc-control"><span>{label}</span><fieldset className="ncc-segments"><legend className="sr-only">{label}</legend>{choices.map((choice) =>
    <button key={choice.value} type="button" aria-pressed={choice.value === value} onClick={() => onChange(choice.value)}>{choice.label}</button>)}</fieldset></div>;
}
function ColorPicker({ label, value, colors, onChange }: { label: string; value: string; colors: string[]; onChange: (value: string) => void }) {
  return <div className="ncc-color-field"><span>{label}</span><div className="ncc-colors">{colors.map((color) =>
    <button key={color} type="button" style={{ backgroundColor: color }} className={value === color || (!value && color === colors[0]) ? "is-active" : ""} aria-label={color} aria-pressed={value === color || (!value && color === colors[0])} onClick={() => onChange(color)} />)}
    <label className="ncc-custom-color">{label.includes("色彩") || label.includes("color") ? "＋" : "◉"}<input type="color" aria-label={label} value={value || colors[0]} onChange={(event) => onChange(event.target.value)} /></label>
  </div></div>;
}
export function CanvasCustomize({ zh, options, change, background, saveBackground, onClose, showMinimap, setShowMinimap, images }: {
  zh: boolean; options: CanvasViewOptions; change: (partial: Partial<CanvasViewOptions>) => void;
  background: string; saveBackground: (value: string) => void; onClose: () => void;
  showMinimap: boolean; setShowMinimap: (value: boolean) => void;
  images: { name: string; url: string }[];
}) {
  const [section, setSection] = useState<Section>("interaction");
  const [permissionError, setPermissionError] = useState("");
  const l = (cn: string, en: string) => zh ? cn : en;
  const set = <K extends keyof CanvasViewOptions>(key: K, value: CanvasViewOptions[K]) => change({ [key]: value } as Pick<CanvasViewOptions, K>);
  const soundChoices = (choices: readonly (readonly [string, string, string])[], value: string, key: "successSound" | "failureSound", failed: boolean) =>
    <div className="ncc-control ncc-sounds"><span>{l(failed ? "失败提示音" : "成功提示音", failed ? "Failure sound" : "Success sound")}</span><div className="ncc-segments">{choices.map(([id, cn, en]) =>
      <button key={id} type="button" aria-pressed={value === id} onClick={() => { set(key, id); playCanvasNoticeSound(id, failed); }}>{l(cn, en)}</button>)}</div></div>;
  return <CanvasFloatingPanel title={l("自定义画布", "Canvas settings")} onClose={onClose} className="nc-settings-floating ncc-panel" width={900}>
    <div className="ncc-top"><button type="button" onClick={() => { change({ ...canvasViewDefaults }); setShowMinimap(false); saveBackground(""); }}>{<RotateCcw size={15} />}{l("恢复默认", "Restore defaults")}</button></div>
    <div className="ncc-layout">
      <nav aria-label={l("设置分类", "Settings categories")}>{sections.map((item) => <button key={item.id} type="button" aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)}>{zh ? item.zh : item.en}</button>)}</nav>
      <div className="ncc-content" key={section}>
        <section className="ncc-card"><h3>{zh ? sections.find((item) => item.id === section)?.zh : sections.find((item) => item.id === section)?.en}</h3>
          {section === "interaction" && <div className="ncc-controls">
            <Slider label={l("画布平移灵敏度", "Pan sensitivity")} value={options.panSensitivity} min={0.25} max={3} step={0.05} unit="x" onChange={(v) => set("panSensitivity", v)} />
            <Slider label={l("定位动画节点上限", "Focus animation node limit")} value={options.focusAnimationLimit} min={0} max={200} onChange={(v) => set("focusAnimationLimit", v)} />
            <Slider label={l("图/视延迟提交", "Image/video submit delay")} value={options.submitDelaySeconds} min={0} max={5} unit={l("秒", "s")} onChange={(v) => { set("submitDelaySeconds", v); set("delaySubmit", v > 0); }} />
            <Slider label={l("触摸点吸附范围", "Connection snap radius")} value={options.touchRadius} min={40} max={250} step={10} unit="px" onChange={(v) => set("touchRadius", v)} />
            <Segmented label={l("空白区域操作", "Blank area action")} value={options.blankAction} choices={[{ value: "context", label: l("右键菜单", "Right click") }, { value: "double", label: l("仅双击添加", "Double-click only") }]} onChange={(v) => set("blankAction", v)} />
            <Segmented label={l("滚轮默认操作", "Mouse wheel")} value={options.wheelPan ? "pan" : "zoom"} choices={[{ value: "pan", label: l("平移", "Pan") }, { value: "zoom", label: l("缩放", "Zoom") }]} onChange={(v) => set("wheelPan", v === "pan")} />
            <Segmented label={l("@ 引用命名", "@ reference names")} value={options.mentionNaming} choices={[{ value: "name", label: l("名称", "Name") }, { value: "number", label: l("数字", "Number") }]} onChange={(v) => set("mentionNaming", v)} />
            <Toggle label={l("拖拽吸附网格", "Snap nodes to grid")} checked={options.snap} onChange={(v) => set("snap", v)} />
            <Toggle label={l("对齐辅助线", "Alignment guides")} checked={options.alignGuides} onChange={(v) => set("alignGuides", v)} />
            <Toggle label={l("拖动节点获取焦点", "Select nodes on drag")} checked={options.dragSelect} onChange={(v) => set("dragSelect", v)} />
            <Toggle label={l("节点提交后取消焦点", "Deselect after submitting")} checked={options.blurAfterSubmit} onChange={(v) => set("blurAfterSubmit", v)} />
            <Toggle label={l("Shift+回车 提交", "Submit with Shift+Enter")} checked={options.shiftEnterSubmit} onChange={(v) => set("shiftEnterSubmit", v)} />
            <Toggle label={l("极简模式缩放", "Simple view when zoomed out")} checked={options.simple} onChange={(v) => set("simple", v)} />
            <Toggle label={l("联动预览画布素材", "Live canvas asset previews")} checked={options.previewCanvasAssets} onChange={(v) => set("previewCanvasAssets", v)} />
            <Toggle label={l("视频悬停自动播放", "Autoplay video on hover")} checked={options.videoHoverPlay} onChange={(v) => set("videoHoverPlay", v)} />
          </div>}
          {section === "notifications" && <div className="ncc-controls">
            <Toggle label={l("生成完成后通知", "Notify on completion")} checked={options.notifyCompleted} onChange={(v) => set("notifyCompleted", v)} />
            <Segmented label={l("通知时机", "When to notify")} value={options.notifyTiming} choices={[{ value: "hidden", label: l("仅切走时", "When away") }, { value: "always", label: l("始终", "Always") }]} onChange={(v) => set("notifyTiming", v)} />
            <Toggle label={l("系统通知（浏览器）", "Browser notification")} checked={options.notifyBrowser} onChange={(v) => { if (!v) { set("notifyBrowser", false); return; } if (typeof Notification === "undefined") { setPermissionError(l("浏览器不支持系统通知", "Browser notifications unavailable")); return; } void Notification.requestPermission().then((permission) => { set("notifyBrowser", permission === "granted"); setPermissionError(permission === "granted" ? "" : l("请在浏览器中允许通知", "Allow notifications in your browser")); }); }} />
            <Toggle label={l("生成失败也通知", "Notify on failure")} checked={options.notifyFailed} onChange={(v) => set("notifyFailed", v)} />
            <Toggle label={l("提示音", "Play sound")} checked={options.notifySound} onChange={(v) => set("notifySound", v)} />
            <Toggle label={l("只通知我发起的任务", "Only my tasks")} checked={options.notifyOnlyMine} onChange={(v) => set("notifyOnlyMine", v)} />
            {soundChoices(successSounds, options.successSound, "successSound", false)}
            {soundChoices(failureSounds, options.failureSound, "failureSound", true)}
            {permissionError && <p className="ncc-error" role="alert">{permissionError}</p>}
          </div>}
          {section === "wires" && <div className="ncc-controls">
            <Slider label={l("连线显示粗细", "Wire thickness")} value={options.wireWidth} min={1} max={6} step={0.5} unit="px" onChange={(v) => set("wireWidth", v)} />
            <Slider label={l("连线焦点范围", "Wire focus range")} value={options.wireFocusRadius} min={4} max={30} unit="px" onChange={(v) => set("wireFocusRadius", v)} />
            <Toggle label={l("连线悬停高亮", "Highlight on hover")} checked={options.wireHoverHighlight} onChange={(v) => set("wireHoverHighlight", v)} />
            <Toggle label={l("开启连线动画", "Animate wires")} checked={options.wireAnimate} onChange={(v) => set("wireAnimate", v)} />
            <Toggle label={l("仅显示焦点连线", "Only focused wires")} checked={options.focusWires} onChange={(v) => set("focusWires", v)} />
          </div>}
          {section === "grid" && <div className="ncc-controls">
            <Slider label={l("网格线间距", "Grid spacing")} value={options.gridSize} min={10} max={60} step={2} unit="px" onChange={(v) => set("gridSize", v)} />
            <Slider label={l("网格点大小", "Grid dot size")} value={options.gridDotSize} min={1} max={5} step={0.5} unit="px" onChange={(v) => set("gridDotSize", v)} />
            <Toggle label={l("显示网格底纹", "Show grid")} checked={options.grid} onChange={(v) => set("grid", v)} />
            <Toggle label={l("背景氛围光晕", "Background glow")} checked={options.gridGlow} onChange={(v) => set("gridGlow", v)} />
            <Toggle label={l("显示导航小地图", "Show minimap")} checked={showMinimap} onChange={setShowMinimap} />
          </div>}
          {section === "layout" && <div className="ncc-controls">
            <Slider label={l("整理节点水平间距", "Horizontal arrangement gap")} value={options.horizontalGap} min={20} max={250} step={10} unit="px" onChange={(v) => set("horizontalGap", v)} />
            <Slider label={l("整理节点垂直间距", "Vertical arrangement gap")} value={options.verticalGap} min={20} max={250} step={10} unit="px" onChange={(v) => set("verticalGap", v)} />
            <Slider label={l("打组包含边距", "Group padding")} value={options.groupPadding} min={30} max={200} step={10} unit="px" onChange={(v) => set("groupPadding", v)} />
            <Slider label={l("组标签大小", "Group label size")} value={options.groupLabelScale} min={0.7} max={1.6} step={0.05} unit="x" onChange={(v) => set("groupLabelScale", v)} />
            <Slider label={l("上方工具栏缩放", "Top toolbar scale")} value={options.topToolbarScale} min={0.75} max={1.4} step={0.05} unit="x" onChange={(v) => set("topToolbarScale", v)} />
            <Slider label={l("下方工具栏缩放", "Bottom toolbar scale")} value={options.toolbarScale} min={0.75} max={1.25} step={0.05} unit="x" onChange={(v) => set("toolbarScale", v)} />
            <Toggle label={l("组节点盖住连线", "Groups cover wires")} checked={options.groupCoverWires} onChange={(v) => set("groupCoverWires", v)} />
          </div>}
          {section === "background" && <CanvasAppearance zh={zh} background={background} save={saveBackground} options={options} change={change} images={images} />}
          {section === "theme" && <ColorPicker label={l("画布主题色彩", "Canvas theme colour")} value={options.themeColor} colors={["#0d0f14", "#17212b", "#202027", "#112a2c", "#29251f", "#17251e"]} onChange={(v) => set("themeColor", v)} />}
          {section === "wireColor" && <><ColorPicker label={l("连线色彩", "Wire colour")} value={options.wireColor} colors={["#9ca3af", "#26dce5", "#5ca0f2", "#a78bfa", "#e9a85c", "#f4727b"]} onChange={(v) => set("wireColor", v)} />
            <Toggle label={l("按素材类型区分连线色彩", "Colour wires by media type")} checked={options.colorWires} onChange={(v) => set("colorWires", v)} /></>}
        </section>
      </div>
    </div>
  </CanvasFloatingPanel>;
}
