"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Film, Image as ImageIcon, Loader2, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { MAX_BYTES, uploadErrorText, uploadImage, validateImageFile } from "@/lib/image-to-video";
import { listGuestAssets, removeGuestAsset, saveGuestAsset, type PickerAsset } from "@/lib/home-media-library";
import { uploadWorkflowVideo } from "@/lib/creative-space/upload-video";
import { PRESENCE_EXIT_MS, usePresence } from "@/hooks/use-presence";
import { prefersReducedMotion } from "@/lib/reduced-motion";
import "./home-media-picker.css";

type Tab = "upload" | "elements" | "brand" | "works";
type MediaType = "image" | "video";
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
/** Same limit as lib/creative-space/upload-video and the video-assets route. */
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
/** How long a pressed delete waits for its second press. */
const CONFIRM_MS = 3000;
const DOUBLE_PRESS_MS = 400;
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

export function HomeMediaPicker({ lang, open, onClose, onSelect, onDelete, maxSelected, selectedIds, userId, acceptedTypes = ["image"] }: {
  lang: string; open: boolean; onClose: () => void; onSelect: (assets: PickerAsset[]) => void; onDelete?: (id: string) => void;
  maxSelected: number; selectedIds: string[]; userId?: string; acceptedTypes?: MediaType[];
}) {
  const zh = lang.toLowerCase().startsWith("zh");
  const allowVideo = acceptedTypes.includes("video");
  const typesKey = acceptedTypes.join("|");
  const unit = zh ? (allowVideo ? "个" : "张") : "";
  const { mounted, state } = usePresence(open);
  const [tab, setTab] = useState<Tab>("upload");
  const [filter, setFilter] = useState<Filter>("all");
  const [assets, setAssets] = useState<PickerAsset[]>([]);
  const [works, setWorks] = useState<PickerAsset[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [initial, setInitial] = useState<string[]>([]);
  const [limitNote, setLimitNote] = useState(false);
  const [elements, setElements] = useState<Element[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [create, setCreate] = useState<"element" | "brand" | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("all");
  const [sourceId, setSourceId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string[]>([]);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<string[]>([]);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armedAt = useRef(0);
  const scope = userId || "guest";
  const elementKey = `aivd:elements:${scope}`;
  const brandKey = `aivd:brands:${scope}`;

  // selectedIds and acceptedTypes are compared by value, so a parent passing
  // a new array on every render does not reload the library.
  useEffect(() => {
    if (!open) return;
    let live = true;
    selectedRef.current = selectedIds;
    setSelected(selectedIds); setInitial(selectedIds); setLimitNote(false); setFilter("all");
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
    setAssets([]);
    const local = listGuestAssets().catch(() => { if (live) setError(zh ? "暂时读取不到保存在这台设备上的素材，请刷新或重新上传" : "Couldn't load uploads saved on this device. Refresh or upload again."); return [] as PickerAsset[]; });
    const remote = userId
      ? fetch("/api/v1/library", { cache: "no-store" }).then((response) => response.json()).then((body) => Array.isArray(body?.data?.assets) ? body.data.assets as PickerAsset[] : []).catch(() => [] as PickerAsset[])
      : Promise.resolve([] as PickerAsset[]);
    void Promise.all([local, remote]).then(([localAssets, remoteAssets]) => {
      if (live) setAssets((current) => {
        const merged = [...current, ...localAssets, ...remoteAssets];
        return merged.filter((asset, index) => merged.findIndex((item) => item.id === asset.id) === index);
      });
    });
    if (userId) {
      // Only ask for the kinds of creations this caller can use.
      void Promise.all(typesKey.split("|").filter(Boolean).map((type) => fetch(`/api/v1/video/list?type=${type}&limit=60`, { cache: "no-store" }).then((r) => r.json()).catch(() => null))).then((bodies) => {
        if (!live) return;
        const rows: any[] = bodies.flatMap((body) => Array.isArray(body?.data?.videos) ? body.data.videos : []);
        setWorks(rows.flatMap((row) => {
          const urls = Array.isArray(row.mediaUrls) ? row.mediaUrls : row.videoUrl ? [row.videoUrl] : [];
          return urls.map((url: string, index: number) => ({ id: `work:${row.uuid}:${index}`, name: row.prompt || row.model || (zh ? "作品" : "Creation"), mimeType: `${row.mediaType || "video"}/generated`, url, key: url }));
        }));
      }).catch(() => {});
    }
    return () => { live = false; };
  }, [open, userId, elementKey, brandKey, zh, selectedIds.join("|"), typesKey]);

  useEffect(() => {
    if (!open) return;
    // Escape first takes back a pending delete, then closes.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (armed) { if (armTimer.current) clearTimeout(armTimer.current); armTimer.current = null; setArmed(null); return; }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, armed]);

  useEffect(() => () => { if (armTimer.current) clearTimeout(armTimer.current); }, []);

  if (!mounted) return null;
  const acceptable = (item: PickerAsset) => Boolean(item.url) && acceptedTypes.some((type) => item.mimeType?.startsWith(`${type}/`));
  const elementAssets = elements.map((item) => ({ ...assets.find((asset) => asset.id === item.assetId), id: `element:${item.id}`, name: item.name } as PickerAsset));
  const brandAssets = brands.map((item) => ({ ...assets.find((asset) => asset.id === item.logoId), id: `brand:${item.id}`, name: item.name } as PickerAsset));
  const source = tab === "works" ? works : tab === "upload" ? assets : tab === "elements" ? elementAssets : brandAssets;
  const choices = [...assets, ...works, ...elementAssets, ...brandAssets];
  // Items this caller cannot take are not listed, and a type filter only
  // appears when there is more than one type to choose between.
  const filters: Filter[] = acceptedTypes.length > 1 ? ["all", ...(["video", "image"] as const).filter((type) => acceptedTypes.includes(type))] : [];
  const shown = source.filter((item) => acceptable(item) && (tab === "elements" ? category === "all" || categoryId(elements.find((element) => `element:${element.id}` === item.id)?.category ?? "") === category : (filter === "all" || item.mimeType.startsWith(`${filter}/`))));
  const changed = selected.join("|") !== initial.join("|");
  const canConfirm = !uploading && (selected.length > 0 || changed);
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
    toggle(item.id);
  };
  const fileProblem = (file: File): string => {
    if (allowVideo && file.type.startsWith("video/")) {
      if (!VIDEO_TYPES.has(file.type)) return zh ? "不支持这个视频格式，请用 MP4、WebM 或 MOV" : "That video format isn't supported. Use an MP4, WebM or MOV.";
      if (file.size > MAX_VIDEO_BYTES) return zh ? `视频超过 ${mb(MAX_VIDEO_BYTES)} MB，请换一个小一点的` : `That video is over ${mb(MAX_VIDEO_BYTES)} MB. Choose a smaller one.`;
      return "";
    }
    if (allowVideo && !file.type.startsWith("image/")) return zh ? "请选择图片或视频文件" : "Choose an image or video file.";
    return validateImageFile(file, zh) ?? "";
  };
  const addFiles = async (files: FileList | File[]) => {
    if (!files.length || uploading) return;
    setUploading(true); setError("");
    for (const file of Array.from(files)) {
      const invalid = fileProblem(file);
      if (invalid) { setError(invalid); continue; }
      try {
        if (userId) {
          const isVideo = file.type.startsWith("video/");
          const uploaded = isVideo ? await uploadWorkflowVideo(file).then((result) => ({ ok: true as const, key: result.key, url: result.url })) : await uploadImage(file);
          if (uploaded.ok) {
            const remote: PickerAsset = { id: `upload:${uploaded.key}`, name: file.name, mimeType: file.type, key: uploaded.key, url: uploaded.url };
            setAssets((current) => [remote, ...current]);
            toggle(remote.id, true);
          } else { setError(uploadErrorText(uploaded, zh)); }
        } else {
          const local = await saveGuestAsset(file);
          setAssets((current) => [local, ...current]);
          toggle(local.id, true);
        }
      } catch { setError(uploadErrorText("upload_failed", zh)); }
    }
    setUploading(false);
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
  // Closing the library cancels a half-done delete: reopening never starts
  // with a bin already armed.
  useEffect(() => { if (!open) disarm(); }, [open]);
  const deleteAsset = async (item: PickerAsset) => {
    setDeleting(item.id); setError("");
    try {
      if (item.id.startsWith("upload:") && userId) {
        const response = await fetch("/api/v1/library", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: item.key }) });
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
      // The card fades out before it leaves the grid.
      setLeaving((current) => [...current, item.id]);
      setTimeout(() => {
        setAssets((current) => current.filter((asset) => asset.id !== item.id));
        setLeaving((current) => current.filter((id) => id !== item.id));
      }, prefersReducedMotion() ? 0 : PRESENCE_EXIT_MS);
    } catch { setError(zh ? "删除失败，请重试。" : "Could not delete this upload. Try again."); }
    finally { setDeleting(null); }
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
  const limits = allowVideo
    ? (zh ? `图片 ${mb(MAX_BYTES)} MB 内 · 视频 ${mb(MAX_VIDEO_BYTES)} MB 内（MP4/WebM/MOV）` : `Images up to ${mb(MAX_BYTES)} MB · videos up to ${mb(MAX_VIDEO_BYTES)} MB`)
    : (zh ? `图片 ${mb(MAX_BYTES)} MB 内` : `Images up to ${mb(MAX_BYTES)} MB`);
  const showToolbar = ((tab === "upload" || tab === "works") && filters.length > 0) || tab === "elements" || (tab === "brand" && !create);
  const status = uploading ? "" : error || (limitNote ? limitText : "");

  return createPortal(<div className="hmp-backdrop" data-presence="fade" data-state={state} onDragOver={acceptDrop} onDrop={handleDrop} onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <dialog open aria-modal="true" aria-label={zh ? "选择参考素材" : "Choose reference media"} className="hmp-dialog" data-presence="dialog" data-state={state}>
      <header className="hmp-header"><nav aria-label={zh ? "素材来源" : "Media sources"}>
        {(["upload", "elements", "brand", "works"] as Tab[]).map((item) => <button type="button" key={item} className={tab === item ? "active" : ""} onClick={() => { setTab(item); setCreate(null); setFilter("all"); setCategory("all"); }} aria-current={tab === item ? "page" : undefined}>{({ upload: zh ? "上传内容" : "Uploads", elements: zh ? "元素" : "Elements", brand: zh ? "品牌工具箱" : "Brand kit", works: zh ? "作品" : "Creations" })[item]}</button>)}
      </nav><button type="button" onClick={onClose} aria-label={zh ? "关闭" : "Close"}><X size={22} /></button></header>
      {showToolbar ? <div className="hmp-toolbar">{(tab === "upload" || tab === "works") ? filters.map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{({ all: zh ? "全部" : "All", video: zh ? "视频" : "Video", image: zh ? "图片" : "Image" })[item]}</button>) : tab === "elements" ? ELEMENT_CATEGORIES.map((item) => <button type="button" key={item.id} className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)}>{zh ? item.zh : item.en}</button>) : null}{(tab === "elements" || tab === "brand") && !create ? <button type="button" className="hmp-toolbar-create" onClick={() => { setCreate(tab === "elements" ? "element" : "brand"); setError(""); }}><Plus size={15} />{tab === "elements" ? (zh ? "创建元素" : "Create element") : (zh ? "创建品牌工具箱" : "Create brand kit")}</button> : null}</div> : null}
      <main className="hmp-body">
        {create ? <div className="hmp-create"><h3>{create === "element" ? (zh ? "创建元素" : "Create element") : (zh ? "创建品牌工具箱" : "Create brand kit")}</h3>
          <label>{zh ? "名称" : "Name"}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></label>
          {create === "element" ? <label>{zh ? "分类" : "Category"}<select value={category === "all" ? "character" : category} onChange={(e) => setCategory(e.target.value)}>{ELEMENT_CATEGORIES.filter((item) => item.id !== "all").map((item) => <option key={item.id} value={item.id}>{zh ? item.zh : item.en}</option>)}</select></label> : null}
          <label>{create === "element" ? (zh ? "元素图片" : "Element image") : "Logo"}<select value={sourceId} onChange={(e) => setSourceId(e.target.value)}><option value="">{zh ? "选择已上传图片" : "Choose an uploaded image"}</option>{assets.filter((a) => a.mimeType.startsWith("image/")).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <div className="hmp-create-actions"><button type="button" onClick={() => setCreate(null)}>{zh ? "取消" : "Cancel"}</button><button type="button" onClick={saveCreation}>{zh ? "保存" : "Save"}</button></div></div>
        : tab === "upload" && !shown.length ? <button type="button" className="hmp-drop" onClick={() => fileInput.current?.click()}><UploadCloud size={40} /><strong>{allowVideo ? (zh ? "拖入图片或视频，或点击上传" : "Drop images or videos here, or click to upload") : (zh ? "拖入图片，或点击上传" : "Drop images here, or click to upload")}</strong><span>{limits}</span></button>
        : shown.length ? <div className="hmp-grid">{tab === "upload" ? <button type="button" className="hmp-add" onClick={() => fileInput.current?.click()}><Plus />{allowVideo ? (zh ? "上传素材" : "Upload media") : (zh ? "上传图片" : "Upload image")}</button> : null}{shown.map((item) => {
          const isSelected = selected.includes(item.id);
          const isArmed = armed === item.id;
          const note = isArmed ? usageNote(item.id) : "";
          return <div key={item.id} className="hmp-card-wrap" data-leaving={leaving.includes(item.id) || undefined}>
            <button type="button" className={`hmp-card ${isSelected ? "selected" : ""}`} aria-pressed={isSelected} onClick={() => selectAsset(item)}><span className="hmp-thumb">{item.mimeType.startsWith("image/") ? <img src={item.url} alt="" /> : <Film />}</span><span className="hmp-card-name">{item.name}</span><span className="hmp-check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span></button>
            {tab === "upload" ? <button type="button" className="hmp-delete" data-armed={isArmed || undefined} data-busy={deleting === item.id || undefined} disabled={Boolean(deleting)} onClick={() => pressDelete(item)}
              aria-label={isArmed ? (zh ? `再按一次删除 ${item.name}${note ? `，${note}` : ""}` : `Press again to delete ${item.name}${note ? `. ${note}` : ""}`) : (zh ? `删除 ${item.name}` : `Delete ${item.name}`)}
              title={isArmed ? undefined : (zh ? "删除这个素材" : "Delete this file")}>
              {deleting === item.id ? <Loader2 className="hmp-spin" size={14} aria-hidden="true" /> : isArmed ? <span key="confirm" data-swap className="hmp-delete-confirm"><strong>{zh ? "确认删除" : "Confirm delete"}</strong>{note ? <small>{note}</small> : null}</span> : <Trash2 key="bin" size={14} aria-hidden="true" />}
            </button> : null}
          </div>;
        })}</div>
        : <div className="hmp-empty"><ImageIcon size={42} /><strong>{tab === "elements" ? (zh ? "还没有元素" : "No elements yet") : tab === "brand" ? (zh ? "还没有品牌工具箱" : "No brand kits yet") : (zh ? "还没有作品" : "No creations yet")}</strong><p>{tab === "works" ? (allowVideo ? (zh ? "生成的图片和视频会出现在这里" : "Everything you generate will appear here.") : (zh ? "生成的图片会出现在这里" : "Your generated images will appear here.")) : (zh ? "把常用素材存起来，下次生成可以直接选用" : "Save the ones you use often and pick them straight away next time.")}</p>{tab !== "works" ? <button type="button" onClick={() => { setCreate(tab === "elements" ? "element" : "brand"); setError(""); }}><Plus size={18} />{tab === "elements" ? (zh ? "创建元素" : "Create element") : (zh ? "创建品牌工具箱" : "Create brand kit")}</button> : null}</div>}
      </main>
      <div className="hmp-count" data-num>{zh ? `已选 ${selected.length}/${maxSelected} ${unit}` : `${selected.length}/${maxSelected} selected`}</div>
      <footer className="hmp-footer"><span aria-live="polite">{uploading ? <><Loader2 className="hmp-spin" size={16} />{zh ? "上传中…" : "Uploading…"}</> : status ? <span key={status} className="hmp-status">{status}</span> : null}</span><button type="button" disabled={!canConfirm} onClick={() => { onSelect(selected.map((id) => choices.find((a) => a.id === id)).filter((a): a is PickerAsset => Boolean(a?.url))); onClose(); }}>{selected.length === 0 && changed ? (zh ? "清空已选" : "Clear selection") : (zh ? "选择" : "Select")}</button></footer>
      <input ref={fileInput} type="file" accept={allowVideo ? "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp,image/gif"} multiple hidden onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = ""; }} />
    </dialog>
  </div>, document.body);
}
