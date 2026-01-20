import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  flatMap,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  match,
  filter,
  zip,
  type Result,
} from "./result";

describe("Result", () => {
  describe("Constructors", () => {
    it("should create Ok with a value", () => {
      const result = ok(42);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    it("should create Err with an error", () => {
      const result = err("error message");
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe("error message");
      }
    });
  });

  describe("Type Guards", () => {
    it("should correctly identify Ok", () => {
      const result = ok(100);
      expect(isOk(result)).toBe(true);
      expect(isErr(result)).toBe(false);
    });

    it("should correctly identify Err", () => {
      const result = err("failure");
      expect(isOk(result)).toBe(false);
      expect(isErr(result)).toBe(true);
    });
  });

  describe("map", () => {
    it("should transform Ok value", () => {
      const result = ok(5);
      const mapped = map(result, (x) => x * 2);
      expect(mapped).toEqual(ok(10));
    });

    it("should leave Err untouched", () => {
      const result = err<string, number>("error");
      const mapped = map(result, (x) => x * 2);
      expect(mapped).toEqual(err("error"));
    });
  });

  describe("mapErr", () => {
    it("should leave Ok untouched", () => {
      const result = ok<number, string>(42);
      const mapped = mapErr(result, (e) => `Error: ${e}`);
      expect(mapped).toEqual(ok(42));
    });

    it("should transform Err value", () => {
      const result = err<string, number>("failure");
      const mapped = mapErr(result, (e) => `Error: ${e}`);
      expect(mapped).toEqual(err("Error: failure"));
    });
  });

  describe("flatMap", () => {
    it("should flatten nested Results", () => {
      const result = ok(5);
      const flattened = flatMap(result, (x) =>
        x > 0 ? ok(x * 2) : err("negative")
      );
      expect(flattened).toEqual(ok(10));
    });

    it("should return Err if inner function returns Err", () => {
      const result = ok(-5);
      const flattened = flatMap(result, (x) =>
        x > 0 ? ok(x * 2) : err("negative")
      );
      expect(flattened).toEqual(err("negative"));
    });

    it("should propagate original Err", () => {
      const result = err<string, number>("original error");
      const flattened = flatMap(result, (x) => ok(x * 2));
      expect(flattened).toEqual(err("original error"));
    });
  });

  describe("unwrap", () => {
    it("should return the value for Ok", () => {
      const result = ok(42);
      expect(unwrap(result)).toBe(42);
    });

    it("should throw for Err", () => {
      const result = err("error");
      expect(() => unwrap(result)).toThrow();
    });
  });

  describe("unwrapOr", () => {
    it("should return the value for Ok", () => {
      const result = ok(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it("should return the default for Err", () => {
      const result = err<string, number>("error");
      expect(unwrapOr(result, 0)).toBe(0);
    });
  });

  describe("unwrapOrElse", () => {
    it("should return the value for Ok", () => {
      const result = ok(42);
      expect(unwrapOrElse(result, () => 0)).toBe(42);
    });

    it("should compute the default for Err", () => {
      const result = err<string, number>("error");
      expect(unwrapOrElse(result, (e) => e.length)).toBe(5);
    });
  });

  describe("match", () => {
    it("should call ok handler for Ok", () => {
      const result = ok(42);
      const output = match(result, {
        ok: (x) => `Value: ${x}`,
        err: (e) => `Error: ${e}`,
      });
      expect(output).toBe("Value: 42");
    });

    it("should call err handler for Err", () => {
      const result = err<string, number>("failure");
      const output = match(result, {
        ok: (x) => `Value: ${x}`,
        err: (e) => `Error: ${e}`,
      });
      expect(output).toBe("Error: failure");
    });
  });

  describe("filter", () => {
    it("should return Ok when predicate is true", () => {
      const result = ok(10);
      const filtered = filter(
        result,
        (x) => x > 5,
        (x) => `Value ${x} is too small`
      );
      expect(filtered).toEqual(ok(10));
    });

    it("should return Err when predicate is false", () => {
      const result = ok(3);
      const filtered = filter(
        result,
        (x) => x > 5,
        (x) => `Value ${x} is too small`
      );
      expect(filtered).toEqual(err("Value 3 is too small"));
    });

    it("should propagate Err", () => {
      const result = err<string, number>("original error");
      const filtered = filter(
        result,
        (x) => x > 5,
        (x) => `Value ${x} is too small`
      );
      expect(filtered).toEqual(err("original error"));
    });
  });

  describe("zip", () => {
    it("should combine two Ok values", () => {
      const result1 = ok(1);
      const result2 = ok("a");
      const zipped = zip(result1, result2);
      expect(zipped).toEqual(ok([1, "a"]));
    });

    it("should return first Err", () => {
      const result1 = err<string, number>("error1");
      const result2 = ok("a");
      const zipped = zip(result1, result2);
      expect(zipped).toEqual(err("error1"));
    });

    it("should return second Err if first is Ok", () => {
      const result1 = ok(1);
      const result2 = err<string, string>("error2");
      const zipped = zip(result1, result2);
      expect(zipped).toEqual(err("error2"));
    });
  });

  describe("Monad Laws (Property-Based)", () => {
    // Arbitrary for Result<number, string>
    const arbResult = fc.oneof(
      fc.integer().map((n) => ok<number, string>(n)),
      fc.string().map((s) => err<string, number>(s))
    );

    // Left Identity: flatMap(ok(a), f) === f(a)
    it("Left Identity: flatMap(ok(a), f) === f(a)", () => {
      fc.assert(
        fc.property(fc.integer(), (a) => {
          const f = (x: number): Result<number, string> =>
            x % 2 === 0 ? ok(x * 2) : err("odd number");
          const left = flatMap(ok(a), f);
          const right = f(a);
          expect(left).toEqual(right);
        })
      );
    });

    // Right Identity: flatMap(m, ok) === m
    it("Right Identity: flatMap(m, ok) === m", () => {
      fc.assert(
        fc.property(arbResult, (m) => {
          const result = flatMap(m, ok);
          expect(result).toEqual(m);
        })
      );
    });

    // Associativity: flatMap(flatMap(m, f), g) === flatMap(m, x => flatMap(f(x), g))
    it("Associativity: flatMap(flatMap(m, f), g) === flatMap(m, x => flatMap(f(x), g))", () => {
      fc.assert(
        fc.property(arbResult, (m) => {
          const f = (x: number): Result<number, string> =>
            x > 0 ? ok(x + 1) : err("non-positive");
          const g = (x: number): Result<number, string> =>
            x % 2 === 0 ? ok(x * 2) : err("odd");

          const left = flatMap(flatMap(m, f), g);
          const right = flatMap(m, (x) => flatMap(f(x), g));

          expect(left).toEqual(right);
        })
      );
    });

    // Functor Law 1: map(m, id) === m
    it("Functor Identity: map(m, id) === m", () => {
      fc.assert(
        fc.property(arbResult, (m) => {
          const id = <T,>(x: T): T => x;
          const result = map(m, id);
          expect(result).toEqual(m);
        })
      );
    });

    // Functor Law 2: map(map(m, f), g) === map(m, x => g(f(x)))
    it("Functor Composition: map(map(m, f), g) === map(m, x => g(f(x)))", () => {
      fc.assert(
        fc.property(arbResult, (m) => {
          const f = (x: number): number => x + 1;
          const g = (x: number): number => x * 2;

          const left = map(map(m, f), g);
          const right = map(m, (x) => g(f(x)));

          expect(left).toEqual(right);
        })
      );
    });
  });
});
