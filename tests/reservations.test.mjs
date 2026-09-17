import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { NextResponse } from "next/server.js";

function load(path, mocks = {}) {
  const compiledModule = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", source)(name => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`);
    return mocks[name];
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

const errors = load("../lib/reservation-errors.ts");
const activityId = "b913dace-786a-4ba1-9207-6281c247ee01";
function setup({ user = { id: "signed-in-user" }, error = null, fails = false } = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    rpc: async (...args) => {
      calls.push(args);
      if (fails) throw new Error("private upstream information");
      return { data: error ? null : { success: true, available: 0 }, error };
    },
  };
  const route = load("../app/api/reservations/route.ts", {
    "next/server": { NextResponse },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/reservation-errors": errors,
  });
  return { ...route, calls };
}
const request = (body = { activityId }) => new Request("http://localhost/api/reservations", {
  method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
});

test("successful reservation passes only activity UUID to existing RPC", async () => {
  const api = setup();
  const response = await api.POST(request({ activityId, user_id: "another-user" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, available: 0 });
  assert.deepEqual(api.calls, [["reserve_activity", { p_activity_id: activityId }]]);
});

test("unauthenticated requests cannot invoke reservation RPC", async () => {
  const api = setup({ user: null });
  assert.equal((await api.POST(request())).status, 401);
  assert.deepEqual(api.calls, []);
});

test("invalid UUID and malformed JSON do not invoke RPC", async () => {
  const api = setup();
  for (const body of [null, {}, { activityId: 123 }, { activityId: "old-slug" }]) {
    assert.equal((await api.POST(request(body))).status, 400);
  }
  assert.equal((await api.POST(new Request("http://localhost", { method: "POST", body: "{" }))).status, 400);
  assert.deepEqual(api.calls, []);
});

test("full, duplicate and cancelled activity responses are clear Lithuanian conflicts", async () => {
  for (const [code, message] of [
    ["P0005", "Vietų nebeliko."],
    ["P0004", "Jūs jau turite rezervaciją šiai veiklai."],
    ["23505", "Jūs jau turite rezervaciją šiai veiklai."],
    ["P0003", "Ši veikla atšaukta."],
  ]) {
    const api = setup({ error: { code, message: "private DB details" } });
    const response = await api.POST(request());
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: message });
  }
});

test("activity creator cannot reserve through the API", async () => {
  const response = await setup({ error: { code: "P0014" } }).POST(request());
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Negalite rezervuoti savo sukurtos veiklos." });
});

test("unexpected database and network errors do not expose internal messages", async () => {
  for (const options of [{ error: { code: "XX000", message: "private DB details" } }, { fails: true }]) {
    const response = await setup(options).POST(request());
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "Nepavyko pakeisti rezervacijos. Bandykite dar kartą." });
  }
});

test("cancellation keeps the existing cancellation RPC", async () => {
  const api = setup();
  assert.equal((await api.DELETE(request())).status, 200);
  assert.deepEqual(api.calls, [["cancel_reservation", { p_activity_id: activityId }]]);
});
