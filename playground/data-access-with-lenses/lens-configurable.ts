import { produce } from "immer";
import { type Result, ok, err, isErr } from "result-option-types";
import { type Lens, type ViewResult, type SetResult } from "./lens-core";

export interface LensConfig {
  readonly sourceType: string;
  readonly targetType: string;
  readonly getterPath: ReadonlyArray<string | number>;
}

const pathError = (
  message: string,
  path: ReadonlyArray<string | number>
): string => `${message}. Path: ${path.join(".")}`;

function validatePathElement<T>(
  current: unknown,
  pathElement: string | number,
  path: ReadonlyArray<string | number>
): Result<T, string> {
  if (current === null || current === undefined) {
    return err(
      pathError(
        `Path failed. Element '${String(
          pathElement
        )}' not found as current object is null/undefined`,
        path
      )
    );
  }

  if (typeof current !== "object" && typeof current !== "function") {
    return err(
      pathError(
        `Path failed. Cannot access property '${String(
          pathElement
        )}' on non-object type (${typeof current})`,
        path
      )
    );
  }

  const isValidArrayAccess =
    Array.isArray(current) &&
    typeof pathElement === "number" &&
    pathElement < current.length;

  if (!(pathElement in current) && !isValidArrayAccess) {
    if (Array.isArray(current) && typeof pathElement === "number") {
      return err(
        pathError(
          `Path failed. Index ${pathElement} out of bounds for array (length ${current.length})`,
          path
        )
      );
    }
    return err(
      pathError(
        `Path failed. Property '${String(
          pathElement
        )}' does not exist on current object`,
        path
      )
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ok((current as any)[pathElement] as T);
}

/**
 * Creates a Lens from configuration metadata. The factory itself returns
 * a Result because the configuration can be invalid (e.g. empty
 * getterPath); the returned lens follows the same convention: view fails
 * by Err when the path does not resolve, and set fails by Err when an
 * intermediate object is missing.
 *
 * Caveats: Relies on 'any' internally. Correctness of 'A' depends on LensConfig.
 * Does not inherently handle discriminated unions safely within path traversal without more complex config.
 */
export function createLensFromConfig<S extends object, A>(
  config: LensConfig
): Result<Lens<S, A>, string> {
  if (!config.getterPath || config.getterPath.length === 0) {
    return err("LensConfig requires a non-empty getterPath");
  }

  const view = (source: S): ViewResult<A> => {
    let current: unknown = source;

    for (const pathElement of config.getterPath) {
      const validationResult = validatePathElement<unknown>(
        current,
        pathElement,
        config.getterPath
      );
      if (isErr(validationResult)) {
        return validationResult;
      }
      current = validationResult.value;
    }

    return ok(current as A);
  };

  const set = (source: S, newValue: A): SetResult<S> => {
    // Pre-validate intermediates so set fails by Err rather than throw
    // when a parent is missing or not an object.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cursor: any = source;
    for (let i = 0; i < config.getterPath.length - 1; i++) {
      const head = config.getterPath[i];
      if (head === undefined) {
        break;
      }
      if (cursor[head] === null || typeof cursor[head] !== "object") {
        return err(
          `Invalid path element '${String(
            head
          )}' during set: parent is not an object or property does not exist.`
        );
      }
      cursor = cursor[head];
    }

    const updated = produce(source, (draft) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let current: any = draft;
      for (let i = 0; i < config.getterPath.length - 1; i++) {
        const head = config.getterPath[i];
        if (head !== undefined) {
          current = current[head];
        }
      }
      const last = config.getterPath[config.getterPath.length - 1];
      if (last !== undefined) {
        current[last] = newValue;
      }
    });
    return ok(updated);
  };

  return ok({ view, set });
}
