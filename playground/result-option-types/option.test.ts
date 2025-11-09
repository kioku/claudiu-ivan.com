import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  some,
  none,
  isSome,
  isNone,
  map,
  flatMap,
  unwrapOr,
  unwrapOrElse,
  match,
  filter,
  type Option,
} from "./option";

describe("Option", () => {
  describe("Constructors", () => {
    it("should create Some with a value", () => {
      const opt = some(42);
      expect(isSome(opt)).toBe(true);
      if (isSome(opt)) {
        expect(opt.value).toBe(42);
      }
    });

    it("should create None", () => {
      const opt = none();
      expect(isNone(opt)).toBe(true);
    });
  });

  describe("Type Guards", () => {
    it("should correctly identify Some", () => {
      const opt = some("test");
      expect(isSome(opt)).toBe(true);
      expect(isNone(opt)).toBe(false);
    });

    it("should correctly identify None", () => {
      const opt = none();
      expect(isSome(opt)).toBe(false);
      expect(isNone(opt)).toBe(true);
    });
  });

  describe("map", () => {
    it("should transform Some value", () => {
      const opt = some(5);
      const result = map(opt, (x) => x * 2);
      expect(result).toEqual(some(10));
    });

    it("should return None when mapping over None", () => {
      const opt = none<number>();
      const result = map(opt, (x) => x * 2);
      expect(result).toEqual(none());
    });
  });

  describe("flatMap", () => {
    it("should flatten nested Options", () => {
      const opt = some(5);
      const result = flatMap(opt, (x) => (x > 0 ? some(x * 2) : none()));
      expect(result).toEqual(some(10));
    });

    it("should return None if inner function returns None", () => {
      const opt = some(-5);
      const result = flatMap(opt, (x) => (x > 0 ? some(x * 2) : none()));
      expect(result).toEqual(none());
    });

    it("should return None when flatMapping over None", () => {
      const opt = none<number>();
      const result = flatMap(opt, (x) => some(x * 2));
      expect(result).toEqual(none());
    });
  });

  describe("unwrapOr", () => {
    it("should return the value for Some", () => {
      const opt = some(42);
      expect(unwrapOr(opt, 0)).toBe(42);
    });

    it("should return the default for None", () => {
      const opt = none<number>();
      expect(unwrapOr(opt, 0)).toBe(0);
    });
  });

  describe("unwrapOrElse", () => {
    it("should return the value for Some", () => {
      const opt = some(42);
      expect(unwrapOrElse(opt, () => 0)).toBe(42);
    });

    it("should compute the default for None", () => {
      const opt = none<number>();
      expect(unwrapOrElse(opt, () => 100)).toBe(100);
    });
  });

  describe("match", () => {
    it("should call some handler for Some", () => {
      const opt = some(42);
      const result = match(opt, {
        some: (x) => `Value: ${x}`,
        none: () => "No value",
      });
      expect(result).toBe("Value: 42");
    });

    it("should call none handler for None", () => {
      const opt = none<number>();
      const result = match(opt, {
        some: (x) => `Value: ${x}`,
        none: () => "No value",
      });
      expect(result).toBe("No value");
    });
  });

  describe("filter", () => {
    it("should return Some when predicate is true", () => {
      const opt = some(10);
      const result = filter(opt, (x) => x > 5);
      expect(result).toEqual(some(10));
    });

    it("should return None when predicate is false", () => {
      const opt = some(3);
      const result = filter(opt, (x) => x > 5);
      expect(result).toEqual(none());
    });

    it("should return None when filtering None", () => {
      const opt = none<number>();
      const result = filter(opt, (x) => x > 5);
      expect(result).toEqual(none());
    });
  });

  describe("Monad Laws (Property-Based)", () => {
    // Arbitrary for Option<number>
    const arbOption = fc.oneof(
      fc.integer().map(some),
      fc.constant(none<number>())
    );

    // Left Identity: flatMap(some(a), f) === f(a)
    it("Left Identity: flatMap(some(a), f) === f(a)", () => {
      fc.assert(
        fc.property(fc.integer(), (a) => {
          const f = (x: number): Option<number> =>
            x % 2 === 0 ? some(x * 2) : none();
          const left = flatMap(some(a), f);
          const right = f(a);
          expect(left).toEqual(right);
        })
      );
    });

    // Right Identity: flatMap(m, some) === m
    it("Right Identity: flatMap(m, some) === m", () => {
      fc.assert(
        fc.property(arbOption, (m) => {
          const result = flatMap(m, some);
          expect(result).toEqual(m);
        })
      );
    });

    // Associativity: flatMap(flatMap(m, f), g) === flatMap(m, x => flatMap(f(x), g))
    it("Associativity: flatMap(flatMap(m, f), g) === flatMap(m, x => flatMap(f(x), g))", () => {
      fc.assert(
        fc.property(arbOption, (m) => {
          const f = (x: number): Option<number> =>
            x > 0 ? some(x + 1) : none();
          const g = (x: number): Option<number> =>
            x % 2 === 0 ? some(x * 2) : none();

          const left = flatMap(flatMap(m, f), g);
          const right = flatMap(m, (x) => flatMap(f(x), g));

          expect(left).toEqual(right);
        })
      );
    });

    // Functor Law 1: map(m, id) === m
    it("Functor Identity: map(m, id) === m", () => {
      fc.assert(
        fc.property(arbOption, (m) => {
          const id = <T,>(x: T): T => x;
          const result = map(m, id);
          expect(result).toEqual(m);
        })
      );
    });

    // Functor Law 2: map(map(m, f), g) === map(m, x => g(f(x)))
    it("Functor Composition: map(map(m, f), g) === map(m, x => g(f(x)))", () => {
      fc.assert(
        fc.property(arbOption, (m) => {
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
