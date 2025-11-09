import { type Lens, type ViewResult } from "./lens-core";
import { type LensConfig, createLensFromConfig } from "./lens-configurable";

// --- Supporting Types for Formula Engine ---
export type FormulaInputValue =
  | number
  | string
  | boolean
  | object
  | null
  | undefined;

export type FormulaResultOutput = FormulaInputValue;

export type FormulaEvaluationResult =
  | { readonly kind: "success"; readonly value: FormulaResultOutput }
  | { readonly kind: "failure"; readonly error: string };

export interface FormulaDefinition {
  id: string;
  getRequiredTokens: () => string[];
  execute: (inputs: Record<string, FormulaInputValue>) => FormulaResultOutput;
}

// Mock storage for formula engine dependencies
// In a real app, these would come from a database, config files, or a service.
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
// --- Simplified Conceptual Flow of a Formula Engine using Lenses ---
export function evaluateFormula(
  formulaId: string,
  dataContext: object // Should ideally be S, but generic context is hard here
): FormulaEvaluationResult {
  const formulaDefinition = lookupFormulaDefinition(formulaId);
  if (!formulaDefinition) {
    return {
      kind: "failure",
      error: `Formula definition not found for ID: ${formulaId}`,
    };
  }

  const requiredTokens = formulaDefinition.getRequiredTokens();
  const inputValues: Record<string, FormulaInputValue> = {};
  const lensCache = new Map<string, Lens<object, FormulaInputValue>>(); // In-function cache

  for (const token of requiredTokens) {
    const lensConfig = lookupLensConfig(token);
    if (!lensConfig) {
      return {
        kind: "failure",
        error: `Configuration missing for token: ${token}`,
      };
    }

    let lens: Lens<object, FormulaInputValue>; // Using 'any' due to dataContext variability
    const cacheKey = JSON.stringify(lensConfig);

    if (lensCache.has(cacheKey)) {
      lens = lensCache.get(cacheKey)!;
    } else {
      // Type S for createLensFromConfig is effectively 'any' here because dataContext is 'object'
      // Type A for createLensFromConfig is also 'any' as we don't know the target type from config alone
      lens = createLensFromConfig(lensConfig);
      lensCache.set(cacheKey, lens);
    }

    const viewResult: ViewResult<FormulaInputValue> = lens.view(dataContext);

    if (!viewResult.success) {
      return {
        kind: "failure",
        error: `Failed to retrieve value for token '${token}' (path: ${lensConfig.getterPath.join(
          "."
        )}). Reason: ${viewResult.error}`,
      };
    }
    inputValues[token] = viewResult.value;
  }

  try {
    const result = formulaDefinition.execute(inputValues);
    return { kind: "success", value: result };
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return {
      kind: "failure",
      error: `Error executing formula '${formulaId}': ${errorMessage}`,
    };
  }
}
