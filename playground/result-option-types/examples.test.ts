import { describe, it, expect } from "vitest";
import { some, none } from "./option";
import { ok, err } from "./result";
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
    describe("first", () => {
      it("should return Some for non-empty array", () => {
        expect(first([1, 2, 3])).toEqual(some(1));
      });

      it("should return None for empty array", () => {
        expect(first([])).toEqual(none());
      });
    });

    describe("last", () => {
      it("should return Some for non-empty array", () => {
        expect(last([1, 2, 3])).toEqual(some(3));
      });

      it("should return None for empty array", () => {
        expect(last([])).toEqual(none());
      });
    });
  });

  describe("Parsing", () => {
    describe("safeParseInt", () => {
      it("should parse valid integer strings", () => {
        expect(safeParseInt("42")).toEqual(ok(42));
        expect(safeParseInt("-10")).toEqual(ok(-10));
        expect(safeParseInt("0")).toEqual(ok(0));
      });

      it("should fail on invalid integer strings", () => {
        const result = safeParseInt("abc");
        expect(result._tag).toBe("Err");
      });

      it("should fail on decimal strings", () => {
        const result = safeParseInt("3.14");
        expect(result._tag).toBe("Err");
      });
    });

    describe("parseJSON", () => {
      it("should parse valid JSON", () => {
        const result = parseJSON<{ a: number }>('{"a": 1}');
        expect(result).toEqual(ok({ a: 1 }));
      });

      it("should fail on invalid JSON", () => {
        const result = parseJSON("{invalid}");
        expect(result._tag).toBe("Err");
      });
    });

    describe("parseDate", () => {
      it("should parse valid date strings", () => {
        const result = parseDate("2025-01-01");
        expect(result._tag).toBe("Ok");
      });

      it("should fail on invalid date strings", () => {
        const result = parseDate("not-a-date");
        expect(result._tag).toBe("Err");
      });
    });
  });

  describe("Validation", () => {
    describe("validateEmail", () => {
      it("should accept valid email addresses", () => {
        expect(validateEmail("user@example.com")).toEqual(
          ok("user@example.com")
        );
        expect(validateEmail("test.name@domain.co.uk")).toEqual(
          ok("test.name@domain.co.uk")
        );
      });

      it("should reject invalid email addresses", () => {
        expect(validateEmail("invalid")._tag).toBe("Err");
        expect(validateEmail("@example.com")._tag).toBe("Err");
        expect(validateEmail("user@")._tag).toBe("Err");
      });
    });

    describe("validateRange", () => {
      it("should accept values within range", () => {
        expect(validateRange(5, 0, 10)).toEqual(ok(5));
        expect(validateRange(0, 0, 10)).toEqual(ok(0));
        expect(validateRange(10, 0, 10)).toEqual(ok(10));
      });

      it("should reject values below range", () => {
        const result = validateRange(-1, 0, 10);
        expect(result._tag).toBe("Err");
      });

      it("should reject values above range", () => {
        const result = validateRange(11, 0, 10);
        expect(result._tag).toBe("Err");
      });
    });

    describe("validateNonEmpty", () => {
      it("should accept non-empty strings", () => {
        expect(validateNonEmpty("hello")).toEqual(ok("hello"));
        expect(validateNonEmpty("  text  ")).toEqual(ok("  text  "));
      });

      it("should reject empty strings", () => {
        expect(validateNonEmpty("")._tag).toBe("Err");
        expect(validateNonEmpty("   ")._tag).toBe("Err");
      });
    });
  });

  describe("Railway-Oriented Programming", () => {
    describe("validateUserRegistration", () => {
      it("should accept valid user data", () => {
        const result = validateUserRegistration(
          "user@example.com",
          "25",
          "johndoe"
        );
        expect(result).toEqual(
          ok({
            email: "user@example.com",
            age: 25,
            username: "johndoe",
          })
        );
      });

      it("should fail on invalid email", () => {
        const result = validateUserRegistration("invalid", "25", "johndoe");
        expect(result._tag).toBe("Err");
      });

      it("should fail on invalid age string", () => {
        const result = validateUserRegistration(
          "user@example.com",
          "abc",
          "johndoe"
        );
        expect(result._tag).toBe("Err");
      });

      it("should fail on age out of range", () => {
        const result = validateUserRegistration(
          "user@example.com",
          "150",
          "johndoe"
        );
        expect(result._tag).toBe("Err");
      });

      it("should fail on empty username", () => {
        const result = validateUserRegistration(
          "user@example.com",
          "25",
          "   "
        );
        expect(result._tag).toBe("Err");
      });
    });
  });

  describe("Option Chaining", () => {
    describe("getDatabaseHost", () => {
      it("should extract host when present", () => {
        const config: Config = {
          database: {
            host: "localhost",
            port: 5432,
          },
        };
        expect(getDatabaseHost(config)).toEqual(some("localhost"));
      });

      it("should return None when database is missing", () => {
        const config: Config = {};
        expect(getDatabaseHost(config)).toEqual(none());
      });

      it("should return None when host is missing", () => {
        const config: Config = {
          database: {
            port: 5432,
          },
        };
        expect(getDatabaseHost(config)).toEqual(none());
      });
    });

    describe("getDatabasePort", () => {
      it("should extract port when present", () => {
        const config: Config = {
          database: {
            host: "localhost",
            port: 3306,
          },
        };
        expect(getDatabasePort(config)).toBe(3306);
      });

      it("should return default when database is missing", () => {
        const config: Config = {};
        expect(getDatabasePort(config)).toBe(5432);
      });

      it("should return default when port is missing", () => {
        const config: Config = {
          database: {
            host: "localhost",
          },
        };
        expect(getDatabasePort(config)).toBe(5432);
      });
    });
  });

  describe("Combining Multiple Results", () => {
    describe("parseCoordinates", () => {
      it("should parse valid coordinates", () => {
        const result = parseCoordinates("40.7128", "-74.0060");
        expect(result).toEqual(
          ok({
            latitude: 40.7128,
            longitude: -74.006,
          })
        );
      });

      it("should fail on invalid latitude string", () => {
        const result = parseCoordinates("invalid", "-74.0060");
        expect(result._tag).toBe("Err");
      });

      it("should fail on invalid longitude string", () => {
        const result = parseCoordinates("40.7128", "invalid");
        expect(result._tag).toBe("Err");
      });

      it("should fail on latitude out of range", () => {
        const result = parseCoordinates("100", "-74.0060");
        expect(result._tag).toBe("Err");
      });

      it("should fail on longitude out of range", () => {
        const result = parseCoordinates("40.7128", "200");
        expect(result._tag).toBe("Err");
      });
    });
  });
});
