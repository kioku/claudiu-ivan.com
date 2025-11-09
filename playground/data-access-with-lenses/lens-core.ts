/**
 * Represents the result of a Lens view operation.
 */
export type ViewResult<A> =
  | { readonly success: true; readonly value: A }
  | { readonly success: false; readonly error: string };

export interface Lens<S, A> {
  readonly view: (source: S) => ViewResult<A>;
  readonly set: (source: S, newValue: A) => S;
}

/**
 * Creates a Lens focusing on a specific property of an object.
 */
export function lensProp<S, K extends keyof S>(prop: K): Lens<S, S[K]> {
  return {
    view: (source: S): ViewResult<S[K]> => {
      if (source && typeof source === "object" && prop in source) {
        return { success: true, value: source[prop] };
      }
      return {
        success: false,
        error: `Property '${String(prop)}' not found on source object.`,
      };
    },
    set: (source: S, newValue: S[K]): S => ({ ...source, [prop]: newValue }),
  };
}

/**
 * Composes two lenses together.
 */
export function composeLens<S, B, A>(
  outer: Lens<S, B>,
  inner: Lens<B, A>
): Lens<S, A> {
  return {
    view: (source: S): ViewResult<A> => {
      const outerResult = outer.view(source);
      if (!outerResult.success) {
        return outerResult;
      }
      return inner.view(outerResult.value);
    },
    set: (source: S, newValue: A): S => {
      const outerResult = outer.view(source);
      if (!outerResult.success) {
        throw new Error(
          `Cannot compose set: outer lens failed to view. Error: ${outerResult.error}`
        );
      }
      return outer.set(source, inner.set(outerResult.value, newValue));
    },
  };
}
