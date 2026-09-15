import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { NextResponse } from "next/server.js";

function load(relativePath, mocks = {}) {
  const source = ts.transpileModule(readFileSync(new URL(relativePath, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const compiledModule = { exports: {} };
  const requireFrom = (name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) return load(`../${name.slice(2)}.ts`, mocks);
    throw new Error(`Missing mock for ${name}`);
  };
  new Function("require", "module", "exports", source)(requireFrom, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

function messaging({ user = { id: "sender" }, error = null } = {}) {
  const calls = [];
  const { POST } = load("../app/api/messages/route.ts", {
    "next/server": { NextResponse },
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user } }) },
      rpc: async (...args) => { calls.push(args); return { data: { success: true }, error }; },
    }) },
  });
  return { calls, send: body => POST(new Request("http://localhost/api/messages", {
    method: "POST", body: JSON.stringify(body),
  })) };
}
const messageBody = { activityId: "3e9e0b88-a653-4d37-8f48-6faabf12a866", subject: " Tema ", message: " Žinutė " };

for (const [name, whitespace] of [["spaces", "   "], ["tabs", "\t\t"], ["line breaks", "\n\r\n"], ["mixed whitespace", " \t\n\r "]]) {
  test(`message API rejects ${name} in subject and message`, async () => {
    for (const field of ["subject", "message"]) {
      const api = messaging();
      assert.equal((await api.send({ ...messageBody, [field]: whitespace })).status, 400);
      assert.equal(api.calls.length, 0);
    }
  });
}

test("SQL migration and schema retain identical RPC whitespace guards and length limits", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260915_activity_messages.sql", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  const start = "create or replace function public.send_activity_message(";
  const rpc = sql => sql.slice(sql.indexOf(start), sql.indexOf("$$;", sql.indexOf(start)) + 3).replaceAll("\r\n", "\n");
  assert.equal(rpc(migration), rpc(schema));
  for (const [field, limit] of [["subject", 120], ["message", 2000]]) {
    assert.ok(rpc(migration).includes(`regexp_replace(coalesce(p_${field}, ''), '\\s', '', 'g') = ''`));
    assert.ok(rpc(migration).includes(`char_length(btrim(coalesce(p_${field}, ''))) not between 1 and ${limit}`));
  }
});

test("message API passes only activity, subject and message to RPC", async () => {
  const api = messaging();
  assert.equal((await api.send(messageBody)).status, 200);
  assert.deepEqual(api.calls, [["send_activity_message", {
    p_activity_id: messageBody.activityId, p_subject: "Tema", p_message: "Žinutė",
  }]]);
});
test("message API rejects client supplied sender or recipient", async () => {
  for (const field of ["sender_id", "recipient_id", "senderId", "recipientId"]) {
    const api = messaging();
    assert.equal((await api.send({ ...messageBody, [field]: "someone" })).status, 400);
    assert.equal(api.calls.length, 0);
  }
});
test("message API requires authentication and nonempty bounded content", async () => {
  assert.equal((await messaging({ user: null }).send(messageBody)).status, 401);
  for (const body of [null, { ...messageBody, message: " " }, { ...messageBody, subject: "" },
    { ...messageBody, message: "x".repeat(2001) }, { ...messageBody, subject: "x".repeat(121) },
    { ...messageBody, activityId: "bad-id" }]) {
    const api = messaging();
    assert.equal((await api.send(body)).status, 400);
    assert.equal(api.calls.length, 0);
  }
});
test("message API reports DB rejection for self messaging and missing activity", async () => {
  const response = await messaging({ error: { code: "P0020" } }).send(messageBody);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "Negalite siųsti žinutės sau.");
  assert.equal((await messaging({ error: { code: "P0002" } }).send(messageBody)).status, 404);
});

test("create route requires organizer_name and rejects empty strings", async () => {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "owner-1" } } }) },
    rpc: async (...args) => { calls.push(args); return { data: { success: true }, error: null }; },
  };
  const { POST } = load("../app/api/activities/route.ts", {
    "next/server": { NextResponse },
    "@/lib/supabase/server": { createClient: async () => client },
  });

  const response = await POST(new Request("http://localhost/api/activities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Snow adventure",
      description: "Test",
      location: "Vilnius",
      startsAt: "2100-01-01T12:00:00",
      capacity: 5,
      organizer_name: "   ",
    }),
  }));

  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

test("edit route only updates owned activity and blocks unauthorized requests", async () => {
  const calls = [];
  let updatePayload;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "owner-1" } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "activity-1", creator_id: "owner-1", status: "active" }, error: null }) }) }),
      update: payload => { updatePayload = payload; return {
        eq: () => ({ eq: () => ({ select: async () => ({ data: [{ id: "activity-1" }], error: null }) }) }),
      }; },
    }),
    rpc: async (...args) => { calls.push(args); return { data: { success: true }, error: null }; },
  };

  const { PATCH } = load("../app/api/activities/[id]/route.ts", {
    "next/server": { NextResponse },
    "@/lib/supabase/server": { createClient: async () => client },
  });

  const response = await PATCH(new Request("http://localhost/api/activities/3e9e0b88-a653-4d37-8f48-6faabf12a866", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Updated activity",
      location: "Kaunas",
      startsAt: "2100-03-01T10:00:00",
      capacity: 8,
      organizer_name: "Snow Adventure LT",
    }),
  }), { params: Promise.resolve({ id: "3e9e0b88-a653-4d37-8f48-6faabf12a866" }) });

  assert.equal(response.status, 200);
  assert.equal(calls.length, 0);
  assert.deepEqual(updatePayload, {
    title: "Updated activity",
    description: null,
    location: "Kaunas",
    starts_at: "2100-03-01T08:00:00.000Z",
    capacity: 8,
    organizer_name: "Snow Adventure LT",
  });
  assert.equal(updatePayload.creator_id, undefined);
});

test("edit route validates future date and positive capacity before database access", async () => {
  let databaseCalled = false;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "owner-1" } } }) },
    from: () => { databaseCalled = true; return {}; },
  };
  const { PATCH } = load("../app/api/activities/[id]/route.ts", {
    "next/server": { NextResponse },
    "@/lib/supabase/server": { createClient: async () => client },
  });
  const response = await PATCH(new Request("http://localhost/api/activities/3e9e0b88-a653-4d37-8f48-6faabf12a866", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Updated", location: "Kaunas", startsAt: "2020-01-01T10:00:00", capacity: 0, organizer_name: "Organizer" }),
  }), { params: Promise.resolve({ id: "3e9e0b88-a653-4d37-8f48-6faabf12a866" }) });

  assert.equal(response.status, 400);
  assert.equal(databaseCalled, false);
});

test("public activity uses organizer_name when available", () => {
  const { toActivity } = load("../lib/activities.ts", { "./supabase/server": {} });
  const result = toActivity({
    id: "activity-1",
    title: "Winter hike",
    description: "Test",
    starts_at: "2100-01-23T11:00:00+02:00",
    capacity: 10,
    available: 4,
    status: "active",
    location: "Trakai",
    creator_id: "owner-1",
    organizer_name: "Snow Adventure LT",
  });

  assert.equal(result.organizer, "Snow Adventure LT");
  assert.equal(result.organizer_name, "Snow Adventure LT");
});
