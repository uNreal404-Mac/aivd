"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Film, Image as ImageIcon, Loader2, Plus, UploadCloud, X } from "lucide-react";
import { uploadImage, validateImageFile } from "@/lib/image-to-video";
import { listGuestAssets, removeGuestAsset, saveGuestAsset, type PickerAsset } from "@/lib/home-media-library";
import { uploadWorkflowVideo } from "@/lib/creative-space/upload-video";
import "./home-media-picker.css";

type Tab = "upload" | "elements" | "brand" | "works";
type Filter = "all" | "video" | "image" | "audio";
type Element = { id: string; name: string; category: string; assetId: string };
type Brand = { id: string; name: string; logoId: string; colors: string; fonts: string; guidelines: string };
const ELEMENT_CATEGORIES = [
  { id: "all", zh: "全部", en: "All" },
  { id: "product", zh: "产品", en: "Product" },
  { id: "character", zh: "角色", en: "Character" },
  { id: "scene", zh: "场景", en: "Scene" },
  { id: "style", zh: "风格", en: "Style" },
  { id: "prop", zh: "道具", en: "Prop" },
] as const;
function categoryId(value: string): string {
  return ELEMENT_CATEGORIES.find((item) => item.id === value || item.zh === value)?.id ?? "character";
}

function saved<T>(key: string): T[] {
  try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}

export function HomeMediaPicker({ lang, open, onClose, onSelect, onDelete, maxSelected, selectedIds, userId, acceptedTypes = ["image"] }: {
  lang: string; open: boolean; onClose: () => void; onSelect: (assets: PickerAsset[]) => void; onDelete?: (id: string) => void;
  maxSelected: number; selectedIds: string[]; userId?: string; acceptedTypes?: Array<"image" | "video">;
}) {
  const zh = lang.toLowerCase().startsWith("zh");
  const allowVideo = acceptedTypes.includes("video");
  const [tab, setTab] = useState<Tab>("upload");
  const [filter, setFilter] = useState<Filter>("all");
  const [assets, setAssets] = useState<PickerAsset[]>([]);
  const [works, setWorks] = useState<PickerAsset[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [create, setCreate] = useState<"element" | "brand" | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("all");
  const [colors, setColors] = useState("");
  const [fonts, setFonts] = useState("");
  const [guidelines, setGuidelines] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const scope = userId || "guest";
  const elementKey = `aivd:elements:${scope}`;
  const brandKey = `aivd:brands:${scope}`;

  useEffect(() => {
    if (!open) return;
    let live = true;
    setSelected(selectedIds);
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
    const local = listGuestAssets().catch(() => { if (live) setError(zh ? "无法读取本机素材库。" : "Could not read local uploads."); return [] as PickerAsset[]; });
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
      void Promise.all((["video", "image", "audio"] as const).map((type) => fetch(`/api/v1/video/list?type=${type}&limit=60`, { cache: "no-store" }).then((r) => r.json()).catch(() => null))).then((bodies) => {
        if (!live) return;
        const rows: any[] = bodies.flatMap((body) => Array.isArray(body?.data?.videos) ? body.data.videos : []);
        setWorks(rows.flatMap((row) => {
          const urls = Array.isArray(row.mediaUrls) ? row.mediaUrls : row.videoUrl ? [row.videoUrl] : [];
          return urls.map((url: string, index: number) => ({ id: `work:${row.uuid}:${index}`, name: row.prompt || row.model || (zh ? "作品" : "Creation"), mimeType: `${row.mediaType || "video"}/generated`, url, key: url }));
        }));
      }).catch(() => {});
    }
    return () => { live = false; };
  }, [open, userId, elementKey, brandKey, zh, selectedIds.join("|")]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const source = tab === "works" ? works : tab === "upload" ? assets : tab === "elements"
    ? elements.map((item) => ({ ...assets.find((asset) => asset.id === item.assetId), id: `element:${item.id}`, name: item.name } as PickerAsset))
    : brands.map((item) => ({ ...assets.find((asset) => asset.id === item.logoId), id: `brand:${item.id}`, name: item.name } as PickerAsset));
  const choices = [...assets, ...works,
    ...elements.map((item) => ({ ...assets.find((asset) => asset.id === item.assetId), id: `element:${item.id}`, name: item.name } as PickerAsset)),
    ...brands.map((item) => ({ ...assets.find((asset) => asset.id === item.logoId), id: `brand:${item.id}`, name: item.name } as PickerAsset))];
  const shown = source.filter((item) => item.url && (tab === "elements" ? category === "all" || categoryId(elements.find((element) => `element:${element.id}` === item.id)?.category ?? "") === category : (filter === "all" || item.mimeType?.startsWith(`${filter}/`))));
  const selectAsset = (item: PickerAsset) => {
    if (!item.mimeType || !acceptedTypes.some((type) => item.mimeType.startsWith(`${type}/`))) { setError(zh ? "当前生成器不支持该素材格式。" : "This generator does not accept this media type."); return; }
    setError("");
    setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id)
      : current.length < maxSelected ? [...current, item.id] : current);
  };
  const addFiles = async (files: FileList | File[]) => {
    if (!files.length || busy) return;
    setBusy(true); setError("");
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/");
      const invalid = isVideo && allowVideo
        ? (!new Set(["video/mp4", "video/webm", "video/quicktime"]).has(file.type) || file.size > 25 * 1024 * 1024 ? (zh ? "视频需为 MP4、WebM 或 MOV，且不超过 25 MB。" : "Use an MP4, WebM, or MOV video up to 25 MB.") : "")
        : validateImageFile(file);
      if (invalid) { setError(invalid); continue; }
      try {
        if (userId) {
          const uploaded = isVideo ? await uploadWorkflowVideo(file).then((result) => ({ ok: true as const, key: result.key, url: result.url })) : await uploadImage(file);
          if (uploaded.ok) {
            const remote: PickerAsset = { id: `upload:${uploaded.key}`, name: file.name, mimeType: file.type, key: uploaded.key, url: uploaded.url };
            setAssets((current) => [remote, ...current]);
            setSelected((current) => current.length < maxSelected ? [...current, remote.id] : current);
          } else { setError(uploaded.message); }
        } else {
          const local = await saveGuestAsset(file);
          setAssets((current) => [local, ...current]);
          setSelected((current) => current.length < maxSelected ? [...current, local.id] : current);
        }
      } catch { setError(zh ? "上传失败，请重试。" : "Upload failed. Try again."); }
    }
    setBusy(false);
  };
  const deleteAsset = async (item: PickerAsset) => {
    setBusy(true); setError("");
    try {
      if (item.id.startsWith("upload:") && userId) {
        const response = await fetch("/api/v1/library", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: item.key }) });
        if (!response.ok) throw new Error("delete failed");
      } else {
        await removeGuestAsset(item.id);
      }
      setAssets((current) => current.filter((asset) => asset.id !== item.id));
      setSelected((current) => current.filter((id) => id !== item.id));
      const nextElements = elements.filter((element) => element.assetId !== item.id);
      const nextBrands = brands.filter((brand) => brand.logoId !== item.id);
      setElements(nextElements); setBrands(nextBrands);
      localStorage.setItem(elementKey, JSON.stringify(nextElements));
      localStorage.setItem(brandKey, JSON.stringify(nextBrands));
      onDelete?.(item.id);
    } catch { setError(zh ? "删除失败，请重试。" : "Could not delete this upload. Try again."); }
    finally { setBusy(false); }
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
      const next = [{ id: crypto.randomUUID(), name: name.trim(), logoId: sourceId, colors, fonts, guidelines }, ...brands];
      setBrands(next); localStorage.setItem(brandKey, JSON.stringify(next)); setTab("brand");
    }
    setCreate(null); setName(""); setSourceId(""); setError("");
  };
  return createPortal(<div className="hmp-backdrop" onDragOver={acceptDrop} onDrop={handleDrop} onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <dialog open aria-modal="true" aria-label={zh ? "选择参考素材" : "Choose reference media"} className="hmp-dialog">
      <header className="hmp-header"><nav aria-label={zh ? "素材来源" : "Media sources"}>
        {(["upload", "elements", "brand", "works"] as Tab[]).map((item) => <button type="button" key={item} className={tab === item ? "active" : ""} onClick={() => { setTab(item); setCreate(null); setFilter("all"); setCategory("all"); }} aria-current={tab === item ? "page" : undefined}>{({ upload: zh ? "上传内容" : "Uploads", elements: zh ? "元素" : "Elements", brand: zh ? "品牌工具箱" : "Brand kit", works: zh ? "作品" : "Creations" })[item]}</button>)}
      </nav><button type="button" onClick={onClose} aria-label={zh ? "关闭" : "Close"}><X size={22} /></button></header>
      <div className="hmp-toolbar">{(tab === "upload" || tab === "works") ? (["all", "video", "image", "audio"] as Filter[]).map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{({ all: zh ? "全部" : "All", video: zh ? "视频" : "Video", image: zh ? "图像" : "Image", audio: zh ? "音频" : "Audio" })[item]}</button>) : tab === "elements" ? ELEMENT_CATEGORIES.map((item) => <button type="button" key={item.id} className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)}>{zh ? item.zh : item.en}</button>) : null}{(tab === "elements" || tab === "brand") && !create ? <button type="button" className="hmp-toolbar-create" onClick={() => { setCreate(tab === "elements" ? "element" : "brand"); setError(""); }}><Plus size={15} />{tab === "elements" ? (zh ? "创建元素" : "Create element") : (zh ? "创建品牌工具箱" : "Create brand kit")}</button> : null}</div>
      <main className="hmp-body">
        {create ? <div className="hmp-create"><h3>{create === "element" ? (zh ? "创建元素" : "Create element") : (zh ? "创建品牌工具箱" : "Create brand kit")}</h3>
          <label>{zh ? "名称" : "Name"}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></label>
          {create === "element" ? <label>{zh ? "分类" : "Category"}<select value={category === "all" ? "character" : category} onChange={(e) => setCategory(e.target.value)}>{ELEMENT_CATEGORIES.filter((item) => item.id !== "all").map((item) => <option key={item.id} value={item.id}>{zh ? item.zh : item.en}</option>)}</select></label> : <><label>{zh ? "品牌颜色" : "Brand colors"}<input value={colors} onChange={(e) => setColors(e.target.value)} placeholder={zh ? "例如：青绿色、深灰色" : "e.g. teal, charcoal"} /></label><label>{zh ? "字体" : "Fonts"}<input value={fonts} onChange={(e) => setFonts(e.target.value)} /></label><label>{zh ? "品牌指南" : "Guidelines"}<textarea value={guidelines} onChange={(e) => setGuidelines(e.target.value)} /></label></>}
          <label>{create === "element" ? (zh ? "元素图片" : "Element image") : (zh ? "Logo" : "Logo")}<select value={sourceId} onChange={(e) => setSourceId(e.target.value)}><option value="">{zh ? "选择已上传图片" : "Choose an uploaded image"}</option>{assets.filter((a) => a.mimeType.startsWith("image/")).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <div className="hmp-create-actions"><button type="button" onClick={() => setCreate(null)}>{zh ? "取消" : "Cancel"}</button><button type="button" onClick={saveCreation}>{zh ? "保存" : "Save"}</button></div></div>
        : tab === "upload" && !shown.length ? <button type="button" className="hmp-drop" onClick={() => fileInput.current?.click()}><UploadCloud size={40} /><strong>{allowVideo ? (zh ? "将图片或视频拖放到此处或点击上传" : "Drop images or videos here, or click to upload") : (zh ? "将图片拖放到此处或点击上传" : "Drop images here or click to upload")}</strong><span>{allowVideo ? "PNG · JPG · WebP · GIF · MP4 · WebM · MOV · 视频 25 MB" : "PNG · JPG · WebP · GIF · 10 MB"}</span></button>
        : shown.length ? <div className="hmp-grid">{tab === "upload" ? <button type="button" className="hmp-add" onClick={() => fileInput.current?.click()}><Plus />{allowVideo ? (zh ? "上传素材" : "Upload media") : (zh ? "上传图片" : "Upload image")}</button> : null}{shown.map((item) => <div key={item.id} className="hmp-card-wrap"><button type="button" className={`hmp-card ${selected.includes(item.id) ? "selected" : ""}`} onClick={() => selectAsset(item)}><span className="hmp-thumb">{item.mimeType.startsWith("image/") ? <img src={item.url} alt="" /> : <Film />}</span><span className="hmp-card-name">{item.name}</span><span className="hmp-check">{selected.includes(item.id) ? "✓" : ""}</span></button>{tab === "upload" ? <button type="button" className="hmp-delete" disabled={busy} onClick={() => void deleteAsset(item)} aria-label={zh ? `删除 ${item.name}` : `Delete ${item.name}`} title={zh ? "删除上传内容" : "Delete upload"}><X size={14} /></button> : null}</div>)}</div>
        : <div className="hmp-empty"><ImageIcon size={42} /><strong>{tab === "elements" ? (zh ? "暂无元素" : "No elements yet") : tab === "brand" ? (zh ? "暂无品牌工具箱" : "No brand kits yet") : (zh ? "暂无作品" : "No creations yet")}</strong><p>{tab === "works" ? (zh ? "生成的图片、视频和音频会显示在这里。" : "Your generated media will appear here.") : (zh ? "创建后可在多次生成中重复使用。" : "Create one to reuse it in future generations.")}</p>{tab !== "works" ? <button type="button" onClick={() => { setCreate(tab === "elements" ? "element" : "brand"); setError(""); }}><Plus size={18} />{tab === "elements" ? (zh ? "创建元素" : "Create element") : (zh ? "创建品牌工具箱" : "Create brand kit")}</button> : null}</div>}
      </main>
      <div className="hmp-count">{zh ? "已选择" : "Selected"} {selected.length}/{maxSelected} · {zh ? "图像" : "Images"} {assets.filter((a) => a.mimeType.startsWith("image/")).length}</div>
      <footer className="hmp-footer"><span>{busy ? <><Loader2 className="hmp-spin" size={16} />{zh ? "上传中…" : "Uploading…"}</> : error}</span><button type="button" disabled={!selected.length || busy} onClick={() => { onSelect(selected.map((id) => choices.find((a) => a.id === id)).filter((a): a is PickerAsset => Boolean(a?.url))); onClose(); }}>{zh ? "选择" : "Select"}</button></footer>
      <input ref={fileInput} type="file" accept={allowVideo ? "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp,image/gif"} multiple hidden onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = ""; }} />
    </dialog>
  </div>, document.body);
}
