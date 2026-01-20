import { type Option, some, none } from "./option";
import { type Result, ok, err } from "./result";

/**
 * Converts a nullable value to an Option.
 * Returns None if the value is null or undefined, otherwise Some(value).
 */
export function fromNullable<T>(value: T | null | undefined): Option<T> {
  if (value === null || value === undefined) {
    return none();
  }
  return some(value);
}

/**
 * Wraps a function that might throw an exception in a Result.
 * Returns Ok(result) if the function succeeds, Err(error) if it throws.
 */
export function tryCatch<T>(fn: () => T): Result<T, Error> {
  try {
    return ok(fn());
  } catch (error) {
    if (error instanceof Error) {
      return err(error);
    }
    return err(new Error(String(error)));
  }
}

/**
 * Asynchronous version of tryCatch for async functions.
 * Returns a Promise of Result<T, Error>.
 */
export async function tryCatchAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T, Error>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    if (error instanceof Error) {
      return err(error);
    }
    return err(new Error(String(error)));
  }
}

/**
 * Converts an Option<T> to Result<T, E> by providing an error value for the None case.
 */
export function optionToResult<T, E>(
  option: Option<T>,
  error: E
): Result<T, E> {
  if (option._tag === "Some") {
    return ok(option.value);
  }
  return err(error);
}

/**
 * Converts an Option<T> to Result<T, E> by computing an error from a function for the None case.
 */
export function optionToResultLazy<T, E>(
  option: Option<T>,
  errorFn: () => E
): Result<T, E> {
  if (option._tag === "Some") {
    return ok(option.value);
  }
  return err(errorFn());
}

/**
 * Converts a Result<T, E> to Option<T>, discarding the error information.
 * Returns Some(value) for Ok, None for Err.
 */
export function resultToOption<T, E>(result: Result<T, E>): Option<T> {
  if (result._tag === "Ok") {
    return some(result.value);
  }
  return none();
}

/**
 * Safely accesses an array element by index, returning an Option.
 * Returns Some(element) if the index is valid, None otherwise.
 */
export function arrayAt<T>(array: readonly T[], index: number): Option<T> {
  if (index >= 0 && index < array.length) {
    const element = array[index];
    if (element !== undefined) {
      return some(element);
    }
  }
  return none();
}

/**
 * Safely accesses an object property, returning an Option.
 * Returns Some(value) if the property exists and is not undefined, None otherwise.
 */
export function objectGet<T>(
  obj: Record<string, T>,
  key: string
): Option<T> {
  const value = obj[key];
  if (value !== undefined) {
    return some(value);
  }
  return none();
}
