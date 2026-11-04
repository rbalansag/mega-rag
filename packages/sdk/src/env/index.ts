import type { z } from "zod";

export interface EnvValidatorOptions {
  /** Variables to validate. Defaults to `process.env`. */
  source?: Record<string, string | undefined>;
  /** Exit the process on failure (default true). When false, throws `EnvValidationError`. */
  exit?: boolean;
  /** Where to print the error report (default `console.error`). */
  logger?: (message: string) => void;
}

export class EnvValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join("\n")}`);
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

/**
 * Validate environment variables against a Zod schema at boot.
 * On failure prints a human-readable list of missing/invalid variables and exits.
 *
 * @example
 * const env = createEnvValidator(z.object({ DATABASE_URL: z.string().url() }));
 */
export function createEnvValidator<T extends z.ZodTypeAny>(
  schema: T,
  options: EnvValidatorOptions = {},
): z.infer<T> {
  const source = options.source ?? process.env;
  const result = schema.safeParse(source);
  if (result.success) return result.data as z.infer<T>;

  const issues = result.error.issues.map((issue) => {
    const name = issue.path.join(".") || "(root)";
    const missing =
      issue.code === "invalid_type" && issue.path.length === 1 && source[String(issue.path[0])] === undefined;
    return missing ? `${name}: missing (required)` : `${name}: ${issue.message}`;
  });

  const error = new EnvValidationError(issues);
  if (options.exit === false) throw error;

  (options.logger ?? console.error)(`\n${error.message}\n\nFix your environment (see .env.example) and restart.\n`);
  process.exit(1);
}
