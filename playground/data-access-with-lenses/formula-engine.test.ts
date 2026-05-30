import { describe, it, expect, beforeEach } from "vitest";
import { err, isErr, isOk, ok } from "result-option-types";
import {
  clearRegistries,
  evaluateFormula,
  registerLensConfig,
  registerFormulaDefinition,
  type FormulaDefinition,
  type FormulaInputValue,
} from "./formula-engine";
import { type LensConfig } from "./lens-configurable";
import { type IRS, type FixedRate, type FloatingRate } from "./data-models";

beforeEach(() => {
  clearRegistries();
});

describe("Formula Engine", () => {
  const sampleIRS: IRS = {
    id: "IRS001_TEST",
    notionalAmount: 1000000,
    fixedLeg: {
      paymentFrequency: "Semi-Annually",
      dayCountConvention: "30/360",
      rate: { type: "Fixed", value: 0.025 } as FixedRate,
    },
    floatingLeg: {
      paymentFrequency: "Quarterly",
      dayCountConvention: "Actual/365",
      rate: { type: "Floating", index: "LIBOR", spread: 0.005 } as FloatingRate,
    },
  };

  const notionalConfig: LensConfig = {
    sourceType: "IRS",
    targetType: "number",
    getterPath: ["notionalAmount"],
  };
  const spreadConfig: LensConfig = {
    sourceType: "IRS",
    targetType: "number",
    getterPath: ["floatingLeg", "rate", "spread"],
  };
  const nonExistentConfig: LensConfig = {
    sourceType: "IRS",
    targetType: "number",
    getterPath: ["nonExistentPath"],
  };

  it("evaluates a formula successfully", () => {
    const adjustedNotionalFormula: FormulaDefinition = {
      id: "AdjustedNotional",
      getRequiredTokens: () => ["notional", "spread"],
      execute: (inputs: Record<string, FormulaInputValue>) => {
        if (
          typeof inputs.notional !== "number" ||
          typeof inputs.spread !== "number"
        ) {
          return err("Invalid input types for AdjustedNotional");
        }
        return ok(inputs.notional * (1 + inputs.spread));
      },
    };

    registerLensConfig("notional", notionalConfig);
    registerLensConfig("spread", spreadConfig);
    registerFormulaDefinition(adjustedNotionalFormula);

    const result = evaluateFormula(adjustedNotionalFormula.id, sampleIRS);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe(1000000 * (1 + 0.005));
    }
  });

  it("returns MissingFormulaDefinition when the formula definition is not found", () => {
    const result = evaluateFormula("NonExistentFormula", sampleIRS);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual({
        kind: "MissingFormulaDefinition",
        formulaId: "NonExistentFormula",
      });
    }
  });

  it("returns MissingLensConfig when a token has no lens configuration", () => {
    const missingTokenFormula: FormulaDefinition = {
      id: "MissingTokenFormula",
      getRequiredTokens: () => ["tokenExists", "tokenMissing"],
      execute: () => ok(0),
    };
    registerLensConfig("tokenExists", notionalConfig);
    registerFormulaDefinition(missingTokenFormula);

    const result = evaluateFormula(missingTokenFormula.id, sampleIRS);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual({
        kind: "MissingLensConfig",
        token: "tokenMissing",
      });
    }
  });

  it("returns InvalidLensConfig when a token has invalid lens configuration", () => {
    const invalidConfigFormula: FormulaDefinition = {
      id: "InvalidConfigFormula",
      getRequiredTokens: () => ["invalidToken"],
      execute: () => ok(0),
    };
    registerLensConfig("invalidToken", {
      sourceType: "IRS",
      targetType: "number",
      getterPath: [],
    });
    registerFormulaDefinition(invalidConfigFormula);

    const result = evaluateFormula(invalidConfigFormula.id, sampleIRS);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual({
        kind: "InvalidLensConfig",
        token: "invalidToken",
        reason: "LensConfig requires a non-empty getterPath",
      });
    }
  });

  it("returns ResolutionFailed when lens view fails for a token", () => {
    const viewFailFormula: FormulaDefinition = {
      id: "ViewFailFormula",
      getRequiredTokens: () => ["badPathToken"],
      execute: () => ok(0),
    };
    registerLensConfig("badPathToken", nonExistentConfig);
    registerFormulaDefinition(viewFailFormula);

    const result = evaluateFormula(viewFailFormula.id, sampleIRS);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error;
      expect(error.kind).toBe("ResolutionFailed");
      if (error.kind === "ResolutionFailed") {
        expect(error.token).toBe("badPathToken");
        expect(error.reason).toContain(
          "Property 'nonExistentPath' does not exist"
        );
      }
    }
  });

  it("returns ExecutionFailed when formula execution returns Err", () => {
    const errorFormula: FormulaDefinition = {
      id: "ErrorFormula",
      getRequiredTokens: () => ["val1"],
      execute: () => err("Execution failed intentionally"),
    };
    registerLensConfig("val1", notionalConfig);
    registerFormulaDefinition(errorFormula);

    const result = evaluateFormula(errorFormula.id, sampleIRS);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual({
        kind: "ExecutionFailed",
        formulaId: "ErrorFormula",
        reason: "Execution failed intentionally",
      });
    }
  });
});
