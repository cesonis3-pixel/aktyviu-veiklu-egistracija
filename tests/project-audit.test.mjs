import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, after, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

function load(path, mocks = {}) {
  const compiled = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("require", "module", "exports", source)(name => {
    assert.ok(name in mocks, name); return mocks[name];
  }, compiled, compiled.exports);
  return compiled.exports;
}
const { parseActivityTime, toVilniusInput } = load("../lib/activity-time.ts");
test("Lithuanian 18:00 survives winter/summer UTC storage and editor round trip in any server TZ", () => {
  const original = process.env.TZ;
  try {
    for (const zone of ["UTC", "America/New_York", "Europe/Vilnius"]) {
      process.env.TZ = zone;
      for (const [input, utc] of [["2027-01-23T18:00", "2027-01-23T16:00:00.000Z"], ["2027-07-23T18:00", "2027-07-23T15:00:00.000Z"]]) {
        assert.equal(parseActivityTime(input).toISOString(), utc);
        assert.equal(toVilniusInput(utc), input);
      }
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});
test("invalid calendar dates, DST gaps and ambiguous times cannot silently move the activity", () => {
  for (const value of ["2027-02-30T18:00", "2027-03-28T03:30", "2027-10-31T03:30", "invalid"]) {
    assert.ok(Number.isNaN(parseActivityTime(value).getTime()), value);
  }
  assert.equal(parseActivityTime("2027-01-23T18:00:00+02:00").toISOString(), "2027-01-23T16:00:00.000Z");
});

const db = new PGlite();
const A = "00000000-0000-0000-0000-000000000001", B = "00000000-0000-0000-0000-000000000002", C = "00000000-0000-0000-0000-000000000003";
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260919_project_audit.sql", import.meta.url), "utf8");
async function asUser(user, action) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.exec("set role authenticated");
  try { return await action(); } finally { await db.exec("reset role"); }
}
async function rpc(user, name, values) {
  return (await asUser(user, () => db.query(`select public.${name}(${values.map((_, i) => `$${i + 1}`).join(",")}) as result`, values))).rows[0].result;
}
const create = (capacity = 2) => rpc(A, "create_activity", ["Žygis", "Aprašymas", "Vilnius", "2100-01-23T18:00:00+02:00", capacity, "Žygių klubas"]);
before(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;`);
  await db.exec(schema);
  for (const id of [A, B, C]) await db.query("insert into auth.users(id,email) values ($1,'private@example.test')", [id]);
});
after(() => db.close());

test("every listed activity including cancelled has a matching detail and its organizer label", async () => {
  const { id } = await create();
  await rpc(A, "cancel_activity", [id]);
  await db.exec("set role anon");
  try {
    const { rows } = await db.query("select * from get_public_activities()");
    assert.ok(rows.length);
    for (const row of rows) {
      const detail = (await db.query("select * from get_public_activity($1)", [row.id])).rows[0];
      assert.deepEqual(detail, row);
      assert.equal(detail.organizer_name, "Žygių klubas");
    }
    assert.equal((await db.query("select * from get_public_activity($1)", [C])).rows.length, 0);
  } finally { await db.exec("reset role"); }
});
test("RLS permits owner edit of cancelled activity, preserves status/owner and blocks strangers", async () => {
  const { id } = await create();
  await rpc(A, "cancel_activity", [id]);
  await asUser(A, () => db.query("update activities set title='Naujas', organizer_name='Klubas' where id=$1", [id]));
  assert.equal((await asUser(B, () => db.query("update activities set title='Svetimas' where id=$1 returning id", [id]))).rows.length, 0);
  for (const column of ["creator_id", "status"]) {
    await assert.rejects(asUser(A, () => db.query(`update activities set ${column}=$1 where id=$2`, [column === "status" ? "active" : B, id])), { code: "42501" });
  }
  const row = (await db.query("select * from activities where id=$1", [id])).rows[0];
  assert.equal(row.title, "Naujas"); assert.equal(row.status, "cancelled"); assert.equal(row.creator_id, A);
});
test("capacity cannot fall below reservations hidden from owner by RLS", async () => {
  const { id } = await create(3);
  await rpc(B, "reserve_activity", [id]); await rpc(C, "reserve_activity", [id]);
  assert.equal((await asUser(A, () => db.query("select * from reservations where activity_id=$1", [id]))).rows.length, 0);
  await assert.rejects(asUser(A, () => db.query("update activities set capacity=1 where id=$1", [id])), { code: "P0012" });
  await asUser(A, () => db.query("update activities set capacity=2 where id=$1", [id]));
  assert.equal((await db.query("select capacity from activities where id=$1", [id])).rows[0].capacity, 2);
});
test("delete refuses strangers and active reservations even after activity cancellation", async () => {
  const { id } = await create();
  const message = await rpc(B, "send_activity_message", [id, "Tema", "Istorija"]);
  await rpc(B, "reserve_activity", [id]);
  await assert.rejects(rpc(B, "delete_activity", [id]), { code: "P0008" });
  await assert.rejects(rpc(A, "delete_activity", [id]), { code: "P0013" });
  await rpc(A, "cancel_activity", [id]);
  await assert.rejects(rpc(A, "delete_activity", [id]), { code: "P0013" });
  await rpc(B, "cancel_reservation", [id]);
  await rpc(A, "delete_activity", [id]);
  assert.equal((await db.query("select * from activities where id=$1", [id])).rows.length, 0);
  const saved = (await db.query("select * from activity_messages where id=$1", [message.id])).rows[0];
  assert.equal(saved.message, "Istorija"); assert.equal(saved.activity_id, null);
});
test("last place, duplicates, stale cancellation and reactivation preserve reservation identity", async () => {
  const { id } = await create(1);
  await rpc(B, "reserve_activity", [id]);
  await assert.rejects(rpc(B, "reserve_activity", [id]), { code: "P0004" });
  await assert.rejects(rpc(C, "reserve_activity", [id]), { code: "P0005" });
  const before = (await db.query("select * from reservations where activity_id=$1", [id])).rows;
  await assert.rejects(rpc(B, "cancel_activity", [id]), { code: "P0008" });
  await rpc(A, "cancel_activity", [id]);
  await assert.rejects(rpc(C, "reserve_activity", [id]), { code: "P0003" });
  await assert.rejects(rpc(B, "reactivate_activity", [id]), { code: "P0008" });
  await rpc(A, "reactivate_activity", [id]);
  assert.deepEqual((await db.query("select * from reservations where activity_id=$1", [id])).rows, before);
  await rpc(B, "cancel_reservation", [id]); await rpc(C, "reserve_activity", [id]);
  assert.equal((await db.query("select count(*)::int as n from reservations where activity_id=$1 and status='active'", [id])).rows[0].n, 1);
  await rpc(A, "cancel_activity", [id]);
  await db.query("update activities set starts_at='2020-01-01' where id=$1", [id]);
  await assert.rejects(rpc(A, "reactivate_activity", [id]), { code: "P0023" });
});
test("legacy reply RPC cannot bypass creator/participant validation", async () => {
  const { id } = await create();
  const bad = (await db.query("insert into activity_messages(activity_id,sender_id,recipient_id,subject,message) values ($1,$2,$3,'Tema','Legacy') returning id", [id, B, C])).rows[0].id;
  await assert.rejects(rpc(C, "reply_activity_message", [bad, "Atsakymas"]), { code: "P0024" });
});
test("audit migration is repeatable and preserves IDs, owners, reservations and messages", async () => {
  const before = (await db.query("select id,creator_id,starts_at,capacity,status from activities order by id")).rows;
  const messages = (await db.query("select * from activity_messages order by id")).rows;
  const reservations = (await db.query("select * from reservations order by id")).rows;
  await db.exec(migration); await db.exec(migration);
  assert.deepEqual((await db.query("select id,creator_id,starts_at,capacity,status from activities order by id")).rows, before);
  assert.deepEqual((await db.query("select * from activity_messages order by id")).rows, messages);
  assert.deepEqual((await db.query("select * from reservations order by id")).rows, reservations);
});
test("detail loader filters UUID inside RPC and distinguishes query failure from missing row", async () => {
  const row = { id: A, creator_id: B, title: "Snieglentė", starts_at: "2100-01-01T12:00:00Z", status: "cancelled", location: "Vilnius", capacity: 2, available: 1, organizer_name: "Klubas" };
  let result = { data: row, error: null };
  const calls = [];
  const { getActivity } = load("../lib/activities.ts", { "./supabase/server": { createClient: async () => ({
    rpc: (...args) => { calls.push(args); return { maybeSingle: async () => result }; },
  }) } });
  assert.equal((await getActivity(A)).status, "cancelled");
  assert.deepEqual(calls, [["get_public_activity", { p_activity_id: A }]]);
  result = { data: null, error: null }; assert.equal(await getActivity(A), null);
  assert.equal(await getActivity("invalid"), null);
  result = { data: null, error: new Error("DB unavailable") }; await assert.rejects(getActivity(A), /DB unavailable/);
});
test("actual detail route renders active/cancelled list UUIDs including uppercase and 404s only missing", async () => {
  let status = "active";
  const { default: Page } = load("../app/activities/[id]/page.tsx", {
    "react/jsx-runtime": jsx,
    "next/link": { __esModule: true, default: ({ children }) => React.createElement("a", {}, children) },
    "next/navigation": { notFound: () => { throw new Error("404"); } },
    "@/components/activity-detail": { ActivityDetail: ({ activity }) => React.createElement("p", {}, activity.status) },
    "@/lib/activities": { getActivity: async id => id.toLowerCase() === A ? { id: A, status } : null },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) },
  });
  for (status of ["active", "cancelled"]) assert.match(renderToStaticMarkup(await Page({ params: Promise.resolve({ id: A.toUpperCase() }) })), new RegExp(status));
  await assert.rejects(Page({ params: Promise.resolve({ id: B }) }), /404/);
});
