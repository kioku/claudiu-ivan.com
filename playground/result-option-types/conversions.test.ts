import { describe, it, expect } from "vitest";
import { some, none } from "./option";
import { ok, err } from "./result";
import {
  fromNullable,
  tryCatch,
  tryCatchAsync,
  optionToResult,
  optionToResultLazy,
  resultToOption,
  arrayAt,
  objectGet,
} from "./conversions";

describe("Conversions", () => {
  describe("fromNullable", () => {
    it("should return Some for non-null values", () => {
      expect(fromNullable(42)).toEqual(some(42));
      expect(fromNullable("test")).toEqual(some("test"));
      expect(fromNullable(0)).toEqual(some(0));
      expect(fromNullable(false)).toEqual(some(false));
    });

    it("should return None for null", () => {
      expect(fromNullable(null)).toEqual(none());
    });

    it("should return None for undefined", () => {
      expect(fromNullable(undefined)).toEqual(none());
    });
  });

  describe("tryCatch", () => {
    it("should return Ok for successful execution", () => {
      const result = tryCatch(() => 42);
      expect(result).toEqual(ok(42));
    });

    it("should return Err for thrown errors", () => {
      const result = tryCatch(() => {
        throw new Error("test error");
      });
      expect(result._tag).toBe("Err");
      if (result._tag === "Err") {
        expect(result.error.message).toBe("test error");
      }
    });

    it("should wrap non-Error throws in Error", () => {
      const result = tryCatch(() => {
        throw "string error";
      });
      expect(result._tag).toBe("Err");
      if (result._tag === "Err") {
        expect(result.error instanceof Error).toBe(true);
      }
    });
  });

  describe("tryCatchAsync", () => {
    it("should return Ok for successful async execution", async () => {
      const result = await tryCatchAsync(async () => {
        return Promise.resolve(42);
      });
      expect(result).toEqual(ok(42));
    });

    it("should return Err for rejected promises", async () => {
      const result = await tryCatchAsync(async () => {
        throw new Error("async error");
      });
      expect(result._tag).toBe("Err");
      if (result._tag === "Err") {
        expect(result.error.message).toBe("async error");
      }
    });
  });

  describe("optionToResult", () => {
    it("should convert Some to Ok", () => {
      const option = some(42);
      const result = optionToResult(option, "error");
      expect(result).toEqual(ok(42));
    });

    it("should convert None to Err with provided error", () => {
      const option = none<number>();
      const result = optionToResult(option, "no value");
      expect(result).toEqual(err("no value"));
    });
  });

  describe("optionToResultLazy", () => {
    it("should convert Some to Ok", () => {
      const option = some(42);
      const result = optionToResultLazy(option, () => "error");
      expect(result).toEqual(ok(42));
    });

    it("should convert None to Err using error function", () => {
      const option = none<number>();
      const result = optionToResultLazy(option, () => "computed error");
      expect(result).toEqual(err("computed error"));
    });

    it("should not call error function for Some", () => {
      const option = some(42);
      let called = false;
      optionToResultLazy(option, () => {
        called = true;
        return "error";
      });
      expect(called).toBe(false);
    });
  });

  describe("resultToOption", () => {
    it("should convert Ok to Some", () => {
      const result = ok(42);
      const option = resultToOption(result);
      expect(option).toEqual(some(42));
    });

    it("should convert Err to None", () => {
      const result = err<string, number>("error");
      const option = resultToOption(result);
      expect(option).toEqual(none());
    });
  });

  describe("arrayAt", () => {
    const array = [10, 20, 30, 40];

    it("should return Some for valid index", () => {
      expect(arrayAt(array, 0)).toEqual(some(10));
      expect(arrayAt(array, 2)).toEqual(some(30));
    });

    it("should return None for negative index", () => {
      expect(arrayAt(array, -1)).toEqual(none());
    });

    it("should return None for out of bounds index", () => {
      expect(arrayAt(array, 4)).toEqual(none());
      expect(arrayAt(array, 100)).toEqual(none());
    });

    it("should return None for empty array", () => {
      expect(arrayAt([], 0)).toEqual(none());
    });
  });

  describe("objectGet", () => {
    const obj = { a: 1, b: 2, c: 3 };

    it("should return Some for existing key", () => {
      expect(objectGet(obj, "a")).toEqual(some(1));
      expect(objectGet(obj, "c")).toEqual(some(3));
    });

    it("should return None for non-existent key", () => {
      expect(objectGet(obj, "z")).toEqual(none());
    });

    it("should return None for undefined value", () => {
      const objWithUndefined = { a: undefined };
      expect(objectGet(objWithUndefined, "a")).toEqual(none());
    });
  });
});
