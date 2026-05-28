---
title: "Composable Data Access with Lenses"
description: "How lenses make nested immutable updates explicit, reusable, and testable without turning ordinary TypeScript into a functional programming ceremony."
date: "2025-05-02"
draft: false
---

There is a kind of code review comment I have written too many times: "this update mutates the original object." It usually appears in a harmless-looking change. Someone needs to update a field three levels down in a data structure, spreads the top-level object, changes the nested value, and misses one of the intermediate copies.

The bug is not that the developer failed to be careful enough. The bug is that the code asked a human to manually preserve an invariant the type system could have helped with.

In financial systems this shows up constantly. Instruments like swaps, options, policies, portfolios, and valuation contexts are naturally nested. The same is true outside finance: claims processing, logistics, document workflows, entitlement models, product catalogs. Once the domain gets real, the objects stop being flat.

Immutability helps because it makes state changes predictable. It is easier to audit, easier to test, and safer under concurrency. But immutability has a practical cost: updating deeply nested data can become noisy enough that the intent disappears.

This article looks at **lenses**, a small functional programming idea that gives us a reusable way to focus on part of a larger structure. The point is not to make TypeScript look like Haskell. The point is to stop rewriting the same fragile object-copying code by hand.

The complete companion code, including tests, is available in the [data-access-with-lenses playground](https://github.com/kioku/claudiu-ivan.com/tree/main/playground/data-access-with-lenses). The snippets below start with the minimal form because it is easier to understand; the companion code makes failure more explicit once runtime configuration enters the picture.

## The Problem

Consider a simplified interest rate swap:

```typescript
interface IRS {
  readonly id: string;
  readonly notionalAmount: number;
  readonly fixedLeg: Leg;
  readonly floatingLeg: Leg;
}

interface Leg {
  readonly paymentFrequency: string;
  readonly dayCountConvention: string;
  readonly rate: Rate;
}

type Rate = FixedRate | FloatingRate;

interface FixedRate {
  readonly type: "Fixed";
  readonly value: number;
}

interface FloatingRate {
  readonly type: "Floating";
  readonly index: string;
  readonly spread: number;
}
```

If we want to update the spread on the floating leg without mutating the original object, the direct implementation looks like this:

```typescript
function updateSpreadManually(irs: IRS, newSpread: number): IRS {
  if (irs.floatingLeg.rate.type !== "Floating") {
    return irs;
  }

  return {
    ...irs,
    floatingLeg: {
      ...irs.floatingLeg,
      rate: {
        ...irs.floatingLeg.rate,
        spread: newSpread,
      },
    },
  };
}
```

This is not terrible. In fact, for one update it is probably fine. The problem starts when this pattern appears fifty times, each copy slightly different, each one depending on the developer remembering the exact shape of the object.

There are several failure modes:

- copy the top level but mutate a nested object,
- forget one level of copying,
- handle one branch of a discriminated union but not another,
- duplicate path knowledge across services, forms, validators, and formula engines,
- make a schema change and miss one of the hand-written update paths.

"Be careful" is not an architecture. If a path through a domain object matters, it deserves a name.

## A Lens Is a Named Focus

A lens is a pair of functions that knows how to look at part of a structure and how to replace that part immutably.

```typescript
interface Lens<S, A> {
  readonly view: (source: S) => A;
  readonly set: (source: S, newValue: A) => S;
}
```

`S` is the source, the larger structure. `A` is the part being focused.

For example, a lens from `IRS` to `Leg` can focus on the floating leg. A lens from `Leg` to `Rate` can focus on the rate. Compose them, and you get a lens from `IRS` directly to the floating leg's rate.

The simplest useful lens targets a property:

```typescript
function lensProp<S, K extends keyof S>(prop: K): Lens<S, S[K]> {
  return {
    view: (source) => source[prop],
    set: (source, newValue) => ({ ...source, [prop]: newValue }),
  };
}

const floatingLegLens = lensProp<IRS, "floatingLeg">("floatingLeg");
const rateLens = lensProp<Leg, "rate">("rate");
```

This is small enough to look underwhelming. That is usually a good sign. The useful part is composition:

```typescript
function composeLens<S, B, A>(
  outer: Lens<S, B>,
  inner: Lens<B, A>
): Lens<S, A> {
  return {
    view: (source) => inner.view(outer.view(source)),
    set: (source, newValue) =>
      outer.set(source, inner.set(outer.view(source), newValue)),
  };
}

const floatingRateLens = composeLens(floatingLegLens, rateLens);
```

The `set` implementation is the whole trick. It views the intermediate value, updates it through the inner lens, then writes the updated intermediate value back through the outer lens. The caller does not need to remember how many levels of object spread are required.

```typescript
const currentRate = floatingRateLens.view(irs);
const updatedIrs = floatingRateLens.set(irs, {
  type: "Floating",
  index: "SOFR",
  spread: 0.004,
});
```

The path now has a name. That is the practical benefit. Once a path has a name, it can be reused, tested, composed, and discussed in code review without re-reading object spread syntax.

## The Laws Are the Contract

Lenses come with three laws. You do not need category theory to understand them. They are just sanity checks.

First, if you view a value and set it back, nothing should change.

```typescript
lens.set(source, lens.view(source)) === source;
```

Second, if you set a value and immediately view it, you should get the value you set.

```typescript
lens.view(lens.set(source, value)) === value;
```

Third, if you set a value and then set another value, the last set wins.

```typescript
lens.set(lens.set(source, a), b) === lens.set(source, b);
```

These sound obvious, which is exactly why they are valuable. A broken lens is worse than no abstraction because it gives a bad update path a trustworthy name. In production code, test your reusable lenses against these laws. Property-based testing is particularly effective here because the laws are expressed over all valid inputs, not just one hand-picked example.

The companion code uses `fast-check` for this. The important idea is simple: when an abstraction exists to protect an invariant, test the invariant directly.

## The Part People Get Wrong

The first temptation after discovering lenses is to make everything configurable.

That instinct is understandable. Enterprise systems often have formula engines, configurable forms, import mappings, reporting tokens, and client-specific data models. You do not want to hard-code every path in application logic. You want a token like `IRS.Notional` or `Option.Strike` to resolve to the right value in the current data structure.

A minimal configuration might look like this:

```typescript
interface LensConfig {
  readonly sourceType: string;
  readonly targetType: string;
  readonly getterPath: ReadonlyArray<string | number>;
}

const optionStrikeConfig: LensConfig = {
  sourceType: "EuropeanCallOption",
  targetType: "number",
  getterPath: ["strike"],
};
```

From there, it is easy to write a path-based lens generator:

```typescript
function createLensFromConfig<S extends object, A>(
  config: LensConfig
): Lens<S, A> {
  return {
    view: (source) => {
      let current: any = source;
      for (const key of config.getterPath) {
        current = current[key];
      }
      return current as A;
    },
    set: (source, newValue) => {
      // Usually implemented with Immer or a similar structural sharing helper.
      // The full companion code includes a safer implementation with path checks.
      throw new Error("set implementation omitted for brevity");
    },
  };
}
```

This is also where the abstraction becomes dangerous.

A string path is not type-safe. TypeScript cannot prove that `["floatingLeg", "rate", "spread"]` is valid for `IRS`, or that the value at the end is a number, or that the rate is actually the `Floating` variant when you get there. The moment you move access paths into runtime configuration, you move some failures from compile time to runtime.

That does not make configuration-driven access wrong. It means the boundary has to be treated as an untrusted input boundary.

A production version needs to answer several questions explicitly:

- What happens when a path is missing?
- Does `view` return `undefined`, throw, or return a typed result?
- Can `set` create intermediate objects, or must the full path already exist?
- How are discriminated unions handled?
- Who validates that `targetType` matches the actual runtime value?
- Are generated lenses cached, or rebuilt on every call?

The companion implementation returns a structured view result instead of pretending every path lookup succeeds:

```typescript
type ViewResult<A> =
  | { readonly success: true; readonly value: A }
  | { readonly success: false; readonly error: string };
```

That is less elegant than the pure lens definition, but more honest for runtime configuration. In code, honesty usually beats elegance.

## Where This Becomes Useful

A good use case is a token-driven formula system.

Imagine a valuation engine where formulas refer to domain concepts rather than object paths:

```text
PresentValue = DiscountFactor * IRS.Notional
```

The formula should not care whether the notional lives at `notionalAmount`, `trade.economics.notional.amount`, or in a client-specific import shape. The formula wants the concept. The mapping layer knows where the concept lives.

A simplified flow looks like this:

```typescript
type FormulaResult = number | string | boolean | object | null;

interface FormulaDefinition {
  readonly getRequiredTokens: () => string[];
  readonly execute: (inputs: Record<string, unknown>) => FormulaResult;
}

interface RuntimeLens<S, A> {
  readonly view: (source: S) => ViewResult<A>;
  readonly set: (source: S, newValue: A) => S;
}

function evaluateFormula(
  formulaId: string,
  dataContext: object
): FormulaResult {
  const formula: FormulaDefinition = lookupFormulaDefinition(formulaId);
  const inputs: Record<string, unknown> = {};

  for (const token of formula.getRequiredTokens()) {
    const config = lookupLensConfig(token);
    if (!config) {
      throw new Error(`Missing lens configuration for token: ${token}`);
    }

    const lens: RuntimeLens<object, unknown> = createRuntimeLens(config);
    const result = lens.view(dataContext);

    if (!result.success) {
      throw new Error(`Could not resolve ${token}: ${result.error}`);
    }

    inputs[token] = result.value;
  }

  return formula.execute(inputs);
}
```

This gives you a clean separation:

- formulas express business logic,
- lens configuration maps business tokens to data locations,
- lenses perform the access,
- validation decides what happens when the mapping is wrong.

Senior engineers will recognize the trade-off immediately. This is a powerful boundary because it decouples formula logic from object shape. It is also a risky boundary because bad configuration can corrupt results. The answer is not to avoid the pattern. The answer is to validate aggressively, test mappings, and make failures explicit.

In systems that handle money, silent `undefined` is not a value. It is a bug report with poor timing.

## Lenses Are Not the Whole Optics Story

Lenses focus on a part that exists. Real data is often less cooperative.

A discriminated union like `Rate` needs conditional access. The `spread` exists only when the rate is floating. This is what **prisms** are for: they focus on one possible variant of a larger type.

Arrays and collections need a different abstraction. If you want to update every leg, every cashflow, or every matching row, you are in **traversal** territory.

You do not need to implement all of these yourself. If you want production-grade optics in TypeScript, look at [`monocle-ts`](https://gcanti.github.io/monocle-ts/). If you only need path-based access and can tolerate weaker type guarantees, Ramda's [`lensPath`](https://ramdajs.com/docs/#lensPath) may be enough.

The decision should be boring:

- use object spread for shallow one-off updates,
- use named lenses for repeated nested immutable access,
- use prisms when the target may not exist because of the shape of the type,
- use traversals when there may be many targets,
- use a library when the abstraction becomes central to the system.

Do not introduce optics because they are elegant. Introduce them when they remove duplicated path logic and make correctness easier to check.

## Practical Guidance

If you are adopting this pattern in a TypeScript codebase, start small.

Pick one domain object with repeated nested updates. Replace the duplicated object-spread logic with a small set of named lenses. Add tests for the lens laws. Stop there. If the code gets clearer, continue. If it gets more abstract without removing real duplication, revert it.

For configuration-driven access, treat configuration like code:

- version it,
- validate it at startup,
- test it against representative fixtures,
- cache parsed/generated lenses,
- surface failures with enough context to debug the bad token or path,
- avoid pretending runtime paths have compile-time guarantees.

This last point matters. A senior reviewer will not object to lenses because the pattern is unfamiliar. They will object if the pattern hides failure. Make the failure mode visible and the abstraction becomes much easier to defend.

## Conclusion

Lenses are a small idea with a practical payoff: give important paths through immutable data a name.

That name lets you compose access, test update behavior, and remove hand-written cloning code from business logic. In simple cases, object spread is still the right tool. In complex systems with nested domain models, repeated updates, and configurable mappings, lenses provide a useful middle ground between ad-hoc property access and a full persistence/query layer.

The pattern is not free. Runtime configuration weakens type guarantees. Optional fields and unions require more than basic lenses. Teams need to understand the laws well enough to test them. But these costs are bounded, and they are usually smaller than the cost of debugging silent mutation or duplicated path logic across a large codebase.

Monday morning: find one nested immutable update that appears in more than one place. Give the path a name. Write the three lens-law tests. If the code becomes easier to read, you have your first useful lens.

## References

- [Companion code: data-access-with-lenses](https://github.com/kioku/claudiu-ivan.com/tree/main/playground/data-access-with-lenses)
- [Monocle-TS Documentation](https://gcanti.github.io/monocle-ts/)
- [Ramda lensPath](https://ramdajs.com/docs/#lensPath)
- [Immer Documentation](https://immerjs.github.io/immer/)
- [Professor Frisby's Mostly Adequate Guide to Functional Programming](https://mostly-adequate.gitbook.io/mostly-adequate-guide/)
- [A Taste of Practical Optics](https://medium.com/@gcanti/a-taste-of-practical-optics-a770d135d589)
- [Domain-Specific Languages](https://martinfowler.com/books/dsl.html) by Martin Fowler
