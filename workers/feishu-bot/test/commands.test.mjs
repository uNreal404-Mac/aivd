import assert from "node:assert/strict";
import test from "node:test";
import { HELP_MESSAGE, PROGRESS_MESSAGE, parseCommand } from "../src/commands.mjs";

test("parses supported commands and natural phrases", () => {
  assert.equal(parseCommand("进度"), "progress");
  assert.equal(parseCommand("麻烦及时汇报项目进度！"), "progress");
  assert.equal(parseCommand("请把网址发我"), "url");
  assert.equal(parseCommand("帮我查一下服务健康状态"), "health");
});

test("returns help for ambiguous or unsupported text", () => {
  assert.equal(parseCommand("进度和网址"), "help");
  assert.equal(parseCommand("想生成一个视频"), "help");
  assert.equal(parseCommand("  "), "help");
});

test("exports editable, safe progress and usage copy", () => {
  assert.match(PROGRESS_MESSAGE, /回复「网址」/);
  assert.match(PROGRESS_MESSAGE, /回复「健康」/);
  assert.match(HELP_MESSAGE, /进度.*网址.*健康/);
});
