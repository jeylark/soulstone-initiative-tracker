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
`/app/logs` for server configuration and logs. To set the active-session limit,
place a `server.json` file in `./data/config`:

```json
{
	"maxActiveSessions": 100
}
```

The limit defaults to 100 when the file or property is absent. It must be a
non-negative safe integer; invalid configuration prevents the server from
starting. Configuration changes take effect after restarting the app container.
The container runs as the unprivileged `node` user; on Linux, ensure the host log
directory is writable by UID 1000. Server requests and unhandled server errors
are written as newline-delimited JSON to
`./data/logs/diagnostics.jsonl` (container path `/app/logs/diagnostics.jsonl`).
Entries include a timestamp, severity, event, source route, correlation ID, and
safe request metadata. Error records include stack frames but omit error
messages. Request URLs and bodies, challenge contents, viewer codes, reconnect
tokens, and authorization headers are not logged.
