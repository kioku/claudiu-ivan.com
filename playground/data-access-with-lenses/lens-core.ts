import { type Result, ok, err, isErr } from "../result-option-types/index.ts";

/**
 * The result of a Lens view operation. Aliased to make lens signatures
 * read at a glance; structurally identical to Result<A, string>.
 */
export type ViewResult<A> = Result<A, string>;

/**
 * The result of a Lens set operation. Set can fail on configured lenses
 * when the configured path does not exist in the source.
 */
export type SetResult<S> = Result<S, string>;

export interface Lens<S, A> {
  readonly view: (source: S) => ViewResult<A>;
  readonly set: (source: S, newValue: A) => SetResult<S>;
}

/**
 * Creates a Lens focusing on a specific property of an object.
 */
export function lensProp<S, K extends keyof S>(prop: K): Lens<S, S[K]> {
  return {
    view: (source: S): ViewResult<S[K]> => {
      if (source && typeof source === "object" && prop in source) {
        return ok(source[prop]);
      }
      return err(`Property '${String(prop)}' not found on source object.`);
    },
    set: (source: S, newValue: S[K]): SetResult<S> =>
      ok({ ...source, [prop]: newValue }),
  };
}

/**
 * Composes two lenses together. A composed set fails if either the outer
 * view or the inner set fails; the failure is returned as Err rather
 * than thrown.
 */
export function composeLens<S, B, A>(
  outer: Lens<S, B>,
  inner: Lens<B, A>
): Lens<S, A> {
  return {
    view: (source: S): ViewResult<A> => {
      const outerView = outer.view(source);
      if (isErr(outerView)) {
        return outerView;
      }
      return inner.view(outerView.value);
    },
    set: (source: S, newValue: A): SetResult<S> => {
      const outerView = outer.view(source);
      if (isErr(outerView)) {
        return outerView;
      }
      const innerSet = inner.set(outerView.value, newValue);
      if (isErr(innerSet)) {
        return innerSet;
      }
      return outer.set(source, innerSet.value);
    },
  };
}
