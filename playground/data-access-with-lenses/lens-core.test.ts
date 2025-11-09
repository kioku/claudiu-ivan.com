import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { lensProp, composeLens } from "./lens-core";

describe("lensProp", () => {
  it("should view a property correctly", () => {
    const obj = { a: 1, b: "hello" };
    const lensA = lensProp<typeof obj, "a">("a");
    expect(lensA.view(obj)).toEqual({ success: true, value: 1 });
  });

  it("should set a property correctly", () => {
    const obj = { a: 1, b: "hello" };
    const lensA = lensProp<typeof obj, "a">("a");
    const newObj = lensA.set(obj, 2);
    expect(newObj.a).toBe(2);
    expect(obj.a).toBe(1); // Immutability
  });

  it("should return error if property does not exist on view", () => {
    const obj = { a: 1 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lensB = lensProp<any, "b">("b"); // Using any for test simplicity
    const result = lensB.view(obj) as { success: false; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toBe("Property 'b' not found on source object.");
  });

  it("should return error if source is null or undefined on view", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lensA = lensProp<any, "a">("a");
    expect(lensA.view(null).success).toBe(false);
    expect(lensA.view(undefined).success).toBe(false);
  });

  // Property-Based Tests for Lens Laws
  describe("Lens Laws (Property-Based)", () => {
    // Arbitrary for simple objects with string keys and primitive values
    const arbSimpleObject = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 10 }),
      fc.oneof(fc.integer(), fc.string(), fc.boolean())
    );

    it("Set-Get: set(s, view(s)) = s", () => {
      fc.assert(
        fc.property(
          arbSimpleObject,
          fc.string({ minLength: 1, maxLength: 10 }),
          (s, key) => {
            // Ensure key exists for this law to be meaningful with lensProp
            s[key] = "default"; // Add key if not present for test setup
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const l = lensProp<any, typeof key>(key);
            const viewResult = l.view(s);
            if (viewResult.success) {
              expect(l.set(s, viewResult.value)).toEqual(s);
            } else {
              // If view fails, this law doesn't apply in this form.
              // lensProp view fails if key is not in s, but we added it.
              // This path should ideally not be hit if key is ensured.
              return true; // or handle as appropriate
            }
          }
        )
      );
    });

    it("Get-Set: view(set(s, v)) = v", () => {
      fc.assert(
        fc.property(
          arbSimpleObject,
          fc.string({ minLength: 1, maxLength: 10 }),
          fc.oneof(fc.integer(), fc.string(), fc.boolean()),
          (s, key, val) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const l = lensProp<any, typeof key>(key);
            const newS = l.set(s, val);
            const viewResult = l.view(newS);
            expect(viewResult).toEqual({ success: true, value: val });
          }
        )
      );
    });

    it("Set-Set: set(set(s, v1), v2) = set(s, v2)", () => {
      fc.assert(
        fc.property(
          arbSimpleObject,
          fc.string({ minLength: 1, maxLength: 10 }),
          fc.oneof(fc.integer(), fc.string(), fc.boolean()),
          fc.oneof(fc.integer(), fc.string(), fc.boolean()),
          (s, key, v1, v2) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const l = lensProp<any, typeof key>(key);
            expect(l.set(l.set(s, v1), v2)).toEqual(l.set(s, v2));
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

  it("should view a deeply nested property correctly", () => {
    expect(lensABC.view(state)).toEqual({ success: true, value: 100 });
  });

  it("should set a deeply nested property correctly", () => {
    const newState = lensABC.set(state, 200);
    expect(newState.a.b.c).toBe(200);
    expect(state.a.b.c).toBe(100); // Immutability
  });

  it("should propagate view error from outer lens", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const badLensA = lensProp<any, "x">("x"); // x does not exist
    const composed = composeLens(badLensA, lensB);
    const result = composed.view(state) as { success: false; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toContain("Property 'x' not found");
  });

  it("should propagate view error from inner lens", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const badLensC = lensProp<Inner, any>("z"); // z does not exist on Inner
    const composed = composeLens(lensAB, badLensC); // lensAB is valid
    const result = composed.view(state) as { success: false; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toContain("Property 'z' not found");
  });

  it("should throw error on set if outer lens view fails", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const badLensA = lensProp<any, "x">("x");
    const composed = composeLens(badLensA, lensB);
    expect(() => composed.set(state, { c: 1 })).toThrowError(
      /Cannot compose set: outer lens failed to view/
    );
  });
});
