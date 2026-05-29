import { type Result, ok, err, isErr } from "result-option-types";
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
  execute: (inputs: Record<string, FormulaInputValue>) => FormulaResultOutput;
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
      readonly kind: "ExecutionThrew";
      readonly formulaId: string;
      readonly message: string;
    };

// Mock storage for formula engine dependencies.
// In a real app these would come from a database, config files, or a service.
const LENS_CONFIGS_REGISTRY: Record<string, LensConfig> = {};
const FORMULA_DEFINITIONS_REGISTRY: Record<string, FormulaDefinition> = {};

export function registerLensConfig(token: string, config: LensConfig): void {
  LENS_CONFIGS_REGISTRY[token] = config;
}

export function registerFormulaDefinition(definition: FormulaDefinition): void {
  FORMULA_DEFINITIONS_REGISTRY[definition.id] = definition;
}

export function lookupLensConfig(token: string): LensConfig | undefined {
  return LENS_CONFIGS_REGISTRY[token];
}

export function lookupFormulaDefinition(
  id: string
): FormulaDefinition | undefined {
  return FORMULA_DEFINITIONS_REGISTRY[id];
}

/**
 * Test/utility helper to reset the registries. Production code uses the
 * register* functions; this keeps the mock storage isolated between
 * test runs.
 */
export function clearRegistries(): void {
  for (const key of Object.keys(LENS_CONFIGS_REGISTRY)) {
    delete LENS_CONFIGS_REGISTRY[key];
  }
  for (const key of Object.keys(FORMULA_DEFINITIONS_REGISTRY)) {
    delete FORMULA_DEFINITIONS_REGISTRY[key];
  }
}

/**
 * Resolve a formula's token inputs through configured lenses and run its
 * execute function. Returns Err with a typed FormulaError instead of
 * throwing; the only throw the engine cannot fully avoid is a
 * formula-author bug inside execute, which is captured and reported as
 * ExecutionThrew.
 */
export function evaluateFormula(
  formulaId: string,
  dataContext: object
): Result<FormulaResultOutput, FormulaError> {
  const formula = lookupFormulaDefinition(formulaId);
  if (!formula) {
    return err({ kind: "MissingFormulaDefinition", formulaId });
  }

  const inputs: Record<string, FormulaInputValue> = {};

  for (const token of formula.getRequiredTokens()) {
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
    inputs[token] = viewResult.value;
  }

  try {
    return ok(formula.execute(inputs));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return err({ kind: "ExecutionThrew", formulaId, message });
  }
}
