import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { createLensFromConfig, type LensConfig } from "./lens-configurable";

describe("createLensFromConfig", () => {
  const sampleObject = {
    a: 1,
    b: { c: "hello", d: [10, 20, { e: true }] },
    f: null,
  };

  it("should view a top-level property", () => {
    const config: LensConfig = {
      sourceType: "Test",
      targetType: "number",
      getterPath: ["a"],
    };
    const lens = createLensFromConfig<typeof sampleObject, number>(config);
    expect(lens.view(sampleObject)).toEqual({ success: true, value: 1 });
  });

  it("should view a nested property", () => {
    const config: LensConfig = {
      sourceType: "Test",
      targetType: "string",
      getterPath: ["b", "c"],
    };
    const lens = createLensFromConfig<typeof sampleObject, string>(config);
    expect(lens.view(sampleObject)).toEqual({ success: true, value: "hello" });
  });

  it("should view an array element", () => {
    const config: LensConfig = {
      sourceType: "Test",
      targetType: "number",
      getterPath: ["b", "d", 0],
    };
    const lens = createLensFromConfig<typeof sampleObject, number>(config);
    expect(lens.view(sampleObject)).toEqual({ success: true, value: 10 });
  });

  it("should view a property in an object within an array", () => {
    const config: LensConfig = {
      sourceType: "Test",
      targetType: "boolean",
      getterPath: ["b", "d", 2, "e"],
    };
    const lens = createLensFromConfig<typeof sampleObject, boolean>(config);
    expect(lens.view(sampleObject)).toEqual({ success: true, value: true });
  });

  it("should return error for non-existent top-level property", () => {
    const config: LensConfig = {
      sourceType: "Test",
      targetType: "any",
      getterPath: ["x"],
    };
    const lens = createLensFromConfig<typeof sampleObject, unknown>(config);
    const result = lens.view(sampleObject) as { success: false; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toContain("Property 'x' does not exist");
  });

  it("should return error for non-existent nested property", () => {
    const config: LensConfig = {
      sourceType: "Test",
      targetType: "any",
      getterPath: ["b", "x"],
    };
    const lens = createLensFromConfig<typeof sampleObject, unknown>(config);
    const result = lens.view(sampleObject) as { success: false; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toContain("Property 'x' does not exist");
  });

  it("should return error for out-of-bounds array index", () => {
    const config: LensConfig = {
      sourceType: "Test",
      targetType: "any",
      getterPath: ["b", "d", 5],
    };
    const lens = createLensFromConfig<typeof sampleObject, unknown>(config);
    const result = lens.view(sampleObject) as { success: false; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toContain("Index 5 out of bounds");
  });

  it("should return error when path encounters null", () => {
    const config: LensConfig = {
      sourceType: "Test",
      targetType: "any",
      getterPath: ["f", "g"],
    };
    const lens = createLensFromConfig<typeof sampleObject, unknown>(config);
    const result = lens.view(sampleObject) as { success: false; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toContain("current object is null/undefined");
  });

  it("should view a property that is legitimately undefined", () => {
    const objWithUndefined = { a: undefined };
    const config: LensConfig = {
      sourceType: "Test",
      targetType: "any",
      getterPath: ["a"],
    };
    const lens = createLensFromConfig<typeof objWithUndefined, unknown>(config);
    expect(lens.view(objWithUndefined)).toEqual({
      success: true,
      value: undefined,
    });
  });

  it("should set a top-level property", () => {
    const config: LensConfig = {
      sourceType: "Test",
      targetType: "number",
      getterPath: ["a"],
    };
    const lens = createLensFromConfig<typeof sampleObject, number>(config);
    const newObj = lens.set(sampleObject, 100);
    expect(newObj.a).toBe(100);
    expect(sampleObject.a).toBe(1); // Immutability
  });

  it("should set a nested property", () => {
    const config: LensConfig = {
      sourceType: "Test",
      targetType: "string",
      getterPath: ["b", "c"],
    };
    const lens = createLensFromConfig<typeof sampleObject, string>(config);
    const newObj = lens.set(sampleObject, "world");
    expect(newObj.b.c).toBe("world");
    expect(sampleObject.b.c).toBe("hello"); // Immutability
  });

  it("should throw error when setting on a path where intermediate object does not exist", () => {
    const config: LensConfig = {
      sourceType: "Test",
      targetType: "any",
      getterPath: ["x", "y"],
    };
    const lens = createLensFromConfig<typeof sampleObject, unknown>(config);
    expect(() => lens.set(sampleObject, "test")).toThrowError(
      /Invalid path element 'x'/
    );
  });

  it("should throw error when setting on a path where intermediate is null", () => {
    const config: LensConfig = {
      sourceType: "Test",
      targetType: "any",
      getterPath: ["f", "g"],
    };
    const lens = createLensFromConfig<typeof sampleObject, unknown>(config);
    // The error message might vary based on the exact check that fails first in the 'set' loop.
    // It will throw because current[pathElement] (f[g]) will be problematic as f is null.
    expect(() => lens.set(sampleObject, "test")).toThrowError();
  });

  // Property-Based Tests (Illustrative - complex arbitraries needed for full coverage)
  describe("Configurable Lens Laws (Property-Based - Simplified)", () => {
    // Arbitrary for simple nested objects and paths
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
    ); // Max 1 level nesting for simplicity
    const arbObject = fc.dictionary(arbKey, fc.oneof(arbValue, arbNode));

    // Generates a valid path for a given object (simplified for 1-2 levels)
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
              // Only one more level for simplicity
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

    it("Get-Set: view(set(s, path, v), path) = v (for valid paths)", () => {
      fc.assert(
        fc.property(arbObject, arbValue, (s, val) => {
          // This test is tricky because arbPathForObject needs 's'
          // We'll test with a fixed known path if 's' has it, or skip.
          // A more robust PBT would generate s and path together.
          fc.pre(Object.keys(s).length > 0); // Ensure object is not empty
          const path = fc.sample(arbPathForObject(s), 1); // Get a sample path
          fc.pre(path && path.length > 0); // Ensure path is valid

          const config: LensConfig = {
            sourceType: "Test",
            targetType: "any",
            getterPath: path[0] as ReadonlyArray<string | number>,
          };
          const l = createLensFromConfig(config);

          const newS = l.set(s, val);
          const viewResult = l.view(newS);
          expect(viewResult).toEqual({ success: true, value: val });
        })
      );
    });
  });
});
