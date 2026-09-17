import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { NextResponse } from "next/server.js";
import { PGlite } from "@electric-sql/pglite";

const require = createRequire(import.meta.url);
function load(path, mocks) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", source)(name => name in mocks ? mocks[name] : require(name), compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const participant = "00000000-0000-0000-0000-000000000001";
const organizer = "00000000-0000-0000-0000-000000000002";
const stranger = "00000000-0000-0000-0000-000000000003";
const originalId = "00000000-0000-0000-0000-000000000004";
const activityId = "00000000-0000-0000-0000-000000000005";
const migration = readFileSync(new URL("../supabase/migrations/20260917_reply_activity_message.sql", import.meta.url), "utf8");
const previous = readFileSync(new URL("../supabase/migrations/20260916_reactivation_and_messages.sql", import.meta.url), "utf8");
const db = new PGlite();
before(async () => {
  await db.exec(`create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    create table public.activities(id uuid primary key, creator_id uuid, title text);
    insert into auth.users values ('${participant}'), ('${organizer}'), ('${stranger}');
    insert into activities values ('${activityId}', '${organizer}', 'Žiemos žygis');`);
  // Use the real existing table, grants and RLS policies, then the new migration.
  await db.exec(previous.slice(0, previous.indexOf("create or replace function public.reactivate_activity")) + "commit;");
  await db.exec(migration);
  await db.query(`insert into activity_messages(id, activity_id, sender_id, recipient_id, subject, message)
    values ($1, $2, $3, $4, 'Kada susitinkame?', 'Dalyvio klausimas')`, [originalId, activityId, participant, organizer]);
});
after(async () => { await db.close(); });
async function asUser(user, run) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.exec("set role authenticated");
  try { return await run(); } finally { await db.exec("reset role"); }
}
const reply = (id = originalId, message = "Susitinkame ryte.") => db.query(
  "select public.reply_activity_message($1, $2) as result", [id, message]);

test("organizer can reply; DB derives sender, recipient and activity and preserves original", async () => {
  const { rows } = await asUser(organizer, () => reply());
  const saved = (await db.query("select * from activity_messages where id = $1", [rows[0].result.id])).rows[0];
  assert.equal(saved.sender_id, organizer);
  assert.equal(saved.recipient_id, participant);
  assert.equal(saved.activity_id, activityId);
  assert.equal(saved.subject, "Re: Kada susitinkame?");
  const original = (await db.query("select * from activity_messages where id = $1", [originalId])).rows[0];
  assert.equal(original.message, "Dalyvio klausimas");
  assert.equal(original.subject, "Kada susitinkame?");
  const followup = await asUser(participant, () => reply(saved.id, "Ačiū!"));
  const subject = (await db.query("select subject from activity_messages where id = $1", [followup.rows[0].result.id])).rows[0].subject;
  assert.equal(subject, saved.subject);
});
test("participant can send consecutive messages before a reply and organizer can reply repeatedly", async () => {
  for (let index = 0; index < 2; index++) {
    const sent = await asUser(participant, () => db.query("select public.send_activity_message($1, $2, $3) as result", [activityId, "Tema", "Dar vienas klausimas"]));
    const saved = (await db.query("select * from activity_messages where id = $1", [sent.rows[0].result.id])).rows[0];
    assert.equal(saved.sender_id, participant);
    assert.equal(saved.recipient_id, organizer);
    await asUser(organizer, () => reply(originalId, "Pokalbio tęsinys"));
  }
});
for (const [name, user, code] of [["stranger", stranger, "P0024"], ["original sender", participant, "P0024"], ["unauthenticated user", null, "P0001"]]) {
  test(`${name} cannot reply to the original message`, async () => {
    await assert.rejects(asUser(user, () => reply()), { code });
  });
}
test("SQL rejects empty, whitespace-only and oversized replies", async () => {
  for (const message of [null, "", "   ", "\t\r\n ", "x".repeat(2001)]) {
    await assert.rejects(asUser(organizer, () => reply(originalId, message)), { code: "P0021" });
  }
  await asUser(organizer, () => reply(originalId, "x".repeat(2000)));
});
test("reply subject fits the existing 120-character constraint", async () => {
  await db.query("update activity_messages set subject = $1 where id = $2", ["x".repeat(120), originalId]);
  try {
    const { rows } = await asUser(organizer, () => reply());
    const saved = (await db.query("select subject from activity_messages where id = $1", [rows[0].result.id])).rows[0];
    assert.equal(saved.subject, "Re: " + "x".repeat(116));
  } finally {
    await db.query("update activity_messages set subject = 'Kada susitinkame?' where id = $1", [originalId]);
  }
});
test("RLS hides all messages from strangers and direct inserts remain forbidden", async () => {
  assert.equal((await asUser(stranger, () => db.query("select * from activity_messages"))).rows.length, 0);
  await assert.rejects(asUser(organizer, () => db.exec(`insert into activity_messages(sender_id, recipient_id, subject, message)
    values ('${organizer}', '${stranger}', 'Spoof', 'Spoof')`)), { code: "42501" });
  await db.exec("set role anon");
  try { await assert.rejects(reply(), { code: "42501" }); } finally { await db.exec("reset role"); }
});

function api(user = { id: organizer }, error = null) {
  const calls = [];
  const { POST } = load("../app/api/messages/reply/route.ts", {
    "next/server": { NextResponse },
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user } }) },
      rpc: async (...args) => { calls.push(args); return { data: { success: true }, error }; },
    }) },
  });
  return { calls, send: body => POST(new Request("http://localhost/api/messages/reply", { method: "POST", body: JSON.stringify(body) })) };
}
const body = { message_id: originalId, message: "Atsakymas" };
test("reply API authenticates and forwards only the original message ID and content", async () => {
  const route = api();
  assert.equal((await route.send(body)).status, 200);
  assert.deepEqual(route.calls, [["reply_activity_message", { p_message_id: originalId, p_message: body.message }]]);
  const unauthenticated = api(null);
  assert.equal((await unauthenticated.send(body)).status, 401);
  assert.equal(unauthenticated.calls.length, 0);
});
test("reply API rejects spoofed IDs, invalid IDs and invalid content", async () => {
  for (const invalid of [null, [], { ...body, message_id: "bad" }, ...["sender_id", "recipient_id", "activity_id", "subject"].map(key => ({ ...body, [key]: stranger })),
    ...["", " \n\t", "x".repeat(2001)].map(message => ({ ...body, message }))]) {
    const route = api();
    assert.equal((await route.send(invalid)).status, 400);
    assert.equal(route.calls.length, 0);
  }
});
test("reply API translates DB errors without exposing database details", async () => {
  for (const [code, status] of [["P0001", 401], ["P0024", 403], ["P0020", 403], ["P0021", 400], ["unknown", 500]]) {
    const response = await api(undefined, { code, message: "private database details" }).send(body);
    assert.equal(response.status, status);
    assert.ok((await response.json()).error);
  }
});
test("schema includes exactly the same reply RPC as the migration", () => {
  const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8").replaceAll("\r\n", "\n");
  assert.ok(schema.includes(migration.slice(migration.indexOf("create or replace"), migration.indexOf("commit;")).trim()));
});

test("reply form opens, sends only allowed fields, reports success and refreshes", async () => {
  const state = [];
  let cursor = 0;
  let refreshed = 0;
  const { ReplyMessage } = load("../components/reply-message.tsx", {
    react: {
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
  const render = () => { cursor = 0; return ReplyMessage({ messageId: originalId, subject: "Kada susitinkame?" }); };
  function find(node, type) {
    if (!node || typeof node !== "object") return undefined;
    if (node.type === type) return node;
    return React.Children.toArray(node.props?.children).map(child => find(child, type)).find(Boolean);
  }
  assert.equal(find(render(), "form"), undefined);
  find(render(), "button").props.onClick();
  assert.match(renderToStaticMarkup(render()), /Originalios žinutės tema.*Kada susitinkame/);
  find(render(), "textarea").props.onChange({ target: { value: " \t\n" } });
  await find(render(), "form").props.onSubmit({ preventDefault() {} });
  assert.match(renderToStaticMarkup(render()), /Įveskite atsakymą/);
  find(render(), "textarea").props.onChange({ target: { value: "Ryte" } });
  const originalFetch = globalThis.fetch;
  let fail = true;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/messages/reply");
    assert.deepEqual(JSON.parse(options.body), { message_id: originalId, message: "Ryte" });
    return { ok: !fail, json: async () => fail ? { error: "Nepavyko išsiųsti atsakymo." } : { success: true } };
  };
  try {
    await find(render(), "form").props.onSubmit({ preventDefault() {} });
    assert.match(renderToStaticMarkup(render()), /Nepavyko išsiųsti atsakymo/);
    assert.equal(find(render(), "textarea").props.value, "Ryte");
    fail = false;
    await find(render(), "form").props.onSubmit({ preventDefault() {} });
    assert.equal(find(render(), "form"), undefined);
    assert.match(renderToStaticMarkup(render()), /Atsakymas išsiųstas\./);
    assert.equal(refreshed, 1);
  } finally { globalThis.fetch = originalFetch; }
});
