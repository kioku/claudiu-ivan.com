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

type IssueStatus = 'open' | 'closed';
type IssueType = 'bug' | 'feature' | 'docs' | 'enhancement';

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
    if (input === '') {
      return success<[T, string]>([[] as unknown as T, '']);
    }

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

const many = <T>(parser: Parser<T>): Parser<T[]> => (input: string) => {
  const results: T[] = [];
  let remaining = input;

  while (true) {
    const result = parser(remaining.trim());
    if (result.isLeft()) break;

    results.push(result.value[0]);
    remaining = result.value[1];
    if (remaining === '') break;
  }

  return success<[T[], string]>([results, remaining]);
};

const label = (): Parser<string> => (input: string) => {
  const match = input.match(/^(\w+)/);
  return match
    ? success<[string, string]>([match[1], input.slice(match[1].length).trim()])
    : failure({ code: 'INVALID_TOKEN', position: 0, input });
}

// ======================
// Filter Parsers
// ======================

const statusParser = seq(
  lit('is:'),
  alt(lit('open'), lit('closed'))
);

const authorParser = seq(
  lit('author:'),
  label()
);

const labelParser = seq(
  lit('label:'),
  label()
);

const typeParser = seq(
  lit('type:'),
  alt(lit('bug'), lit('feature'), lit('docs'), lit('enhancement'))
);

const timeFilterParser = seq(
  lit('updated:'),
  alt(lit('hour'), lit('day'), lit('week'), lit('month'))
);

const searchQueryParser = many(alt(
  statusParser,
  typeParser,
  labelParser,
  authorParser,
  timeFilterParser
));

// ======================
// Predicate System
// ======================

type IssuePredicate = (issue: Issue) => boolean;

const matchAny = (): IssuePredicate => (v) => true;
const matchNone = (): IssuePredicate => (v) => false;

const matchTime = (filter: TimeFilter): IssuePredicate =>
  (issue) => {
    const diff = Date.now() - issue.updatedAt;
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

const matchStatus = (status: IssueStatus): IssuePredicate =>
  (issue) => issue.status === status;

const matchAuthor = (author: string): IssuePredicate =>
  (issue) => issue.author === author;

const matchLabel = (label: string): IssuePredicate =>
  (issue) => issue.labels.includes(label);

const matchType = (type: IssueType): IssuePredicate =>
  (issue) => issue.type === type;

const matchAssignee = (assignee: string): IssuePredicate =>
  (issue) => issue.assignee === assignee;

const matchMilestone = (milestone: string): IssuePredicate =>
  (issue) => issue.milestone === milestone;

const and = (...preds: IssuePredicate[]): IssuePredicate =>
  (doc) => preds.every(p => p(doc));

const or = (...preds: IssuePredicate[]): IssuePredicate =>
  (doc) => preds.some(p => p(doc));

// @todo how to handle or()
// Create complex query
//const queryPredicate = and(
//  matchText('urgent'),
//  or(
//    matchType('document'),
//    matchPriority('high')
//  )
//);

const searchQueryMapFn = ([key, value]: [string, string]): IssuePredicate => {
  switch (key) {
    case 'is:':
      return matchStatus(value as IssueStatus);
    case 'author:':
      return matchAuthor(value);
    case 'label:':
      return matchLabel(value);
    case 'type:':
      return matchType(value as IssueType);
    case 'assignee:':
      return matchAssignee(value);
    case 'milestone:':
      return matchMilestone(value);
    default:
      return matchAny();
  }
};

const createSearchPredicate = (result: ParserResult<Array<[string, string]>>): IssuePredicate =>
  result.isRight() ? and(...result.value[0].map(searchQueryMapFn)) : and(matchNone());



// ======================
// Indexing System
// ======================


interface SearchIndex {
  status: Map<IssueStatus, Set<string>>;
  authors: Map<string, Set<string>>;
  labels: Map<string, Set<string>>;
  types: Map<IssueType, Set<string>>;
  assignees: Map<string, Set<string>>;
  milestones: Map<string, Set<string>>;
}

const buildIndex = (issues: Issue[]): SearchIndex => {
  const index: SearchIndex = {
    status: new Map(),
    authors: new Map(),
    labels: new Map(),
    types: new Map(),
    assignees: new Map(),
    milestones: new Map()
  };

  for (const issue of issues) {
    // Status Index
    index.status.set(issue.status,
      (index.status.get(issue.status) || new Set()).add(issue.id));

    // Author Index
    index.authors.set(issue.author,
      (index.authors.get(issue.author) || new Set()).add(issue.id));

    // Labels Index
    issue.labels.forEach(label => {
      index.labels.set(label,
        (index.labels.get(label) || new Set()).add(issue.id));
    });

    // Type Index
    index.types.set(issue.type,
      (index.types.get(issue.type) || new Set()).add(issue.id));

    // Assignee Index
    if (issue.assignee) {
      index.assignees.set(issue.assignee,
        (index.assignees.get(issue.assignee) || new Set()).add(issue.id));
    }

    // Milestone Index
    if (issue.milestone) {
      index.milestones.set(issue.milestone,
        (index.milestones.get(issue.milestone) || new Set()).add(issue.id));
    }
  }

  return index;
};

// ======================
// Query Execution
// ======================

const executeQuery = (
  index: SearchIndex,
  predicate: IssuePredicate,
  issues: Issue[]
): Issue[] => {
  return issues.filter(predicate);
};

// ======================
// Demo Usage
// ======================

function generateTestIssues(count: number): Issue[] {
  const authors = ['alice', 'bob', 'charlie', 'daisy'];
  const labels = ['bug', 'enhancement', 'documentation', 'good-first-issue'];
  const milestones = ['v1.0', 'v1.1', 'v2.0', null];
  const statuses: IssueStatus[] = ['open', 'closed'];
  const types: IssueType[] = ['bug', 'feature', 'docs', 'enhancement'];
  const now = Date.now();

  return Array.from({ length: count }, (_, i) => ({
    id: `issue-${i}`,
    title: `Test Issue ${i}`,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    author: authors[Math.floor(Math.random() * authors.length)],
    labels: Array.from(
      { length: Math.floor(Math.random() * 3) + 1 },
      () => labels[Math.floor(Math.random() * labels.length)]
    ),
    milestone: milestones[Math.floor(Math.random() * milestones.length)],
    assignee: Math.random() > 0.3
      ? authors[Math.floor(Math.random() * authors.length)]
      : null,
    type: types[Math.floor(Math.random() * types.length)],
    updatedAt: now - (i * 3600000), // each 1 hour apart
  }));
}

const issues = generateTestIssues(100_000);
const searchIndex = buildIndex([]);

// Example usage:
//const input = 'is:open label:bug';
//const parsedSearchQuery = searchQueryParser(input);
//const query = createSearchPredicate(parsedSearchQuery);
//console.log(parsedSearchQuery);

// Execute query
//const results = executeQuery(searchIndex, createSearchPredicate(parsedSearchQuery), issues);
//console.log('query ->', input)
//console.log('search result count ->', results.length);
//console.log(issues.slice(3));
//console.log('Search Results:', results);
//

function showSearchStats(
  query: string,
  issues: Issue[],
  results: Issue[],
  startTime: number
): void {
  const endTime = performance.now();
  const duration = endTime - startTime;

  console.log(`Search Results for: "${query}"`);
  console.log('----------------------------------------');
  console.log(`Total issues: ${issues.length}`);
  console.log(`Matching issues: ${results.length}`);
  console.log(`Search time: ${duration.toFixed(2)}ms`);
  console.log('');
  console.log('Sample matches:');
  results.slice(0, 3).forEach(issue => {
    console.log(`#${issue.id}: ${issue.title}`);
    console.log(`  Status: ${issue.status}`);
    console.log(`  Author: ${issue.author}`);
    console.log(`  Labels: ${issue.labels.join(', ')}`);
    console.log(`  Type: ${issue.type}`);
    console.log('');
  });
}

// Example usage:
const testQueries = [
  'is:open',
  'is:closed',
  'is:open label:bug',
  'author:alice type:feature',
  'is:closed milestone:v1.0 assignee:bob',
  'label:documentation type:docs',
  'is:open author:charlie label:enhancement'
];

//const issues = generateTestIssues(1000);
//const index = buildIndex(issues);

testQueries.forEach(query => {
  const startTime = performance.now();
  const results = executeQuery(
    searchIndex,
    createSearchPredicate(searchQueryParser(query)),
    issues
  );
  showSearchStats(query, issues, results, startTime);
});

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

