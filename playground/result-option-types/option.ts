/**
 * Represents an optional value: every Option is either Some and contains a value, or None.
 * Inspired by Rust's Option<T> type.
 */
export type Option<T> = Some<T> | None;

/**
 * Some value of type T
 */
export interface Some<T> {
  readonly _tag: "Some";
  readonly value: T;
}

/**
 * No value
 */
export interface None {
  readonly _tag: "None";
}

/**
 * Creates an Option containing the given value.
 */
export function some<T>(value: T): Option<T> {
  return { _tag: "Some", value };
}

/**
 * Creates an Option with no value.
 */
export function none<T = never>(): Option<T> {
  return { _tag: "None" };
}

/**
 * Type guard to check if an Option is Some.
 */
export function isSome<T>(option: Option<T>): option is Some<T> {
  return option._tag === "Some";
}

/**
 * Type guard to check if an Option is None.
 */
export function isNone<T>(option: Option<T>): option is None {
  return option._tag === "None";
}

/**
 * Maps an Option<T> to Option<U> by applying a function to the contained value.
 * Returns None if the option is None.
 */
export function map<T, U>(option: Option<T>, fn: (value: T) => U): Option<U> {
  if (isSome(option)) {
    return some(fn(option.value));
  }
  return none();
}

/**
 * Maps an Option<T> to Option<U> by applying a function that returns an Option.
 * Flattens the nested Option<Option<U>> to Option<U>.
 * Also known as 'bind' or 'chain' in other FP contexts.
 */
export function flatMap<T, U>(
  option: Option<T>,
  fn: (value: T) => Option<U>
): Option<U> {
  if (isSome(option)) {
    return fn(option.value);
  }
  return none();
}

/**
 * Returns the contained value if Some, otherwise returns the provided default.
 */
export function unwrapOr<T>(option: Option<T>, defaultValue: T): T {
  if (isSome(option)) {
    return option.value;
  }
  return defaultValue;
}

/**
 * Returns the contained value if Some, otherwise computes it from a function.
 */
export function unwrapOrElse<T>(option: Option<T>, fn: () => T): T {
  if (isSome(option)) {
    return option.value;
  }
  return fn();
}

/**
 * Matches on an Option, executing the appropriate function based on its variant.
 * This enables exhaustive pattern matching.
 */
export function match<T, U>(
  option: Option<T>,
  handlers: {
    readonly some: (value: T) => U;
    readonly none: () => U;
  }
): U {
  if (isSome(option)) {
    return handlers.some(option.value);
  }
  return handlers.none();
}

/**
 * Returns None if the option is None, otherwise calls the predicate
 * with the wrapped value and returns:
 * - Some(value) if the predicate returns true
 * - None if the predicate returns false
 */
export function filter<T>(
  option: Option<T>,
  predicate: (value: T) => boolean
): Option<T> {
  if (isSome(option) && predicate(option.value)) {
    return option;
  }
  return none();
}
