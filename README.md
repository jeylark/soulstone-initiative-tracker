# Soulstone Initiative Tracker

A SvelteKit and TypeScript app for organizing initiative in Soulstone encounters.

## Developing

Install dependencies and start the development server:

```sh
npm install
npm run dev
```

The current landing page is a visual prototype. Challenge setup, loading saved
challenges, and joining live sessions are not connected yet.

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
`/app/logs` for the planned server configuration and logs. The current prototype
does not yet read configuration or write logs to these locations. The container
runs as the unprivileged `node` user; on Linux, ensure the host log directory is
writable by UID 1000.
