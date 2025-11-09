# Result and Option Types

A TypeScript implementation of functional error handling types inspired by Rust's `Result<T, E>` and `Option<T>`. This playground accompanies the article "Type-Safe Error Handling in TypeScript: Option and Result".

## Overview

This implementation provides principled alternatives to traditional error handling:

- **Option\<T\>**: Represents an optional value, eliminating null/undefined
- **Result\<T, E\>**: Represents success or failure with typed errors

Both types are discriminated unions that enable exhaustive pattern matching and type-safe operations.

## Installation

From the repository root:

```bash
pnpm install
```

## Running Tests

```bash
# From repository root
pnpm playground:test

# Or specifically for this playground
pnpm --filter result-option-types test

# Watch mode for development
pnpm --filter result-option-types test:watch
```

## Type Checking

```bash
pnpm --filter result-option-types build
```

## Project Structure

```
result-option-types/
├── option.ts           # Option<T> type and operations
├── option.test.ts      # Tests including monad law verification
├── result.ts           # Result<T, E> type and operations
├── result.test.ts      # Tests including monad law verification
├── conversions.ts      # Utilities for converting between types
├── conversions.test.ts # Tests for conversion functions
├── examples.ts         # Practical domain examples
├── examples.test.ts    # Tests for examples
└── index.ts           # Barrel exports
```

## Usage Examples

### Option\<T\>: Handling Optional Values

```typescript
import { some, none, map, unwrapOr } from './option';

// Safe array access
function first<T>(array: T[]): Option<T> {
  return array.length > 0 ? some(array[0]) : none();
}

const numbers = [1, 2, 3];
const firstNum = first(numbers);  // Some(1)
const doubled = map(firstNum, x => x * 2);  // Some(2)
const value = unwrapOr(doubled, 0);  // 2

const empty: number[] = [];
const noFirst = first(empty);  // None
const defaultValue = unwrapOr(noFirst, 0);  // 0
```

### Result\<T, E\>: Type-Safe Error Handling

```typescript
import { ok, err, flatMap, match } from './result';

function parseInt(str: string): Result<number, string> {
  const num = Number(str);
  if (Number.isNaN(num) || !Number.isInteger(num)) {
    return err(`Failed to parse "${str}" as integer`);
  }
  return ok(num);
}

function validateRange(value: number, min: number, max: number): Result<number, string> {
  if (value < min) return err(`Value ${value} is below minimum ${min}`);
  if (value > max) return err(`Value ${value} is above maximum ${max}`);
  return ok(value);
}

// Chaining operations (Railway-Oriented Programming)
const result = flatMap(
  parseInt("25"),
  age => validateRange(age, 13, 120)
);

match(result, {
  ok: (age) => console.log(`Valid age: ${age}`),
  err: (error) => console.error(`Error: ${error}`)
});
```

### Converting Between Types

```typescript
import { fromNullable, tryCatch, optionToResult } from './conversions';

// Nullable to Option
const config: { port?: number } = {};
const port = fromNullable(config.port);  // None

// Exception-throwing code to Result
const parseResult = tryCatch(() => JSON.parse('{"a": 1}'));  // Ok({ a: 1 })

// Option to Result
const portResult = optionToResult(port, "Port not configured");  // Err("Port not configured")
```

## Core Operations

### Option\<T\>

- **Constructors**: `some(value)`, `none()`
- **Type Guards**: `isSome(opt)`, `isNone(opt)`
- **Transformation**: `map(opt, fn)`, `flatMap(opt, fn)`
- **Extraction**: `unwrapOr(opt, default)`, `unwrapOrElse(opt, fn)`
- **Pattern Matching**: `match(opt, { some, none })`
- **Filtering**: `filter(opt, predicate)`

### Result\<T, E\>

- **Constructors**: `ok(value)`, `err(error)`
- **Type Guards**: `isOk(result)`, `isErr(result)`
- **Transformation**: `map(result, fn)`, `mapErr(result, fn)`, `flatMap(result, fn)`
- **Extraction**: `unwrap(result)` (unsafe), `unwrapOr(result, default)`, `unwrapOrElse(result, fn)`
- **Pattern Matching**: `match(result, { ok, err })`
- **Advanced**: `filter(result, predicate, errorFn)`, `zip(result1, result2)`

## Testing

The test suite includes:

- **109 total tests** across 4 test files
- **Property-based tests** using fast-check to verify:
  - Monad laws (left identity, right identity, associativity)
  - Functor laws (identity, composition)
- **Unit tests** for all operations and edge cases
- **Integration tests** demonstrating realistic usage patterns

All tests verify both success and failure paths for comprehensive coverage.

## Design Decisions

### Discriminated Unions

Both types use the `_tag` property for type narrowing:

```typescript
type Option<T> =
  | { readonly _tag: "Some"; readonly value: T }
  | { readonly _tag: "None" };
```

This enables exhaustive pattern matching and proper TypeScript type inference.

### Typed Errors

Result uses a generic error type `E` instead of always using `Error`:

```typescript
type Result<T, E> = Ok<T> | Err<E>;
```

This allows domain-specific error types and better error handling strategies.

### Immutability

All operations return new values rather than mutating existing ones, following functional programming principles.

## Further Reading

- [Rust Option Documentation](https://doc.rust-lang.org/std/option/)
- [Rust Result Documentation](https://doc.rust-lang.org/std/result/)
- [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/) by Scott Wlaschin
- [neverthrow](https://github.com/supermacro/neverthrow) - Production-ready TypeScript library

## License

Part of the claudiu-ivan.com blog codebase.
