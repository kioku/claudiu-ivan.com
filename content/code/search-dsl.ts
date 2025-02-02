// search-engine.ts

// ======================
// Core Types
// ======================

type DocumentTypeLocal = 'document' | 'folder';
type PriorityLevel = 'low' | 'medium' | 'high';
type TimeFilter = 'hour' | 'day' | 'week' | 'month';

interface DocumentLocal {
  id: string;
  content: string;
  type: DocumentTypeLocal;
  createdAt: number;
  priority?: PriorityLevel;
  clientIds?: number[];
}

// ======================
// Functional Utilities
// ======================

type Either<L, R> = Left<L> | Right<R>;

class Left<L> {
  constructor(readonly value: L) { }
  isLeft(): this is Left<L> { return true }
  isRight(): this is Right<never> { return false }
}

class Right<R> {
  constructor(readonly value: R) { }
  isLeft(): this is Left<never> { return false }
  isRight(): this is Right<R> { return true }
}

const success = <T>(value: T) => new Right(value);
const failure = <E>(error: E) => new Left(error);

// ======================
// Parser Implementation
// ======================

type ParseError = {
  code: 'INVALID_TOKEN' | 'MISSING_VALUE' | 'TYPE_MISMATCH';
  position: number;
  input: string;
};

type ParserResult<T> = Either<ParseError, [T, string]>;
type Parser<T> = (input: string) => ParserResult<T>;

const lit = (match: string): Parser<string> => (input) => {
  if (input.startsWith(match)) {
    return success<[string, string]>([match, input.slice(match.length).trim()]);
  }

  return failure({
    code: 'INVALID_TOKEN',
    position: 0,
    input: match
  });
};

const alt = <T>(...parsers: Parser<T>[]): Parser<T> => (input) => {
  for (const parser of parsers) {
    const result = parser(input);
    if (result.isRight()) return result;
  }
  return failure({
    code: 'INVALID_TOKEN',
    position: 0,
    input
  });
};

const seq = <T extends unknown[]>(...parsers: { [K in keyof T]: Parser<T[K]> }): Parser<T> =>
  (input) => {
    let remaining = input;
    const results: unknown[] = [];

    for (const parser of parsers) {
      const result = parser(remaining);
      if (result.isLeft()) {
        return result;
      }
      results.push(result.value[0]);
      remaining = result.value[1];
    }


    return success<[T, string]>([results as T, remaining]);
  };

// ======================
// Filter Parsers
// ======================

const typeParser = seq(
  lit('type:'),
  alt(lit('document'), lit('folder'))
);

const priorityParser = seq(
  lit('priority:'),
  alt(lit('low'), lit('medium'), lit('high'))
);

const timeFilterParser = seq(
  lit('created:'),
  alt(lit('hour'), lit('day'), lit('week'), lit('month'))
);

const searchQueryParser = seq(
  typeParser,
  priorityParser,
  timeFilterParser
);

// ======================
// Predicate System
// ======================

type DocumentPredicate = (doc: DocumentLocal) => boolean;

const matchAny = (): DocumentPredicate => (doc) => true;
const matchNone = (): DocumentPredicate => (doc) => false;

const matchText = (term: string): DocumentPredicate =>
  (doc) => doc.content.toLowerCase().includes(term.toLowerCase());

const matchType = (type: DocumentTypeLocal): DocumentPredicate =>
  (doc) => doc.type === type;

const matchPriority = (level: PriorityLevel): DocumentPredicate =>
  (doc) => doc.priority === level;

const matchTime = (filter: TimeFilter): DocumentPredicate =>
  (doc) => {
    const diff = Date.now() - doc.createdAt;
    switch (filter) {
      case 'hour':
        return diff <= 3600000;
      case 'day':
        return diff <= 86400000;
      case 'week':
        return diff <= 604800000;
      case 'month':
        return diff <= 2592000000;
    }
  };

const and = (...preds: DocumentPredicate[]): DocumentPredicate =>
  (doc) => preds.every(p => p(doc));

const or = (...preds: DocumentPredicate[]): DocumentPredicate =>
  (doc) => preds.some(p => p(doc));

// ======================
// Indexing System
// ======================

interface SearchIndex {
  text: Map<string, Set<string>>;
  types: Map<DocumentTypeLocal, Set<string>>;
  priorities: Map<PriorityLevel, Set<string>>;
}

const buildIndex = (docs: DocumentLocal[]): SearchIndex => {
  const index: SearchIndex = {
    text: new Map(),
    types: new Map(),
    priorities: new Map()
  };

  for (const doc of docs) {
    // Text Index
    doc.content.split(/\W+/).forEach(word => {
      const key = word.toLowerCase();
      index.text.set(key, (index.text.get(key) || new Set()).add(doc.id));
    });

    // Type Index
    index.types.set(doc.type, (index.types.get(doc.type) || new Set()).add(doc.id));

    // Priority Index
    if (doc.priority) {
      index.priorities.set(doc.priority,
        (index.priorities.get(doc.priority) || new Set()).add(doc.id));
    }
  }

  return index;
};

// ======================
// Query Execution
// ======================

const executeQuery = (
  index: SearchIndex,
  predicate: DocumentPredicate,
  docs: DocumentLocal[]
): DocumentLocal[] => {
  // Simple implementation for demonstration
  return docs.filter(predicate);
};

// ======================
// Demo Usage
// ======================

function generateTestDocuments(count: number): DocumentLocal[] {
  const priorities = ['high', 'medium', 'low'] as PriorityLevel[];
  const types = ['document', 'folder'] as DocumentTypeLocal[];
  const now = Date.now();

  return Array.from({ length: count }, (_, index) => ({
    id: (index + 1).toString(),
    content: '',
    type: types[index % types.length],
    createdAt: now - (index * 3600000), // each doc 1 hour apart
    priority: priorities[index % priorities.length],
    clientIds: index % 2 === 0 ? [index, index + 100] : []
  }));
}

const documents = generateTestDocuments(100_000);

// Build search index
const searchIndex = buildIndex(documents);

// Create complex query
//const queryPredicate = and(
//  matchText('urgent'),
//  or(
//    matchType('document'),
//    matchPriority('high')
//  )
//);

// Example usage:
const input = "type:document priority:medium created:week";

const parsedSearchQuery = searchQueryParser(input);
//console.log(parsedSearchQuery);
//Right {
//  value: [
//    [
//      [ "type:", "document" ], [ "priority:", "high" ], [ "created:", "week" ]
//    ], ""
//  ],
//  isLeft: [Function: isLeft],
//  isRight: [Function: isRight],
//}

const searchQueryMapFn = ([key, value]: [string, string]) => {
  if (key.includes('type')) {
    return matchType(value as DocumentTypeLocal);
  }

  if (key.includes('priority')) {
    return matchPriority(value as PriorityLevel);
  }

  if (key.includes('created')) {
    return matchTime(value as TimeFilter);
  }

  return matchAny();
};

const createSearchPredicate = (result: ParserResult<Array<[string, string]>>): DocumentPredicate =>
  result.isRight() ? and(...result.value[0].map(searchQueryMapFn)) : and(matchNone());

// Execute query
const results = executeQuery(searchIndex, createSearchPredicate(parsedSearchQuery), documents);
console.log('query ->', input)
console.log('search result count ->', results.length);
//console.log('Search Results:', results);

const showSearchStats = (results: DocumentLocal[]) => {
  // Count by type
  const typeStats = results.reduce((acc, doc) => {
    acc[doc.type] = (acc[doc.type] || 0) + 1;
    return acc;
  }, {} as Record<DocumentTypeLocal, number>);

  // Count by priority
  const priorityStats = results.reduce((acc, doc) => {
    if (doc.priority) {
      acc[doc.priority] = (acc[doc.priority] || 0) + 1;
    }
    return acc;
  }, {} as Record<PriorityLevel, number>);

  // Time-based stats
  const now = Date.now();
  const timeStats = {
    lastHour: results.filter(d => now - d.createdAt <= 3600000).length,
    lastDay: results.filter(d => now - d.createdAt <= 86400000).length,
    lastWeek: results.filter(d => now - d.createdAt <= 604800000).length
  };

  // Client coverage
  const uniqueClients = new Set(results.flatMap(d => d.clientIds || []));

  console.log('\nSearch Statistics:');
  console.log('=================');
  console.log(`Total Results: ${results.length}`);
  console.log('\nBy Type:', typeStats);
  console.log('By Priority:', priorityStats);
  console.log('\nTime Distribution:');
  console.log(`- Last Hour: ${timeStats.lastHour}`);
  console.log(`- Last Day: ${timeStats.lastDay}`);
  console.log(`- Last Week: ${timeStats.lastWeek}`);
  console.log(`\nUnique Clients: ${uniqueClients.size}`);
};
//showSearchStats(documents);

//Improvements:
//1. Error Handling:
//- The parser error handling is basic - errors only contain position and code but no meaningful error messages
//- Failed parses silently return `matchNone()` instead of explaining why the search failed
//- No validation of input values against allowed enums
//
//2. Performance Issues:
//- `executeQuery` does a full scan of documents without utilizing the index structure
//- The text search index is naive - no stemming, tokenization, or proper word boundary handling
//- Large result sets are not paginated
//- No caching mechanism for frequent queries
//
//3. Type Safety:
//- Unsafe type assertions in `mapFn` (using `as` for DocumentTypeLocal, PriorityLevel etc)
//- Parser results could be more strongly typed
//- No runtime validation of enum values
//
//4. Architecture:
//- Search index implementation is incomplete - text index exists but isn't used
//- No support for compound queries (AND/OR combinations) in the query language
//- No support for ranges in date filters (only predefined time windows)
//- Missing features like sorting, field selection, fuzzy matching
//
//The most critical improvements would be:
//1. Properly utilize the index structure in `executeQuery`
//2. Add proper error handling and validation
//3. Implement pagination
//4. Add compound query support
//

