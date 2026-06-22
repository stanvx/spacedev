import { homedir } from "node:os";
import { realpath } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export function expandHomePath(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/") || path.startsWith("~\\")) {
    return resolve(homedir(), path.slice(2));
  }
  if (path.includes("~")) {
    throw new AccessDeniedError(`Refusing path with tilde that is not ~/... or ~: ${path}`);
  }

  return path;
}

export function isPathInsideRoot(path: string, root: string): boolean {
  const resolvedPath = resolve(expandHomePath(path));
  const resolvedRoot = resolve(expandHomePath(root));
  const relationship = relative(resolvedRoot, resolvedPath);

  return (
    relationship === "" ||
    (!relationship.startsWith("..") && relationship !== ".." && !relationship.includes(`..${sep}`))
  );
}

export function assertAllowedPath(path: string, allowedRoots: string[]): string {
  const resolvedPath = resolve(expandHomePath(path));
  if (allowedRoots.some((root) => isPathInsideRoot(resolvedPath, root))) {
    return resolvedPath;
  }

  throw new AccessDeniedError(`Path is outside allowed roots: ${path}`);
}

/**
 * Same as {@link assertAllowedPath} but additionally resolves symlinks via
 * realpath before checking the allowlist. This prevents symlinks inside the
 * workspace that point outside the allowed roots from being used as a traversal
 * pivot.
 */
export async function assertAllowedRealPath(path: string, allowedRoots: string[]): Promise<string> {
  const resolved = assertAllowedPath(path, allowedRoots);
  let real: string;
  try {
    real = await realpath(resolved);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AccessDeniedError(`Cannot resolve real path for ${path}: ${message}`);
  }

  if (!allowedRoots.some((root) => isPathInsideRoot(real, root))) {
    throw new AccessDeniedError(`Path is outside allowed roots after symlink resolution: ${path}`);
  }

  return real;
}

export function resolveAllowedPath(inputPath: string, cwd: string, allowedRoots: string[]): string {
  const absolutePath = resolve(cwd, inputPath);
  return assertAllowedPath(absolutePath, allowedRoots);
}
