import { type Result, ok, err, isErr } from "../result-option-types/index.ts";
import { createLensFromConfig, type LensConfig } from "./lens-configurable";

export type FormulaInputValue =
  | number
  | string
  | boolean
  | object
  | null
  | undefined;

export type FormulaResultOutput = FormulaInputValue;

export interface FormulaDefinition {
  id: string;
  getRequiredTokens: () => string[];
  execute: (
    inputs: Record<string, FormulaInputValue>
  ) => Result<FormulaResultOutput, string>;
}

/**
 * Typed error union for the formula engine. Each variant carries the
 * context a caller (or an operator inspecting logs) needs to act on the
 * failure without rediscovering it from the message text.
 */
export type FormulaError =
  | { readonly kind: "MissingFormulaDefinition"; readonly formulaId: string }
  | { readonly kind: "MissingLensConfig"; readonly token: string }
  | {
      readonly kind: "InvalidLensConfig";
      readonly token: string;
      readonly reason: string;
    }
  | {
      readonly kind: "ResolutionFailed";
      readonly token: string;
      readonly reason: string;
    }
  | {
      readonly kind: "ExecutionFailed";
      readonly formulaId: string;
      readonly reason: string;
    };

// Mock storage for formula engine dependencies.
// In a real app these would come from a database, config files, or a service.
let lensConfigsRegistry: Readonly<Record<string, LensConfig>> = {};
let formulaDefinitionsRegistry: Readonly<Record<string, FormulaDefinition>> = {};

export function registerLensConfig(token: string, config: LensConfig): void {
  lensConfigsRegistry = { ...lensConfigsRegistry, [token]: config };
}

export function registerFormulaDefinition(definition: FormulaDefinition): void {
  formulaDefinitionsRegistry = {
    ...formulaDefinitionsRegistry,
    [definition.id]: definition,
  };
}

export function lookupLensConfig(token: string): LensConfig | undefined {
  return lensConfigsRegistry[token];
}

export function lookupFormulaDefinition(
  id: string
): FormulaDefinition | undefined {
  return formulaDefinitionsRegistry[id];
}

/**
 * Test/utility helper to reset the registries. Production code uses the
 * register* functions; this keeps the mock storage isolated between
 * test runs.
 */
export function clearRegistries(): void {
  lensConfigsRegistry = {};
  formulaDefinitionsRegistry = {};
}

function resolveTokenInput(
  token: string,
  dataContext: object
): Result<readonly [string, FormulaInputValue], FormulaError> {
  const config = lookupLensConfig(token);
  if (!config) {
    return err({ kind: "MissingLensConfig", token });
  }

  const lensResult = createLensFromConfig<object, FormulaInputValue>(config);
  if (isErr(lensResult)) {
    return err({
      kind: "InvalidLensConfig",
      token,
      reason: lensResult.error,
    });
  }

  const viewResult = lensResult.value.view(dataContext);
  if (isErr(viewResult)) {
    return err({
      kind: "ResolutionFailed",
      token,
      reason: viewResult.error,
    });
  }

  return ok([token, viewResult.value]);
}

function resolveFormulaInputs(
  tokens: readonly string[],
  dataContext: object
): Result<Record<string, FormulaInputValue>, FormulaError> {
  return tokens.reduce<Result<Record<string, FormulaInputValue>, FormulaError>>(
    (inputsResult, token) => {
      if (isErr(inputsResult)) {
        return inputsResult;
      }

      const tokenResult = resolveTokenInput(token, dataContext);
      if (isErr(tokenResult)) {
        return tokenResult;
      }

      const [resolvedToken, value] = tokenResult.value;
      return ok({ ...inputsResult.value, [resolvedToken]: value });
    },
    ok({})
  );
}

/**
 * Resolve a formula's token inputs through configured lenses and run its
 * execute function. Formula execution returns Result instead of throwing;
 * the engine maps formula failures into typed FormulaError values.
 */
export function evaluateFormula(
  formulaId: string,
  dataContext: object
): Result<FormulaResultOutput, FormulaError> {
  const formula = lookupFormulaDefinition(formulaId);
  if (!formula) {
    return err({ kind: "MissingFormulaDefinition", formulaId });
  }

  const inputsResult = resolveFormulaInputs(
    formula.getRequiredTokens(),
    dataContext
  );
  if (isErr(inputsResult)) {
    return inputsResult;
  }

  const executionResult = formula.execute(inputsResult.value);
  if (isErr(executionResult)) {
    return err({
      kind: "ExecutionFailed",
      formulaId,
      reason: executionResult.error,
    });
  }

  return ok(executionResult.value);
}
