import { enableMapSet } from "immer";
import {
  type IRS,
  type EuropeanCallOption,
  type FixedRate,
  type FloatingRate,
} from "./data-models";
import { lensProp } from "./lens-core";
import { createLensFromConfig, type LensConfig } from "./lens-configurable";
import {
  evaluateFormula,
  registerLensConfig,
  registerFormulaDefinition,
  type FormulaDefinition,
  type FormulaResultOutput,
  type FormulaInputValue,
} from "./formula-engine";

enableMapSet();

// --- Example Data Setup ---
const sampleIRS: IRS = {
  id: "IRS001",
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

const option1: EuropeanCallOption = {
  id: "opt1",
  underlying: "XYZ",
  strike: 100,
  expiry: Date.now(),
  style: "European",
};

// --- Register Lens Configurations ---
registerLensConfig("IRS.Notional", {
  sourceType: "IRS",
  targetType: "number",
  getterPath: ["notionalAmount"],
});
registerLensConfig("IRS.FloatingLeg.RateType", {
  sourceType: "IRS",
  targetType: "string",
  getterPath: ["floatingLeg", "rate", "type"],
});
registerLensConfig("IRS.FloatingLeg.Spread", {
  sourceType: "IRS",
  targetType: "number",
  getterPath: ["floatingLeg", "rate", "spread"], // Assumes rate is FloatingRate
});
registerLensConfig("IRS.FixedLeg.RateValue", {
  sourceType: "IRS",
  targetType: "number",
  getterPath: ["fixedLeg", "rate", "value"], // Assumes rate is FixedRate
});

// --- Register Formula Definitions ---
const calculateAdjustedNotionalDef: FormulaDefinition = {
  id: "CalculateAdjustedNotional",
  getRequiredTokens: () => ["IRS.Notional", "IRS.FloatingLeg.Spread"],
  execute: (inputs: Record<string, FormulaInputValue>): FormulaResultOutput => {
    console.log("Executing CalculateAdjustedNotional with inputs:", inputs);
    const notional = inputs["IRS.Notional"];
    const spread = inputs["IRS.FloatingLeg.Spread"];

    if (typeof notional !== "number" || typeof spread !== "number") {
      console.error(
        "Error: Invalid input types for CalculateAdjustedNotional.",
        { notional, spread }
      );
      return "Error: Invalid input types. Notional or Spread is not a number.";
    }
    return notional * (1 + spread);
  },
};
registerFormulaDefinition(calculateAdjustedNotionalDef);

const displayLegTypesAndNotionalDef: FormulaDefinition = {
  id: "DisplayLegTypesAndNotional",
  getRequiredTokens: () => [
    "IRS.FloatingLeg.RateType",
    "IRS.FixedLeg.RateValue",
    "IRS.Notional",
  ],
  execute: (inputs: Record<string, FormulaInputValue>): FormulaResultOutput => {
    console.log("Executing DisplayLegTypesAndNotional with inputs:", inputs);
    return `Notional: ${inputs["IRS.Notional"]}, Floating Leg Rate Type: ${inputs["IRS.FloatingLeg.RateType"]}, Fixed Leg Rate Value: ${inputs["IRS.FixedLeg.RateValue"]}`;
  },
};
registerFormulaDefinition(displayLegTypesAndNotionalDef);

// --- Main Execution Block for Demonstration ---
function runDemonstrations() {
  console.log("--- Running Demonstrations ---");

  // Lens Law Demo (simplified, more robust tests in .test.ts files)
  console.log("\n--- Lens Law Example (Option Strike) ---");
  const optionStrikeLens = lensProp<EuropeanCallOption, "strike">("strike");
  const strikeView = optionStrikeLens.view(option1);
  if (strikeView.success) {
    const updatedOption = optionStrikeLens.set(option1, strikeView.value + 10);
    const newStrikeView = optionStrikeLens.view(updatedOption);
    console.log("Original Strike:", strikeView.value);
    if (newStrikeView.success) {
      console.log("Updated Strike:", newStrikeView.value);
      console.log(
        "Set-Get Law (simplified):",
        newStrikeView.value === strikeView.value + 10
      );
    } else {
      console.error(
        "Failed to view strike on updated option:",
        newStrikeView.error
      );
    }
  } else {
    console.error("Failed to view strike on option1:", strikeView.error);
  }

  console.log(
    "\n--- Formula Evaluation Example: CalculateAdjustedNotional ---"
  );
  const formulaResult1 = evaluateFormula(
    "CalculateAdjustedNotional",
    sampleIRS
  );
  if (formulaResult1.kind === "success") {
    console.log(
      "Formula Result (CalculateAdjustedNotional):",
      formulaResult1.value
    );
  } else {
    console.error(
      "Error evaluating CalculateAdjustedNotional:",
      formulaResult1.error
    );
  }

  console.log(
    "\n--- Formula Evaluation Example: DisplayLegTypesAndNotional ---"
  );
  const formulaResult2 = evaluateFormula(
    "DisplayLegTypesAndNotional",
    sampleIRS
  );
  if (formulaResult2.kind === "success") {
    console.log(
      "Formula Result (DisplayLegTypesAndNotional):",
      formulaResult2.value
    );
  } else {
    console.error(
      "Error evaluating DisplayLegTypesAndNotional:",
      formulaResult2.error
    );
  }

  console.log("\n--- Direct Configurable Lens Usage Example ---");
  const spreadLensConfig: LensConfig = {
    sourceType: "IRS",
    targetType: "number",
    getterPath: ["floatingLeg", "rate", "spread"],
  };
  const spreadLens = createLensFromConfig<IRS, number>(spreadLensConfig);
  const spreadViewResult = spreadLens.view(sampleIRS);
  console.log("Spread viewed via lens:", spreadViewResult);

  if (spreadViewResult.success) {
    const newIRS = spreadLens.set(sampleIRS, spreadViewResult.value + 0.001);
    const updatedSpreadView = spreadLens.view(newIRS);
    console.log("Updated spread in new IRS object:", updatedSpreadView);
    if (sampleIRS.floatingLeg.rate.type === "Floating") {
      console.log(
        "Original IRS spread (direct access):",
        sampleIRS.floatingLeg.rate.spread
      );
    }
    if (
      newIRS.floatingLeg.rate.type === "Floating" &&
      updatedSpreadView.success
    ) {
      console.log(
        "New IRS spread (direct access):",
        newIRS.floatingLeg.rate.spread,
        "Matches lens view:",
        newIRS.floatingLeg.rate.spread === updatedSpreadView.value
      );
    }
  }

  console.log(
    "\n--- Testing Lens on Potentially Mismatched Path (fixedLeg.rate.spread) ---"
  );
  const problematicPathConfig: LensConfig = {
    sourceType: "IRS",
    targetType: "number",
    getterPath: ["fixedLeg", "rate", "spread"], // 'spread' doesn't exist on FixedRate
  };
  const problematicLens = createLensFromConfig<IRS, number | undefined>(
    problematicPathConfig
  );
  const problematicView = problematicLens.view(sampleIRS);
  console.log(
    "View result for fixedLeg.rate.spread (expected failure):",
    problematicView
  ); // Expect { success: false, ... }

  console.log(
    "Attempting to set on fixedLeg.rate.spread (expected to modify object if parent path exists)..."
  );
  try {
    const problematicSetIRS = problematicLens.set(sampleIRS, 0.007);
    // This will add 'spread' to the FixedRate object if fixedLeg.rate exists.
    console.log(
      "Result of setting 'spread' on FixedRate:",
      problematicSetIRS.fixedLeg.rate
    );
  } catch (e: unknown) {
    console.error(
      "Error during problematic set on fixedLeg.rate.spread:",
      (e as Error).message
    );
  }
}

runDemonstrations();
