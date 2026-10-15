import assert from "node:assert/strict";
import test from "node:test";
import {
  createIssue,
  hmacSha256Hex,
  listIssueComments,
  verifyGitHubSignature,
} from "../src/github.mjs";

const encoder = new TextEncoder();

test("verifies GitHub's published HMAC test vector", async () => {
  const secret = "It's a Secret to Everybody";
  const payload = "Hello, World!";
  const digest = await hmacSha256Hex(secret, payload);
  assert.equal(digest, "757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17");
  assert.equal(
    await verifyGitHubSignature(encoder.encode(payload), `sha256=${digest}`, secret),
    true,
  );
  assert.equal(
    await verifyGitHubSignature(encoder.encode(payload), `sha256=${"0".repeat(64)}`, secret),
    false,
  );
  assert.equal(await verifyGitHubSignature(encoder.encode(payload), "", secret), false);
});

test("lists issue comments through the public REST API without a token", async () => {
  let request;
  const comments = await listIssueComments({
    fetchImpl: async (url, init) => {
      request = { url, init };
      return Response.json([
        { user: { login: "a" }, created_at: "2026-10-15T00:00:00Z", body: "hello" },
      ]);
    },
  });

  assert.match(request.url, /\/repos\/CharlesHarry7\/dreamutopia-clone\/issues\/20\/comments/);
  assert.equal(request.init.method, "GET");
  assert.equal(request.init.headers.Accept, "application/vnd.github+json");
  assert.equal(request.init.headers["User-Agent"], "dreamutopia-feishu-bot");
  assert.equal(request.init.headers.Authorization, undefined);
  assert.deepEqual(comments[0].body, "hello");
});

test("sends the optional token only as an Authorization header when listing comments", async () => {
  let request;
  await listIssueComments({
    token: "ghs_test_token",
    fetchImpl: async (url, init) => {
      request = { url, init };
      return Response.json([]);
    },
  });
  assert.equal(request.init.headers.Authorization, "Bearer ghs_test_token");
});

test("creates a labeled GitHub issue and returns its number and url", async () => {
  let request;
  const created = await createIssue({
    token: "ghs_test_token",
    title: "飞书需求：落地页",
    body: "来源：老王",
    labels: ["feishu-request"],
    fetchImpl: async (url, init) => {
      request = { url, init };
      return Response.json({
        number: 21,
        html_url: "https://github.com/CharlesHarry7/dreamutopia-clone/issues/21",
        title: "飞书需求：落地页",
      }, { status: 201 });
    },
  });

  assert.equal(request.url, "https://api.github.com/repos/CharlesHarry7/dreamutopia-clone/issues");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.Authorization, "Bearer ghs_test_token");
  assert.deepEqual(JSON.parse(request.init.body), {
    title: "飞书需求：落地页",
    body: "来源：老王",
    labels: ["feishu-request"],
  });
  assert.equal(created.number, 21);
  assert.equal(created.html_url, "https://github.com/CharlesHarry7/dreamutopia-clone/issues/21");
});

test("retries issue creation without labels when the label is missing", async () => {
  const bodies = [];
  const created = await createIssue({
    token: "ghs_test_token",
    title: "飞书需求：落地页",
    body: "正文",
    labels: ["feishu-request"],
    fetchImpl: async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      if (bodies.length === 1) {
        return Response.json({ message: "Label does not exist" }, { status: 422 });
      }
      return Response.json({
        number: 22,
        html_url: "https://github.com/CharlesHarry7/dreamutopia-clone/issues/22",
        title: "飞书需求：落地页",
      }, { status: 201 });
    },
  });

  assert.deepEqual(bodies[0].labels, ["feishu-request"]);
  assert.equal(bodies[1].labels, undefined);
  assert.equal(created.number, 22);
});
