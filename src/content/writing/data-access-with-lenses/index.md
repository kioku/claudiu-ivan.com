---
title: "Composable Data Access with Lenses"
description: "How lenses make nested immutable updates explicit, reusable, and testable without turning ordinary TypeScript into a functional programming ceremony."
date: "2025-05-02"
draft: false
---

There is a kind of code review comment I have written too many times: "this update mutates the original object." It usually appears in a harmless-looking change. Someone needs to update a field three levels down in a data structure, spreads the top-level object, changes the nested value, and misses one of the intermediate copies.

The developer may have been careful and still missed the invariant. The code asked a person to preserve something the type system could have helped with.

In financial systems this shows up constantly. Instruments like swaps, options, policies, portfolios, and valuation contexts are naturally nested. The same is true outside finance: claims processing, logistics, document workflows, entitlement models, product catalogs. Once the domain gets real, the objects stop being flat.

Immutability helps because it makes state changes predictable. It is easier to audit, easier to test, and safer under concurrency. But immutability has a practical cost: updating nested data can become noisy enough that the intent disappears.

Path ownership is the larger design problem. When a field path is used by forms, imports, reports, and formulas, it stops being an implementation detail. It becomes a contract between the domain model and the rest of the system. Repeating that contract as raw property access makes schema changes harder to review and harder to test.

**Lenses** are a functional programming idea for focusing on part of a larger structure. In TypeScript, they give shared paths a name and move fragile object-copying code behind a testable interface.

Code for the examples, including tests, is available in the [data-access-with-lenses playground](https://github.com/kioku/claudiu-ivan.com/tree/main/playground/data-access-with-lenses). The article starts with the minimal form; the companion code makes failure more explicit once runtime configuration enters the picture.

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

If we want to update the spread on the floating leg without mutating the original object, the direct implementation is:

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

For one update, this is probably fine. The problem starts when this pattern appears fifty times, each copy slightly different, each one depending on the developer remembering the exact shape of the object.

The failures tend to be mundane:

- copy the top level but mutate a nested object,
- forget one level of copying,
- handle one branch of a discriminated union but not another,
- duplicate path knowledge across services, forms, validators, and formula engines,
- make a schema change and miss one of the hand-written update paths.

A codebase should not rely on "be careful" as its enforcement mechanism. If a path through a domain object matters, it deserves a name.

## A Lens Is a Named Focus

A lens is a pair of functions that knows how to look at part of a structure and how to replace that part immutably.

```typescript
interface Lens<S, A> {
  readonly view: (source: S) => A;
  readonly set: (source: S, newValue: A) => S;
}
```

`S` is the source, the larger structure. `A` is the part being focused.

A lens from `IRS` to `Leg` can focus on the floating leg. A lens from `Leg` to `Rate` can focus on the rate. Compose them, and you get a lens from `IRS` directly to the floating leg's rate.

The simplest lens targets a property:

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

The implementation is deliberately small. Composition gives it range:

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

The composed `set` does three things: view the intermediate value, update it through the inner lens, then write the updated intermediate value back through the outer lens. The caller does not need to remember how many levels of object spread are required.

```typescript
const currentRate = floatingRateLens.view(irs);
const updatedIrs = floatingRateLens.set(irs, {
  type: "Floating",
  index: "SOFR",
  spread: 0.004,
});
```

Naming the path changes the maintenance model. A named path can be reused, tested, composed, and discussed in code review without re-reading object spread syntax.

## The Laws Are the Contract

Lenses come with three laws. You do not need category theory to understand them. They are just sanity checks.

The view-set law: viewing a value and setting it back should leave the source unchanged.

```typescript
lens.set(source, lens.view(source)) === source;
```

The set-view law: setting a value and immediately viewing it should return the value you set.

```typescript
lens.view(lens.set(source, value)) === value;
```

The set-set law: setting a value and then setting another value is equivalent to setting the second value directly.

```typescript
lens.set(lens.set(source, a), b) === lens.set(source, b);
```

The laws make good tests because they are easy to state and easy to violate. A broken lens is worse than no abstraction because it gives a bad update path a trustworthy name. In production code, test your reusable lenses against these laws. Property-based testing works well here because the laws are expressed over all valid inputs, not just one hand-picked example.

The companion code uses `fast-check` for this. When an abstraction exists to protect an invariant, test the invariant directly.

## Runtime Configuration Is a Boundary

Runtime configuration usually appears next. Enterprise systems often have formula engines, configurable forms, import mappings, reporting tokens, and client-specific data models. You do not want to hard-code every path in application logic. You want a token like `IRS.Notional` or `Option.Strike` to resolve to the right value in the current data structure.

A minimal configuration needs the source type, target type, and path:

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

Generated lenses lose some of the guarantees that made the hand-written version attractive. A string path is not type-safe. TypeScript cannot prove that `["floatingLeg", "rate", "spread"]` is valid for `IRS`, or that the value at the end is a number, or that the rate is actually the `Floating` variant when you get there. The moment you move access paths into runtime configuration, you move some failures from compile time to runtime.

Configuration-driven access can still be the right design, but the boundary has to be treated as an untrusted input boundary.

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

The pure lens definition is shorter, while runtime configuration needs the error channel. The extra type is the cost of admitting that lookup can fail.

## Token-Driven Formula Systems

Valuation engines often refer to domain concepts rather than object paths:

```text
PresentValue = DiscountFactor * IRS.Notional
```

The formula should not care whether the notional lives at `notionalAmount`, `trade.economics.notional.amount`, or in a client-specific import shape. It should refer to the concept while the mapping layer handles the location.

The engine's core loop is:

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

The separation keeps formulas focused on business logic, lens configuration focused on data locations, and validation focused on bad mappings.

The trade-off: this boundary decouples formula logic from object shape, while bad configuration can still corrupt results. Use the pattern with aggressive validation, mapping tests, and explicit failures.

In systems that handle money, silent `undefined` usually becomes a badly timed bug report.

## When Paths Become Contracts

Typed lenses are a local abstraction. Runtime-configured lenses are a system boundary.

The boundary needs ownership. A token such as `IRS.Notional` may be referenced by formulas, report definitions, client mappings, and support runbooks. A change to the underlying object shape can break all of them without changing a single formula. At that point, lens configuration should be treated like routing rules or database migrations: versioned, reviewed, validated, and observable.

A production setup should make a few things explicit:

- which team owns each token namespace,
- which domain schema version each path targets,
- which fixtures prove the mapping still works,
- whether failures are deploy-time errors or request-time errors,
- what context appears in an error when lookup fails,
- how old token mappings are retired.

The error context matters. `Could not resolve IRS.Notional` is better than `Cannot read property amount of undefined`, but it still may not be enough. A better failure includes the formula id, token, source type, configured path, expected type, and where validation last passed.

Lenses create a place to attach ownership, compatibility checks, and operational signals to paths that already mattered but were previously scattered through the codebase.

## Beyond Lenses

Lenses focus on a part that exists. Real data is often less cooperative.

A discriminated union like `Rate` needs conditional access. The `spread` exists only when the rate is floating. **Prisms** handle that case by focusing on one possible variant of a larger type.

Arrays and collections need a different abstraction. If you want to update every leg, every cashflow, or every matching row, you are in **traversal** territory.

You do not need to implement all of these yourself. If you want production-grade optics in TypeScript, look at [`monocle-ts`](https://gcanti.github.io/monocle-ts/). If you only need path-based access and can tolerate weaker type guarantees, Ramda's [`lensPath`](https://ramdajs.com/docs/#lensPath) may be enough.

Choose the smallest abstraction that covers the case:

- object spread for shallow one-off updates,
- named lenses for repeated nested immutable access,
- prisms when the target may not exist because of the shape of the type,
- traversals when there may be many targets,
- a library when the abstraction becomes central to the system.

Introduce optics when they remove duplicated path logic and make correctness easier to check. Elegance is a side effect, not the justification.

## Practical Guidance

If you are adopting this pattern in a TypeScript codebase, start small.

Pick one domain object with repeated nested updates. Replace the duplicated object-spread logic with a small set of named lenses, add tests for the lens laws, and stop there. If the code gets clearer, continue. If it gets more abstract without removing real duplication, revert it.

Use runtime configuration only when the path has to cross a boundary: formula definitions, client mappings, reporting metadata, import specifications, or other data that lives outside the compiled TypeScript module. Keep ordinary application code on typed lenses where possible.

A senior reviewer will object less to the unfamiliar pattern than to hidden failure. Make the failure mode visible and the abstraction becomes much easier to defend.

## Putting It to Work

Lenses give repeated or risky paths through immutable data a name. Once the path is named, you can compose access, test update behavior, and remove hand-written cloning code from business logic.

Object spread remains the right tool for shallow one-off updates. Lenses fit better when the codebase has nested domain models, repeated updates, and configurable mappings.

The pattern has costs. Runtime configuration weakens type guarantees. Optional fields and unions require more than basic lenses. Teams need to understand the laws well enough to test them. Adopt the pattern when duplicated path knowledge is already creating review risk, schema migration risk, or production failure risk. Leave it alone when the update is local and shallow.

Monday morning: find one nested immutable update that appears in more than one place. Give the path a name. Write the three lens-law tests. If the code becomes easier to read, keep it.

## References

- [Companion code: data-access-with-lenses](https://github.com/kioku/claudiu-ivan.com/tree/main/playground/data-access-with-lenses)
- [Monocle-TS Documentation](https://gcanti.github.io/monocle-ts/)
- [Ramda lensPath](https://ramdajs.com/docs/#lensPath)
- [Immer Documentation](https://immerjs.github.io/immer/)
- [Professor Frisby's Mostly Adequate Guide to Functional Programming](https://mostly-adequate.gitbook.io/mostly-adequate-guide/)
- [A Taste of Practical Optics](https://medium.com/@gcanti/a-taste-of-practical-optics-a770d135d589)
- [Domain-Specific Languages](https://martinfowler.com/books/dsl.html) by Martin Fowler
