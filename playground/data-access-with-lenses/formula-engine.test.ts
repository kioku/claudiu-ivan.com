import { describe, it, expect, beforeEach } from "vitest";
import {
  evaluateFormula,
  registerLensConfig,
  registerFormulaDefinition,
  type FormulaDefinition,
  type FormulaInputValue,
  type FormulaResultOutput,
} from "./formula-engine";
import { type LensConfig } from "./lens-configurable";
import { type IRS, type FixedRate, type FloatingRate } from "./data-models";

// Clear registries before each test to ensure isolation
beforeEach(() => {
  // Need a way to clear registries if they are module-scoped and not exported for clearing
  // For now, assuming they are cleared or tests manage unique keys.
  // A better approach would be to pass registries to evaluateFormula or use classes.
  // Let's redefine them for each test suite or use unique IDs.
  // This is a limitation of the current mock registry design.
  // To make this testable, we'd need to export clearRegistry functions or re-initialize.
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

  const sumFormula: FormulaDefinition = {
    id: "SumTestFormula",
    getRequiredTokens: () => ["val1", "val2"],
    execute: (
      inputs: Record<string, FormulaInputValue>
    ): FormulaResultOutput => {
      if (typeof inputs.val1 === "number" && typeof inputs.val2 === "number") {
        return inputs.val1 + inputs.val2;
      }
      throw new Error("Invalid input types for SumTestFormula");
    },
  };

  it("should evaluate a formula successfully", () => {
    registerLensConfig("val1", notionalConfig); // IRS.Notional
    registerLensConfig("val2", spreadConfig); // IRS.FloatingLeg.Spread
    registerFormulaDefinition(sumFormula);

    const result = evaluateFormula(sumFormula.id, sampleIRS);
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      // notionalAmount (1000000) + spread (0.005)
      // This formula is not realistic, just for testing token resolution
      // Let's adjust the formula for a more meaningful test.
      const adjustedSumFormula: FormulaDefinition = {
        id: "AdjustedSumTestFormula",
        getRequiredTokens: () => ["notional", "spreadAmount"],
        execute: (
          inputs: Record<string, FormulaInputValue>
        ): FormulaResultOutput => {
          if (
            typeof inputs.notional === "number" &&
            typeof inputs.spreadAmount === "number"
          ) {
            return inputs.notional * (1 + inputs.spreadAmount); // Example: adjusted notional
          }
          throw new Error("Invalid input types for AdjustedSumTestFormula");
        },
      };
      registerLensConfig("notional", notionalConfig);
      registerLensConfig("spreadAmount", spreadConfig);
      registerFormulaDefinition(adjustedSumFormula);

      const adjustedResult = evaluateFormula(adjustedSumFormula.id, sampleIRS);
      expect(adjustedResult.kind).toBe("success");
      if (adjustedResult.kind === "success") {
        expect(adjustedResult.value).toBe(1000000 * (1 + 0.005));
      }
    }
  });

  it("should return failure if formula definition not found", () => {
    const result = evaluateFormula("NonExistentFormula", sampleIRS);
    expect(result.kind).toBe("failure");
    if (result.kind === "failure") {
      expect(result.error).toContain("Formula definition not found");
    }
  });

  it("should return failure if lens configuration missing for a token", () => {
    // sumFormula requires "val1" and "val2"
    // registerLensConfig("val1", notionalConfig); // "val2" is missing
    // registerFormulaDefinition(sumFormula);
    // Need unique IDs for this test due to shared registry
    const missingTokenFormula: FormulaDefinition = {
      id: "MissingTokenFormula",
      getRequiredTokens: () => ["tokenExists", "tokenMissing"],
      execute: () => 0,
    };
    registerLensConfig("tokenExists", notionalConfig);
    registerFormulaDefinition(missingTokenFormula);

    const result = evaluateFormula(missingTokenFormula.id, sampleIRS);
    expect(result.kind).toBe("failure");
    if (result.kind === "failure") {
      expect(result.error).toContain(
        "Configuration missing for token: tokenMissing"
      );
    }
  });

  it("should return failure if lens view fails for a token", () => {
    const viewFailFormula: FormulaDefinition = {
      id: "ViewFailFormula",
      getRequiredTokens: () => ["badPathToken"],
      execute: () => 0,
    };
    registerLensConfig("badPathToken", nonExistentConfig); // This lens will fail to view
    registerFormulaDefinition(viewFailFormula);

    const result = evaluateFormula(viewFailFormula.id, sampleIRS);
    expect(result.kind).toBe("failure");
    if (result.kind === "failure") {
      expect(result.error).toContain(
        "Failed to retrieve value for token 'badPathToken'"
      );
      expect(result.error).toContain(
        "Property 'nonExistentPath' does not exist"
      );
    }
  });

  it("should return failure if formula execution throws an error", () => {
    const errorFormula: FormulaDefinition = {
      id: "ErrorFormula",
      getRequiredTokens: () => ["val1"],
      execute: (): FormulaResultOutput => {
        throw new Error("Execution failed intentionally");
      },
    };
    registerLensConfig("val1", notionalConfig);
    registerFormulaDefinition(errorFormula);

    const result = evaluateFormula(errorFormula.id, sampleIRS);
    expect(result.kind).toBe("failure");
    if (result.kind === "failure") {
      expect(result.error).toContain(
        "Error executing formula 'ErrorFormula': Execution failed intentionally"
      );
    }
  });
});
