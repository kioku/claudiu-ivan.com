import { enableMapSet } from "immer";
import { err, isErr, isOk, ok } from "result-option-types";
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
  execute: (inputs: Record<string, FormulaInputValue>) => {
    console.log("Executing CalculateAdjustedNotional with inputs:", inputs);
    const notional = inputs["IRS.Notional"];
    const spread = inputs["IRS.FloatingLeg.Spread"];

    if (typeof notional !== "number" || typeof spread !== "number") {
      console.error(
        "Error: Invalid input types for CalculateAdjustedNotional.",
        { notional, spread }
      );
      return err("Invalid input types. Notional or Spread is not a number.");
    }
    return ok(notional * (1 + spread));
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
  execute: (inputs: Record<string, FormulaInputValue>) => {
    console.log("Executing DisplayLegTypesAndNotional with inputs:", inputs);
    return ok(
      `Notional: ${inputs["IRS.Notional"]}, Floating Leg Rate Type: ${inputs["IRS.FloatingLeg.RateType"]}, Fixed Leg Rate Value: ${inputs["IRS.FixedLeg.RateValue"]}`
    );
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
  if (isOk(strikeView)) {
    const updatedOptionResult = optionStrikeLens.set(
      option1,
      strikeView.value + 10
    );
    if (isErr(updatedOptionResult)) {
      console.error("Failed to set strike on option1:", updatedOptionResult.error);
      return;
    }

    const updatedOption = updatedOptionResult.value;
    const newStrikeView = optionStrikeLens.view(updatedOption);
    console.log("Original Strike:", strikeView.value);
    if (isOk(newStrikeView)) {
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
  if (isOk(formulaResult1)) {
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
  if (isOk(formulaResult2)) {
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
  const spreadLensResult = createLensFromConfig<IRS, number>(spreadLensConfig);
  if (isErr(spreadLensResult)) {
    console.error("Failed to create spread lens:", spreadLensResult.error);
    return;
  }

  const spreadLens = spreadLensResult.value;
  const spreadViewResult = spreadLens.view(sampleIRS);
  console.log("Spread viewed via lens:", spreadViewResult);

  if (isOk(spreadViewResult)) {
    const newIRSResult = spreadLens.set(
      sampleIRS,
      spreadViewResult.value + 0.001
    );
    if (isErr(newIRSResult)) {
      console.error("Failed to update spread in IRS object:", newIRSResult.error);
      return;
    }

    const newIRS = newIRSResult.value;
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
      isOk(updatedSpreadView)
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
  const problematicLensResult = createLensFromConfig<IRS, number | undefined>(
    problematicPathConfig
  );
  if (isErr(problematicLensResult)) {
    console.error("Failed to create problematic lens:", problematicLensResult.error);
    return;
  }

  const problematicLens = problematicLensResult.value;
  const problematicView = problematicLens.view(sampleIRS);
  console.log(
    "View result for fixedLeg.rate.spread (expected failure):",
    problematicView
  ); // Expect Err because the leaf property is absent.

  console.log(
    "Attempting to set on fixedLeg.rate.spread (expected to modify object if parent path exists)..."
  );
  const problematicSetResult = problematicLens.set(sampleIRS, 0.007);
  if (isOk(problematicSetResult)) {
    // Leaf creation is allowed when the parent path exists, so this adds
    // 'spread' to the FixedRate object instead of failing.
    console.log(
      "Result of setting 'spread' on FixedRate:",
      problematicSetResult.value.fixedLeg.rate
    );
  } else {
    console.error(
      "Error during problematic set on fixedLeg.rate.spread:",
      problematicSetResult.error
    );
  }
}

runDemonstrations();
