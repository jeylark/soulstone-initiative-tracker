# Soulstone Initiative Tracker: Project Decisions

This document records the product and architecture decisions discussed so far. It is intended as a handoff point for future work.

## Product

- The app is a helper for **Soulstone**, a custom dungeon crawler.
- A **challenge** may take one play session or span several sessions.
- A **creature** belongs to a faction and has a name. A player-controlled **character** is a creature. Other creatures are **NPCs**.
- Each NPC has a **creature type**. Multiple NPCs can share a type; an NPC's name combines its type with a custom identifier.
- A challenge has configurable factions. "Player" and "Monster" are common examples, not required faction names or a fixed limit.
- A creature usually has one turn, but may have zero or multiple turns.
- Each turn may have its own initiative value. Players roll initiative and the DM enters the results; a value may also be set directly.
- To roll initiative, roll a number of d6 equal to the creature's initiative stat and sum the highest three dice, or all dice if fewer than three were rolled.
- For each turn, the DM can choose to roll initiative, enter a static initiative value, place it at the Nth position from the top or bottom, or place it N positions before or after a specified turn. Position-based placement is applied after the rest of the list is calculated.
- Turn-order generation takes the ordered lists of initiative values and the hooked initiatives for each faction as inputs, and produces an ordered list of turns.
- Fixed-position hooks beyond the available list are clamped to the nearest available position. If placement hooks conflict or form a cycle, turn-order generation is rejected and the affected turns are shown to the DM.
- By default, players roll and the DM enters their results; the app rolls for NPCs. The DM can choose otherwise.
- Existing rolled initiative results remain unchanged when the order is recalculated. The DM must explicitly reroll to change them.
- When two turns in the same faction have the same rolled initiative, the DM decides which goes first. Other initiative tie-break criteria are not decided yet.
- The DM can hide or show a creature's turns in the list. In the DM view, hidden turns remain visible but are greyed out. In read-only view, hidden turns are omitted.
- At the end of the turn list, each round has a **Spawn** step. The DM can add creatures to or remove creatures from the challenge there. Changes may require the turn order to be recalculated.

## Challenge workflow

1. The DM creates a challenge or loads one from their device.
2. The DM can reuse player characters from a previous challenge. Groups may have different DMs, players, and characters; their membership can also change.
3. The DM specifies the NPC creature types that appear in the challenge.
4. The DM adds creatures to factions, including any factions needed beyond the common Player and Monster factions.
5. Where needed, the DM sets a creature's turn count and how turns without initiative are ordered.
6. Players roll initiative; the DM records the results.
7. The DM starts or resumes the challenge, and the turn order is calculated.
8. Creatures take their turns in order. At the end of the list, the DM handles Spawn and the order is recalculated when necessary.

## App navigation and views

- The landing page offers:
  - Create a new challenge.
  - Load an existing challenge.
  - Display a running challenge in read-only mode.
- The app will use **SvelteKit** and **TypeScript**, organized into components, with strict typing enabled.
- The DM manages the challenge. A read-only view on another device shows the running turn order without editing capabilities.
- The read-only view updates during play using Server-Sent Events (SSE). Viewers join using a random, case-insensitive code made from numbers and letters, avoiding easily confused characters. The same code can be entered manually or embedded in a QR code that links directly to the read-only view.
- The viewer code is valid only while its session is active. The DM can regenerate it during a session, invalidating the previous code and QR link.
- The server enforces a configurable maximum of 100 concurrent viewer connections per session by default. When the limit is reached, new viewer connections are refused; existing connections are not disconnected.
- To reconnect without cookies, the DM's browser stores a separate, random bearer token in IndexedDB and sends it in an authorization header. The token grants DM access only to its active session and is invalidated when that session ends.
- There is no cross-device recovery for a lost DM reconnect token. If the token is lost, the DM must start a new session from the locally stored challenge.
- Anyone can create a session without an account or login. The server enforces a configurable maximum of 100 active sessions by default to limit resource usage. When the limit is reached, new sessions are refused with a clear message; existing sessions are not evicted.
- Sessions automatically end after a host-configured period without DM activity. The default inactivity timeout is six hours. Viewer connections or activity do not reset the timeout.

## Storage and hosting

- The app should be hostable on the user's own server.
- The app will run in a single Docker container, with a Docker Compose setup and server configuration persisted on the host. A host-managed reverse proxy will provide public access; the app must not depend on a specific reverse-proxy product.
- HTTPS termination and certificate management are handled by the host's reverse proxy, not by the app.
- The reverse proxy must support long-lived Server-Sent Events (SSE) connections without buffering or prematurely timing them out.
- The browser app must be self-contained: all resources it needs are served by the app, with no runtime requests to third parties.
- Server configuration is stored in a JSON file on the hosting server and mounted into the container. Configuration changes take effect after restarting the app container.
- Configuration includes the maximum number of active sessions, maximum viewer connections per session, session inactivity timeout, and maximum retained log size.
- The server writes structured diagnostic logs to a host-mounted directory. Logs use bounded rotation and retention, with a configurable total size limit of 1 GB by default, and remain available across container restarts.
- Log entries include a timestamp, severity, event, source location, and correlation ID. Errors include stack traces and safe diagnostic context.
- Logs must not contain viewer codes, DM reconnect tokens, authorization headers, or challenge contents.
- The DM's challenge library and other required persistent challenge data live in the browser, using **IndexedDB**.
- The DM can download persistent challenge data as a human-readable, pretty-printed JSON file for backup or transfer between devices. The file includes a format version and stable IDs for entities and references, and excludes active-session credentials such as viewer codes and DM reconnect tokens.
- When an imported challenge matches one in the local library, ask the DM whether to replace it or import a copy. Never allow replacing the local challenge used by a running session; offer to import a copy or abort instead.
- If an import contains parts that cannot be imported, list them and ask whether to import only the valid data or abort. For older supported format versions, ask the DM before migrating.
- Every change to the challenge data format must include a migration from the previously supported format, so existing challenge files remain usable.
- Reject files with unsupported or unrecognized format versions without changing the library, and explain that a compatible app version is needed.
- Starting or resuming a challenge sends the data needed for sharing to the server, which keeps the active session **in memory only**.
- The DM must be able to reload or restart their browser and regain access to the session they were managing, as long as the server session is still running.
- Ending a session removes its data from server memory.
- Because there is no server-side persistence in this design, a server restart or crash loses active sessions. The DM can restore from their local challenge and start a new session; viewers would need to reconnect.
- PostgreSQL and other persistent server-side databases are not part of the current design.

## Coding guidelines

- Work on each implementation task in a separate Git branch. Never merge into or push to `main`.
- Prefer clear names and simple designs. Keep functions and components focused, avoid duplication, and avoid unnecessary abstractions.
- Use PascalCase for types, camelCase for identifiers, and UPPER_SNAKE_CASE for constants. Prefix booleans with `is`, `has`, or `can`, and write acronyms as words (for example, `Uuid` and `Id`). ESLint enforces type and identifier casing, acronym style, and boolean prefixes.
- Use strict types and handle errors explicitly. Address compiler diagnostics rather than suppressing or bypassing them.
- Keep third-party dependencies to a minimum; add one only when it provides clear value.
- Target WCAG 2.2 Level AA, including semantic markup, keyboard operability, visible focus, and support for assistive technologies.
- Make the app usable on mobile devices, and use the available space on larger screens where practical.
- Implement changes incrementally in small, reviewable steps; avoid large bulk changes.
- Use a test-driven approach: clarify the expected behavior before implementation, then write or update tests for that behavior before writing or changing app code. Do not write app code while the expected behavior is unclear.
- Run `npm test`, `npm run lint`, and `npm run check` before submitting pull requests; CI must pass.
- Write comments to explain non-obvious intent, not to restate the code.

## Still to decide
