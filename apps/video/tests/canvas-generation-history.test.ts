import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as asset } from "@/app/api/v1/creative-space/asset/route";
import { POST as resolve } from "@/app/api/v1/creative-space/resolve/route";
import { POST as create } from "@/app/api/v1/creative-space/workflows/route";
import { GET as open, PUT as save } from "@/app/api/v1/creative-space/workflows/[id]/route";
import { CanvasResources } from "@/components/creative-space/canvas/canvas-resources";
import { db, videos } from "@/db";
import {
  acceptGeneration, copyGenerationSettings, fromStoredGraph, toStoredGraph, type GenerateData,
} from "@/lib/creative-space/canvas-graph";

const owner = "canvas-history-owner";
vi.mock("@/lib/api/auth", () => ({ requireAuth: async () => ({ id: "canvas-history-owner" }) }));
vi.mock("@/lib/storage", () => ({
  signMediaRef: (key: string) => `https://storage.invalid/${key}`,
  getStorage: () => ({ getSignedUrl: (key: string) => `https://storage.invalid/${key}` }),
}));
vi.mock("@/components/ui/dialog", () => {
  const content = ({ children }: { children: React.ReactNode }) => children;
  return { Dialog: content, DialogTitle: content, DialogContent: content };
});
vi.mock("@/components/creative-space/canvas/canvas-nodes", () => ({ kindIcon: () => () => null }));
afterEach(() => vi.unstubAllGlobals());

const settings: GenerateData = { kind: "image", title: "Image", prompt: "daylight", modelId: "flux3/klein-text-to-image", status: "idle" };
const firstAt = Date.UTC(2026, 0, 10, 12);
const nextAt = Date.UTC(2026, 0, 11, 12);
const node = (data: GenerateData) => ({ id: "generator", position: { x: 0, y: 0 }, data });
const store = (data: GenerateData) => toStoredGraph([node(data)], []);
const run = (data: GenerateData, uuid: string, at: number): GenerateData => ({ ...data, ...acceptGeneration(data, uuid, at) });
const post = (method: string, body?: unknown) => new Request("https://canvas.invalid", {
  method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

describe("per-node generation history", () => {
  it("creates, updates and reopens a workflow through its handlers with both job IDs and no preview URLs", async () => {
    const first = run(settings, "img_first", firstAt);
    const created = await create(post("POST", { name: "History", graph: store(first) }));
    expect(created.status).toBe(200);
    const { id, revision } = (await created.json()).data;
    const ctx = { params: Promise.resolve({ id }) };
    const next = run({ ...first, status: "done", modelId: "different-model", urls: ["blob:first", "https://signed.invalid/2"] }, "img_next", nextAt);
    const saved = await save(post("PUT", { name: "History", graph: store(next), baseRevision: revision }), ctx);
    expect(saved.status).toBe(200);
    const reopened = await open(post("GET"), ctx);
    expect(reopened.status).toBe(200);
    const { graph } = (await reopened.json()).data.workflow;
    expect(graph.revision).toBe(2);
    expect(JSON.stringify(graph)).not.toMatch(/blob:|signed\.invalid/);
    expect(fromStoredGraph(graph, "unknown").nodes[0].data).toMatchObject({
      resultUuid: "img_next", resultAt: nextAt, resultModelId: "different-model", status: "running",
      history: [{ uuid: "img_first", at: firstAt, modelId: settings.modelId, resultCount: 2 }],
    });
  });

  it("keeps one entry per acknowledged job across retries, including a formerly archived UUID", () => {
    const first = run(settings, "img_first", firstAt);
    const replay = run({ ...first, status: "done", urls: ["blob:finished"] }, "img_first", nextAt);
    expect(replay).toMatchObject({ status: "done", resultAt: firstAt, urls: ["blob:finished"] });
    expect(replay.history).toBeUndefined();
    const second = run({ ...first, status: "failed" }, "img_next", nextAt);
    const retried = run(second, "img_next", nextAt + 1);
    expect(retried.resultAt).toBe(nextAt);
    expect(retried.history).toEqual(second.history);
    const promoted = run(retried, "img_first", nextAt + 2);
    expect(promoted.resultAt).toBe(firstAt);
    expect(promoted.history?.map((item) => item.uuid)).toEqual(["img_next"]);
    expect(promoted.history?.[0]).not.toHaveProperty("status");
  });

  it("reopens with the current job and only the twelve most recent predecessors", () => {
    let data = settings;
    for (let i = 0; i < 16; i++) data = run(data, `img_${i}`, firstAt + i);
    const loaded = fromStoredGraph(store(data), "unknown").nodes[0].data as GenerateData;
    expect(loaded.resultUuid).toBe("img_15");
    expect(loaded.history?.map((item) => item.uuid)).toEqual(Array.from({ length: 12 }, (_, i) => `img_${14 - i}`));
  });

  it("opens pre-history graphs and retains their last known job on the next run", () => {
    const legacy = { ...settings, resultUuid: "img_legacy", status: "done" as const };
    const loaded = fromStoredGraph(store(legacy), "unknown").nodes[0].data as GenerateData;
    expect(loaded.history).toBeUndefined();
    expect(loaded.resultAt).toBeUndefined();
    expect(run(loaded, "img_next", nextAt).history).toEqual([{ uuid: "img_legacy", at: nextAt }]);
  });

  it("bounds and validates history independently on save and on open", () => {
    const history = [
      null, { uuid: "https://signed.invalid/id", at: 1 }, { uuid: "img_invalid", at: 9e15 },
      { uuid: "img_invalid", at: -1 }, { uuid: "img_invalid", at: "yesterday" }, { uuid: "img_current", at: 3 },
      { uuid: "img_0", at: 5, modelId: "https://signed.invalid/model", resultCount: -1, urls: ["blob:old"], status: "done" },
      ...Array.from({ length: 20 }, (_, i) => ({ uuid: `img_${i}`, at: 99 - i })),
    ];
    const data = { ...settings, resultUuid: "img_current", resultAt: Infinity, history } as unknown as GenerateData;
    const saved = store(data).nodes[0].data as GenerateData;
    const loaded = fromStoredGraph({ version: 2, nodes: [node(data)], edges: [] }, "unknown").nodes[0].data as GenerateData;
    for (const result of [saved, loaded]) {
      expect(result.resultAt).toBeUndefined();
      expect(result.history?.map((item) => item.uuid)).toEqual(Array.from({ length: 12 }, (_, i) => `img_${i}`));
      expect(result.history?.[0]).toEqual({ uuid: "img_0", at: 5 });
    }
  });

  it("excludes the source's jobs from duplicates and strips all results from templates", () => {
    const data: GenerateData = {
      ...run(run(settings, "img_first", firstAt), "img_next", nextAt),
      status: "done", urls: ["blob:copy"], pending: { key: "key", signature: "request", at: nextAt },
    };
    const copy = copyGenerationSettings(data, "duplicate");
    expect(copy).toMatchObject({ status: "done", resultUuid: "img_next", urls: ["blob:copy"] });
    const restored = fromStoredGraph(store(copy), "unknown").nodes[0].data as GenerateData;
    expect(restored.inheritedResult).toBe(true);
    expect(restored.history).toBeUndefined();
    expect(run(restored, "img_copy_run", nextAt + 1).history).toBeUndefined();
    const template = copyGenerationSettings(data, "template");
    expect(fromStoredGraph(store(template), "unknown").nodes[0].data).toEqual(settings);
    expect(copyGenerationSettings({ ...data, status: "running" }, "duplicate")).toEqual(settings);
    expect(data.history).toHaveLength(1);
  });

  it("renders a dated card per job, with no success label or media before verification", () => {
    vi.stubGlobal("React", React);
    const data = { ...run(run(settings, "img_first", firstAt), "img_next", nextAt), status: "done" as const, urls: ["blob:one", "blob:two", "blob:three"] };
    const noop = () => {};
    const html = renderToStaticMarkup(React.createElement(CanvasResources, {
      section: "history", zh: false, nodes: [node(data), { ...node(copyGenerationSettings(data, "duplicate")), id: "copy" }], canvasFetch: vi.fn(), onClose: noop, onLibrary: noop,
      onTemplates: noop, onFocus: noop, onSound: noop,
    }));
    expect(html.match(/class="ncr-card"/g)).toHaveLength(2);
    expect(html).toContain("Status unconfirmed");
    expect(html).toContain("2026");
    expect(html).not.toMatch(/Completed|blob:|src=/);
  });

  it("authorizes archived previews and returns bytes only for a completed job owned by the viewer", async () => {
    const rows = [
      { uuid: "img_owned", status: "COMPLETED" }, { uuid: "img_running", status: "GENERATING" },
      { uuid: "img_failed", status: "FAILED" }, { uuid: "img_other_user", status: "COMPLETED" },
    ] as const;
    await db.insert(videos).values(rows.map(({ uuid, status }) => ({
      uuid, status, userId: uuid === "img_other_user" ? "another-user" : owner,
      mediaType: "image" as const, prompt: "sample", model: settings.modelId, videoUrl: `images/${uuid}.png`,
    })));
    const response = await resolve(post("POST", { uuids: rows.map((row) => row.uuid) }));
    expect(response.status).toBe(200);
    const { results } = (await response.json()).data;
    expect(results.img_owned.status).toBe("COMPLETED");
    expect(results.img_running).toMatchObject({ status: "GENERATING", urls: [] });
    expect(results.img_failed).toMatchObject({ status: "FAILED", urls: [] });
    expect(results.img_other_user).toBeUndefined();
    const read = (uuid: string) => asset(new Request(`https://canvas.invalid/api/v1/creative-space/asset?uuid=${uuid}&index=0`));
    const storage = vi.fn(async () => new Response("preview bytes"));
    vi.stubGlobal("fetch", storage);
    for (const uuid of ["img_running", "img_failed", "img_other_user"]) expect((await read(uuid)).status).toBe(404);
    expect(storage).not.toHaveBeenCalled();
    expect(await (await read("img_owned")).text()).toBe("preview bytes");
    expect(storage).toHaveBeenCalledTimes(1);
  });
});
