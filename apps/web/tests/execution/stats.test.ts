import { describe, it, expect } from "vitest";
import { percentiles, summarizeLatencies } from "../../src/execution/stats";

describe("percentiles", () => {
  it("returns {} for empty array", () => {
    expect(percentiles([], [50, 95])).toEqual({});
  });

  it("single value [42] → all percentiles equal 42", () => {
    const result = percentiles([42], [0, 50, 95, 100]);
    expect(result[0]).toBe(42);
    expect(result[50]).toBe(42);
    expect(result[95]).toBe(42);
    expect(result[100]).toBe(42);
  });

  it("[1..10] → p50 = 5.5, p95 ≈ 9.55 (type-7 linear interpolation)", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = percentiles(values, [50, 95]);
    expect(result[50]).toBeCloseTo(5.5, 2);
    expect(result[95]).toBeCloseTo(9.55, 2);
  });

  it("produces the same result for unsorted input as for sorted", () => {
    const unsorted = [5, 3, 8, 1, 9, 2, 7, 4, 6, 10];
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const r1 = percentiles(unsorted, [50, 95]);
    const r2 = percentiles(sorted, [50, 95]);
    expect(r1[50]).toBeCloseTo(r2[50], 10);
    expect(r1[95]).toBeCloseTo(r2[95], 10);
  });

  it("does not mutate the input array", () => {
    const input = [5, 3, 8, 1, 9];
    const copy = [...input];
    percentiles(input, [50, 95]);
    expect(input).toEqual(copy);
  });
});

describe("summarizeLatencies", () => {
  it("returns all-zero summary for empty array", () => {
    expect(summarizeLatencies([])).toEqual({
      min: 0,
      p50: 0,
      p95: 0,
      max: 0,
      mean: 0,
    });
  });

  it("single value [42] → all fields equal 42", () => {
    const result = summarizeLatencies([42]);
    expect(result.min).toBe(42);
    expect(result.p50).toBe(42);
    expect(result.p95).toBe(42);
    expect(result.max).toBe(42);
    expect(result.mean).toBe(42);
  });

  it("[10, 20, 30] → min=10, max=30, mean=20", () => {
    const result = summarizeLatencies([10, 20, 30]);
    expect(result.min).toBe(10);
    expect(result.max).toBe(30);
    expect(result.mean).toBe(20);
  });
});
