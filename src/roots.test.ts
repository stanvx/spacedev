import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { AccessDeniedError, assertAllowedPath, expandHomePath, resolveAllowedPath } from "./roots.js";

const home = homedir();

assert.equal(expandHomePath("~"), home);
assert.equal(expandHomePath("~/personal/devspace"), resolve(home, "personal", "devspace"));
assert.equal(expandHomePath("$HOME/project"), "$HOME/project");

assert.throws(
  () => expandHomePath("~user/project"),
  (err: unknown) => err instanceof AccessDeniedError && /tilde/.test((err as Error).message),
  "~user/project must be rejected as a path-traversal pivot",
);
assert.throws(
  () => expandHomePath("~root/.ssh/id_rsa"),
  (err: unknown) => err instanceof AccessDeniedError,
);
assert.throws(
  () => expandHomePath("foo/~/bar"),
  (err: unknown) => err instanceof AccessDeniedError,
);

assert.equal(
  assertAllowedPath("~/personal/devspace", [join(home, "personal")]),
  resolve(home, "personal", "devspace"),
);

assert.equal(
  assertAllowedPath("~/personal/devspace", ["~/personal"]),
  resolve(home, "personal", "devspace"),
);

// ~ inside the resolved path is refused (would have silently been a literal
// segment under the bug, which is dangerous when joined to cwd by callers).
assert.throws(
  () => resolveAllowedPath("~/file.txt", "/workspace", ["/workspace"]),
  (err: unknown) => err instanceof AccessDeniedError,
);

assert.throws(
  () => resolveAllowedPath("~user/foo", "/workspace", ["/workspace"]),
  (err: unknown) => err instanceof AccessDeniedError,
);

assert.throws(
  () => resolveAllowedPath("../escape", "/workspace", ["/workspace"]),
  (err: unknown) => err instanceof AccessDeniedError,
);
