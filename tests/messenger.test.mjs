import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, after, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import { NextResponse } from "next/server.js";

function load(path, mocks = {}) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", source)(name => { assert.ok(name in mocks, name); return mocks[name]; }, compiled, compiled.exports);
  return compiled.exports;
}
const { groupConversations } = load("../lib/conversations.ts");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260918_messenger.sql", import.meta.url), "utf8");
const A = "00000000-0000-0000-0000-000000000001";
const B = "00000000-0000-0000-0000-000000000002";
const C = "00000000-0000-0000-0000-000000000003";
const D = "00000000-0000-0000-0000-000000000004";
const db = new PGlite();
let activityId, bMessage, cMessage, bReply, cReply;
async function asUser(user, action) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.exec("set role authenticated");
  try { return await action(); } finally { await db.exec("reset role"); }
}
async function rpc(user, name, params) {
  const placeholders = params.map((_, index) => `$${index + 1}`).join(",");
  const { rows } = await asUser(user, () => db.query(`select public.${name}(${placeholders}) as result`, params));
  return rows[0].result;
}
const visible = user => asUser(user, async () => (await db.query("select * from public.activity_messages order by created_at, id")).rows
  .map(row => ({ ...row, created_at: row.created_at.toISOString(), read_at: row.read_at?.toISOString() ?? null })));
before(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;`);
  await db.exec(schema);
  for (const [id, name] of [[A, "Jurgita"], [B, "Povilas"], [C, "Tomas"], [D, "Kitas"]]) {
    await db.query("insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3)", [id, name + "@example.test", JSON.stringify({ full_name: name })]);
  }
  activityId = (await rpc(A, "create_activity", ["Žiemos žygis", "Aprašymas", "Vilnius", "2100-01-01T12:00:00Z", 10, "Kitas rodomas vardas"])).id;
  bMessage = (await rpc(B, "send_activity_message", [activityId, "B tema", "B klausimas"])).id;
  cMessage = (await rpc(C, "send_activity_message", [activityId, "C tema", "C klausimas"])).id;
});
after(async () => db.close());

test("A owns activity by auth.uid, B and C start separate conversations regardless of organizer label", async () => {
  assert.equal((await db.query("select creator_id from activities where id = $1", [activityId])).rows[0].creator_id, A);
  const messages = await visible(A);
  assert.equal(messages.length, 2);
  assert.ok(messages.every(message => message.recipient_id === A));
  assert.equal(groupConversations(messages, A).length, 2);
  assert.equal(groupConversations(await visible(B), B).length, 1);
  assert.equal(groupConversations(await visible(C), C).length, 1);
  assert.deepEqual((await visible(B)).map(message => message.id), [bMessage]);
  assert.deepEqual((await visible(C)).map(message => message.id), [cMessage]);
  assert.deepEqual(await visible(D), []);
});
test("A answers B and C; each participant receives only their own answer", async () => {
  bReply = (await rpc(A, "send_conversation_message", [bMessage, "A atsakymas B"])).id;
  cReply = (await rpc(A, "send_conversation_message", [cMessage, "A atsakymas C"])).id;
  const bRows = await visible(B), cRows = await visible(C);
  assert.ok(bRows.some(message => message.id === bReply && message.sender_id === A && message.recipient_id === B));
  assert.ok(cRows.some(message => message.id === cReply && message.sender_id === A && message.recipient_id === C));
  assert.ok(!bRows.some(message => message.id === cReply || message.id === cMessage));
  assert.ok(!cRows.some(message => message.id === bReply || message.id === bMessage));
});
test("both sides send consecutive messages using their own sent or received anchor", async () => {
  for (const [user, anchor, other] of [[A, bReply, B], [A, bMessage, B], [B, bMessage, A], [B, bReply, A]]) {
    const result = await rpc(user, "send_conversation_message", [anchor, "Tęsiame"]);
    const row = (await visible(user)).find(message => message.id === result.id);
    assert.equal(row.sender_id, user); assert.equal(row.recipient_id, other); assert.equal(row.activity_id, activityId);
  }
});
test("unrelated user cannot send to a foreign anchor or start arbitrary conversation", async () => {
  for (const [user, anchor] of [[B, cMessage], [C, bMessage], [D, bMessage], [D, D]]) {
    await assert.rejects(rpc(user, "send_conversation_message", [anchor, "Svetima"]), { code: "P0024" });
  }
  await assert.rejects(rpc(null, "send_conversation_message", [bMessage, "Text"]), { code: "P0001" });
  await assert.rejects(rpc(A, "send_activity_message", [activityId, "Tema", "Sau"]), { code: "P0020" });
});
test("malformed legacy participant pair is rejected even if caller is a message participant", async () => {
  const badId = (await db.query("insert into activity_messages(activity_id,sender_id,recipient_id,subject,message) values ($1,$2,$3,'Tema','Legacy') returning id", [activityId, B, C])).rows[0].id;
  try { await assert.rejects(rpc(B, "send_conversation_message", [badId, "Test"]), { code: "P0024" }); }
  finally { await db.query("delete from activity_messages where id=$1", [badId]); }
});
test("only recipient marks read; sender and unrelated users cannot change it", async () => {
  assert.equal((await rpc(B, "mark_activity_messages_read", [[bMessage]])).updated, 0);
  assert.equal((await rpc(C, "mark_activity_messages_read", [[bMessage]])).updated, 0);
  assert.equal((await rpc(A, "mark_activity_messages_read", [[bMessage]])).updated, 1);
  const readAt = (await visible(A)).find(message => message.id === bMessage).read_at;
  assert.ok(readAt);
  assert.equal((await rpc(A, "mark_activity_messages_read", [[bMessage]])).updated, 0);
  assert.deepEqual((await visible(A)).find(message => message.id === bMessage).read_at, readAt);
  assert.equal((await rpc(B, "mark_activity_messages_read", [[bReply, cReply]])).updated, 1);
  assert.equal((await visible(C)).find(message => message.id === cReply).read_at, null);
  assert.equal(groupConversations(await visible(C), C)[0].unreadCount, 1);
});
test("direct INSERT, UPDATE including read_at, and DELETE are forbidden; anonymous RPCs denied", async () => {
  for (const sql of ["update activity_messages set read_at = now()", "update activity_messages set recipient_id = sender_id", "delete from activity_messages",
    `insert into activity_messages(sender_id,recipient_id,subject,message) values ('${B}','${C}','Tema','Text')`]) {
    await assert.rejects(asUser(A, () => db.exec(sql)), { code: "42501" });
  }
  await db.exec("set role anon");
  try {
    await assert.rejects(db.query("select public.send_conversation_message($1,'Text')", [bMessage]), { code: "42501" });
    await assert.rejects(db.query("select public.mark_activity_messages_read($1)", [[bMessage]]), { code: "42501" });
    await assert.rejects(db.query("select * from activity_messages"), { code: "42501" });
  } finally { await db.exec("reset role"); }
});
test("migration rerun preserves every message and read status and removes permissive legacy policy", async () => {
  const beforeRows = (await db.query("select * from activity_messages order by id")).rows;
  await db.exec('create policy "Unsafe legacy policy" on activity_messages for select to authenticated using (true)');
  await db.exec(migration);
  assert.deepEqual((await db.query("select * from activity_messages order by id")).rows, beforeRows);
  assert.deepEqual(await visible(D), []);
  assert.ok(schema.replaceAll("\r\n", "\n").includes(migration.replaceAll("\r\n", "\n").trim()));
});
test("conversation RPC rejects blank and oversized input; accepts 2000 characters", async () => {
  for (const text of [null, "", " \n\t\r", "x".repeat(2001)]) {
    await assert.rejects(rpc(B, "send_conversation_message", [bMessage, text]), { code: "P0021" });
  }
  assert.equal((await rpc(B, "send_conversation_message", [bMessage, "x".repeat(2000)])).success, true);
  await assert.rejects(rpc(A, "mark_activity_messages_read", [[]]), { code: "P0021" });
  await assert.rejects(rpc(null, "mark_activity_messages_read", [[bMessage]]), { code: "P0001" });
});
test("chronological history, newest conversation and unread counts reflect actual DB rows", async () => {
  const last = await rpc(C, "send_conversation_message", [cReply, "Paskutinė"]);
  const groups = groupConversations(await visible(A), A);
  assert.equal(groups[0].latest.id, last.id);
  assert.equal(groups[0].otherUserId, C);
  assert.equal(groups[0].unreadCount, 2);
  for (const group of groups) {
    const dates = group.messages.map(message => Date.parse(message.created_at));
    assert.deepEqual(dates, [...dates].sort((a, b) => a - b));
  }
});
test("read API sends only IDs and checks auth and payload", async () => {
  for (const signedIn of [true, false]) {
    const calls = [];
    const { POST } = load("../app/api/messages/read/route.ts", {
      "next/server": { NextResponse },
      "@/lib/supabase/server": { createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: signedIn ? { id: A } : null } }) },
        rpc: async (...args) => { calls.push(args); return { data: { success: true }, error: null }; },
      }) },
    });
    const send = body => POST(new Request("http://localhost/api/messages/read", { method: "POST", body: JSON.stringify(body) }));
    assert.equal((await send({ message_ids: [bMessage] })).status, signedIn ? 200 : 401);
    assert.deepEqual(calls, signedIn ? [["mark_activity_messages_read", { p_message_ids: [bMessage] }]] : []);
    for (const body of [{ message_ids: [] }, { message_ids: [bMessage], recipient_id: A }, { message_ids: ["bad"] }, { message_ids: Array(501).fill(bMessage) }]) {
      assert.equal((await send(body)).status, 400);
    }
  }
});

test("deleted activity preserves history and both existing participants can continue", async () => {
  const activity = (await rpc(A, "create_activity", ["Kita veikla", "Test", "Vilnius", "2100-01-01T12:00:00Z", 5, "Jurgita"])).id;
  const first = (await rpc(B, "send_activity_message", [activity, "Tema", "Originalas"])).id;
  await rpc(A, "delete_activity", [activity]);
  const original = (await visible(B)).find(message => message.id === first);
  assert.equal(original.activity_id, null); assert.equal(original.message, "Originalas");
  for (const user of [A, B]) assert.equal((await rpc(user, "send_conversation_message", [first, "Tęsiame pokalbį"])).success, true);
  await assert.rejects(rpc(C, "send_conversation_message", [first, "Svetima"]), { code: "P0024" });
});
