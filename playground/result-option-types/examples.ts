import { type Option, flatMap as flatMapOption, unwrapOr as unwrapOrOption } from "./option";
import { type Result, ok, err, flatMap } from "./result";
import { fromNullable, tryCatch, arrayAt } from "./conversions";

// --- Example 1: Safe Array Access with Option ---

/**
 * Safely retrieves the first element of an array.
 */
export function first<T>(array: readonly T[]): Option<T> {
  return arrayAt(array, 0);
}

/**
 * Safely retrieves the last element of an array.
 */
export function last<T>(array: readonly T[]): Option<T> {
  return arrayAt(array, array.length - 1);
}

// --- Example 2: Parsing with Result ---

/**
 * Attempts to parse a string as an integer.
 * Returns Ok(number) if successful, Err(message) if parsing fails.
 */
export function safeParseInt(str: string): Result<number, string> {
  const num = Number(str);
  if (Number.isNaN(num) || !Number.isInteger(num)) {
    return err(`Failed to parse "${str}" as integer`);
  }
  return ok(num);
}

/**
 * Attempts to parse a string as JSON.
 * Returns Ok(value) if successful, Err(error) if parsing fails.
 */
export function parseJSON<T = unknown>(str: string): Result<T, Error> {
  return tryCatch(() => JSON.parse(str) as T);
}

/**
 * Attempts to parse a date string in ISO format.
 * Returns Ok(Date) if valid, Err(message) if invalid.
 */
export function parseDate(str: string): Result<Date, string> {
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) {
    return err(`Invalid date string: "${str}"`);
  }
  return ok(date);
}

// --- Example 3: Validation with Result ---

/**
 * Validates an email address format.
 * Returns Ok(email) if valid, Err(message) if invalid.
 */
export function validateEmail(email: string): Result<string, string> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(email)) {
    return ok(email);
  }
  return err(`Invalid email format: "${email}"`);
}

/**
 * Validates that a number is within a range.
 * Returns Ok(number) if valid, Err(message) if out of range.
 */
export function validateRange(
  value: number,
  min: number,
  max: number
): Result<number, string> {
  if (value < min) {
    return err(`Value ${value} is below minimum ${min}`);
  }
  if (value > max) {
    return err(`Value ${value} is above maximum ${max}`);
  }
  return ok(value);
}

/**
 * Validates that a string is not empty.
 * Returns Ok(string) if non-empty, Err(message) if empty.
 */
export function validateNonEmpty(str: string): Result<string, string> {
  if (str.trim().length === 0) {
    return err("String cannot be empty");
  }
  return ok(str);
}

// --- Example 4: Railway-Oriented Programming (Chaining Operations) ---

/**
 * Represents a user registration request with validation requirements.
 */
export interface UserRegistration {
  readonly email: string;
  readonly age: number;
  readonly username: string;
}

/**
 * Validates a complete user registration.
 * Demonstrates chaining multiple validations using flatMap.
 */
export function validateUserRegistration(
  email: string,
  ageStr: string,
  username: string
): Result<UserRegistration, string> {
  return flatMap(validateEmail(email), (validEmail) =>
    flatMap(safeParseInt(ageStr), (age) =>
      flatMap(validateRange(age, 13, 120), (validAge) =>
        flatMap(validateNonEmpty(username), (validUsername) =>
          ok({
            email: validEmail,
            age: validAge,
            username: validUsername,
          })
        )
      )
    )
  );
}

// --- Example 5: Option Chaining ---

/**
 * Represents a configuration object with optional nested values.
 */
export interface Config {
  readonly database?: {
    readonly host?: string;
    readonly port?: number;
  };
}

/**
 * Safely extracts the database host from a config object.
 * Demonstrates chaining Option operations.
 */
export function getDatabaseHost(config: Config): Option<string> {
  return flatMapOption(fromNullable(config.database), (db) =>
    fromNullable(db.host)
  );
}

/**
 * Safely extracts the database port with a default value.
 */
export function getDatabasePort(config: Config): number {
  return unwrapOrOption(
    flatMapOption(
      fromNullable(config.database),
      (db) => fromNullable(db.port)
    ),
    5432
  );
}

// --- Example 6: Combining Multiple Results ---

/**
 * Coordinates for a location.
 */
export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * Parses latitude and longitude strings into Coordinates.
 * Returns Ok(Coordinates) if both are valid, Err(message) on first failure.
 */
export function parseCoordinates(
  latStr: string,
  lonStr: string
): Result<Coordinates, string> {
  return flatMap(safeParseFloat(latStr), (lat) =>
    flatMap(safeParseFloat(lonStr), (lon) =>
      flatMap(validateRange(lat, -90, 90), (validLat) =>
        flatMap(validateRange(lon, -180, 180), (validLon) =>
          ok({
            latitude: validLat,
            longitude: validLon,
          })
        )
      )
    )
  );
}

/**
 * Attempts to parse a string as a floating-point number.
 * Returns Ok(number) if successful, Err(message) if parsing fails.
 */
export function safeParseFloat(str: string): Result<number, string> {
  const num = Number(str);
  if (Number.isNaN(num)) {
    return err(`Failed to parse "${str}" as float`);
  }
  return ok(num);
}
