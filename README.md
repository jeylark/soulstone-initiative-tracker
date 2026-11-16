# Soulstone Initiative Tracker

A SvelteKit and TypeScript app for organizing initiative in Soulstone encounters.

## Developing

Install dependencies and start the development server:

```sh
npm install
npm run dev
```

The app supports challenge setup, saved-challenge loading, and starting or
resuming an in-memory live session from the Run view. Joining as a read-only
viewer and streaming live updates are not implemented yet.

## Validation

```sh
npm run lint
npm test
npm run check
npm run build
```

Pull requests run all four checks and build the Docker image in GitHub Actions.

Testing Library error messages are limited to 500 characters, including the
truncation notice. Set `TEST_ERROR_PRINT_LIMIT` to a positive integer to use a
different character limit for a test run; invalid values use the default. Stack
traces, assertion diffs, and other test output are not limited by this setting.
Testing Library's separate `DEBUG_PRINT_LIMIT` also limits individual DOM dumps
and defaults to 7000 characters.

For example, in PowerShell:

```powershell
$previousLimit = [Environment]::GetEnvironmentVariable('TEST_ERROR_PRINT_LIMIT', 'Process')
try {
	$env:TEST_ERROR_PRINT_LIMIT = '10000'
	npx vitest run src/test-setup.spec.ts
} finally {
	[Environment]::SetEnvironmentVariable('TEST_ERROR_PRINT_LIMIT', $previousLimit, 'Process')
}
```

## Deployment

The app can be built and started locally in its production Node.js 26 LTS
container with Docker Compose:

```sh
docker compose up --build
```

The app listens on `127.0.0.1:3000` on the host. Configure a host-managed
reverse proxy to forward requests to that address and handle HTTPS. Keep the
proxy configured to pass Server-Sent Events without buffering when live viewer
updates are implemented.

Compose mounts `./data/config` read-only at `/app/config` and `./data/logs` at
`/app/logs` for server configuration and logs. To configure server limits, place
a `server.json` file in `./data/config`:

```json
{
	"maxActiveSessions": 100,
	"maxViewerConnectionsPerSession": 100,
	"sessionInactivityTimeoutMs": 21600000,
	"maxRetainedLogSizeBytes": 1000000000
}
```

All properties are optional and default to the values shown: 100 active sessions,
100 concurrent viewers per session, a six-hour inactivity timeout in milliseconds,
and 1,000,000,000 bytes of retained logs. Each value must be a non-negative safe
integer; invalid configuration prevents the server from starting. Configuration
changes take effect after restarting the app container. When a session reaches
`maxViewerConnectionsPerSession`, additional viewers see a limit message and
stop reconnecting automatically; they can reload to try again later. Existing
viewers keep receiving updates, and disconnected viewers free their slots.
Setting this limit to zero refuses all viewer connections.

Sessions automatically end after `sessionInactivityTimeoutMs` without successful
authenticated DM activity: resuming or updating the session, or regenerating its
viewer code. Viewer lookups, connections, disconnects, and SSE heartbeats never
reset this timeout; failed DM authorization does not reset it either. Expiry
invalidates the viewer code and reconnect credential, frees session capacity,
and sends connected viewers a terminal `session-ended` event. Setting the timeout
to zero expires sessions immediately.

The container runs as the
unprivileged `node` user; on Linux, ensure the host log directory is writable by
UID 1000. Server requests and unhandled server errors
are written as newline-delimited JSON to
`./data/logs/diagnostics.jsonl` (container path `/app/logs/diagnostics.jsonl`).
Entries include a timestamp, severity, event, source route, correlation ID, and
safe request metadata. Error records include stack frames but omit error
messages. Request URLs and bodies, challenge contents, viewer codes, reconnect
tokens, and authorization headers are not logged.
The active log rotates into numbered `.1` through `.4` archives. Rotation keeps
the combined size of the active file and archives within
`maxRetainedLogSizeBytes`, removing the oldest archives first. An individual
record larger than that limit is rejected rather than exceeding the configured
bound.
