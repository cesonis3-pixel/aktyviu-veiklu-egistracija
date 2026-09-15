import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { NextResponse } from "next/server.js";

function load(relativePath, mocks = {}) {
  const source = ts.transpileModule(readFileSync(new URL(relativePath, import.meta.url), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: relativePath.endsWith(".tsx") ? ts.JsxEmit.ReactJSX : undefined,
    },
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

test("reactivation API requires a session and forwards only the activity UUID", async () => {
  for (const signedIn of [false, true]) {
    const calls = [];
    const { POST } = load("../app/api/activities/[id]/reactivate/route.ts", {
      "next/server": { NextResponse },
      "@/lib/supabase/server": { createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: signedIn ? { id: "owner" } : null } }) },
        rpc: async (...args) => { calls.push(args); return { data: { success: true, status: "active" }, error: null }; },
      }) },
    });
    const response = await POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: messageBody.activityId }) });
    assert.equal(response.status, signedIn ? 200 : 401);
    assert.deepEqual(calls, signedIn ? [["reactivate_activity", { p_activity_id: messageBody.activityId }]] : []);
  }
});

test("reactivation API explains missing, foreign, active and past activities", async () => {
  for (const [code, expected] of [["P0002", 404], ["P0008", 403], ["P0022", 409], ["P0023", 409]]) {
    const { POST } = load("../app/api/activities/[id]/reactivate/route.ts", {
      "next/server": { NextResponse },
      "@/lib/supabase/server": { createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
        rpc: async () => ({ data: null, error: { code } }),
      }) },
    });
    const response = await POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: messageBody.activityId }) });
    assert.equal(response.status, expected);
    if (code === "P0023") assert.equal((await response.json()).error, "Negalima aktyvuoti veiklos, kurios data jau praėjo. Pirmiausia pakeiskite datą.");
  }
});

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

for (const status of ["active", "cancelled"]) {
  for (const own of [true, false]) {
    test(`editing ${status} activity: ${own ? "owner preserves status and creator" : "other user is rejected"}`, async () => {
      const row = { id: messageBody.activityId, creator_id: "owner", status };
      const filters = [];
      let updates = 0;
      const client = {
        auth: { getUser: async () => ({ data: { user: { id: own ? "owner" : "other" } } }) },
        from: () => ({
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...row }, error: null }) }) }),
          update: payload => {
            updates++;
            assert.deepEqual(Object.keys(payload).sort(), ["title", "description", "location", "starts_at", "capacity", "organizer_name"].sort());
            const query = {
              eq: (field, value) => { filters.push([field, value]); return query; },
              select: async () => { Object.assign(row, payload); return { data: [{ id: row.id }], error: null }; },
            };
            return query;
          },
        }),
      };
      const { PATCH } = load("../app/api/activities/[id]/route.ts", {
        "next/server": { NextResponse }, "@/lib/supabase/server": { createClient: async () => client },
      });
      const response = await PATCH(new Request("http://localhost", {
        method: "PATCH", body: JSON.stringify({
          title: "Pakeistas pavadinimas", description: "Naujas aprašymas", location: "Trakai",
          startsAt: "2100-01-01T10:00:00Z", capacity: 8, organizer_name: "Organizatorius",
          creator_id: "attacker", status: "active",
        }),
      }), { params: Promise.resolve({ id: row.id }) });
      assert.equal(response.status, own ? 200 : 403);
      assert.equal(updates, own ? 1 : 0);
      assert.equal(row.status, status);
      assert.equal(row.creator_id, "owner");
      if (own) {
        assert.equal(row.title, "Pakeistas pavadinimas");
        assert.deepEqual(filters, [["id", row.id], ["creator_id", "owner"]]);
      }
    });
  }
}

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

test("activity detail shows owner management and hides messaging from owner", () => {
  const { ActivityDetail } = load("../components/activity-detail.tsx", {
    react: React,
    "react/jsx-runtime": { jsx: React.createElement, jsxs: React.createElement, Fragment: React.Fragment },
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/image": { __esModule: true, default: () => null },
    "next/navigation": { useRouter: () => ({ refresh() {}, push() {} }) },
    "./icon": { Icon: () => null },
    "./reactivate-activity": { ReactivateActivity: () => null },
  });
  const activity = {
    id: "activity-1",
    creator_id: "owner-1",
    title: "Winter hike",
    category: "Žygiai",
    date: "2100-01-23T11:00:00+02:00",
    dateLabel: "2100 m. sausio 23 d. · 11:00",
    location: "Trakai",
    organizer: "Organizatorius",
    organizer_name: "Snow Adventure LT",
    capacity: 10,
    available: 4,
    status: "active",
    image: "/images/winter-forest.jpg",
    imageAlt: "Miškas",
    description: "Test",
  };
  const ownerHtml = renderToStaticMarkup(React.createElement(ActivityDetail, { activity, signedIn: true, currentUserId: "owner-1" }));
  const visitorHtml = renderToStaticMarkup(React.createElement(ActivityDetail, { activity, signedIn: true, currentUserId: "visitor-1" }));

  assert.match(ownerHtml, /Veiklos valdymas/);
  assert.match(ownerHtml, /Redaguoti/);
  assert.match(ownerHtml, /Ištrinti veiklą/);
  assert.doesNotMatch(ownerHtml, /Parašyti organizatoriui/);
  assert.match(visitorHtml, /Parašyti organizatoriui/);
  assert.doesNotMatch(visitorHtml, /Veiklos valdymas/);
  assert.match(ownerHtml, /Snow Adventure LT/);
});
