import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsx from "react/jsx-runtime";
import ts from "typescript";

function load(path, overrides = {}) {
  const compiledModule = { exports: {} };
  const mocks = {
    react: React,
    "react/jsx-runtime": jsx,
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/image": { __esModule: true, default: () => null },
    "next/navigation": { useRouter: () => ({ refresh() {}, push() {} }) },
    "./icon": { Icon: () => null },
    ...overrides,
  };
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("require", "module", "exports", source)(name => {
    assert.ok(name in mocks, name);
    return mocks[name];
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

const { ActivityCard } = load("../components/activity-card.tsx");
const { ActivityDetail } = load("../components/activity-detail.tsx");
const { MyReservations } = load("../components/my-reservations.tsx", { "./activity-card": { ActivityCard } });
const { MyActivities } = load("../components/my-activities.tsx", { "./activity-card": { ActivityCard } });
const activity = {
  id: "b913dace-786a-4ba1-9207-6281c247ee01", title: "Žygis gamtoje",
  status: "active", isReserved: true, available: 1, capacity: 10,
  date: "2027-01-23T11:00:00+02:00", dateLabel: "2027 m. sausio 23 d. · 11:00",
  location: "Kauno rajonas", category: "Žygiai", organizer: "Jurgita",
  description: "Žygio aprašymas", image: "/images/winter-forest.jpg", imageAlt: "Miškas",
};
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));

test("my activities exposes deletion for supplied owned activities and an empty state", () => {
  const html = render(MyActivities, { activities: [activity] });
  assert.match(html, /Žygis gamtoje/);
  assert.match(html, /Ištrinti veiklą/);
  assert.doesNotMatch(html, /Ar tikrai norite ištrinti/);
  assert.match(render(MyActivities, { activities: [] }), /Kol kas neturite veiklų/);
});

test("active activity and reservation keep existing participant actions", () => {
  const html = render(MyReservations, { signedIn: true, items: [{ activity, reservation: { activity_id: activity.id, status: "active" } }] });
  assert.match(html, /Vieta rezervuota/);
  assert.match(html, /Atšaukti rezervaciją/);
  assert.doesNotMatch(html, /Veikla atšaukta/);
});

test("cancelled activity retains old reservation, title, date and location", () => {
  for (const status of ["active", "cancelled"]) {
    const html = render(MyReservations, { signedIn: true, items: [{ activity: { ...activity, status: "cancelled" }, reservation: { activity_id: activity.id, status } }] });
    for (const text of ["Veikla atšaukta", activity.title, activity.dateLabel, activity.location, "rezervacijos įrašas išsaugotas"])
      assert.ok(html.includes(text), text);
    assert.doesNotMatch(html, /Registruotis|Atšaukti rezervaciją/);
  }
});

test("cancelled cards and details never offer registration to guests or participants", () => {
  for (const signedIn of [true, false]) {
    for (const isReserved of [true, false]) {
      const props = { activity: { ...activity, status: "cancelled", isReserved }, signedIn };
      const card = render(ActivityCard, props);
      const detail = render(ActivityDetail, props);
      assert.match(card, /Veikla atšaukta/);
      assert.match(detail, /Naujos rezervacijos nebepriimamos/);
      assert.doesNotMatch(card + detail, /Registruotis|Registruoti vietą|Atšaukti rezervaciją/);
    }
  }
});

test("stale active page displays server rejection and refreshes current activity status", async () => {
  const states = [];
  let refreshed = false;
  const hooks = {
    useState: initial => {
      const index = states.push(initial) - 1;
      return [initial, value => { states[index] = value; }];
    },
    useRef: current => ({ current }),
    useEffect() {},
    useTransition: () => [false, callback => callback()],
  };
  const { ActivityDetail: Detail } = load("../components/activity-detail.tsx", {
    react: hooks,
    "next/navigation": { useRouter: () => ({ refresh() { refreshed = true; }, push() {} }) },
  });
  const tree = Detail({ activity: { ...activity, isReserved: false }, signedIn: true });
  function findButton(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "button" && node.props.onClick) return node;
    for (const child of React.Children.toArray(node.props?.children)) {
      const found = findButton(child);
      if (found) return found;
    }
  }
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/reservations");
    assert.equal(options.method, "POST");
    return { ok: false, status: 409, json: async () => ({ error: "Ši veikla atšaukta." }) };
  };
  try {
    await findButton(tree).props.onClick();
    assert.equal(states[0], "Ši veikla atšaukta.");
    assert.equal(states[1], false);
    assert.equal(refreshed, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Supabase activity mapping preserves cancelled status", () => {
  const { toActivity } = load("../lib/activities.ts", { "./supabase/server": {} });
  assert.equal(toActivity({ ...activity, starts_at: activity.date, status: "cancelled" }).status, "cancelled");
});
