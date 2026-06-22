# Security Model

DevSpace exposes local coding capabilities over MCP. Treat it as remote access
to your development machine.

The security model is simple:

- you choose a narrow filesystem allowlist
- the MCP endpoint requires OAuth approval with your Owner password
- Host headers are allowlisted from the configured public URL
- every coding action happens through explicit MCP tool calls

## Filesystem Allowlist

DevSpace only opens workspaces under configured roots.

Good examples:

```text
~/work
~/personal/open-source
```

Avoid broad roots:

```text
~
/
C:\
```

The narrower the root, the easier it is to reason about what the MCP client can
reach.

## Owner Password

`devspace init` generates an Owner password and stores it in:

```text
~/.devspace/auth.json
```

When an MCP client connects, DevSpace shows an approval page. Enter the Owner
password only when you intentionally want that client to access this server.

For env-driven deployments, set a long random value:

```bash
DEVSPACE_OAUTH_OWNER_TOKEN="$(openssl rand -base64 32)"
```

## Public URL And Host Allowlist

DevSpace needs `DEVSPACE_PUBLIC_BASE_URL` so MCP clients can discover OAuth
metadata and connect to the correct resource.

The value should be the origin only:

```text
https://your-tunnel-host.example.com
```

Do not include `/mcp` in `DEVSPACE_PUBLIC_BASE_URL`.

By default, DevSpace derives allowed Host headers from the local host and public
URL. Use `DEVSPACE_ALLOWED_HOSTS=*` only for intentional local debugging.

## Tunnels

DevSpace does not manage tunnels. Your tunnel or reverse proxy should point to:

```text
http://127.0.0.1:7676
```

Prefer adding Cloudflare Access, Tailscale identity controls, or equivalent
protection in front of public tunnels. DevSpace OAuth still protects the MCP
endpoint, but the tunnel URL should not be treated as a secret.

## Shell Access

The shell tool is powerful by design. It is meant for tests, builds, git, and
package scripts.

Filesystem path containment applies to DevSpace file tools. Shell commands run
as local commands and can do what your user account can do. This is why the MCP
client must be trusted and the Owner password must stay private.

## Worktrees

Managed worktrees reduce accidental edits to your active checkout, but they are
not a security boundary. They are a workflow boundary for isolated coding
sessions.

## Logs

By default, DevSpace does not log per-request or per-tool-call events to keep
the journal quiet on large reads. Enable them with `DEVSPACE_LOG_REQUESTS=1`
and `DEVSPACE_LOG_TOOL_CALLS=1`. Shell command previews are disabled unless
`DEVSPACE_LOG_SHELL_COMMANDS=1`.

Do not enable shell command logging if commands may contain secrets.

## OAuth Scopes

The first entry of `DEVSPACE_OAUTH_SCOPES` is the scope required on `/mcp`
requests; the remaining entries are advertised as supported. The default is
`["devspace"]`, so a token issued with the scope `devspace` will pass bearer
auth against `/mcp`. If you change `DEVSPACE_OAUTH_SCOPES` to e.g.
`["foo", "bar"]`, issued tokens must carry `foo` — `bar` is informational only.

`DEVSPACE_OAUTH_SCOPES` must contain at least one entry; the server refuses to
start otherwise.

## Host Allowlist and `trustProxy`

The combination of `DEVSPACE_TRUST_PROXY=1` and `*` in `DEVSPACE_ALLOWED_HOSTS`
is refused at startup. The wildcard `*` allows an attacker behind a trusted
proxy to poison the `Host` header and redirect OAuth callbacks. If you really
need this combination, set `DEVSPACE_ALLOW_WILDCARD_HOSTS=1` to acknowledge
the risk.

## Path Containment

Paths containing `~` other than exactly `~` or `~/...` are refused outright
(this used to silently pass through as a literal segment). Symlinks that point
outside the workspace root are caught by the same allowlist check on the
realpath, so a symlink inside the workspace cannot be used as a path-traversal
pivot to a protected directory.

## One Workspace Per Folder

The server reuses the most recent workspace session for a `(root, mode)` pair
opened within the last hour, instead of minting a new UUID on every
`open_workspace` call. This matches the model-facing contract in `AGENTS.md`
("call `open_workspace` once per folder, then reuse the `workspaceId`") and
prevents a misbehaving client from accumulating sessions.

## In-Memory Limits

`transports`, `workspaces`, and OAuth `codes` Maps are bounded by `BoundedMap`.
The cap is 100 sessions for transports/workspaces and 1000 codes, with a
60-second sweep that drops expired authorization codes. Past the cap, the
oldest entry is evicted on the next `set`.
