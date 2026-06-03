import { enableMapSet } from "immer";
import { err, isErr, isOk, ok } from "../result-option-types/index.ts";
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

const section = (title: string): void => {
  console.log(`\n--- ${title} ---`);
};

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

function runLensLawDemo(): void {
  section("Lens Law Example (Option Strike)");

  const optionStrikeLens = lensProp<EuropeanCallOption, "strike">("strike");
  const strikeView = optionStrikeLens.view(option1);
  if (isErr(strikeView)) {
    console.error("Failed to view strike on option1:", strikeView.error);
    return;
  }

  const updatedOptionResult = optionStrikeLens.set(
    option1,
    strikeView.value + 10
  );
  if (isErr(updatedOptionResult)) {
    console.error("Failed to set strike on option1:", updatedOptionResult.error);
    return;
  }

  const newStrikeView = optionStrikeLens.view(updatedOptionResult.value);
  if (isErr(newStrikeView)) {
    console.error("Failed to view strike on updated option:", newStrikeView.error);
    return;
  }

  console.log("Original Strike:", strikeView.value);
  console.log("Updated Strike:", newStrikeView.value);
  console.log(
    "Set-Get Law (simplified):",
    newStrikeView.value === strikeView.value + 10
  );
}

function runFormulaExample(formulaId: string): void {
  section(`Formula Evaluation Example: ${formulaId}`);

  const formulaResult = evaluateFormula(formulaId, sampleIRS);
  if (isOk(formulaResult)) {
    console.log(`Formula Result (${formulaId}):`, formulaResult.value);
    return;
  }

  console.error(`Error evaluating ${formulaId}:`, formulaResult.error);
}

function runConfigurableLensDemo(): void {
  section("Direct Configurable Lens Usage Example");

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

  if (isErr(spreadViewResult)) {
    return;
  }

  const newIRSResult = spreadLens.set(sampleIRS, spreadViewResult.value + 0.001);
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

  if (newIRS.floatingLeg.rate.type === "Floating" && isOk(updatedSpreadView)) {
    console.log(
      "New IRS spread (direct access):",
      newIRS.floatingLeg.rate.spread,
      "Matches lens view:",
      newIRS.floatingLeg.rate.spread === updatedSpreadView.value
    );
  }
}

function runMismatchedPathDemo(): void {
  section("Mismatched Path Example: fixedLeg.rate.spread");

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
  if (isErr(problematicView)) {
    console.log("View failed because FixedRate has no spread field:");
    console.log(problematicView.error);
  } else {
    console.log("Unexpected view success:", problematicView.value);
  }

  console.log(
    "Set succeeds because this demo lens allows creating the leaf property when the parent path exists."
  );
  const problematicSetResult = problematicLens.set(sampleIRS, 0.007);
  if (isErr(problematicSetResult)) {
    console.error(
      "Error during problematic set on fixedLeg.rate.spread:",
      problematicSetResult.error
    );
    return;
  }

  console.log("Updated fixedLeg.rate:", problematicSetResult.value.fixedLeg.rate);
  console.log(
    "This is why production configurable lenses should validate target paths against fixtures."
  );
}

function runDemonstrations(): void {
  console.log("--- Running Demonstrations ---");
  runLensLawDemo();
  runFormulaExample("CalculateAdjustedNotional");
  runFormulaExample("DisplayLegTypesAndNotional");
  runConfigurableLensDemo();
  runMismatchedPathDemo();
}

runDemonstrations();
