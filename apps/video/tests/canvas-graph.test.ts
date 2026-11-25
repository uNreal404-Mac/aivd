import { describe, expect, it, vi } from "vitest";

import {
  arrangeBoxes,
  checkConnection,
  directInputs,
  fromLegacyLocalCanvas,
  fromStoredGraph,
  isUploadKey,
  kindsAccepting,
  inputText,
  selectionWithChildren,
  withoutGraphSelection,
  worldPosition,
  submitKey,
  toStoredGraph,
  type CanvasData,
  type GraphEdge,
  type GraphNode,
} from "@/lib/creative-space/canvas-graph";
import { postGeneration } from "@/lib/creative-space/canvas-submit";
import { parseWorkflowPayload } from "@/lib/creative-space/workflow-graph";

const at = (id: string, data: CanvasData, x = 0, y = 0): GraphNode => ({ id, position: { x, y }, data });
const text = (id: string, value = "a cat") => at(id, { kind: "text", title: "T", text: value });
const image = (id: string, extra: Partial<CanvasData> = {}) =>
  at(id, { kind: "image", title: "I", prompt: "", modelId: "seedream-5-5", status: "idle", ...extra } as CanvasData);
const video = (id: string) => at(id, { kind: "video", title: "V", prompt: "", modelId: "veo-3.1", status: "idle" });
const audio = (id: string) => at(id, { kind: "audio", title: "A", prompt: "", modelId: "elevenlabs-v3", status: "idle" });
const media = (id: string, kind: "image" | "video" | "audio") => at(id, { kind: "media", media: kind, title: "M", mime: `${kind}/png`, assetKey: "uploads/u/a.png" });

describe("typed connections", () => {
  const nodes = [text("t"), image("i"), video("v"), audio("a"), media("mv", "video"), media("mi", "image")];

  it("accepts wires whose type the target takes", () => {
    expect(checkConnection("t", "i", nodes, [])).toEqual({ ok: true });
    expect(checkConnection("i", "v", nodes, [])).toEqual({ ok: true });
    expect(checkConnection("mi", "v", nodes, [])).toEqual({ ok: true });
  });

  it("rejects wrong types, self, duplicates and loops", () => {
    expect(checkConnection("mv", "i", nodes, [])).toEqual({ ok: false, reason: "type" });
    expect(checkConnection("i", "a", nodes, [])).toEqual({ ok: false, reason: "type" });
    expect(checkConnection("i", "i", nodes, [])).toEqual({ ok: false, reason: "self" });
    expect(checkConnection("v", "t", nodes, [])).toEqual({ ok: true });
    expect(checkConnection("a", "t", nodes, [])).toEqual({ ok: false, reason: "type" });
    const edges: GraphEdge[] = [{ id: "e", source: "t", target: "i" }];
    expect(checkConnection("t", "i", nodes, edges)).toEqual({ ok: false, reason: "duplicate" });
    const loop = [image("i1"), image("i2"), image("i3")];
    const chain: GraphEdge[] = [{ id: "a", source: "i1", target: "i2" }, { id: "b", source: "i2", target: "i3" }];
    expect(checkConnection("i3", "i1", loop, chain)).toEqual({ ok: false, reason: "cycle" });
  });

  it("lists which nodes a dropped wire can create", () => {
    expect(kindsAccepting("text").sort()).toEqual(["agent", "audio", "image", "text", "video"]);
    expect(kindsAccepting("video").sort()).toEqual(["agent", "text"]);
  });

  it("reads direct inputs in wire order", () => {
    const edges: GraphEdge[] = [{ id: "1", source: "mi", target: "v" }, { id: "2", source: "t", target: "v" }];
    expect(directInputs("v", nodes, edges).map((node) => node.id)).toEqual(["mi", "t"]);
  });
});

describe("idempotency key for a node's request", () => {
  const make = vi.fn(() => "new-key");
  it("reuses the key of an unanswered identical request, however old", () => {
    expect(submitKey({ key: "old", signature: "s", at: 0 }, "s", make)).toEqual({ key: "old", reused: true });
  });
  it("uses a new key when the request changed or nothing is pending", () => {
    expect(submitKey({ key: "old", signature: "s", at: 1000 }, "s2", make)).toEqual({ key: "new-key", reused: false });
    expect(submitKey(undefined, "s", make)).toEqual({ key: "new-key", reused: false });
  });
});

describe("stored upload keys", () => {
  it("never writes a URL as an asset key, and skips media with nothing to point at", () => {
    const graph = toStoredGraph(
      [
        at("bad", { kind: "media", media: "image", title: "", mime: "image/png", assetKey: "https://signed/x", resultUuid: "img_1" }),
        at("empty", { kind: "media", media: "image", title: "", mime: "image/png", url: "blob:x", busy: true }),
        text("t"),
      ],
      [{ id: "e", source: "empty", target: "t" }],
    );
    expect(graph.nodes.map((node) => node.id)).toEqual(["bad", "t"]);
    expect(graph.nodes[0].data).not.toHaveProperty("assetKey");
    expect(graph.edges).toEqual([]);
  });

  it("keeps only upload keys, never URLs", () => {
    expect(isUploadKey("uploads/u1/abc.png")).toBe(true);
    expect(isUploadKey("https://bucket.example/uploads/u1/abc.png?X-Amz-Signature=1")).toBe(false);
    expect(isUploadKey("uploads/u1/../x.png")).toBe(false);
    const { nodes } = fromStoredGraph({ version: 2, nodes: [{ id: "m", position: { x: 0, y: 0 }, data: { kind: "media", media: "image", title: "", mime: "image/png", assetKey: "https://signed/x" } }], edges: [] }, "?");
    expect(nodes[0].data).not.toHaveProperty("assetKey");
  });
});

describe("saving and opening", () => {
  it("keeps known pin colours and reads canvases that predate pins", () => {
    const graph = toStoredGraph([image("i", { pins: ["blue", "red"] }), text("t")], []);
    const raw = { ...graph, nodes: graph.nodes.map((node) => node.id === "i" ? { ...node, data: { ...node.data, pins: ["blue", "other", "red", "red"] } } : node) };
    const { nodes } = fromStoredGraph(raw, "?");
    expect(nodes[0].data.pins).toEqual(["red", "blue"]);
    expect(nodes[1].data.pins).toBeUndefined();
  });

  it("stores references only, never URLs", () => {
    const graph = toStoredGraph(
      [
        at("m", { kind: "media", media: "image", title: "M", mime: "image/png", assetKey: "uploads/u/a.png", url: "https://signed/a" }),
        at("g", { kind: "image", title: "I", prompt: "p", modelId: "x", status: "done", resultUuid: "img_1", urls: ["https://signed/b"] }),
      ],
      [],
      { x: 1.4, y: 2.6, zoom: 1.23456 },
    );
    const json = JSON.stringify(graph);
    expect(json).not.toContain("https://signed");
    expect(graph.version).toBe(2);
    expect(graph.viewport).toEqual({ x: 1, y: 3, zoom: 1.235 });
    expect(() => parseWorkflowPayload({ name: "c", graph })).not.toThrow();
  });

  it("turns a request cut off by closing the page into a retryable failure that keeps its key", () => {
    const stored = toStoredGraph([image("i", { status: "submitting", pending: { key: "k1", signature: "s", at: 5 } } as Partial<CanvasData>)], []);
    const { nodes } = fromStoredGraph(stored, "unknown");
    expect(nodes[0].data).toMatchObject({ status: "failed", error: "unknown", pending: { key: "k1" } });
  });

  it("keeps a running job so it is polled again after reopening", () => {
    const stored = toStoredGraph([image("i", { status: "running", resultUuid: "img_9" } as Partial<CanvasData>)], []);
    expect(fromStoredGraph(stored, "?").nodes[0].data).toMatchObject({ status: "running", resultUuid: "img_9" });
  });

  it("keeps groups with their children, parents first", () => {
    const child = { ...text("t"), parentNode: "g" };
    const group = { ...at("g", { kind: "group", title: "G" }), style: { width: 400, height: 300 } };
    const { nodes } = fromStoredGraph(toStoredGraph([child, group], []), "?");
    expect(nodes.map((node) => node.id)).toEqual(["g", "t"]);
    expect(nodes[1].parentNode).toBe("g");
    expect(nodes[0].style).toEqual({ width: 400, height: 300 });
  });

  it("drops invalid wires and unknown nodes from user-controlled JSON", () => {
    const graph = {
      version: 2,
      nodes: [text("t"), media("mv", "video"), { id: "x", position: { x: 0, y: 0 }, data: { kind: "evil" } }],
      edges: [{ id: "1", source: "t", target: "mv" }, { id: "2", source: "t", target: "nope" }],
    };
    const result = fromStoredGraph(graph, "?");
    expect(result.nodes.map((node) => node.id)).toEqual(["t", "mv"]);
    expect(result.edges).toEqual([]);
  });

  it("migrates canvases saved by the old workflow editor", () => {
    const v1 = {
      nodes: [
        { id: "a", type: "creativeNode", position: { x: 0, y: 0 }, data: { kind: "asset", title: "x", assetKey: "uploads/u/a.png", assetMime: "image/png", assetName: "a.png" } },
        { id: "b", type: "creativeNode", position: { x: 300, y: 0 }, data: { kind: "video", title: "v", prompt: "go", modelId: "veo-3.1", resultUuid: "vid_1", status: "COMPLETED" } },
        { id: "c", type: "creativeNode", position: { x: 0, y: 200 }, data: { kind: "text", title: "t", prompt: "hello" } },
      ],
      edges: [{ id: "e1", source: "a", target: "b" }, { id: "e2", source: "c", target: "b" }],
    };
    const { nodes, edges } = fromStoredGraph(v1, "?");
    expect(nodes.map((node) => node.data.kind)).toEqual(["media", "video", "text"]);
    expect(nodes[1].data).toMatchObject({ status: "done", resultUuid: "vid_1", prompt: "go" });
    expect(nodes[2].data).toMatchObject({ text: "hello" });
    expect(edges).toHaveLength(2);
  });

  it("rejects groups that point nowhere", () => {
    const graph = { nodes: [{ id: "t", position: { x: 0, y: 0 }, data: {}, parentNode: "missing" }], edges: [] };
    expect(() => parseWorkflowPayload({ name: "c", graph })).toThrow("group");
  });
});

describe("importing the old browser-only canvas", () => {
  it("keeps what has a stable reference and counts the rest", () => {
    let n = 0;
    const result = fromLegacyLocalCanvas(
      {
        title: "Old",
        nodes: [
          { id: "1", kind: "image", name: "up", url: "blob:x", x: 0, y: 0, width: 280 },
          { id: "2", kind: "image", name: "key", url: "https://s/a", storageKey: "uploads/u/k.png", x: 10, y: 0, width: 280 },
          { id: "3", kind: "video", name: "gen", url: "", jobUuid: "vid_7", x: 400, y: 0, width: 320 },
          { id: "4", kind: "text", title: "Note", content: "hi", x: 0, y: 300, width: 260 },
          { id: "5", kind: "group", title: "G", x: -20, y: -20, width: 900, height: 600 },
        ],
        edges: [{ fromId: "2", toId: "3" }, { fromId: "1", toId: "3" }],
      },
      () => `n${++n}`,
    );
    expect(result.title).toBe("Old");
    expect(result.skipped).toBe(1);
    expect(result.nodes.map((node) => node.data.kind)).toEqual(["group", "media", "media", "text"]);
    // media → media is not a valid wire in the new model, so it is dropped.
    expect(result.edges).toEqual([]);
  });
});

describe("auto-arrange", () => {
  it("puts each box right of its inputs without overlaps", () => {
    const boxes = [
      { id: "a", x: 0, y: 0, width: 100, height: 50 },
      { id: "b", x: 0, y: 100, width: 100, height: 50 },
      { id: "c", x: 0, y: 200, width: 100, height: 50 },
    ];
    const positions = arrangeBoxes(boxes, [{ source: "a", target: "c" }, { source: "b", target: "c" }], 50, 10);
    expect(positions.get("a")).toEqual({ x: 0, y: 0 });
    expect(positions.get("b")).toEqual({ x: 0, y: 60 });
    expect(positions.get("c")).toEqual({ x: 150, y: 0 });
  });
});

describe("posting a generation", () => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

  it("returns the job on success and sends the key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { success: true, data: { videoUuid: "img_1" } }));
    expect(await postGeneration("/api/v1/media/generate", { model: "m" }, "k", fetchMock)).toEqual({ kind: "ok", uuid: "img_1" });
    expect((fetchMock.mock.calls[0][1] as RequestInit & { headers: Record<string, string> }).headers["Idempotency-Key"]).toBe("k");
  });

  it("treats a network error, a broken body or a 5xx as unknown (retry with the same key)", async () => {
    expect((await postGeneration("/api/v1/video/generate", {}, "k", vi.fn().mockRejectedValue(new TypeError("x")))).kind).toBe("lost");
    expect((await postGeneration("/api/v1/video/generate", {}, "k", vi.fn().mockResolvedValue(new Response("<html>", { status: 502 })))).kind).toBe("lost");
    expect((await postGeneration("/api/v1/video/generate", {}, "k", vi.fn().mockResolvedValue(json(500, { success: false, error: { message: "boom" } })))).kind).toBe("lost");
  });

  it("reports definite refusals with their code", async () => {
    const shortfall = json(402, { success: false, error: { message: "no", details: { code: "INSUFFICIENT_CREDITS", requiredCredits: 30 } } });
    expect(await postGeneration("/api/v1/video/generate", {}, "k", vi.fn().mockResolvedValue(shortfall))).toEqual({
      kind: "rejected",
      code: "INSUFFICIENT_CREDITS",
      message: "no",
      requiredCredits: 30,
    });
    const off = json(503, { success: false, error: { message: "off", details: { code: "GENERATION_DISABLED" } } });
    expect((await postGeneration("/api/v1/video/generate", {}, "k", vi.fn().mockResolvedValue(off))).kind).toBe("rejected");
    expect((await postGeneration("/api/v1/video/generate", {}, "k", vi.fn().mockResolvedValue(new Response("", { status: 401 })))).kind).toBe("unauthorized");
  });
});

describe("reference canvas graph interactions", () => {
  it("combines chained text inputs in wire order and reads shared ancestors once", () => {
    const inputs = [text("a", "first"), text("b", "second"), text("c", "third"), image("i")];
    const wires = [["a", "b"], ["b", "i"], ["a", "c"], ["c", "i"]].map(([source, target], id) => ({ id: String(id), source, target }));
    expect(inputText("i", inputs, wires)).toEqual(["first", "second", "third"]);
    expect(checkConnection("a", "b", inputs, [])).toEqual({ ok: true });
    expect(checkConnection("b", "a", inputs, wires)).toEqual({ ok: false, reason: "cycle" });
  });
  it("keeps selected groups with descendants and preserves world coordinates on ungroup", () => {
    const group = { ...at("g", { kind: "group", title: "" }), selected: true, position: { x: 200, y: 120 } };
    const child = { ...text("t"), parentNode: "g", position: { x: 80, y: 80 } };
    const other = text("outside");
    expect(selectionWithChildren([child, group, other]).map((n) => n.id)).toEqual(["t", "g"]);
    expect(worldPosition(child, [group, child])).toEqual({ x: 280, y: 200 });
  });
  it("persists bounded notes, text instructions and trusted built-in sounds", () => {
    const sound = at("s", { kind: "media", title: "Tap", media: "audio", mime: "audio/wav", soundId: "soft-click", url: "https://unused.invalid/audio" });
    const invalid = { ...sound, id: "other", data: { ...sound.data, soundId: "not-in-catalog" } } as GraphNode;
    const card = { ...text("t"), data: { ...text("t").data, annotation: "a".repeat(210), instruction: "x".repeat(5020) } } as GraphNode;
    const stored = toStoredGraph([sound, invalid, card], []);
    expect(stored.nodes.map((n) => n.id)).toEqual(["s", "t"]);
    expect(stored.nodes[0].data).not.toHaveProperty("url");
    const graph = fromStoredGraph(stored, "retry");
    expect(graph.nodes[0].data).toMatchObject({ soundId: "soft-click", url: "/canvas/sounds/soft-click.wav" });
    expect(graph.nodes[1].data).toMatchObject({ annotation: "a".repeat(200), instruction: "x".repeat(5000) });
  });
});

it("exports distinct safe filenames with the original media and text bytes", async () => {
  const { canvasZip } = await import("@/lib/creative-space/canvas-export");
  const { unzipSync, strFromU8 } = await import("fflate");
  const result = await canvasZip([
    { title: "shot/a", blob: new Blob(["sample"], { type: "text/plain" }) },
    { title: "shot/a", blob: new Blob([Uint8Array.from([1, 2, 3])], { type: "image/png" }) },
  ]);
  const contents = unzipSync(new Uint8Array(await result.arrayBuffer()));
  expect(Object.keys(contents)).toEqual(["01-shot_a.txt", "02-shot_a.png"]);
  expect(strFromU8(contents["01-shot_a.txt"])).toBe("sample");
  expect(Array.from(contents["02-shot_a.png"])).toEqual([1, 2, 3]);
});

describe("group execution", () => {
  it("sorts group dependencies through text relays, skips finished jobs and excludes other groups", async () => {
    const { canvasGroupPlan } = await import("@/lib/creative-space/canvas-group-run");
    const g = at("g", { kind: "group", title: "Group" });
    const members = [video("downstream"), text("relay"), image("first"), image("finished", { status: "done" })].map((n) => ({ ...n, parentNode: "g" }));
    const edges = [["first", "relay"], ["relay", "downstream"]].map(([source, target], index) => ({ id: String(index), source, target }));
    expect(canvasGroupPlan("g", [g, ...members, image("outside")], edges).map((n) => n.id)).toEqual(["first", "downstream"]);
    expect(canvasGroupPlan("g", [g, ...members], [...edges, { id: "cycle", source: "downstream", target: "first" }])).toEqual([]);
  });
  it("does not continue a group after failure or after its canvas disappears", async () => {
    const { runCanvasGroup } = await import("@/lib/creative-space/canvas-group-run");
    let active = true;
    const ids = ["a", "b", "c"];
    const failed = vi.fn(async (id: string) => id !== "b");
    expect(await runCanvasGroup(ids, () => active, failed)).toBe(false);
    expect(failed.mock.calls.map(([id]) => id)).toEqual(["a", "b"]);
    const switched = vi.fn(async () => { active = false; return true; });
    expect(await runCanvasGroup(ids, () => active, switched)).toBe(false);
    expect(switched).toHaveBeenCalledTimes(1);
  });
});

describe("canvas selection removal", () => {
  it("removes nested descendants and incoming, outgoing and explicitly selected wires", () => {
    const nodes = [{ id: "leaf", parentNode: "inner" }, { id: "keep" }, { id: "inner", parentNode: "group" }, { id: "group", selected: true }, { id: "other" }];
    const retained = { source: "other", target: "keep" };
    const edges = [{ source: "leaf", target: "keep" }, { source: "other", target: "inner" }, { source: "keep", target: "other", selected: true }, retained];
    const next = withoutGraphSelection(nodes, edges);
    expect(next.nodes.map((node) => node.id)).toEqual(["keep", "other"]);
    expect(next.edges).toEqual([retained]);
    expect(nodes).toHaveLength(5);
    expect(edges).toHaveLength(4);
  });

  it("supports an edge-only selection without removing its nodes", () => {
    const nodes = [{ id: "a" }, { id: "b" }];
    expect(withoutGraphSelection(nodes, [{ source: "a", target: "b", selected: true }])).toEqual({ nodes, edges: [] });
  });
});
