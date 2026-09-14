import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, beforeEach, test } from "node:test";
import ts from "typescript";
import { createBrowserClient } from "@supabase/ssr";
import { NextRequest } from "next/server.js";

// Real Supabase SSR/Next.js cookie implementations, mocked Auth HTTP responses.
// Never load .env.local or contact the hosted project in these tests.
const root = fileURLToPath(new URL("../", import.meta.url));
const projectRequire = createRequire(import.meta.url);
const originalFetch = globalThis.fetch;
const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const oldKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-test.example";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of [
    ["NEXT_PUBLIC_SUPABASE_URL", oldUrl],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", oldKey],
  ]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function load(relative, mocks = {}) {
  const filename = path.resolve(root, relative);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  const resolve = (name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) return load(`${name.slice(2)}.ts`, mocks);
    if (name.startsWith("."))
      return load(
        path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)),
        mocks,
      );
    return projectRequire(name);
  };
  new Function("require", "module", "exports", source)(
    resolve,
    compiledModule,
    compiledModule.exports,
  );
  return compiledModule.exports;
}

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "test@example.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
function session(expired = false, marker = "initial") {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (expired ? -120 : 3600);
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, email: user.email, aud: "authenticated", role: "authenticated", exp, iat: now - 180, session_id: marker })}.${Buffer.from("test-signature").toString("base64url")}`,
    refresh_token: `test-refresh-${marker}`,
    expires_in: expired ? -120 : 3600,
    expires_at: exp,
    token_type: "bearer",
    user,
  };
}
function jar() {
  const values = new Map();
  return {
    values,
    getAll: () => [...values].map(([name, value]) => ({ name, value })),
    setAll: (entries) =>
      entries.forEach(({ name, value, options }) =>
        options.maxAge === 0 ? values.delete(name) : values.set(name, value),
      ),
    header: () =>
      [...values].map(([name, value]) => `${name}=${value}`).join("; "),
  };
}
function browser(cookies) {
  return createBrowserClient(
    "https://auth-test.example",
    "test-publishable-key",
    {
      isSingleton: false,
      cookies,
      auth: { autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
}
let calls;
beforeEach(() => {
  calls = [];
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    assert.equal(
      url.origin,
      "https://auth-test.example",
      "Tests must not contact a real Auth server",
    );
    const grant = url.searchParams.get("grant_type");
    calls.push(`${url.pathname}${grant ? `?grant_type=${grant}` : ""}`);
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    if (url.pathname === "/auth/v1/logout")
      return new Response(null, { status: 204 });
    if (url.pathname === "/auth/v1/token") {
      if (grant === "password") {
        assert.deepEqual(JSON.parse(options.body), {
          email: user.email,
          password: "test-password",
          gotrue_meta_security: {},
        });
      }
      return Response.json(session(false, grant));
    }
    throw new Error("Unexpected Auth endpoint: " + url.pathname);
  };
});

test("password login writes cookies; proxy and fresh server read user after reload; logout removes cookies", async () => {
  const cookies = jar();
  const client = browser(cookies);
  const login = await client.auth.signInWithPassword({
    email: user.email,
    password: "test-password",
  });
  assert.equal(login.error, null);
  assert.ok(cookies.values.size > 0);
  assert.ok(
    !calls.some(
      (value) => value.includes("signup") || value.includes("resend"),
    ),
  );
  const before = cookies.header();
  const { updateSession } = load("lib/supabase/proxy.ts");
  const response = await updateSession(
    new NextRequest("http://localhost:3000/", { headers: { cookie: before } }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
  assert.ok(!response.cookies.getAll().some((cookie) => cookie.maxAge === 0));
  const { createClient } = load("lib/supabase/server.ts", {
    "next/headers": {
      cookies: async () => ({
        getAll: cookies.getAll,
        set: (name, value, options) =>
          cookies.setAll([{ name, value, options }]),
      }),
    },
  });
  const server = await createClient();
  const result = await server.auth.getUser();
  assert.equal(result.error, null);
  assert.equal(result.data.user.email, user.email);
  const reloaded = browser(cookies);
  assert.equal((await reloaded.auth.getUser()).data.user.email, user.email);
  assert.equal((await reloaded.auth.signOut({ scope: "local" })).error, null);
  assert.equal(cookies.values.size, 0);
  assert.equal((await browser(cookies).auth.getUser()).data.user, null);
});

test("expired session refresh reaches both request and response and includes SSR cache headers", async () => {
  const oldSession = session(true);
  const encoded =
    "base64-" + Buffer.from(JSON.stringify(oldSession)).toString("base64url");
  const request = new NextRequest("http://localhost:3000/", {
    headers: { cookie: `sb-auth-test-auth-token=${encoded}` },
  });
  const { updateSession } = load("lib/supabase/proxy.ts");
  const response = await updateSession(request);
  assert.ok(calls.includes("/auth/v1/token?grant_type=refresh_token"));
  const updated = response.cookies
    .getAll()
    .find((cookie) => cookie.name.startsWith("sb-auth-test-auth-token"));
  assert.ok(updated?.value);
  assert.notEqual(updated.value, encoded);
  assert.equal(request.cookies.get(updated.name).value, updated.value);
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  assert.equal(response.headers.get("Pragma"), "no-cache");
  assert.equal(response.headers.get("Expires"), "0");
});

test("anonymous login/register requests do not redirect or delete cookies", async () => {
  const { updateSession } = load("lib/supabase/proxy.ts");
  for (const route of ["/login", "/register", "/auth/callback"]) {
    const response = await updateSession(
      new NextRequest(`http://localhost:3000${route}`),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("location"), null);
    assert.equal(response.cookies.getAll().length, 0);
  }
  assert.equal(calls.length, 0);
});

test("callback exchanges PKCE code, sends session cookies with redirect, and rejects missing code safely", async () => {
  const { GET } = load("app/auth/callback/route.ts");
  const verifier =
    "base64-" +
    Buffer.from(JSON.stringify("test-verifier")).toString("base64url");
  const request = new NextRequest(
    "http://localhost:3000/auth/callback?code=test-code",
    {
      headers: { cookie: `sb-auth-test-auth-token-code-verifier=${verifier}` },
    },
  );
  const response = await GET(request);
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost:3000/");
  assert.ok(calls.includes("/auth/v1/token?grant_type=pkce"));
  assert.ok(
    response.cookies
      .getAll()
      .some(
        (cookie) => cookie.name === "sb-auth-test-auth-token" && cookie.value,
      ),
  );
  assert.equal(response.headers.get("Pragma"), "no-cache");
  const missing = await GET(
    new NextRequest("http://localhost:3000/auth/callback"),
  );
  assert.equal(
    missing.headers.get("location"),
    "http://localhost:3000/login?error=confirmation",
  );
});

test("Lithuanian errors distinguish credentials, confirmation, account, email limit, request limit and service/network failures", () => {
  const { getAuthErrorMessage } = load("lib/auth-errors.ts");
  const inputs = [
    { code: "invalid_credentials" },
    { code: "email_not_confirmed" },
    { code: "user_already_exists" },
    { code: "over_email_send_rate_limit" },
    { status: 429 },
    { status: 503 },
    { name: "AuthRetryableFetchError", status: 0 },
  ];
  assert.equal(new Set(inputs.map(getAuthErrorMessage)).size, inputs.length);
  assert.equal(
    getAuthErrorMessage({ code: "email_not_confirmed" }),
    "Pirmiausia patvirtinkite el. paštą.",
  );
  assert.match(
    getAuthErrorMessage({ message: "Email rate limit exceeded" }),
    /laiškų siuntimo limitas/,
  );
  assert.match(
    getAuthErrorMessage({ code: "email_address_not_authorized" }),
    /SMTP/,
  );
  assert.ok(
    !getAuthErrorMessage({ message: "sensitive upstream details" }).includes(
      "sensitive",
    ),
  );
});

test("callback without the registration browser verifier reports the specific recovery instruction", async () => {
  const { GET } = load("app/auth/callback/route.ts");
  const response = await GET(
    new NextRequest("http://localhost:3000/auth/callback?code=test-code"),
  );
  assert.equal(
    response.headers.get("location"),
    "http://localhost:3000/login?error=confirmation_browser",
  );
  assert.ok(!calls.includes("/auth/v1/token?grant_type=pkce"));
});

test("multiple SSR cookie writes preserve earlier cookies and first-write cache headers", async () => {
  const { updateSession } = load("lib/supabase/proxy.ts", {
    "@supabase/ssr": {
      createServerClient: (_url, _key, { cookies }) => ({
        auth: {
          getClaims: async () => {
            cookies.setAll(
              [{ name: "first", value: "one", options: { path: "/" } }],
              { "Cache-Control": "private, no-store", Pragma: "no-cache" },
            );
            cookies.setAll(
              [{ name: "second", value: "two", options: { path: "/" } }],
              {},
            );
            return { data: null, error: null };
          },
        },
      }),
    },
  });
  const response = await updateSession(
    new NextRequest("http://localhost:3000/login"),
  );
  assert.equal(response.cookies.get("first").value, "one");
  assert.equal(response.cookies.get("second").value, "two");
  assert.equal(response.headers.get("Pragma"), "no-cache");
});
