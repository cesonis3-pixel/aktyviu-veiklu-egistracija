import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { NextResponse } from "next/server.js";

function load(path, mocks) {
  const compiledModule = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("require", "module", "exports", source)(name => {
    assert.ok(name in mocks, name);
    return mocks[name];
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const id = "3e9e0b88-a653-4d37-8f48-6faabf12a866";
function setup({ user = { id: "owner" }, owner = "owner", error = null, exists = true } = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: exists ? { creator_id: owner } : null, error: null }) }) }) }),
    rpc: async (...args) => { calls.push(args); return { data: error ? null : { success: true }, error }; },
  };
  const { DELETE } = load("../app/api/activities/[id]/route.ts", {
    "next/server": { NextResponse }, "@/lib/supabase/server": { createClient: async () => client },
  });
  return { calls, run: (activityId = id) => DELETE(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ id: activityId }) }) };
}
test("delete rejects anonymous users without invoking RPC", async () => {
  const api = setup({ user: null });
  assert.equal((await api.run()).status, 401);
  assert.equal(api.calls.length, 0);
});
test("delete rejects a different owner without invoking RPC", async () => {
  const api = setup({ owner: "someone-else" });
  assert.equal((await api.run()).status, 403);
  assert.equal(api.calls.length, 0);
});
test("delete validates UUID and missing activities", async () => {
  const api = setup({ exists: false });
  assert.equal((await api.run("bad-id")).status, 400);
  assert.equal((await api.run()).status, 404);
  assert.equal(api.calls.length, 0);
});
test("owner deletion invokes only the guarded RPC", async () => {
  const api = setup();
  const response = await api.run();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.deepEqual(api.calls, [["delete_activity", { p_activity_id: id }]]);
});
test("active reservations and DB owner recheck failures reach the user", async () => {
  const api = setup({ error: { code: "P0013" } });
  const response = await api.run();
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /Naudokite veiklos atšaukimą/);
  assert.equal((await setup({ error: { code: "P0008" } }).run()).status, 403);
});
test("winter categories match titles without changing DB identity or description", () => {
  const { toActivity } = load("../lib/activities.ts", { "./supabase/server": {} });
  for (const [title, category, filename] of [
    ["Slidinėjimo treniruotė", "Slidinėjimas", "ski-tour.jpg"],
    ["Išvyka su keturračiais", "Keturračiai", "winter-atv.png"],
    ["Keturičiai sniege", "Keturračiai", "winter-atv.png"],
    ["Keturračiai sniege", "Keturračiai", "winter-atv.png"],
    ["Lauko treniruotė", "Lauko treniruotės", "winter-fitness.png"],
    ["Snieglentės veikla", "Snieglentės", "winter-snowboard.png"],
    ["Čiuožimas", "Čiuožimas", "winter-skating.png"],
    ["Rogutės", "Rogutės", "winter-sledding.png"],
  ]) {
    const result = toActivity({ id, title, description: "Organizatoriaus aprašymas", starts_at: "2027-01-23T11:00:00+02:00", capacity: 5, available: 3, status: "active", location: "Trakai" });
    assert.equal(result.id, id);
    assert.equal(result.title, title);
    assert.equal(result.description, "Organizatoriaus aprašymas");
    assert.equal(result.category, category);
    assert.equal(result.image, `/images/${filename}`);
    assert.ok(existsSync(new URL(`../public/images/${filename}`, import.meta.url)));
  }
});
