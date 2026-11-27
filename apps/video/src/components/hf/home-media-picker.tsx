"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Expand, Image as ImageIcon, Loader2, Music2, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { isWanVideoMime, WAN_REFERENCE_MAX_BYTES } from "@/lib/wan-video-references";
import { canUseHomeKeyframe } from "@/lib/home-keyframes";
import { MAX_BYTES, uploadErrorText, uploadImage, validateImageFile } from "@/lib/image-to-video";
import { listGuestAssets, removeGuestAsset, saveGuestAsset, type PickerAsset } from "@/lib/home-media-library";
import { uploadWorkflowVideo } from "@/lib/creative-space/upload-video";
import { PRESENCE_EXIT_MS, usePresence } from "@/hooks/use-presence";
import { prefersReducedMotion } from "@/lib/reduced-motion";
import "./home-media-picker.css";

type Tab = "upload" | "elements" | "brand" | "works";
type MediaType = "image" | "video" | "audio";
type Filter = "all" | MediaType;
type Element = { id: string; name: string; category: string; assetId: string };
/** Kits saved before colours, fonts and guidelines were dropped still carry
 * those fields; nothing reads them, and they are kept as they are. */
type Brand = { id: string; name: string; logoId: string };
const ELEMENT_CATEGORIES = [
  { id: "all", zh: "全部", en: "All" },
  { id: "product", zh: "产品", en: "Product" },
  { id: "character", zh: "角色", en: "Character" },
  { id: "scene", zh: "场景", en: "Scene" },
  { id: "style", zh: "风格", en: "Style" },
  { id: "prop", zh: "道具", en: "Prop" },
] as const;
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const AUDIO_TYPES = new Set(["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/webm"]);
/** Same limit as lib/creative-space/upload-video and the video-assets route. */
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
/** How long a pressed delete waits for its second press. */
const CONFIRM_MS = 3000;
const DOUBLE_PRESS_MS = 400;
const LIBRARY_CACHE_MS = 5 * 60 * 1000;
type LibrarySnapshot = { assets: PickerAsset[]; works: PickerAsset[]; at: number };
const librarySnapshots = new Map<string, LibrarySnapshot>();

function reusableUrl(url: string, now = Date.now()): boolean {
  if (!url) return false;
  if (url.startsWith("/")) return true;
  try {
    const parsed = new URL(url);
    const issued = parsed.searchParams.get("X-Amz-Date");
    const seconds = Number(parsed.searchParams.get("X-Amz-Expires"));
    if (!issued) return true;
    const timestamp = Date.parse(issued.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z"));
    return Number.isFinite(timestamp) && Number.isFinite(seconds) && timestamp + seconds * 1000 > now + 2 * 60 * 1000;
  } catch {
    return url.startsWith("blob:");
  }
}

function keepLoadedUrl(item: PickerAsset, previous: PickerAsset[]): PickerAsset {
  const old = previous.find((asset) => asset.id === item.id);
  return old && reusableUrl(old.url) ? { ...item, url: old.url } : item;
}
const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

function categoryId(value: string): string {
  return ELEMENT_CATEGORIES.find((item) => item.id === value || item.zh === value)?.id ?? "character";
}

function saved<T extends { id: string }>(key: string): T[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter((item): item is T => Boolean(item) && typeof item === "object" && typeof item.id === "string") : [];
  } catch { return []; }
}

export function HomeMediaPicker({ lang, open, onClose, onSelect, onDelete, maxSelected, selectedIds, userId, acceptedTypes = ["image"], initialTab, wanVideoOnly = false, keyframeOnly = false, videoToolAsset, uploadsAndWorksOnly = false, homepage = false, mentionAnchor, onMention, libraryScope = "global", canvasItems = [] }: {
  lang: string; open: boolean; onClose: () => void; onSelect: (assets: PickerAsset[]) => void; onDelete?: (id: string) => void;
  maxSelected: number; selectedIds: string[]; userId?: string; acceptedTypes?: MediaType[];
  /** The shelf it opens on each time (an "@" button opens it on the elements). */
  initialTab?: Tab;
  homepage?: boolean;
  wanVideoOnly?: boolean;
  keyframeOnly?: boolean;
  videoToolAsset?: "image" | "video";
  uploadsAndWorksOnly?: boolean;
  mentionAnchor?: HTMLButtonElement | null;
  onMention?: (item: PickerAsset) => void;
  libraryScope?: "global" | "canvas";
  /** Assets already present on this canvas, including imported works. */
  canvasItems?: PickerAsset[];
}) {
  const zh = lang.toLowerCase().startsWith("zh");
  const allowVideo = acceptedTypes.includes("video");
  const typesKey = acceptedTypes.join("|");
  const unit = zh ? (allowVideo ? "个" : "张") : "";
  const { mounted, state } = usePresence(open);
  const [tab, setTab] = useState<Tab>("upload");
  // Until the library has loaded, a selection cannot be confirmed: chosen
  // items not listed yet would otherwise be dropped from the prompt.
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [assets, setAssets] = useState<PickerAsset[]>([]);
  const [works, setWorks] = useState<PickerAsset[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [initial, setInitial] = useState<string[]>([]);
  const [preview, setPreview] = useState<PickerAsset | null>(null);
  const previewOpener = useRef<HTMLButtonElement | null>(null);
  const closePreview = () => { setPreview(null); requestAnimationFrame(() => previewOpener.current?.focus({ preventScroll: true })); };
  const [limitNote, setLimitNote] = useState(false);
  const [elements, setElements] = useState<Element[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [create, setCreate] = useState<"element" | "brand" | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("all");
  const [sourceId, setSourceId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [manageMode, setManageMode] = useState(false);
  const [managed, setManaged] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<"selected" | "all" | null>(null);
  const [deletingMany, setDeletingMany] = useState(false);
  const uploadRevision = useRef(0);
  const assetMutationRevision = useRef(0);
  useEffect(() => {
    setUploading(false);
    return () => { uploadRevision.current++; };
  }, [userId]);
  const [armed, setArmed] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string[]>([]);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Focus moves into the library when it opens (onto the open tab) and goes
  // back to whatever opened it when it closes.
  const returnFocus = useRef<HTMLElement | null>(null);
  const selectedRef = useRef<string[]>([]);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armedAt = useRef(0);
  const scope = userId || "guest";
  const elementKey = `aivd:elements:${scope}`;
  const brandKey = `aivd:brands:${scope}`;
  const libraryKey = `${scope}:${libraryScope}:${typesKey}:${wanVideoOnly}:${zh}`;
  const [snapshotKey, setSnapshotKey] = useState<string | null>(null);

  // selectedIds and acceptedTypes are compared by value, so a parent passing
  // a new array on every render does not reload the library.
  useEffect(() => {
    if (!open) return;
    let live = true;
    selectedRef.current = selectedIds;
    setSelected(selectedIds); setInitial(selectedIds); setLimitNote(false); setFilter("all");
    setManageMode(false); setManaged([]); setConfirmDelete(null);
    const oldElements = userId ? saved<Element>("aivd:elements:guest") : [];
    const oldBrands = userId ? saved<Brand>("aivd:brands:guest") : [];
    const nextElements = [...saved<Element>(elementKey), ...oldElements];
    const nextBrands = [...saved<Brand>(brandKey), ...oldBrands];
    setElements(nextElements); setBrands(nextBrands);
    if (userId && (oldElements.length || oldBrands.length)) {
      localStorage.setItem(elementKey, JSON.stringify(nextElements));
      localStorage.setItem(brandKey, JSON.stringify(nextBrands));
      localStorage.removeItem("aivd:elements:guest"); localStorage.removeItem("aivd:brands:guest");
    }
    setError("");
    const snapshot = librarySnapshots.get(libraryKey);
    const useSnapshot = Boolean(snapshot && Date.now() - snapshot.at < LIBRARY_CACHE_MS &&
      [...snapshot.assets, ...snapshot.works].every((item) => reusableUrl(item.url)));
    if (useSnapshot && snapshot) {
      setAssets(snapshot.assets);
      setWorks(snapshot.works);
      setSnapshotKey(libraryKey);
    } else {
      setAssets([]);
      setWorks([]);
      setSnapshotKey(null);
    }
    setLoadingAssets(!useSnapshot);
    const loadRevision = assetMutationRevision.current;
    const local = listGuestAssets(userId, libraryScope).catch(() => { if (live) setError(zh ? "暂时读取不到保存在这台设备上的素材，请刷新或重新上传" : "Couldn't load uploads saved on this device. Refresh or upload again."); return null; });
    const remote = userId
      ? fetch(`/api/v1/library?scope=${libraryScope}`, { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((body) => Array.isArray(body?.data?.assets) ? body.data.assets as PickerAsset[] : null).catch(() => null)
      : Promise.resolve([] as PickerAsset[]);
    const libraryLoaded = Promise.all([local, remote]).then(([localAssets, remoteAssets]) => {
      if (live) setAssets((current) => {
        const merged = [...(localAssets ?? current.filter((item) => !item.key)), ...(remoteAssets ?? current.filter((item) => item.key))];
        if (assetMutationRevision.current !== loadRevision) {
          const fetchedIds = new Set(merged.map((item) => item.id));
          merged.push(...current.filter((item) => !fetchedIds.has(item.id)));
        }
        return merged.filter((asset, index) => merged.findIndex((item) => item.id === asset.id) === index).map((item) => keepLoadedUrl(item, current));
      });
    });
    let worksLoaded: Promise<unknown> = Promise.resolve();
    if (userId && !wanVideoOnly && libraryScope === "global") {
      // Only ask for the kinds of creations this caller can use.
      worksLoaded = Promise.all(typesKey.split("|").filter(Boolean).map((type) => fetch(`/api/v1/video/list?type=${type}&limit=60`, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null))).then((bodies) => {
        if (!live) return;
        if (bodies.every((body) => body === null)) return;
        const rows: any[] = bodies.flatMap((body) => Array.isArray(body?.data?.videos) ? body.data.videos : []);
        setWorks((current) => rows.flatMap((row) => {
          const urls = Array.isArray(row.mediaUrls) ? row.mediaUrls : row.videoUrl ? [row.videoUrl] : [];
          return urls.map((url: string, index: number) => ({ id: `work:${row.uuid}:${index}`, name: row.prompt || row.model || (zh ? "作品" : "Creation"), mimeType: `${row.mediaType || "video"}/generated`, url, key: url }));
        }).map((item) => keepLoadedUrl(item, current)));
      }).catch(() => {});
    }
    void Promise.allSettled([libraryLoaded, worksLoaded]).then(() => { if (live) { setLoadingAssets(false); setSnapshotKey(libraryKey); } });
    return () => { live = false; };
  }, [open, userId, elementKey, brandKey, zh, selectedIds.join("|"), typesKey, wanVideoOnly, libraryScope, libraryKey]);

  useEffect(() => {
    if (snapshotKey === libraryKey) librarySnapshots.set(libraryKey, { assets, works, at: Date.now() });
  }, [snapshotKey, libraryKey, assets, works]);

  useEffect(() => {
    if (!open) return;
    // Escape first takes back a pending delete, then closes.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (confirmDelete) { setConfirmDelete(null); return; }
      if (preview) { closePreview(); return; }
      if (armed) { if (armTimer.current) clearTimeout(armTimer.current); armTimer.current = null; setArmed(null); return; }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, armed, preview, confirmDelete]);

  useEffect(() => () => { if (armTimer.current) clearTimeout(armTimer.current); }, []);

  const [position, setPosition] = useState({ left: 0, top: 0 });
  useEffect(() => {
    if (!open || !mentionAnchor) return;
    const place = () => {
      const anchor = mentionAnchor.getBoundingClientRect();
      const width = Math.min(420, window.innerWidth - 24);
      const height = Math.min(400, window.innerHeight - 24);
      const above = anchor.top - height - 8;
      const below = anchor.bottom + 8;
      setPosition({
        left: Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12)),
        top: Math.max(12, Math.min(below + height <= window.innerHeight - 12 || above < 12 ? below : above, window.innerHeight - height - 12)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, mentionAnchor]);

  const wantFocus = useRef(false);
  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      wantFocus.current = true;
      return;
    }
    wantFocus.current = false;
    const opener = returnFocus.current;
    returnFocus.current = null;
    if (opener?.isConnected && (!document.activeElement || document.activeElement === document.body || dialogRef.current?.contains(document.activeElement))) opener.focus({ preventScroll: true });
  }, [open]);
  // Once the panel is on screen, onto the tab of the shelf it opens on.
  useEffect(() => {
    if (!open || !mounted || !wantFocus.current) return;
    wantFocus.current = false;
    if (mentionAnchor) { dialogRef.current?.querySelector<HTMLElement>(".hmp-toolbar button")?.focus({ preventScroll: true }); return; }
    dialogRef.current?.querySelector<HTMLElement>(`.hmp-header nav button[data-tab="${initialTab ?? tab}"]`)?.focus({ preventScroll: true });
  }, [open, mounted, tab, initialTab, mentionAnchor]);

  // Each opening starts on the shelf the caller asked for (only on opening,
  // not when the selection changes while it is open).
  useEffect(() => {
    if (!open) return;
    setTab(wanVideoOnly ? "upload" : initialTab ?? "upload");
    setCreate(null);
    setCategory("all");
  }, [open, initialTab, wanVideoOnly, libraryScope]);

  // Closing the library, or moving to another source, cancels a half-done
  // delete: the library never reopens with a bin already armed. (Above the
  // early return: hooks run in the same order every render.)
  useEffect(() => {
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = null;
    setArmed(null);
    setPreview(null);
    setConfirmDelete(null);
    setManageMode(false);
    setManaged([]);
  }, [open, tab]);

  if (!mounted) return null;
  const acceptable = (item: PickerAsset) => {
    if (!item.url || !acceptedTypes.some((type) => item.mimeType?.startsWith(`${type}/`))) return false;
    if (videoToolAsset) {
      if (/^work:[\w-]+:\d+$/.test(item.id)) return true;
      const types = videoToolAsset === "image" ? ["image/png", "image/jpeg"] : ["video/mp4", "video/quicktime"];
      return types.includes(item.mimeType) && (item.size ?? item.file?.size ?? 0) <= (videoToolAsset === "image" ? 10 : 25) * 1024 * 1024;
    }
    if (keyframeOnly) return canUseHomeKeyframe(item, userId);
    if (!wanVideoOnly) return true;
    const size = item.file?.size ?? item.size;
    return isWanVideoMime(item.mimeType) && Boolean(item.file || (userId && item.key?.startsWith(`uploads/${userId}/`)))
      && typeof size === "number" && size > 0 && size <= WAN_REFERENCE_MAX_BYTES;
  };
  const elementAssets = elements.map((item) => ({ ...assets.find((asset) => asset.id === item.assetId), id: `element:${item.id}`, name: item.name } as PickerAsset));
  const brandAssets = brands.map((item) => ({ ...assets.find((asset) => asset.id === item.logoId), id: `brand:${item.id}`, name: item.name } as PickerAsset));
  const canvasUploads = libraryScope === "canvas" ? canvasItems.filter((item) => !item.id.startsWith("work:")) : [];
  const canvasWorks = libraryScope === "canvas" ? canvasItems.filter((item) => item.id.startsWith("work:")) : [];
  const uploads = [...assets, ...canvasUploads].filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index);
  const generated = [...works, ...canvasWorks].filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index);
  const source = tab === "works" ? generated : tab === "upload" ? uploads : tab === "elements" ? elementAssets : brandAssets;
  const choices = [...uploads, ...generated, ...elementAssets, ...brandAssets];
  // Items this caller cannot take are not listed, and a type filter only
  // appears when there is more than one type to choose between.
  const filters: Filter[] = tab === "upload" && homepage ? ["all", "image", "video", "audio"] : acceptedTypes.length > 1 ? ["all", ...(["video", "image", "audio"] as const).filter((type) => acceptedTypes.includes(type))] : [];
  const shown = source.filter((item) => (tab === "upload" && homepage || acceptable(item)) && (tab === "elements" ? category === "all" || categoryId(elements.find((element) => `element:${element.id}` === item.id)?.category ?? "") === category : (filter === "all" || item.mimeType.startsWith(`${filter}/`))));
  const changed = selected.join("|") !== initial.join("|");
  const resolved = selected.every((id) => choices.some((item) => item.id === id && item.url));
  const canConfirm = !uploading && !loadingAssets && resolved && (selected.length > 0 || changed);
  const limitText = maxSelected <= 0
    ? (zh ? "当前模型不支持添加参考图" : "This model doesn't support reference images")
    : zh ? `最多选 ${maxSelected} ${unit}，先取消一${unit}再选` : `Up to ${maxSelected} selected — deselect one first`;

  const commitSelected = (next: string[]) => { selectedRef.current = next; setSelected(next); };
  /** Adds or removes an item. With room for one, a new pick replaces the old;
   * when a larger selection is full, the footer says what to do. */
  const toggle = (id: string, addOnly = false) => {
    const current = selectedRef.current;
    if (current.includes(id)) { if (!addOnly) commitSelected(current.filter((item) => item !== id)); setLimitNote(false); return; }
    if (current.length < maxSelected) { commitSelected([...current, id]); setLimitNote(false); return; }
    if (maxSelected === 1) { commitSelected([id]); setLimitNote(false); return; }
    setLimitNote(true);
  };
  const selectAsset = (item: PickerAsset) => {
    if (!acceptable(item)) { setError(zh ? "这里不能选这类素材" : "This type of file can't be used here."); return; }
    setError("");
    if (onMention) {
      if (!selected.includes(item.id) && selected.length >= maxSelected) { setLimitNote(true); return; }
      onMention(item);
      return;
    }
    toggle(item.id);
  };
  const fileProblem = (file: File): string => {
    if (!homepage && videoToolAsset === "video" && !isWanVideoMime(file.type)) return zh ? "请选择 MP4 或 MOV 视频" : "Choose an MP4 or MOV.";
    if (!homepage && videoToolAsset === "image" && !["image/jpeg","image/png"].includes(file.type)) return zh ? "请选择 PNG 或 JPEG 图片" : "Choose a PNG or JPEG.";
    if (wanVideoOnly && !homepage) {
      if (!isWanVideoMime(file.type)) return zh ? "请选择 MP4 或 MOV 视频" : "Choose an MP4 or MOV video.";
      if (!file.size || file.size > WAN_REFERENCE_MAX_BYTES) return zh ? "视频不能为空或超过 10 MB" : "Choose a non-empty video up to 10 MB.";
      return "";
    }
    if (homepage && file.type.startsWith("audio/")) {
      if (!AUDIO_TYPES.has(file.type)) return zh ? "音频请使用 MP3、WAV、M4A 或 WebM" : "Use MP3, WAV, M4A, or WebM audio.";
      if (!file.size || file.size > MAX_VIDEO_BYTES) return zh ? "音频不能超过 25 MB" : "Audio must be under 25 MB.";
      return "";
    }
    if ((allowVideo || homepage) && file.type.startsWith("video/")) {
      if (!VIDEO_TYPES.has(file.type)) return zh ? "不支持这个视频格式，请用 MP4、WebM 或 MOV" : "That video format isn't supported. Use an MP4, WebM or MOV.";
      if (file.size > MAX_VIDEO_BYTES) return zh ? `视频超过 ${mb(MAX_VIDEO_BYTES)} MB，请换一个小一点的` : `That video is over ${mb(MAX_VIDEO_BYTES)} MB. Choose a smaller one.`;
      return "";
    }
    if ((allowVideo || homepage) && !file.type.startsWith("image/")) return zh ? "请选择图片、视频或音频文件" : "Choose an image, video, or audio file.";
    return validateImageFile(file, zh) ?? "";
  };
  const addFiles = async (files: FileList | File[]) => {
    if (!files.length || uploading) return;
    const batch = Array.from(files);
    const revision = uploadRevision.current;
    setTab("upload");
    setUploading(true); setError(""); setUploadProgress({ done: 0, total: batch.length });
    let failures = 0;
    for (const [index, original] of batch.entries()) {
      if (revision !== uploadRevision.current) return;
      // Some macOS file pickers omit the MIME type for MOV. The upload
      // service still decodes a preview frame and validates the stored asset.
      const inferredType = !original.type ? (/\.mov$/i.test(original.name) ? "video/quicktime" : /\.mp4$/i.test(original.name) ? "video/mp4" : homepage && /\.mp3$/i.test(original.name) ? "audio/mpeg" : homepage && /\.m4a$/i.test(original.name) ? "audio/mp4" : "") : "";
      const file = inferredType
        ? new File([original], original.name, { type: inferredType, lastModified: original.lastModified })
        : original;
      const invalid = fileProblem(file);
      if (invalid) { setError(`${original.name}: ${invalid}`); failures++; setUploadProgress({ done: index + 1, total: batch.length }); continue; }
      try {
        if (userId) {
          const isVideo = file.type.startsWith("video/");
          const isAudio = file.type.startsWith("audio/");
          const uploaded = isVideo ? await uploadWorkflowVideo(file, fetch, userId, libraryScope === "canvas" ? "canvas" : undefined).then((result) => ({ ok: true as const, key: result.key, url: result.url }))
            : isAudio ? await fetch("/api/v1/creative-space/audio-assets", { method: "POST", headers: { "X-Media-Account": userId }, body: (() => { const form = new FormData(); form.set("file", file); if (libraryScope === "canvas") form.set("scope", "canvas"); return form; })() }).then(async (response) => {
              const body = await response.json();
              if (!response.ok || !body?.data?.key || !body?.data?.signedUrl) throw new Error("audio upload failed");
              return { ok: true as const, key: body.data.key as string, url: body.data.signedUrl as string };
            }) : await uploadImage(file, fetch, userId, libraryScope === "canvas" ? "canvas" : undefined);
          if (revision !== uploadRevision.current) return;
          if (uploaded.ok) {
            const remote: PickerAsset = { id: `upload:${uploaded.key}`, name: file.name, mimeType: file.type, size: file.size, key: uploaded.key, url: uploaded.url };
            assetMutationRevision.current++;
            setAssets((current) => [remote, ...current]);
            if (batch.length === 1 && acceptable(remote)) toggle(remote.id, true);
          } else { setError(`${file.name}: ${uploadErrorText(uploaded, zh)}`); failures++; }
        } else {
          const local = await saveGuestAsset(file, userId, libraryScope);
          if (revision !== uploadRevision.current) return;
          assetMutationRevision.current++;
          setAssets((current) => [local, ...current]);
          if (batch.length === 1 && acceptable(local)) toggle(local.id, true);
        }
      } catch { if (revision === uploadRevision.current) { setError(`${file.name}: ${uploadErrorText("upload_failed", zh)}`); failures++; } }
      setUploadProgress({ done: index + 1, total: batch.length });
    }
    if (revision === uploadRevision.current) {
      setUploading(false);
      if (!failures && batch.length > 1) setError(zh ? `已上传 ${batch.length} 个文件` : `${batch.length} files uploaded`);
    }
  };
  /** Elements and brand kits built on an upload go with it. */
  const usageNote = (id: string): string => {
    const inElements = elements.filter((element) => element.assetId === id).length;
    const inBrands = brands.filter((brand) => brand.logoId === id).length;
    if (!inElements && !inBrands) return "";
    if (zh) return `同时会删掉用到它的 ${[inElements ? `${inElements} 个元素` : "", inBrands ? `${inBrands} 个品牌工具箱` : ""].filter(Boolean).join("和")}`;
    return `Also deletes ${[inElements ? `${inElements} element${inElements === 1 ? "" : "s"}` : "", inBrands ? `${inBrands} brand kit${inBrands === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ")}`;
  };
  const disarm = () => { if (armTimer.current) clearTimeout(armTimer.current); armTimer.current = null; setArmed(null); };
  const deleteAsset = async (item: PickerAsset) => {
    setDeleting(item.id); setError("");
    try {
      if (item.id.startsWith("upload:") && userId) {
        const response = await fetch(`/api/v1/library?scope=${libraryScope}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: item.key }) });
        if (!response.ok) throw new Error("delete failed");
      } else {
        await removeGuestAsset(item.id);
      }
      commitSelected(selectedRef.current.filter((id) => id !== item.id));
      setInitial((current) => current.filter((id) => id !== item.id));
      const nextElements = elements.filter((element) => element.assetId !== item.id);
      const nextBrands = brands.filter((brand) => brand.logoId !== item.id);
      setElements(nextElements); setBrands(nextBrands);
      localStorage.setItem(elementKey, JSON.stringify(nextElements));
      localStorage.setItem(brandKey, JSON.stringify(nextBrands));
      onDelete?.(item.id);
      assetMutationRevision.current++;
      // The card fades out before it leaves the grid.
      setLeaving((current) => [...current, item.id]);
      setTimeout(() => {
        setAssets((current) => current.filter((asset) => asset.id !== item.id));
        setLeaving((current) => current.filter((id) => id !== item.id));
      }, prefersReducedMotion() ? 0 : PRESENCE_EXIT_MS);
    } catch { setError(zh ? "删除失败，请重试。" : "Could not delete this upload. Try again."); }
    finally { setDeleting(null); }
  };
  const deleteManaged = async () => {
    if (!confirmDelete || deletingMany) return;
    const targets = confirmDelete === "all" ? assets : assets.filter((asset) => managed.includes(asset.id));
    setDeletingMany(true); setError("");
    const deleted = new Set<string>();
    let failed = 0;
    try {
      const remote = targets.filter((asset) => asset.id.startsWith("upload:") && asset.key && userId);
      if (userId && (confirmDelete === "all" || remote.length)) {
        const response = await fetch(`/api/v1/library?scope=${libraryScope}`, {
          method: "DELETE", headers: { "content-type": "application/json" },
          body: JSON.stringify(confirmDelete === "all" ? { all: true } : { keys: remote.map((asset) => asset.key) }),
        });
        if (!response.ok) throw new Error("delete failed");
        const body = await response.json();
        if (!body?.success || !Array.isArray(body?.data?.deletedKeys) || !Array.isArray(body?.data?.failedKeys)) throw new Error("invalid delete response");
        const deletedKeys = new Set<string>(body?.data?.deletedKeys ?? []);
        for (const asset of remote) if (asset.key && deletedKeys.has(asset.key)) deleted.add(asset.id);
        failed += (body?.data?.failedKeys ?? []).length;
      }
      for (const asset of targets.filter((item) => !item.id.startsWith("upload:"))) {
        try { await removeGuestAsset(asset.id); deleted.add(asset.id); }
        catch { failed++; }
      }
      if (deleted.size) {
        assetMutationRevision.current++;
        commitSelected(selectedRef.current.filter((id) => !deleted.has(id)));
        setInitial((current) => current.filter((id) => !deleted.has(id)));
        setManaged((current) => current.filter((id) => !deleted.has(id)));
        setAssets((current) => current.filter((asset) => !deleted.has(asset.id)));
        const nextElements = elements.filter((element) => !deleted.has(element.assetId));
        const nextBrands = brands.filter((brand) => !deleted.has(brand.logoId));
        setElements(nextElements); setBrands(nextBrands);
        localStorage.setItem(elementKey, JSON.stringify(nextElements));
        localStorage.setItem(brandKey, JSON.stringify(nextBrands));
        for (const id of deleted) onDelete?.(id);
      }
      if (failed) setError(zh ? `${failed} 个文件删除失败，请重试。` : `${failed} files could not be deleted. Try again.`);
      else setManageMode(false);
    } catch { setError(zh ? "删除失败，请重试。" : "Could not delete uploads. Try again."); }
    finally { setConfirmDelete(null); setDeletingMany(false); }
  };
  /** Delete takes two presses: the first turns the bin into a red
   * "Delete?" for a few seconds, the second deletes. */
  const pressDelete = (item: PickerAsset) => {
    if (deleting) return;
    if (armed !== item.id) {
      if (armTimer.current) clearTimeout(armTimer.current);
      setArmed(item.id);
      armedAt.current = Date.now();
      // Longer to read when the delete also takes elements or brand kits.
      const linked = elements.some((element) => element.assetId === item.id) || brands.some((brand) => brand.logoId === item.id);
      armTimer.current = setTimeout(() => { armTimer.current = null; setArmed(null); }, linked ? CONFIRM_MS + 2000 : CONFIRM_MS);
      return;
    }
    // A double-click is one intent, not "delete" and "confirm".
    if (Date.now() - armedAt.current < DOUBLE_PRESS_MS) return;
    disarm();
    void deleteAsset(item);
  };
  const acceptDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.types.includes("Files")) event.dataTransfer.dropEffect = "copy";
  };
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!event.dataTransfer.files.length) return;
    setTab("upload"); setCreate(null); setFilter("all");
    void addFiles(event.dataTransfer.files);
  };
  const saveCreation = () => {
    if (!name.trim() || !sourceId) { setError(zh ? "请填写名称并选择一张已上传的图片。" : "Enter a name and choose an uploaded image."); return; }
    if (create === "element") {
      const next = [{ id: crypto.randomUUID(), name: name.trim(), category: category === "all" ? "character" : category, assetId: sourceId }, ...elements];
      setElements(next); localStorage.setItem(elementKey, JSON.stringify(next)); setTab("elements"); setCategory("all");
    } else {
      const next = [{ id: crypto.randomUUID(), name: name.trim(), logoId: sourceId }, ...brands];
      setBrands(next); localStorage.setItem(brandKey, JSON.stringify(next)); setTab("brand");
    }
    setCreate(null); setName(""); setSourceId(""); setError("");
  };
  const limits = homepage ? (zh ? "图片 10 MB 内 · 视频/音频 25 MB 内" : "Images up to 10 MB · video/audio up to 25 MB") : videoToolAsset ? (videoToolAsset === "video" ? "MP4 / MOV · 25 MB" : "PNG / JPEG · 10 MB") : wanVideoOnly ? (zh ? "MP4 / MOV · 每段最多 10 MB" : "MP4 / MOV · up to 10 MB each") : allowVideo
    ? (zh ? `图片 ${mb(MAX_BYTES)} MB 内 · 视频 ${mb(MAX_VIDEO_BYTES)} MB 内（MP4/WebM/MOV）` : `Images up to ${mb(MAX_BYTES)} MB · videos up to ${mb(MAX_VIDEO_BYTES)} MB`)
    : (zh ? `图片 ${mb(MAX_BYTES)} MB 内` : `Images up to ${mb(MAX_BYTES)} MB`);
  const status = uploading ? "" : error || (limitNote ? limitText : "");
  const tabNames: Record<Tab, string> = { upload: zh ? "上传素材" : "Uploads", elements: zh ? "元素" : "Elements", brand: zh ? "品牌工具箱" : "Brand kit", works: zh ? "生成结果" : "Generated" };
  // The upload tile opens the file chooser; it leads the uploads grid, even
  // when there is nothing uploaded yet.
  const addTile = <button type="button" className="hmp-add" title={limits} disabled={uploading || deletingMany} onClick={() => fileInput.current?.click()}><span className="hmp-add-icon"><UploadCloud size={20} aria-hidden="true" /></span>{homepage ? (zh ? "批量上传文件" : "Upload files") : (zh ? "上传文件" : "Upload file")}</button>;
  const uploadingTile = uploading ? <output className="hmp-uploading" aria-live="polite"><Loader2 className="hmp-spin" size={24} aria-hidden="true" /><strong>{zh ? "上传中" : "Uploading"}</strong>{uploadProgress.total > 1 ? <small>{uploadProgress.done}/{uploadProgress.total}</small> : null}</output> : null;
  const deleteTargets = confirmDelete === "all" ? assets : assets.filter((asset) => managed.includes(asset.id));
  const linkedCount = elements.filter((element) => deleteTargets.some((asset) => asset.id === element.assetId)).length + brands.filter((brand) => deleteTargets.some((asset) => asset.id === brand.logoId)).length;

  // Laid out like the reference's library: a frosted panel, a row of pill
  // tabs with a round close button, then one inset shelf whose header names
  // what it shows (with its filters on the right) above a grid of square
  // tiles. Our footer stays: several files can be chosen, then confirmed.
  return createPortal(<div className="hmp-backdrop" inert={state === "closed"} data-home-library={homepage || undefined} data-mention={Boolean(mentionAnchor) || undefined} data-presence="fade" data-state={state} onDragOver={acceptDrop} onDrop={handleDrop} onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <dialog ref={dialogRef} open aria-modal="true" onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const focusRoot = confirmDelete ? event.currentTarget.querySelector(".hmp-confirm") ?? event.currentTarget : preview ? event.currentTarget.querySelector(".hmp-preview") ?? event.currentTarget : event.currentTarget;
      const targets = Array.from(focusRoot.querySelectorAll<HTMLElement>("button:not(:disabled), input:not([hidden]), select, a[href], video[controls]")).filter((el) => el.getClientRects().length);
      const first = targets[0];
      const last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} aria-label={zh ? "选择参考素材" : "Choose reference media"} className="hmp-dialog" style={mentionAnchor ? position : undefined} data-presence="dialog" data-state={state}>
      <header className="hmp-header"><nav aria-label={zh ? "素材来源" : "Media sources"}>
        {((libraryScope === "canvas" || videoToolAsset || uploadsAndWorksOnly ? ["upload","works"] : wanVideoOnly ? ["upload"] : keyframeOnly ? ["upload", "elements", "works"] : ["upload", "elements", "brand", "works"]) as Tab[]).map((item) => <button type="button" key={item} data-tab={item} className={tab === item ? "active" : ""} onClick={() => { setTab(item); setCreate(null); setFilter("all"); setCategory("all"); }} aria-current={tab === item ? "page" : undefined}>{tabNames[item]}</button>)}
      </nav><button type="button" className="hmp-close" onClick={onClose} aria-label={zh ? "关闭" : "Close"}><X size={16} /></button></header>
      <section className="hmp-shelf" aria-label={tabNames[tab]}>
      <div className="hmp-toolbar"><span className="hmp-shelf-title">{create ? (create === "element" ? (zh ? "创建元素" : "Create element") : (zh ? "创建品牌工具箱" : "Create brand kit")) : `${libraryScope === "canvas" ? (zh ? "画布 · " : "Canvas · ") : ""}${tabNames[tab]}`}</span>{create ? null : (tab === "upload" || tab === "works") ? filters.map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{({ all: zh ? "全部" : "All", video: zh ? "视频" : "Video", image: zh ? "图片" : "Image", audio: zh ? "音频" : "Audio" })[item]}</button>) : tab === "elements" ? ELEMENT_CATEGORIES.map((item) => <button type="button" key={item.id} className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)}>{zh ? item.zh : item.en}</button>) : null}{tab === "upload" && homepage ? <div className="hmp-manage-actions"><button type="button" className={manageMode ? "active" : ""} disabled={uploading || deletingMany || !assets.length} onClick={() => { setManageMode((current) => !current); setManaged([]); }}>{manageMode ? (zh ? "取消管理" : "Done") : (zh ? "批量删除" : "Select to delete")}</button>{manageMode ? <button type="button" disabled={!managed.length || deletingMany} onClick={() => setConfirmDelete("selected")}><Trash2 size={14} />{zh ? `删除所选 (${managed.length})` : `Delete selected (${managed.length})`}</button> : null}<button type="button" className="hmp-clear-all" disabled={!assets.length || uploading || deletingMany} onClick={() => setConfirmDelete("all")}><Trash2 size={14} />{zh ? "一键清空" : "Clear all"}</button></div> : null}{(tab === "elements" || tab === "brand") && !create ? <button type="button" className="hmp-toolbar-create" onClick={() => { setCreate(tab === "elements" ? "element" : "brand"); setError(""); }}><Plus size={15} />{tab === "elements" ? (zh ? "创建元素" : "Create element") : (zh ? "创建品牌工具箱" : "Create brand kit")}</button> : null}</div>
      <main className="hmp-body">
        {create ? <div className="hmp-create">
          <label>{zh ? "名称" : "Name"}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></label>
          {create === "element" ? <label>{zh ? "分类" : "Category"}<select value={category === "all" ? "character" : category} onChange={(e) => setCategory(e.target.value)}>{ELEMENT_CATEGORIES.filter((item) => item.id !== "all").map((item) => <option key={item.id} value={item.id}>{zh ? item.zh : item.en}</option>)}</select></label> : null}
          <label>{create === "element" ? (zh ? "元素图片" : "Element image") : "Logo"}<select value={sourceId} onChange={(e) => setSourceId(e.target.value)}><option value="">{zh ? "选择已上传图片" : "Choose an uploaded image"}</option>{assets.filter((a) => a.mimeType.startsWith("image/")).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <div className="hmp-create-actions"><button type="button" onClick={() => setCreate(null)}>{zh ? "取消" : "Cancel"}</button><button type="button" onClick={saveCreation}>{zh ? "保存" : "Save"}</button></div></div>
        : tab === "upload" && !shown.length ? <><div className="hmp-grid">{addTile}{uploadingTile}</div>{!uploading ? <div className="hmp-empty hmp-empty-uploads"><strong>{loadingAssets ? (zh ? "正在读取上传内容…" : "Loading your uploads…") : (zh ? "还没有上传内容" : "Nothing uploaded yet")}</strong><p>{homepage ? (zh ? "可一次选择多张图片、多段视频或音频，也可以拖入文件" : "Choose multiple images, videos, or audio files at once, or drop them here") : allowVideo ? (zh ? "点上传文件，或把图片、视频拖进来" : "Choose Upload file, or drop images or videos here") : (zh ? "点上传文件，或把图片拖进来" : "Choose Upload file, or drop images here")} · {limits}</p></div> : null}</>
        : shown.length ? <div className="hmp-grid" data-named={tab === "elements" || tab === "brand" || undefined}>{tab === "upload" ? <>{addTile}{uploadingTile}</> : null}{shown.map((item) => {
          const isSelected = manageMode && tab === "upload" ? managed.includes(item.id) : selected.includes(item.id);
          const isArmed = armed === item.id;
          const note = isArmed ? usageNote(item.id) : "";
          return <div key={item.id} className="hmp-card-wrap" data-leaving={leaving.includes(item.id) || undefined}>
            <button type="button" className={`hmp-card ${isSelected ? "selected" : ""}`} aria-pressed={isSelected} aria-label={manageMode && tab === "upload" ? (zh ? `选择删除 ${item.name}` : `Select ${item.name} for deletion`) : item.name} onClick={() => { if (manageMode && tab === "upload") setManaged((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]); else if (acceptable(item)) selectAsset(item); else setError(zh ? "此素材已保存在库中，但当前生成器不能使用" : "Saved to your library, but unavailable in this generator."); }}><span className="hmp-thumb">{item.mimeType.startsWith("image/") ? <img src={item.url} alt="" /> : item.mimeType.startsWith("video/") ? <video src={item.url} muted playsInline preload="metadata" /> : <Music2 size={32} aria-hidden="true" />}</span><span className="hmp-card-name">{item.name}</span><span className="hmp-check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span></button>
            {homepage && !onMention ? <button type="button" className="hmp-preview-button" aria-label={zh ? `预览 ${item.name}` : `Preview ${item.name}`} onClick={(event) => {
              previewOpener.current = event.currentTarget; setPreview(item);
              requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLButtonElement>(".hmp-preview-close")?.focus());
            }}><Expand size={14} /></button> : null}
            {tab === "upload" && !manageMode && (libraryScope === "global" || !item.key || item.key.includes("/canvas/")) ? <button type="button" className="hmp-delete" onKeyDown={(event) => { if (event.repeat) event.preventDefault(); }} data-armed={isArmed || undefined} data-busy={deleting === item.id || undefined} disabled={Boolean(deleting || deletingMany)} onClick={() => pressDelete(item)}
              aria-label={isArmed ? (zh ? `再按一次删除 ${item.name}${note ? `，${note}` : ""}` : `Press again to delete ${item.name}${note ? `. ${note}` : ""}`) : (zh ? `删除 ${item.name}` : `Delete ${item.name}`)}
              title={isArmed ? undefined : (zh ? "删除这个素材" : "Delete this file")}>
              {deleting === item.id ? <Loader2 className="hmp-spin" size={14} aria-hidden="true" /> : isArmed ? <span key="confirm" data-swap className="hmp-delete-confirm"><strong>{zh ? "确认删除" : "Confirm delete"}</strong>{note ? <small>{note}</small> : null}</span> : <Trash2 key="bin" size={14} aria-hidden="true" />}
            </button> : null}
          </div>;
        })}</div>
        : <div className="hmp-empty"><span className="hmp-empty-icon"><ImageIcon size={20} aria-hidden="true" /></span><strong>{tab === "elements" ? (zh ? "还没有元素" : "No elements yet") : tab === "brand" ? (zh ? "还没有品牌工具箱" : "No brand kits yet") : (zh ? "还没有作品" : "No creations yet")}</strong><p>{tab === "works" ? (allowVideo ? (zh ? "生成的图片和视频会出现在这里" : "Everything you generate will appear here.") : (zh ? "生成的图片会出现在这里" : "Your generated images will appear here.")) : (zh ? "把常用素材存起来，下次生成可以直接选用" : "Save the ones you use often and pick them straight away next time.")}</p>{tab !== "works" ? <button type="button" onClick={() => { setCreate(tab === "elements" ? "element" : "brand"); setError(""); }}><Plus size={18} />{tab === "elements" ? (zh ? "创建元素" : "Create element") : (zh ? "创建品牌工具箱" : "Create brand kit")}</button> : null}</div>}
      </main>
      </section>
      <footer className="hmp-footer"><span aria-live="polite">{deletingMany ? <><Loader2 className="hmp-spin" size={16} />{zh ? "删除中…" : "Deleting…"}</> : uploading ? <><Loader2 className="hmp-spin" size={16} />{zh ? `上传中 ${uploadProgress.done}/${uploadProgress.total}…` : `Uploading ${uploadProgress.done}/${uploadProgress.total}…`}</> : status ? <span key={status} className="hmp-status">{status}</span> : <span className="hmp-count" data-num>{manageMode && tab === "upload" ? (zh ? `已勾选 ${managed.length} 个素材` : `${managed.length} files marked`) : zh ? `已选 ${selected.length}/${maxSelected} ${unit}` : `${selected.length}/${maxSelected} selected`}</span>}</span><button type="button" disabled={manageMode || deletingMany || !canConfirm} onClick={() => { onSelect(selected.map((id) => choices.find((a) => a.id === id)).filter((a): a is PickerAsset => Boolean(a?.url))); onClose(); }}>{selected.length === 0 && changed ? (zh ? "清空已选" : "Clear selection") : (zh ? "选择" : "Select")}</button></footer>
      {preview ? <dialog open className="hmp-preview" aria-modal="true" aria-label={preview.name}>
        <button className="hmp-preview-close" type="button" aria-label={zh ? "关闭预览" : "Close preview"} onClick={closePreview}><X size={18} /></button>
        {preview.mimeType.startsWith("video/") ? <video src={preview.url} controls playsInline preload="metadata" /> : preview.mimeType.startsWith("audio/") ? <audio src={preview.url} controls /> : <img src={preview.url} alt={preview.name} />}
        <p>{preview.name}</p>
      </dialog> : null}
      {confirmDelete ? <div className="hmp-confirm-backdrop"><div className="hmp-confirm" role="alertdialog" aria-modal="true" aria-labelledby="hmp-confirm-title" aria-describedby="hmp-confirm-detail"><h2 id="hmp-confirm-title">{confirmDelete === "all" ? (zh ? "清空上传素材库？" : "Clear all uploads?") : (zh ? `删除选中的 ${deleteTargets.length} 个素材？` : `Delete ${deleteTargets.length} selected files?`)}</h2><p id="hmp-confirm-detail">{confirmDelete === "all" ? (zh ? "这会永久删除你上传的所有图片、视频和音频，无法撤销。" : "This permanently deletes every uploaded image, video, and audio file. It cannot be undone.") : (zh ? "所选素材将永久删除，无法撤销。" : "Selected files will be permanently deleted. This cannot be undone.")}{linkedCount ? (zh ? ` 同时会删除使用这些素材的 ${linkedCount} 个元素或品牌工具箱。` : ` ${linkedCount} linked elements or brand kits will also be removed.`) : ""}</p><div className="hmp-confirm-actions"><button type="button" autoFocus disabled={deletingMany} onClick={() => setConfirmDelete(null)}>{zh ? "取消" : "Cancel"}</button><button type="button" className="danger" disabled={deletingMany} onClick={() => void deleteManaged()}>{deletingMany ? (zh ? "删除中…" : "Deleting…") : (zh ? "确认删除" : "Delete permanently")}</button></div></div></div> : null}
      <input ref={fileInput} type="file" accept={homepage ? "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/webm" : videoToolAsset === "image" ? "image/jpeg,image/png" : (wanVideoOnly || videoToolAsset === "video") ? "video/mp4,video/quicktime" : allowVideo ? "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp,image/gif"} multiple hidden onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = ""; }} />
    </dialog>
  </div>, document.body);
}
