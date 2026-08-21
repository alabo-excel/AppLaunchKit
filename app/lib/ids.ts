const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Rejects anything that isn't a plain UUID.
 *
 * Workspace and file ids become directory and file names, so a value like
 * `../../etc/passwd` must never reach the filesystem layer. Lives in its own
 * module so the storage layer and the session layer can both use it without
 * importing each other.
 */
export function isValidId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
