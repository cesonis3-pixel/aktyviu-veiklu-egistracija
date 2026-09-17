import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { NextResponse } from "next/server.js";

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", source)(name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) return load(`../${name.slice(2)}.ts`, mocks);
    return require(name);
  }, compiled, compiled.exports);
  return compiled.exports;
}
const { groupConversations } = load("../lib/conversations.ts");
const id = "00000000-0000-0000-0000-000000000001";
const row = (overrides = {}) => ({ id, activity_id: "activity", sender_id: "participant", recipient_id: "owner", subject: "Tema", message: "Klausimas", created_at: "2026-09-17T10:00:00Z", activities: { title: "Žiemos žygis" }, ...overrides });
const rows = [row(), row({ id: "reply", sender_id: "owner", recipient_id: "participant", message: "Atsakymas", created_at: "2026-09-17T11:00:00Z" })];
test("same activity and participant form one chronological conversation in both directions", () => {
  for (const user of ["owner", "participant"]) {
    const groups = groupConversations([...rows].reverse(), user);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].messages.map(m => m.id), [id, "reply"]);
    assert.equal(groups[0].otherUserId, user === "owner" ? "participant" : "owner");
  }
});
test("other activities and other participants stay separate; latest conversation comes first", () => {
  const groups = groupConversations([...rows, row({ id: "new", activity_id: "second", created_at: "2026-09-18T10:00:00Z" }), row({ id: "third", sender_id: "another" })], "owner");
  assert.equal(groups.length, 3);
  assert.equal(groups[0].activityId, "second");
  assert.equal(groups[1].latest.id, "reply");
});
test("foreign messages are excluded and deleted activity history is retained", () => {
  assert.deepEqual(groupConversations(rows, "stranger"), []);
  const groups = groupConversations([row({ activity_id: null, activities: null })], "owner");
  assert.equal(groups[0].activityTitle, "Veikla ištrinta");
});
const navigation = { useRouter: () => ({ refresh() {} }), redirect: () => { throw new Error("redirect"); }, notFound: () => { throw new Error("not found"); } };
const { ConversationThread } = load("../components/conversation-thread.tsx", { "next/navigation": navigation });
test("history renders own bubbles on the right and other bubbles on the left with one composer", () => {
  const html = renderToStaticMarkup(React.createElement(ConversationThread, { messages: rows, currentUserId: "owner", anchorId: id }));
  assert.match(html, /message-other[\s\S]*Klausimas/);
  assert.match(html, /message-own[\s\S]*Atsakymas/);
  assert.equal((html.match(/<textarea/g) ?? []).length, 1);
  assert.match(html, /Rašyti žinutę/);
  assert.doesNotMatch(html, /Atsakyti|Gauta žinutė|Siuntėjas|Gavėjas/);
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.message-own\s*\{\s*justify-content: flex-end/);
  assert.match(css, /\.message-other\s*\{\s*justify-content: flex-start/);
});
function pageMocks(messages = rows, user = "owner") {
  return {
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/navigation": navigation,
    "@/components/conversation-thread": { ConversationThread },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: user ? { id: user } : null } }) } }) },
    "@/lib/message-data": { readMessages: async () => messages, readParticipantNames: async () => new Map([["participant", "Povilas"]]) },
  };
}
test("messages page displays one named conversation with latest preview and link", async () => {
  const { default: Page } = load("../app/messages/page.tsx", pageMocks());
  const html = renderToStaticMarkup(await Page());
  assert.equal((html.match(/class="conversation-link"/g) ?? []).length, 1);
  assert.match(html, /Povilas/); assert.match(html, /Žiemos žygis/); assert.match(html, /Atsakymas/);
  assert.match(html, /href="\/messages\/reply"/);
  assert.doesNotMatch(html, /Klausimas|Atsakyti/);
});
test("conversation route renders complete history and refuses foreign or nonexistent anchors", async () => {
  const { default: Page } = load("../app/messages/[messageId]/page.tsx", pageMocks());
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ messageId: id }) }));
  assert.match(html, /Klausimas/); assert.match(html, /Atsakymas/); assert.match(html, /\/activities\/activity/);
  await assert.rejects(Page({ params: Promise.resolve({ messageId: "foreign" }) }), /not found/);
  const { default: Foreign } = load("../app/messages/[messageId]/page.tsx", pageMocks(rows, "stranger"));
  await assert.rejects(Foreign({ params: Promise.resolve({ messageId: id }) }), /not found/);
});
test("message loader fetches all pages and restricts every query to the current user", async () => {
  const { readMessages } = load("../lib/message-data.ts");
  const ranges = [];
  const query = { select: () => query, or: value => { assert.equal(value, "sender_id.eq.owner,recipient_id.eq.owner"); return query; }, order: () => query,
    range: async (start, end) => { ranges.push([start, end]); return { data: start === 0 ? Array.from({ length: 500 }, () => row()) : [row()], error: null }; } };
  assert.equal((await readMessages({ from: () => query }, "owner")).length, 501);
  assert.deepEqual(ranges, [[0, 499], [500, 999]]);
});
function api({ user = "owner", original = row(), creator = "owner" } = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: user ? { id: user } : null } }) },
    from: table => {
      const query = { select: () => query, eq: () => query, or: () => query, maybeSingle: async () => ({ data: table === "activity_messages" ? original : { creator_id: creator }, error: null }) };
      return query;
    },
    rpc: async (...args) => { calls.push(args); return { data: { success: true }, error: null }; },
  };
  const { POST } = load("../app/api/messages/conversation/route.ts", { "next/server": { NextResponse }, "@/lib/supabase/server": { createClient: async () => client } });
  return { calls, send: (body = { message_id: id, message: "Tęsinys" }) => POST(new Request("http://localhost/api/messages/conversation", { method: "POST", body: JSON.stringify(body) })) };
}
test("organizer continues through reply RPC without browser recipient", async () => {
  const route = api(); assert.equal((await route.send()).status, 200);
  assert.deepEqual(route.calls, [["reply_activity_message", { p_message_id: id, p_message: "Tęsinys" }]]);
});
test("participant continues before and after organizer response using existing RPCs", async () => {
  const initial = api({ user: "participant" }); assert.equal((await initial.send()).status, 200);
  assert.deepEqual(initial.calls, [["send_activity_message", { p_activity_id: "activity", p_subject: "Tema", p_message: "Tęsinys" }]]);
  const afterReply = api({ user: "participant", original: rows[1] }); assert.equal((await afterReply.send()).status, 200);
  assert.equal(afterReply.calls[0][0], "reply_activity_message");
});
test("random recipients, foreign anchors, missing conversation and anonymous sends are rejected", async () => {
  for (const options of [{ user: "stranger" }, { original: null }, { user: "participant", creator: "random" }, { user: null }]) {
    const route = api(options); assert.equal((await route.send()).status, options.user === null ? 401 : 403); assert.equal(route.calls.length, 0);
  }
  for (const body of [{ message_id: id, message: "Text", recipient_id: "random" }, { message_id: id, message: " \n\t" }, { message_id: id, message: "x".repeat(2001) }]) {
    const route = api(); assert.equal((await route.send(body)).status, 400); assert.equal(route.calls.length, 0);
  }
});

test("composer sends only anchor and text, preserves failed draft and refreshes after success", async () => {
  const state = [];
  let cursor = 0;
  let refreshed = 0;
  const { ConversationThread: Thread } = load("../components/conversation-thread.tsx", {
    react: {
      useEffect() {},
      useTransition: () => [false, action => action()],
      useState: initial => {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], value => { state[index] = value; }];
      },
      useRef: initial => {
        const index = cursor++;
        if (!(index in state)) state[index] = { current: initial };
        return state[index];
      },
    },
    "next/navigation": { useRouter: () => ({ refresh: () => { refreshed++; } }) },
  });
  const render = () => { cursor = 0; return Thread({ messages: rows, currentUserId: "owner", anchorId: id }); };
  function find(node, type) {
    if (!node || typeof node !== "object") return;
    if (node.type === type) return node;
    return React.Children.toArray(node.props?.children).map(child => find(child, type)).find(Boolean);
  }
  find(render(), "textarea").props.onChange({ target: { value: "Nauja žinutė" } });
  const originalFetch = globalThis.fetch;
  let ok = false;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/messages/conversation");
    assert.deepEqual(JSON.parse(options.body), { message_id: id, message: "Nauja žinutė" });
    return { ok, json: async () => ok ? { success: true } : { error: "Bandykite dar kartą." } };
  };
  try {
    await find(render(), "form").props.onSubmit({ preventDefault() {} });
    assert.equal(find(render(), "textarea").props.value, "Nauja žinutė");
    assert.match(renderToStaticMarkup(render()), /Bandykite dar kartą/);
    ok = true;
    await find(render(), "form").props.onSubmit({ preventDefault() {} });
    assert.equal(find(render(), "textarea").props.value, "");
    assert.equal(refreshed, 1);
    assert.match(renderToStaticMarkup(render()), /Žinutė išsiųsta/);
  } finally { globalThis.fetch = originalFetch; }
});
