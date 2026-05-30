import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { ok, isOk, isErr } from "../result-option-types/index.ts";
import { createLensFromConfig, type LensConfig } from "./lens-configurable";
import type { Lens } from "./lens-core";

// Test helper: createLensFromConfig now returns Result<Lens, string>.
// Tests that exercise lens behavior on a valid config use this to keep
// assertions focused; tests for invalid config call the factory directly.
function buildLens<S extends object, A>(config: LensConfig): Lens<S, A> {
  const result = createLensFromConfig<S, A>(config);
  if (isErr(result)) {
    throw new Error(`Test setup: invalid LensConfig: ${result.error}`);
  }
  return result.value;
}

describe("createLensFromConfig", () => {
  const sampleObject = {
    a: 1,
    b: { c: "hello", d: [10, 20, { e: true }] },
    f: null,
  };

  it("returns Err for an empty getterPath", () => {
    const config: LensConfig = {
      sourceType: "Test",
      targetType: "any",
      getterPath: [],
    };
    const result = createLensFromConfig(config);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toContain("non-empty getterPath");
    }
  });

  it("views a top-level property", () => {
    const lens = buildLens<typeof sampleObject, number>({
      sourceType: "Test",
      targetType: "number",
      getterPath: ["a"],
    });
    expect(lens.view(sampleObject)).toEqual(ok(1));
  });

  it("views a nested property", () => {
    const lens = buildLens<typeof sampleObject, string>({
      sourceType: "Test",
      targetType: "string",
      getterPath: ["b", "c"],
    });
    expect(lens.view(sampleObject)).toEqual(ok("hello"));
  });

  it("views an array element", () => {
    const lens = buildLens<typeof sampleObject, number>({
      sourceType: "Test",
      targetType: "number",
      getterPath: ["b", "d", 0],
    });
    expect(lens.view(sampleObject)).toEqual(ok(10));
  });

  it("views a property in an object within an array", () => {
    const lens = buildLens<typeof sampleObject, boolean>({
      sourceType: "Test",
      targetType: "boolean",
      getterPath: ["b", "d", 2, "e"],
    });
    expect(lens.view(sampleObject)).toEqual(ok(true));
  });

  it("returns Err for a non-existent top-level property", () => {
    const lens = buildLens<typeof sampleObject, unknown>({
      sourceType: "Test",
      targetType: "any",
      getterPath: ["x"],
    });
    const result = lens.view(sampleObject);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toContain("Property 'x' does not exist");
    }
  });

  it("returns Err for a non-existent nested property", () => {
    const lens = buildLens<typeof sampleObject, unknown>({
      sourceType: "Test",
      targetType: "any",
      getterPath: ["b", "x"],
    });
    const result = lens.view(sampleObject);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toContain("Property 'x' does not exist");
    }
  });

  it("returns Err for an out-of-bounds array index", () => {
    const lens = buildLens<typeof sampleObject, unknown>({
      sourceType: "Test",
      targetType: "any",
      getterPath: ["b", "d", 5],
    });
    const result = lens.view(sampleObject);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toContain("Index 5 out of bounds");
    }
  });

  it("returns Err when the path encounters null", () => {
    const lens = buildLens<typeof sampleObject, unknown>({
      sourceType: "Test",
      targetType: "any",
      getterPath: ["f", "g"],
    });
    const result = lens.view(sampleObject);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toContain("current object is null/undefined");
    }
  });

  it("views a property whose value is legitimately undefined", () => {
    const objWithUndefined = { a: undefined };
    const lens = buildLens<typeof objWithUndefined, unknown>({
      sourceType: "Test",
      targetType: "any",
      getterPath: ["a"],
    });
    expect(lens.view(objWithUndefined)).toEqual(ok(undefined));
  });

  it("sets a top-level property", () => {
    const lens = buildLens<typeof sampleObject, number>({
      sourceType: "Test",
      targetType: "number",
      getterPath: ["a"],
    });
    const result = lens.set(sampleObject, 100);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.a).toBe(100);
    }
    expect(sampleObject.a).toBe(1);
  });

  it("sets a nested property", () => {
    const lens = buildLens<typeof sampleObject, string>({
      sourceType: "Test",
      targetType: "string",
      getterPath: ["b", "c"],
    });
    const result = lens.set(sampleObject, "world");
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.b.c).toBe("world");
    }
    expect(sampleObject.b.c).toBe("hello");
  });

  it("returns Err on set when an intermediate object does not exist (no throw)", () => {
    const lens = buildLens<typeof sampleObject, unknown>({
      sourceType: "Test",
      targetType: "any",
      getterPath: ["x", "y"],
    });
    const result = lens.set(sampleObject, "test");
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toContain("Invalid path element 'x'");
    }
  });

  it("returns Err on set when an intermediate is null (no throw)", () => {
    const lens = buildLens<typeof sampleObject, unknown>({
      sourceType: "Test",
      targetType: "any",
      getterPath: ["f", "g"],
    });
    const result = lens.set(sampleObject, "test");
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toContain("Invalid path element 'f'");
    }
  });

  describe("Configurable Lens Laws (Property-Based - Simplified)", () => {
    const arbKey = fc.string({ minLength: 1, maxLength: 5 });
    const arbValue = fc.oneof(
      fc.integer(),
      fc.string(),
      fc.boolean(),
      fc.constant(null)
    );

    const arbLeaf = arbValue;
    const arbNode = fc.dictionary(
      arbKey,
      fc.oneof(arbValue, fc.dictionary(arbKey, arbLeaf))
    );
    const arbObject = fc.dictionary(arbKey, fc.oneof(arbValue, arbNode));

    const arbPathForObject = (
      obj: object
    ): fc.Arbitrary<(string | number)[]> => {
      const paths: (string | number)[][] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function collectPaths(currentObj: any, currentPath: (string | number)[]) {
        if (typeof currentObj !== "object" || currentObj === null) return;
        for (const key in currentObj) {
          if (Object.prototype.hasOwnProperty.call(currentObj, key)) {
            paths.push([...currentPath, key]);
            if (
              typeof currentObj[key] === "object" &&
              !Array.isArray(currentObj[key])
            ) {
              for (const subKey in currentObj[key]) {
                if (
                  Object.prototype.hasOwnProperty.call(currentObj[key], subKey)
                ) {
                  paths.push([...currentPath, key, subKey]);
                }
              }
            }
          }
        }
      }
      collectPaths(obj, []);
      return paths.length > 0 ? fc.constantFrom(...paths) : fc.constant([]);
    };

    it("Get-Set: view(set(s, path, v).value) = v for valid paths", () => {
      fc.assert(
        fc.property(arbObject, arbValue, (s, val) => {
          fc.pre(Object.keys(s).length > 0);
          const path = fc.sample(arbPathForObject(s), 1);
          fc.pre(path && path.length > 0 && path[0] && path[0].length > 0);

          const lens = buildLens({
            sourceType: "Test",
            targetType: "any",
            getterPath: path[0] as ReadonlyArray<string | number>,
          });

          const setResult = lens.set(s, val);
          if (isOk(setResult)) {
            expect(lens.view(setResult.value)).toEqual(ok(val));
          }
        })
      );
    });
  });
});
