---
title: "A Principled Approach to Querying Data"
description: "A principled approach to building a search DSL in TypeScript. We explore a type-driven approach, leveraging a Domain-Specific Language (DSL), to create a powerful and maintainable search system."
date: "Feb 06 2025"
draft: false
---

The rise of local-first web applications demands a rethinking of traditional client-server architectures. Users expect near-native responsiveness, even when offline. This necessitates efficient, client-side data processing, including search. The techniques presented in this article, while discussed in a local-first context, are equally applicable to server-side systems.  We'll explore a type-driven approach, leveraging a Domain-Specific Language (DSL), to create a powerful and maintainable search system.

The complete, dependency-free code for this article is available on [GitHub](https://gist.github.com/kioku/3350e4c4f1aac5d3f5f53e68923cb35a).

## Domain-Specific Languages (DSLs)

Our approach centers around a DSL tailored to the specifics of searching "issues" – a common concept in project management and bug tracking. A DSL provides a specialized language for expressing search intent, offering several key advantages. Consider these example queries:

- `is:open label:bug`
- `author:alice (type:feature type:enhancement)`
- `is:closed milestone:v1.0 assignee:bob`

The expressiveness and clarity of a well-designed Domain-Specific Language (DSL) are evident across many successful systems. Examples include Lucene/Elasticsearch, which utilizes a query string DSL for full-text search. SQL employs its `WHERE` clause as a DSL for filtering data, and GraphQL defines a query language for fetching data from APIs. The reader might observe the similarity of the proposed DSL to the one used by GitHub in their issue search functionality.

The benefits of using a DSL are multifaceted. It provides controlled complexity by limiting the scope of possible queries and ensures domain alignment by mirroring the domain's concepts in its vocabulary. This, in turn, enhances usability, allowing users to query using familiar terms. Furthermore, a formal grammar simplifies maintainability and extensibility, making modification and expansion more manageable.

## Defining the domain

The structure of the dataset is usually inferred from the constraints of the business domain being modeled. In this case, we have chosen an issue tracking system, so the basic value we'll be working with is represented by the `Issue` interface.

```typescript
type IssueStatus = "open" | "closed";
type IssueType = "bug" | "feature" | "docs" | "enhancement";

interface Issue {
  id: string;
  title: string;
  status: IssueStatus;
  author: string;
  labels: string[];
  milestone: string | null;
  assignee: string | null;
  type: IssueType;
  updatedAt: number;
}
```

This is just _one example_. The same principles can be applied to many other domains: document management, customer relationship management, product lists, application logs, etc.

## Error Handling

Before we dive into parsing, we need a robust way to handle potential errors. The `Either` type, a cornerstone of functional programming, provides this mechanism. It is used to represent a value that can be the "success" (`Right` case) or the "failure" (`Left` case) of applying an operation.

```typescript
type Either<L, R> = Left<L> | Right<R>;

class Left<L> {
  constructor(readonly value: L) {}
  isLeft(): this is Left<L> {
    return true;
  }
  isRight(): this is Right<never> {
    return false;
  }
}

class Right<R> {
  constructor(readonly value: R) {}
  isLeft(): this is Left<never> {
    return false;
  }
  isRight(): this is Right<R> {
    return true;
  }
}

const success = <T>(value: T) => new Right(value);
const failure = <E>(error: E) => new Left(error);
```

Throughout the program, we'll use `Either` to propagate results. If a parsing step succeeds, it returns a `Right` containing the parsed value and the remaining input. If it fails, it returns a `Left` containing an error object. This explicit error handling is crucial for building a reliable system.

## Parsing with precision

To process queries, we employ parser combinators. They are a powerful technique from functional programming, often used in compiler design, for building parsers in a modular, composable, and declarative way.

In essence, a parser combinator is a higher-order function: it takes one or more parsers as input and returns a _new_ parser. Each parser attempts to match a portion of the input string. If successful, it returns a `Right` containing the parsed value and the remaining input string. If it fails, it returns a `Left` with an error.

```typescript
type ParserError = {
  code:
    | "INVALID_TOKEN"
    | "MISSING_VALUE"
    | "INVALID_STATUS"
    | "INVALID_TYPE"
    | "INVALID_TIME_FILTER";
  message: string;
  position: number;
  input: string;
};

type ParserResult<T> = Either<ParserError, [T, string]>;
type Parser<T> = (input: string) => ParserResult<T>;
```

This implementation uses several fundamental combinators.

```typescript
/** Matches a literal string. */
const lit = (match: string): Parser<string> => (input) => { ... };

/** Parses a sequence of alphanumeric characters. */
const word = (): Parser<string> => (input: string) => { ... };

/**
 * Tries multiple parsers in sequence, returning the result of the first one that succeeds.
 * This allows for choices in the grammar (e.g., `is:open` OR `is:closed`).
 */
const alt = <T>(...parsers: Parser<T>[]): Parser<T> => (input) => { ... };

/**
 * Applies multiple parsers sequentially, succeeding only if *all* of them succeed.
 * This is used to build up complex structures from simpler parts (e.g., `is:` followed by `open`).
 */
const seq = <T extends unknown[]>(...parsers: { [K in keyof T]: Parser<T[K]> }): Parser<T> => (input) => { ... };

/** Applies a parser zero or more times, collecting the results into an array. */
const many = <T>(parser: Parser<T>): Parser<T[]> => (input: string) => { ... };

/** Transforms the result of a successful parse using a provided function. Required to build the AST. */
const map = <T, U>(parser: Parser<T>, fn: (value: T) => U): Parser<U> => (input) => { ... };
```

We start with simple parsers (like `lit` and `word`) and combine them using combinators like `seq`, `alt`, and `many` to build increasingly complex parsers. The `map` combinator is important for transforming the raw parsed strings into a more structured representation – our Abstract Syntax Tree. This recursive nature of building complex structures from simpler ones is a hallmark of functional programming.

Composition is amazing. It's remarkable what unexpected elegance emerges from combining simple elements. In this simplicity lies the beauty of parser combinators.

## Structuring the query

The responsibility of the parser, is not to directly execute the query, it is to transform the input string into an Abstract Syntax Tree (AST). The AST is a structured, hierarchical representation of the query, independent of its specific syntax. This decoupling is essential for several reasons:

1.  **Separation of Concerns:** Parsing (syntax) is separated from evaluation (semantics).
2.  **Optimization:** The AST can be analyzed and optimized before execution.
3.  **Flexibility:** The AST can be used for multiple purposes (e.g., generating queries for different backends).

```typescript
type FilterNodeType =
  | "status"
  | "author"
  | "label"
  | "type"
  | "updated"
  | "and"
  | "or";

type LeafFilterNode = {
  readonly type: FilterNodeType;
  readonly value: string;
};

type FilterNode =
  | LeafFilterNode
  | {
      type: "and" | "or";
      value: FilterNode[];
    };
```

The AST consists of `FilterNode` objects. Leaf nodes (`LeafFilterNode`) represent individual filters (e.g., `status:open`), while `and` / `or` nodes represent boolean combinations.

The final `searchQueryParser` is obtained by composing the combinators.

```typescript
const searchQueryParser: Parser<FilterNode> = map(
  many(alt(statusParser, authorParser, labelParser, typeParser, timeFilterParser, orParser)),
  (filters) => { ... }
);
```

While the individual filter parsers like `statusParser` are defined as follows.

```typescript
const statusParser = map(
  seq(lit("is:"), alt(lit("open"), lit("closed"))),
  ([_, status]) => ({ type: "status", value: status } as const)
);
```

## Evaluating the query

With the AST in hand, we can transform it into a _predicate function_.

```typescript
type IssuePredicate = (issue: Issue) => boolean;
```

We define predicate-building functions for each filter type, including input validation.

```typescript
const isValidIssueStatus = (value: string): value is IssueStatus => {
  return ["open", "closed"].includes(value);
};
const matchStatus = (status: string): IssuePredicate => {
  if (isValidIssueStatus(status)) {
    return (issue) => issue.status === status;
  }
  console.error(`Invalid status: ${status}`);
  return matchNone();
};

// ... similar functions each filter type
```

The `createPredicate` function recursively traverses the AST, creating and combining predicates.

```typescript
const createPredicate = (node: FilterNode): IssuePredicate => {
  switch (node.type) {
    case "status":
      return isValidIssueStatus(node.value)
        ? matchStatus(node.value)
        : matchNone();
    // ... other cases
    case "and":
      return and(...(node.value as FilterNode[]).map(createPredicate));
    // ...
  }
};

const and =
  (...preds: IssuePredicate[]): IssuePredicate =>
  (issue) =>
    preds.every((p) => p(issue));
```

This recursive structure elegantly handles complex boolean logic that will be applied to the dataset.

## Query execution

We define an `executeQuery` function to orchestrate the entire process.

```typescript
const executeQuery = (query: string, issues: Issue[]): Issue[] => {
  const parsedQuery = searchQueryParser(query);

  if (parsedQuery.isLeft()) {
    console.error(`Parse Error: ${parsedQuery.value.message}`);
    return []; // Return empty array on parse failure
  }

  const ast = parsedQuery.value[0];
  const predicate = createPredicate(ast);
  return issues.filter(predicate);
};
```

The body of the function gracefully handles parsing errors, returning an empty result set and logging the error. In a production system, this error could be logged and surfaced through a variety of mechanisms, depending on the context.

## The path forward

It could be argued that other solutions might be more adequate for large datasets. For example, IndexedDB or SQLite could be used for data storage and querying. However, this does not negate the value of the techniques presented here. A database solution can be used as the storage layer, while the methods described in this article can be used to construct queries from the input of the system.

With that in mind, we should examine the performance of this system and explore potential improvements. Using the provided helper utilities within the linked code, a superficial performance evaluation was conducted. The following results were obtained on a test machine using a simulated dataset of 1 million issues.

```plaintext
Search Results for: "is:open"
----------------------------------------
Matching issues: 499344
Search time: 20.77ms

Search Results for: "is:closed"
----------------------------------------
Matching issues: 500656
Search time: 20.06ms

Search Results for: "is:open label:bug"
----------------------------------------
Matching issues: 210988
Search time: 76.44ms

Search Results for: "author:alice type:feature"
----------------------------------------
Matching issues: 63052
Search time: 67.80ms

Search Results for: "label:documentation type:docs"
----------------------------------------
Matching issues: 105336
Search time: 52.06ms

Search Results for: "is:open (author:charlie author:alice) label:enhancement"
----------------------------------------
Matching issues: 105326
Search time: 81.30ms
```

These results indicate that the system can handle a decent number of records and execute queries with acceptable performance. However, it's important to recognize that the current implementation relies on a linear scan.

Therefore, for real-world applications dealing with intrinsic or imposed constraints, indexing becomes essential to maintain acceptable performance. A common choice for text fields, such as `title`, is an inverted index, which maps words to the IDs of the issues containing them. For other fields, simpler map-based indexes may suffice.

Beyond indexing, several other optimizations can be applied:

- **Query Optimization:** Analyzing the AST to determine the most efficient order to apply filters. For example, applying the most selective filters (those that are likely to eliminate the most issues) first can significantly reduce the workload.
- **Query Planning:** In more complex scenarios, a query planner could choose between different indexes and execution strategies based on the query structure and data statistics.
- **Caching** can be applied at multiple levels:
  - **Parsed Queries:** Caching the AST for frequently used queries avoids repeated parsing.
  - **Predicates:** Caching the generated predicate function can also save computation.
  - **Query Results:** Caching the results of entire queries can be beneficial if the data doesn't change frequently.

These optimizations can provide a path forward for scaling the system to handle a large amount of data and complex queries, and their implementation is left as an exercise for the reader.

## Conclusion

This article has detailed a principled approach to querying data: a comprehensive system built on type safety, functional programming, and a clear separation of concerns. We've leveraged TypeScript, parser combinators, and an AST to create a search DSL that is not only functional but also robust, maintainable, and extensible.

It's worth mentioning that the `Either` type is an example of a _monad_ – a fundamental concept in functional programming. Monads provide a way to structure computations that involve sequencing operations and handling potential failures or side effects. While a deep dive into monad theory is beyond the scope of this article, recognizing this connection can open doors to a deeper understanding of functional programming principles, and maybe even lessen the barries of entry.

The techniques presented here provide a strong foundation for building advanced search capabilities, applicable to both local-first web applications and large-scale server-side systems. By adopting the principles outlined in this approach, developers can design search experiences that are both powerful and user-friendly.

## References and Further Reading

- [Crafting Interpreters](https://craftinginterpreters.com/) by Robert Nystrom 
- [Functional Parsing](https://www.cs.nott.ac.uk/~pszgmh/pearl.pdf) by Graham Hutton and Erik Meijer
- [Parsec: Direct Style Monadic Parser Combinators For The Real World](https://www.microsoft.com/en-us/research/publication/parsec-direct-style-monadic-parser-combinators-for-the-real-world/) by Daan Leijen and Erik Meijer
- [Monads for Functional Programming](https://homepages.inf.ed.ac.uk/wadler/papers/marktoberdorf/baastad.pdf) by Philip Wadler
- [Learn You a Haskell for Great Good!](http://learnyouahaskell.com/a-fistful-of-monads) (Chapter on Monads)
- [Domain-Specific Languages](https://martinfowler.com/books/dsl.html) by Martin Fowler
- [Professor Frisby's Mostly Adequate Guide to Functional Programming](https://mostly-adequate.gitbook.io/mostly-adequate-guide/)
- [Local-first software: You own your data, in spite of the cloud](https://www.inkandswitch.com/local-first/) by Martin Kleppmann et al.
