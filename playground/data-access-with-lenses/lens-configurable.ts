import { produce } from "immer";
import { type Lens, type ViewResult } from "./lens-core";

export interface LensConfig {
  readonly sourceType: string;
  readonly targetType: string;
  readonly getterPath: ReadonlyArray<string | number>;
}

type ValidationError = {
  success: false;
  error: string;
};

type ValidationSuccess<T> = {
  success: true;
  value: T;
};

const createError = (message: string): ValidationError => ({
  success: false,
  error: message,
});

const createPathError = (
  message: string,
  path: ReadonlyArray<string | number>
): ValidationError => createError(`${message}. Path: ${path.join(".")}`);

const validatePathElement = <T>(
  current: unknown,
  pathElement: string | number,
  path: ReadonlyArray<string | number>
): ValidationError | ValidationSuccess<T> => {
  if (current === null || current === undefined) {
    return createPathError(
      `Path failed. Element '${String(
        pathElement
      )}' not found as current object is null/undefined`,
      path
    );
  }

  if (typeof current !== "object" && typeof current !== "function") {
    return createPathError(
      `Path failed. Cannot access property '${String(
        pathElement
      )}' on non-object type (${typeof current})`,
      path
    );
  }

  const isValidArrayAccess =
    Array.isArray(current) &&
    typeof pathElement === "number" &&
    pathElement < current.length;

  if (!(pathElement in current) && !isValidArrayAccess) {
    if (Array.isArray(current) && typeof pathElement === "number") {
      return createPathError(
        `Path failed. Index ${pathElement} out of bounds for array (length ${current.length})`,
        path
      );
    }
    return createPathError(
      `Path failed. Property '${String(
        pathElement
      )}' does not exist on current object`,
      path
    );
  }

  return {
    success: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: (current as any)[pathElement] as T,
  };
};

/**
 * Creates a Lens from configuration metadata.
 * Caveats: Relies on 'any' internally. Correctness of 'A' depends on LensConfig.
 * Does not inherently handle discriminated unions safely within path traversal without more complex config.
 */
export function createLensFromConfig<S extends object, A>(
  config: LensConfig
): Lens<S, A> {
  if (!config.getterPath || config.getterPath.length === 0) {
    throw new Error("LensConfig requires a non-empty getterPath");
  }

  const view = (source: S): ViewResult<A> => {
    let current: unknown = source;

    for (const pathElement of config.getterPath) {
      const validationResult = validatePathElement(
        current,
        pathElement,
        config.getterPath
      );
      if (!validationResult.success) {
        return validationResult;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      current = validationResult.value as A;
      // current = (current as any)[pathElement];
    }

    return { success: true, value: current as A };
  };

  const set = (source: S, newValue: A): S => {
    return produce(source, (draft) => {
      const traversePath = (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        obj: any,
        path: ReadonlyArray<string | number>,
        value: A
      ): void => {
        const [head, ...tail] = path;

        if (head === undefined) {
          return;
        }

        if (tail.length === 0) {
          obj[head] = value;
          return;
        }

        if (obj[head] === null || typeof obj[head] !== "object") {
          throw new Error(
            `Invalid path element '${String(
              head
            )}' during set: parent is not an object or property does not exist.`
          );
        }

        traversePath(obj[head], tail, value);
      };

      traversePath(draft, config.getterPath, newValue);
    });
  };

  return { view, set };
}
