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

const readProperty = (
  source: object,
  pathElement: string | number
): unknown => (source as Record<string | number, unknown>)[pathElement];

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

  return ok(readProperty(current, pathElement) as T);
}

function validateSetIntermediates(
  source: object,
  path: ReadonlyArray<string | number>
): Result<unknown, string> {
  return path.slice(0, -1).reduce<Result<unknown, string>>(
    (cursorResult, pathElement) => {
      if (isErr(cursorResult)) {
        return cursorResult;
      }

      const cursor = cursorResult.value;
      if (cursor === null || typeof cursor !== "object") {
        return err(
          `Invalid path element '${String(
            pathElement
          )}' during set: parent is not an object or property does not exist.`
        );
      }

      const next = readProperty(cursor, pathElement);
      if (next === null || typeof next !== "object") {
        return err(
          `Invalid path element '${String(
            pathElement
          )}' during set: parent is not an object or property does not exist.`
        );
      }

      return ok(next);
    },
    ok(source)
  );
}

const replaceArrayElement = (
  source: readonly unknown[],
  index: number,
  newValue: unknown
): readonly unknown[] => {
  if (index < source.length) {
    return [...source.slice(0, index), newValue, ...source.slice(index + 1)];
  }

  return [
    ...source,
    ...Array.from({ length: index - source.length }, () => undefined),
    newValue,
  ];
};

function replaceProperty(
  source: unknown,
  pathElement: string | number,
  newValue: unknown
): unknown {
  if (Array.isArray(source) && typeof pathElement === "number") {
    return replaceArrayElement(source, pathElement, newValue);
  }

  if (source !== null && typeof source === "object") {
    return { ...source, [pathElement]: newValue };
  }

  return source;
}

function setPathValue(
  source: unknown,
  path: ReadonlyArray<string | number>,
  newValue: unknown
): unknown {
  const [head, ...tail] = path;
  if (head === undefined) {
    return newValue;
  }

  if (tail.length === 0) {
    return replaceProperty(source, head, newValue);
  }

  if (source === null || typeof source !== "object") {
    return source;
  }

  return replaceProperty(
    source,
    head,
    setPathValue(readProperty(source, head), tail, newValue)
  );
}

/**
 * Creates a Lens from configuration metadata. The factory itself returns
 * a Result because the configuration can be invalid (e.g. empty
 * getterPath); the returned lens follows the same convention: view fails
 * by Err when the path does not resolve, and set fails by Err when an
 * intermediate object is missing.
 *
 * Caveats: Correctness of 'A' depends on LensConfig. Does not inherently
 * handle discriminated unions safely within path traversal without more
 * complex config.
 */
export function createLensFromConfig<S extends object, A>(
  config: LensConfig
): Result<Lens<S, A>, string> {
  if (!config.getterPath || config.getterPath.length === 0) {
    return err("LensConfig requires a non-empty getterPath");
  }

  const view = (source: S): ViewResult<A> => {
    const result = config.getterPath.reduce<Result<unknown, string>>(
      (currentResult, pathElement) => {
        if (isErr(currentResult)) {
          return currentResult;
        }
        return validatePathElement<unknown>(
          currentResult.value,
          pathElement,
          config.getterPath
        );
      },
      ok(source)
    );

    if (isErr(result)) {
      return result;
    }
    return ok(result.value as A);
  };

  const set = (source: S, newValue: A): SetResult<S> => {
    const parentResult = validateSetIntermediates(source, config.getterPath);
    if (isErr(parentResult)) {
      return parentResult;
    }

    return ok(setPathValue(source, config.getterPath, newValue) as S);
  };

  return ok({ view, set });
}
