/**
 * Represents either success (Ok) or failure (Err).
 * Inspired by Rust's Result<T, E> type.
 */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Contains the success value
 */
export interface Ok<T> {
  readonly _tag: "Ok";
  readonly value: T;
}

/**
 * Contains the error value
 */
export interface Err<E> {
  readonly _tag: "Err";
  readonly error: E;
}

/**
 * Creates a successful Result containing the given value.
 */
export function ok<T, E = never>(value: T): Result<T, E> {
  return { _tag: "Ok", value };
}

/**
 * Creates a failed Result containing the given error.
 */
export function err<E, T = never>(error: E): Result<T, E> {
  return { _tag: "Err", error };
}

/**
 * Type guard to check if a Result is Ok.
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result._tag === "Ok";
}

/**
 * Type guard to check if a Result is Err.
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result._tag === "Err";
}

/**
 * Maps a Result<T, E> to Result<U, E> by applying a function to the Ok value.
 * Leaves Err values untouched.
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Maps a Result<T, E> to Result<T, F> by applying a function to the Err value.
 * Leaves Ok values untouched.
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * Maps a Result<T, E> to Result<U, E> by applying a function that returns a Result.
 * Flattens the nested Result<Result<U, E>, E> to Result<U, E>.
 * Also known as 'bind' or 'chain' in other FP contexts.
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
}

/**
 * Returns the contained Ok value.
 * Throws an error if the Result is Err.
 * Use with caution - prefer unwrapOr or match for safer handling.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw new Error(
    `Called unwrap on an Err value: ${JSON.stringify(result.error)}`
  );
}

/**
 * Returns the contained Ok value, or the provided default if Err.
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Returns the contained Ok value, or computes it from a function if Err.
 */
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
  if (isOk(result)) {
    return result.value;
  }
  return fn(result.error);
}

/**
 * Matches on a Result, executing the appropriate function based on its variant.
 * This enables exhaustive pattern matching.
 */
export function match<T, E, U>(
  result: Result<T, E>,
  handlers: {
    readonly ok: (value: T) => U;
    readonly err: (error: E) => U;
  }
): U {
  if (isOk(result)) {
    return handlers.ok(result.value);
  }
  return handlers.err(result.error);
}

/**
 * Converts a Result<T, E> to Result<U, E> by applying a function to the Ok value,
 * but only if a predicate holds. If the predicate fails, returns an Err with the error
 * produced by the provided function.
 */
export function filter<T, E>(
  result: Result<T, E>,
  predicate: (value: T) => boolean,
  errorFn: (value: T) => E
): Result<T, E> {
  if (isOk(result)) {
    if (predicate(result.value)) {
      return result;
    }
    return err(errorFn(result.value));
  }
  return result;
}

/**
 * Combines two Results into a tuple if both are Ok.
 * Returns the first Err encountered if either is Err.
 */
export function zip<T1, T2, E>(
  result1: Result<T1, E>,
  result2: Result<T2, E>
): Result<[T1, T2], E> {
  if (isOk(result1) && isOk(result2)) {
    return ok([result1.value, result2.value]);
  }
  if (isErr(result1)) {
    return result1;
  }
  return result2 as Result<[T1, T2], E>;
}
