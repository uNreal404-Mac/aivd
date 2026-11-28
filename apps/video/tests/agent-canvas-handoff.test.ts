import { describe, expect, it } from "vitest";
import { agentCanvasTitle } from "@/lib/creative-space/agent-canvas-handoff";
import { parseWorkflowPayload } from "@/lib/creative-space/workflow-graph";

describe("Agent to canvas handoff", () => {
  it("uses the subject of the first request as the canvas name", () => {
    expect(agentCanvasTitle([{ role: "user", text: "帮我创建一个小猫的视频" }], "AGENT")).toBe("小猫");
    expect(agentCanvasTitle([{ role: "user", text: "制作一支「夏日海边」短片" }], "AGENT")).toBe("夏日海边");
  });

  it("keeps user and Agent turns in the saved workflow", () => {
    const agentHistory = [
      { role: "user" as const, text: "帮我创建一个小猫的视频" },
      { role: "agent" as const, text: "从窗边的特写开始。", prompt: "小猫在窗边，镜头缓缓推近" },
    ];
    const result = parseWorkflowPayload({ name: "小猫", graph: { version: 2, nodes: [], edges: [], agentHistory } });
    expect(result.graph.agentHistory).toEqual(agentHistory);
  });
});
