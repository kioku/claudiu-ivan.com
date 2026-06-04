import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { ok, err, isOk, isErr } from "../result-option-types/index.ts";
import { lensProp, composeLens, type Lens } from "./lens-core";

describe("lensProp", () => {
  it("views a property as Ok", () => {
    const obj = { a: 1, b: "hello" };
    const lensA = lensProp<typeof obj, "a">("a");
    expect(lensA.view(obj)).toEqual(ok(1));
  });

  it("sets a property as Ok and preserves immutability", () => {
    const obj = { a: 1, b: "hello" };
    const lensA = lensProp<typeof obj, "a">("a");
    const result = lensA.set(obj, 2);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.a).toBe(2);
    }
    expect(obj.a).toBe(1);
  });

  it("returns Err when the property does not exist on view", () => {
    const obj = { a: 1 };
    const lensB = lensProp<Record<string, unknown>, "b">("b");
    const result = lensB.view(obj);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBe("Property 'b' not found on source object.");
    }
  });

  it("returns Err when the source is null or undefined on view", () => {
    const lensA = lensProp<Record<string, unknown>, "a">("a");
    expect(isErr(lensA.view(null as unknown as Record<string, unknown>))).toBe(
      true
    );
    expect(
      isErr(lensA.view(undefined as unknown as Record<string, unknown>))
    ).toBe(true);
  });

  describe("Lens Laws (Property-Based)", () => {
    const arbSimpleObject = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 10 }),
      fc.oneof(fc.integer(), fc.string(), fc.boolean())
    );

    it("Set-Get: set(s, view(s).value) = s", () => {
      fc.assert(
        fc.property(
          arbSimpleObject,
          fc.string({ minLength: 1, maxLength: 10 }),
          (s, key) => {
            s[key] = "default";
            const l = lensProp<Record<string, unknown>, string>(key);
            const viewResult = l.view(s);
            if (isOk(viewResult)) {
              const setResult = l.set(s, viewResult.value);
              expect(isOk(setResult)).toBe(true);
              if (isOk(setResult)) {
                expect(setResult.value).toEqual(s);
              }
            }
          }
        )
      );
    });

    it("Get-Set: view(set(s, v).value) = v", () => {
      fc.assert(
        fc.property(
          arbSimpleObject,
          fc.string({ minLength: 1, maxLength: 10 }),
          fc.oneof(fc.integer(), fc.string(), fc.boolean()),
          (s, key, val) => {
            const l = lensProp<Record<string, unknown>, string>(key);
            const setResult = l.set(s, val);
            expect(isOk(setResult)).toBe(true);
            if (isOk(setResult)) {
              expect(l.view(setResult.value)).toEqual(ok(val));
            }
          }
        )
      );
    });

    it("Set-Set: set(set(s, v1).value, v2) = set(s, v2)", () => {
      fc.assert(
        fc.property(
          arbSimpleObject,
          fc.string({ minLength: 1, maxLength: 10 }),
          fc.oneof(fc.integer(), fc.string(), fc.boolean()),
          fc.oneof(fc.integer(), fc.string(), fc.boolean()),
          (s, key, v1, v2) => {
            const l = lensProp<Record<string, unknown>, string>(key);
            const first = l.set(s, v1);
            expect(isOk(first)).toBe(true);
            if (isOk(first)) {
              expect(l.set(first.value, v2)).toEqual(l.set(s, v2));
            }
          }
        )
      );
    });
  });
});

describe("composeLens", () => {
  interface Inner {
    c: number;
  }
  interface Outer {
    b: Inner;
  }
  interface State {
    a: Outer;
  }

  const state: State = { a: { b: { c: 100 } } };
  const lensA = lensProp<State, "a">("a");
  const lensB = lensProp<Outer, "b">("b");
  const lensC = lensProp<Inner, "c">("c");

  const lensAB = composeLens(lensA, lensB);
  const lensABC = composeLens(lensAB, lensC);

  it("views a deeply nested property as Ok", () => {
    expect(lensABC.view(state)).toEqual(ok(100));
  });

  it("sets a deeply nested property as Ok and preserves immutability", () => {
    const result = lensABC.set(state, 200);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.a.b.c).toBe(200);
    }
    expect(state.a.b.c).toBe(100);
  });

  it("propagates view Err from the outer lens", () => {
    const badLensA = lensProp<Record<string, unknown>, "x">(
      "x"
    ) as unknown as Lens<State, Outer>;
    const composed = composeLens(badLensA, lensB);
    const result = composed.view(state);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toContain("Property 'x' not found");
    }
  });

  it("propagates view Err from the inner lens", () => {
    const badLensC = lensProp<Record<string, unknown>, "z">(
      "z"
    ) as unknown as Lens<Inner, number>;
    const composed = composeLens(lensAB, badLensC);
    const result = composed.view(state);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toContain("Property 'z' not found");
    }
  });

  it("returns Err on set when the outer view fails (no throw)", () => {
    const badLensA = lensProp<Record<string, unknown>, "x">(
      "x"
    ) as unknown as Lens<State, Outer>;
    const composed = composeLens(badLensA, lensB);
    const result = composed.set(state, { c: 1 });
    expect(result).toEqual(err("Property 'x' not found on source object."));
  });
});
