import { describe, expect, it, vi } from "vitest";

import {
  arrangeBoxes,
  checkConnection,
  directInputs,
  fromLegacyLocalCanvas,
  fromStoredGraph,
  isUploadKey,
  kindsAccepting,
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
    expect(checkConnection("v", "t", nodes, [])).toEqual({ ok: false, reason: "type" });
    const edges: GraphEdge[] = [{ id: "e", source: "t", target: "i" }];
    expect(checkConnection("t", "i", nodes, edges)).toEqual({ ok: false, reason: "duplicate" });
    const loop = [image("i1"), image("i2"), image("i3")];
    const chain: GraphEdge[] = [{ id: "a", source: "i1", target: "i2" }, { id: "b", source: "i2", target: "i3" }];
    expect(checkConnection("i3", "i1", loop, chain)).toEqual({ ok: false, reason: "cycle" });
  });

  it("lists which nodes a dropped wire can create", () => {
    expect(kindsAccepting("text").sort()).toEqual(["agent", "audio", "image", "video"]);
    expect(kindsAccepting("video")).toEqual(["agent"]);
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
  it("keeps only upload keys, never URLs", () => {
    expect(isUploadKey("uploads/u1/abc.png")).toBe(true);
    expect(isUploadKey("https://bucket.example/uploads/u1/abc.png?X-Amz-Signature=1")).toBe(false);
    expect(isUploadKey("uploads/u1/../x.png")).toBe(false);
    const { nodes } = fromStoredGraph({ version: 2, nodes: [{ id: "m", position: { x: 0, y: 0 }, data: { kind: "media", media: "image", title: "", mime: "image/png", assetKey: "https://signed/x" } }], edges: [] }, "?");
    expect(nodes[0].data).not.toHaveProperty("assetKey");
  });
});

describe("saving and opening", () => {
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
      edges: [{ id: "1", source: "mv", target: "t" }, { id: "2", source: "t", target: "nope" }],
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
