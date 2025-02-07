// search-dsl.ts

// ======================
// Core Types
// ======================

type IssueStatus = 'open' | 'closed';
type IssueType = 'bug' | 'feature' | 'docs' | 'enhancement';
type TimeRange = 'hour' | 'day' | 'week' | 'month';

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
  value: L;
  constructor(value: L) { this.value = value; }
  isLeft(): this is Left<L> { return true; }
  isRight(): this is Right<never> { return false; }
}

class Right<R> {
  value: R;
  constructor(value: R) { this.value = value; }
  isLeft(): this is Left<never> { return false; }
  isRight(): this is Right<R> { return true; }
}

const success = <T>(value: T) => new Right(value);
const failure = <E>(error: E) => new Left(error);

// ======================
// Parser Implementation
// ======================

type ParserError = {
  code: 'INVALID_TOKEN' | 'MISSING_VALUE' | 'INVALID_STATUS' | 'INVALID_TYPE' | 'INVALID_TIME_FILTER';
  message: string;
  position: number;
  input: string;
};

type ParserResult<T> = Either<ParserError, [T, string]>;
type Parser<T> = (input: string) => ParserResult<T>;

const lit = (match: string): Parser<string> => (input) => {
  if (input.startsWith(match)) {
    return success<[string, string]>([match, input.slice(match.length).trim()]);
  }
  return failure({
    code: 'INVALID_TOKEN',
    message: `Expected "${match}"`,
    position: 0,
    input,
  });
};

const alt = <T>(...parsers: Parser<T>[]): Parser<T> => (input) => {
  for (const parser of parsers) {
    const result = parser(input);
    if (result.isRight()) return result;
  }
  return failure({
    code: 'INVALID_TOKEN',
    message: `No matching alternative`,
    position: 0,
    input,
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

const many = <T>(parser: Parser<T>): Parser<T[]> => (input: string) => {
  const results: T[] = [];
  let remaining = input;

  while (true) {
    const trimmedRemaining = remaining.trim();
    const result = parser(trimmedRemaining);
    if (result.isLeft()) break;

    results.push(result.value[0]);
    remaining = result.value[1];
  }
  return success<[T[], string]>([results, remaining]);
};

const map = <T, U>(parser: Parser<T>, fn: (value: T) => U): Parser<U> => (input) => {
  const result = parser(input);
  if (result.isRight()) {
    const [value, remaining] = result.value;
    return success<[U, string]>([fn(value), remaining]);
  }
  return result;
};

const word = (): Parser<string> => (input: string) => {
  const match = input.match(/^(\w+)/);
  return match
    ? success<[string, string]>([match[1], input.slice(match[1].length).trim()])
    : failure({ code: 'INVALID_TOKEN', message: 'Expected a word', position: 0, input });
};

// ======================
// AST Node Types
// ======================

type FilterNodeType = 'status' | 'author' | 'label' | 'type' | 'updated' | 'and' | 'or';

type LeafFilterNode = {
  readonly type: FilterNodeType;
  readonly value: string;
}

type FilterNode = LeafFilterNode | {
  type: 'and' | 'or';
  value: FilterNode[];
};

// ======================
// Filter Parsers
// ======================

const statusParser = map(
  seq(lit('is:'), alt(lit('open'), lit('closed'))),
  ([_, status]) => ({ type: 'status', value: status } as const)
);

const authorParser = map(
  seq(lit('author:'), word()),
  ([_, author]) => ({ type: 'author', value: author } as const)
);

const labelParser = map(
  seq(lit('label:'), word()),
  ([_, label]) => ({ type: 'label', value: label } as const)
);

const typeParser = map(
  seq(lit('type:'), alt(lit('bug'), lit('feature'), lit('docs'), lit('enhancement'))),
  ([_, type]) => ({ type: 'type', value: type } as const)
);

const timeFilterParser = map(
  seq(lit('updated:'), alt(lit('hour'), lit('day'), lit('week'), lit('month'))),
  ([_, timeFilter]) => ({ type: 'updated', value: timeFilter } as const)
);

const orParser: Parser<FilterNode> = map(
  seq(
    lit('('),
    many(
      alt<LeafFilterNode>(
        statusParser, authorParser, labelParser, typeParser, timeFilterParser
      )
    ),
    lit(')')
  ),
  ([_, filters, __]) => {
    if (filters.length === 1) {
      return filters[0];
    }
    return { type: 'or', value: filters }
  }
)

const searchQueryParser: Parser<FilterNode> = map(
  many(alt(statusParser, authorParser, labelParser, typeParser, timeFilterParser, orParser)),
  (filters) => {
    if (filters.length === 0) {
      return { type: 'and', value: [] }; // Default to matching everything
    }
    if (filters.length === 1) {
      return filters[0]; // Single filter, no need for 'and'
    }
    return { type: 'and', value: filters }; // Combine multiple filters with 'and'
  }
);

// ======================
// Predicate System
// ======================

type IssuePredicate = (issue: Issue) => boolean;

const matchAny = () => (issue: Issue) => true;
const matchNone = () => (issue: Issue) => false;

const isValidIssueStatus = (value: string): value is IssueStatus => {
  return ['open', 'closed'].includes(value);
};
const matchStatus = (status: string): IssuePredicate => {
  if (isValidIssueStatus(status)) {
    return (issue) => issue.status === status;
  }
  console.error(`Invalid status: ${status}`);
  return matchNone();
};

const matchAuthor = (author: string): IssuePredicate =>
  (issue) => issue.author === author;

const matchLabel = (label: string): IssuePredicate =>
  (issue) => issue.labels.includes(label);

const isValidIssueType = (value: string): value is IssueType => {
  return ['bug', 'feature', 'docs', 'enhancement'].includes(value);
};
const matchType = (type: string): IssuePredicate => {
  if (isValidIssueType(type)) {
    return (issue) => issue.type === type;
  }
  console.error(`Invalid type: ${type}`);
  return matchNone();
};

const isValidTimeFilter = (value: string): value is TimeRange => {
  return ['hour', 'day', 'week', 'month'].includes(value);
};
const matchTime = (filter: string): IssuePredicate => {
  if (!isValidTimeFilter(filter)) {
    console.error(`Invalid time filter: ${filter}`);
    return matchNone();
  }

  return (issue) => {
    const diff = Date.now() - issue.updatedAt;
    switch (filter) {
      case 'hour': return diff <= 3600000;
      case 'day': return diff <= 86400000;
      case 'week': return diff <= 604800000;
      case 'month': return diff <= 2592000000;
      default: return false;
    }
  }
};

const createPredicate = (node: FilterNode): IssuePredicate => {
  switch (node.type) {
    case 'status':
      return isValidIssueStatus(node.value) ? matchStatus(node.value) : matchNone();
    case 'author':
      return matchAuthor(node.value!);
    case 'label':
      return matchLabel(node.value!);
    case 'type':
      return isValidIssueType(node.value) ? matchType(node.value) : matchNone();
    case 'updated':
      return isValidTimeFilter(node.value) ? matchTime(node.value) : matchNone();
    case 'and':
      return and(...(node.value as FilterNode[]).map(createPredicate));
    case 'or':
      return or(...(node.value as FilterNode[]).map(createPredicate));
  }
};

const and = (...preds: IssuePredicate[]): IssuePredicate =>
  (issue) => preds.every(p => p(issue));

const or = (...preds: IssuePredicate[]): IssuePredicate =>
  (issue) => preds.some(p => p(issue));

// ======================
// Query Execution
// ======================

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

// ======================
// Test Data
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

// ======================
// Basic Unit Tests (using a simple assertion library)
// ======================
const assert = {
  deepEqual: (actual: any, expected: any, message: string) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      console.error(`Assertion failed: ${message}\nActual: ${JSON.stringify(actual)}\nExpected: ${JSON.stringify(expected)}`);
    } else {
      console.log(`Assertion passed: ${message}`);
    }
  },
};

//Test cases
const testIssues: Issue[] = [
  { id: '1', title: 'Bug in module A', status: 'open', author: 'alice', labels: ['bug'], type: 'bug', updatedAt: Date.now() - 3600000, milestone: null, assignee: null },
  { id: '2', title: 'Feature request', status: 'closed', author: 'bob', labels: ['enhancement'], type: 'feature', updatedAt: Date.now() - 86400000, milestone: null, assignee: null },
];

// Test parsing and predicate creation
assert.deepEqual(searchQueryParser('is:open').value[0], { type: 'status', value: 'open' }, 'statusParser test');
assert.deepEqual(createPredicate(searchQueryParser('is:open').value[0])(testIssues[0]), true, 'createPredicate status test');
assert.deepEqual(executeQuery('is:open', testIssues), [testIssues[0]], 'executeQuery test');
assert.deepEqual(executeQuery('is:open label:bug', testIssues), [testIssues[0]], 'executeQuery combined test');
assert.deepEqual(executeQuery('is:closed author:bob', testIssues), [testIssues[1]], 'executeQuery combined test 2');
assert.deepEqual(executeQuery('is:open author:bob', testIssues), [], 'executeQuery combined test 3');
assert.deepEqual(executeQuery('is:open label:bug author:alice updated:day', testIssues), [testIssues[0]], 'executeQuery combined test 4');
assert.deepEqual(executeQuery('(is:open author:bob)', testIssues), testIssues, 'executeQuery OR test');
assert.deepEqual(executeQuery('(is:open author:bob) updated:week', testIssues), testIssues, 'executeQuery OR test 2');

// ======================
// Benchmarking
// ======================
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
  //console.log(`Total issues: ${issues.length}`);
  console.log(`Matching issues: ${results.length}`);
  console.log(`Search time: ${duration.toFixed(2)}ms`);
  console.log('');
  //console.log('Sample matches:');
  //results.slice(0, 3).forEach(issue => {
  //  console.log(`#${issue.id}: ${issue.title}`);
  //  console.log(`  Status: ${issue.status}`);
  //  console.log(`  Author: ${issue.author}`);
  //  console.log(`  Labels: ${issue.labels.join(', ')}`);
  //  console.log(`  Type: ${issue.type}`);
  //  console.log('');
  //});
}

// Example usage:
const testQueries = [
  'is:open',
  'is:closed',
  'is:open label:bug',
  'author:alice type:feature',
  'label:documentation type:docs',
  'is:open (author:charlie author:alice) label:enhancement'
];

const issues = generateTestIssues(1_000_000);

testQueries.forEach(query => {
  const startTime = performance.now();
  const results = executeQuery(
    query,
    issues
  );
  showSearchStats(query, issues, results, startTime);
});


