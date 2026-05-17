// Integration test for the schema-inference feature.
// Covers the store + banner + modal as the user would experience them.
import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

import {
  captureRun,
  clearInferenceFor,
  getInferenceFor,
  isInferenceEnabled,
  setInferenceEnabled,
} from "../../src/inference/inferenceStore";
import { InferenceBanner } from "../../src/inference/InferenceBanner";
import type { BlockRunResult } from "../../src/blocks/types";

function ok(body: unknown, httpStatus = 200): BlockRunResult {
  return {
    status: "ok",
    httpStatus,
    elapsedMs: 12,
    response: body,
    captured: {},
  };
}

function err(body: unknown, httpStatus: number, error = "HTTP"): BlockRunResult {
  return {
    status: "err",
    httpStatus,
    elapsedMs: 12,
    response: body,
    error,
  };
}

function renderInProvider(node: React.ReactElement) {
  return render(<MantineProvider>{node}</MantineProvider>);
}

beforeEach(() => {
  localStorage.clear();
});

describe("inferenceStore.captureRun", () => {
  it("captures a 2xx body and writes to localStorage", () => {
    const out = captureRun("get-user", ok({ id: 1, email: "a@b.co" }));
    expect(out).not.toBeNull();
    expect(out?.family).toBe("2xx");
    expect(out?.isNew).toBe(true);

    const stored = getInferenceFor("get-user");
    expect(stored?.runs).toBe(1);
    expect(stored?.schemas?.["2xx"]).toBeDefined();
    expect(stored?.examples?.["2xx"]).toEqual({ id: 1, email: "a@b.co" });
  });

  it("merges across multiple runs and intersects required keys", () => {
    captureRun("get-user", ok({ id: 1, email: "a@b.co" }));
    captureRun("get-user", ok({ id: 2, phone: "555" }));

    const inf = getInferenceFor("get-user");
    expect(inf?.runs).toBe(2);
    const s = inf?.schemas?.["2xx"] as { required: string[]; type: string };
    expect(s.type).toBe("object");
    expect(s.required).toEqual(["id"]);
  });

  it("keeps 2xx and 4xx families separate", () => {
    captureRun("call", ok({ data: 1 }));
    captureRun("call", err({ error: "not found" }, 404));

    const inf = getInferenceFor("call");
    expect(inf?.schemas?.["2xx"]).toBeDefined();
    expect(inf?.schemas?.["4xx"]).toBeDefined();
  });

  it("redacts sensitive fields before storing the example", () => {
    captureRun("login", ok({ password: "hunter2", token: "abc.def.ghi", id: 1 }));
    const ex = getInferenceFor("login")?.examples?.["2xx"] as Record<string, unknown>;
    expect(ex.id).toBe(1);
    expect(ex.password).not.toBe("hunter2");
    expect(ex.token).not.toBe("abc.def.ghi");
  });

  it("ignores network errors (no httpStatus)", () => {
    const r: BlockRunResult = {
      status: "err",
      elapsedMs: 0,
      response: null,
      error: "fetch failed",
    };
    expect(captureRun("net", r)).toBeNull();
    expect(getInferenceFor("net")).toBeUndefined();
  });

  it("does not capture when inference is disabled", () => {
    setInferenceEnabled(false);
    expect(captureRun("call", ok({ id: 1 }))).toBeNull();
    expect(getInferenceFor("call")).toBeUndefined();
    setInferenceEnabled(true);
  });

  it("detects schema drift between runs", () => {
    captureRun("call", ok({ status: "active" }));
    const second = captureRun("call", ok({ status: { code: 1 } }));
    expect(second?.driftCount).toBeGreaterThan(0);
    expect(getInferenceFor("call")?.lastDrift?.length).toBeGreaterThan(0);
  });

  it("clearInferenceFor removes the entry", () => {
    captureRun("call", ok({ id: 1 }));
    expect(getInferenceFor("call")).toBeDefined();
    clearInferenceFor("call");
    expect(getInferenceFor("call")).toBeUndefined();
  });
});

describe("settings", () => {
  it("defaults to enabled", () => {
    expect(isInferenceEnabled()).toBe(true);
  });

  it("round-trips through localStorage", () => {
    setInferenceEnabled(false);
    expect(isInferenceEnabled()).toBe(false);
    setInferenceEnabled(true);
    expect(isInferenceEnabled()).toBe(true);
  });
});

describe("InferenceBanner", () => {
  it("renders nothing when no inference exists for the block", () => {
    renderInProvider(<InferenceBanner kind="never-run" />);
    expect(screen.queryByText(/Response schema captured/i)).toBeNull();
    expect(screen.queryByText(/Schema drift detected/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /View schema/i })).toBeNull();
  });

  it("renders summary + View schema button after capture", () => {
    captureRun("get-user", ok({ id: 1, email: "a@b.co" }));
    renderInProvider(<InferenceBanner kind="get-user" />);

    expect(screen.getByText(/Response schema captured/i)).toBeTruthy();
    expect(screen.getByText(/1 run/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /View schema/i })).toBeTruthy();
  });

  it("flips to drift wording when a later run disagrees", () => {
    captureRun("get-user", ok({ status: "active" }));
    captureRun("get-user", ok({ status: { code: 1 } }));

    renderInProvider(<InferenceBanner kind="get-user" />);
    expect(screen.getByText(/Schema drift detected/i)).toBeTruthy();
  });

  it("re-renders when a new capture happens after mount", () => {
    renderInProvider(<InferenceBanner kind="late-block" />);
    expect(screen.queryByText(/Response schema captured/i)).toBeNull();

    act(() => {
      captureRun("late-block", ok({ id: 7 }));
    });

    expect(screen.getByText(/Response schema captured/i)).toBeTruthy();
  });

  it("View schema button is clickable when inference exists", () => {
    captureRun("get-user", ok({ id: 1 }));
    renderInProvider(<InferenceBanner kind="get-user" />);

    const btn = screen.getByRole("button", { name: /View schema/i });
    expect(btn).toBeTruthy();
    // The click handler is wired — calling it should not throw.
    expect(() => fireEvent.click(btn)).not.toThrow();
  });
});
