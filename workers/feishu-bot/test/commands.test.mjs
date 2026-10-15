import assert from "node:assert/strict";
import test from "node:test";
import { HELP_MESSAGE, PROGRESS_MESSAGE, parseCommand } from "../src/commands.mjs";

test("parses supported commands and natural phrases", () => {
  assert.equal(parseCommand("进度"), "progress");
  assert.equal(parseCommand("麻烦及时汇报项目进度！"), "progress");
  assert.equal(parseCommand("请把网址发我"), "url");
  assert.equal(parseCommand("帮我查一下服务健康状态"), "health");
  assert.equal(parseCommand("需求：落地页要中文"), "request");
  assert.equal(parseCommand("需求:先出报价"), "request");
});

test("treats a 需求 prefix as a request even if the body mentions other commands", () => {
  assert.equal(parseCommand("需求：请同步进度和网址"), "request");
});

test("returns help for ambiguous or unsupported text", () => {
  assert.equal(parseCommand("进度和网址"), "help");
  assert.equal(parseCommand("想生成一个视频"), "help");
  assert.equal(parseCommand("  "), "help");
});

test("exports editable, safe progress and usage copy", () => {
  assert.match(PROGRESS_MESSAGE, /网站进度/);
  assert.match(PROGRESS_MESSAGE, /还没做/);
  assert.doesNotMatch(PROGRESS_MESSAGE, /#\d+/);
  assert.doesNotMatch(PROGRESS_MESSAGE, /\b[0-9a-f]{7,40}\b/i);
  assert.match(HELP_MESSAGE, /进度.*网址.*健康/);
});
