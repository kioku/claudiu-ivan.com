import { describe, it, expect } from "vitest";
import { some, none } from "./option";
import { ok } from "./result";
import {
  first,
  last,
  safeParseInt,
  parseJSON,
  parseDate,
  validateEmail,
  validateRange,
  validateNonEmpty,
  validateUserRegistration,
  getDatabaseHost,
  getDatabasePort,
  parseCoordinates,
  type Config,
} from "./examples";

describe("Examples", () => {
  describe("Safe Array Access", () => {
    it("first returns Some for non-empty, None for empty", () => {
      expect(first([1, 2, 3])).toEqual(some(1));
      expect(first([])).toEqual(none());
    });

    it("last returns Some for non-empty, None for empty", () => {
      expect(last([1, 2, 3])).toEqual(some(3));
      expect(last([])).toEqual(none());
    });
  });

  describe("Parsing", () => {
    it("safeParseInt handles valid and invalid input", () => {
      expect(safeParseInt("42")).toEqual(ok(42));
      expect(safeParseInt("abc")._tag).toBe("Err");
      expect(safeParseInt("3.14")._tag).toBe("Err");
    });

    it("parseJSON handles valid and invalid input", () => {
      expect(parseJSON<{ a: number }>('{"a": 1}')).toEqual(ok({ a: 1 }));
      expect(parseJSON("{invalid}")._tag).toBe("Err");
    });

    it("parseDate handles valid and invalid input", () => {
      expect(parseDate("2025-01-01")._tag).toBe("Ok");
      expect(parseDate("not-a-date")._tag).toBe("Err");
    });
  });

  describe("Validation", () => {
    it("validateEmail accepts valid, rejects invalid", () => {
      expect(validateEmail("user@example.com")).toEqual(ok("user@example.com"));
      expect(validateEmail("invalid")._tag).toBe("Err");
    });

    it("validateRange accepts in-range, rejects out-of-range", () => {
      expect(validateRange(5, 0, 10)).toEqual(ok(5));
      expect(validateRange(-1, 0, 10)._tag).toBe("Err");
      expect(validateRange(11, 0, 10)._tag).toBe("Err");
    });

    it("validateNonEmpty accepts non-empty, rejects empty", () => {
      expect(validateNonEmpty("hello")).toEqual(ok("hello"));
      expect(validateNonEmpty("   ")._tag).toBe("Err");
    });
  });

  describe("Railway-Oriented Programming", () => {
    it("validateUserRegistration chains validations", () => {
      expect(
        validateUserRegistration("user@example.com", "25", "johndoe")
      ).toEqual(ok({ email: "user@example.com", age: 25, username: "johndoe" }));

      // First failure in chain stops propagation
      expect(validateUserRegistration("invalid", "25", "johndoe")._tag).toBe("Err");
    });
  });

  describe("Option Chaining", () => {
    it("getDatabaseHost extracts nested optional values", () => {
      const withHost: Config = { database: { host: "localhost", port: 5432 } };
      const withoutHost: Config = { database: { port: 5432 } };
      const empty: Config = {};

      expect(getDatabaseHost(withHost)).toEqual(some("localhost"));
      expect(getDatabaseHost(withoutHost)).toEqual(none());
      expect(getDatabaseHost(empty)).toEqual(none());
    });

    it("getDatabasePort provides default for missing values", () => {
      const withPort: Config = { database: { host: "localhost", port: 3306 } };
      const empty: Config = {};

      expect(getDatabasePort(withPort)).toBe(3306);
      expect(getDatabasePort(empty)).toBe(5432);
    });
  });

  describe("Combining Multiple Results", () => {
    it("parseCoordinates validates both lat and lon", () => {
      expect(parseCoordinates("40.7128", "-74.0060")).toEqual(
        ok({ latitude: 40.7128, longitude: -74.006 })
      );
      expect(parseCoordinates("invalid", "-74.0060")._tag).toBe("Err");
      expect(parseCoordinates("100", "-74.0060")._tag).toBe("Err"); // out of range
    });
  });
});
