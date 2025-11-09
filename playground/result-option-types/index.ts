// Re-export all public APIs for convenient importing

export {
  type Option,
  type Some,
  type None,
  some,
  none,
  isSome,
  isNone,
  map as mapOption,
  flatMap as flatMapOption,
  unwrapOr as unwrapOrOption,
  unwrapOrElse as unwrapOrElseOption,
  match as matchOption,
  filter as filterOption,
} from "./option";

export {
  type Result,
  type Ok,
  type Err,
  ok,
  err,
  isOk,
  isErr,
  map as mapResult,
  mapErr,
  flatMap as flatMapResult,
  unwrap,
  unwrapOr as unwrapOrResult,
  unwrapOrElse as unwrapOrElseResult,
  match as matchResult,
  filter as filterResult,
  zip,
} from "./result";

export {
  fromNullable,
  tryCatch,
  tryCatchAsync,
  optionToResult,
  optionToResultLazy,
  resultToOption,
  arrayAt,
  objectGet,
} from "./conversions";
