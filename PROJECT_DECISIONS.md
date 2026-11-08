# Soulstone Initiative Tracker: Project Decisions

This document records the product and architecture decisions discussed so far. It is intended as a handoff point for future work.

## Product

- The app is a helper for **Soulstone**, a custom dungeon crawler.
- A **challenge** may take one play session or span several sessions.
- A **creature** belongs to a faction and has a name. A player-controlled **character** is a creature. Other creatures are **NPCs**.
- Each NPC has a **creature type**. Multiple NPCs can share a type; an NPC's name combines its type with a custom identifier. The identifier may be blank only when that NPC is the sole creature of its type across all factions; otherwise identifiers must be nonblank and unique within the type.
- The DM can change an NPC's creature type individually. That selection becomes the default for subsequently added NPCs across factions; before any creature type is selected, the first type in the list is the default. Changing type preserves the identifier unless it would duplicate an NPC of the destination type, in which case the next unused number is assigned.
- A challenge has configurable factions. "Player" and "Monster" are common examples, not required faction names or a fixed limit.
- A creature may have zero or multiple turns; each newly created creature starts with one turn. A creature with no turns has no initiative. Additional turns use the hard-coded initiative mode for their creature kind: manual for characters and app-calculated for NPCs.
- Each turn may have its own initiative value and app/manual roll mode. Players roll initiative and the DM enters the results; a value may also be set directly.
- To roll initiative, roll a number of d6 equal to the creature's initiative stat and sum the highest three dice, or all dice if fewer than three were rolled.
- For each turn, the DM can choose to roll initiative, enter a static initiative value, place it at the Nth position from the top or bottom, or place it immediately before or after a specified turn. Relative hooks sharing a target and direction form a challenge-wide sibling group. A singleton is adjacent without an index; multiple siblings require unique contiguous indices from 1 through N, with 1 nearest the target. Before-groups are emitted farthest-to-nearest; after-groups nearest-to-farthest. A hooked turn's own relative descendants remain attached to it.
- Turn-order generation takes the ordered lists of initiative values and the hooked initiatives for each faction as inputs, and produces an ordered list of turns.
- Each challenge stores a non-negative fairness weight that controls how strongly turn-order generation balances factions against initiative; 0 orders purely by initiative. New challenges default to a weight of 3. The setup accepts any non-negative numeric value; its 0–10 slider stays at the maximum for larger values, and moving the slider sets the value from its selected position.
- Fixed-position hooks beyond either end of the root-turn list are clamped to the nearest available position. Fixed positions count initiative turns and fixed-position turns, but each root turn and all of its relative-hook descendants occupy one counted position. Relative sibling groups are expanded as adjacent subtrees after root ordering and are never distance-clamped. Missing targets, cycles, or missing, invalid, duplicate, or gapped sibling indices reject generation; affected turns are shown to the DM.
- Turn setup cards are labeled `Turn N` in each creature's current turn order, and renumber after a turn is removed. Relative-target choices include both the creature name and turn label. Removing a turn or creature that is referenced by other turns requires confirmation; accepting deletes all transitively dependent turns, while canceling leaves the challenge unchanged. This confirmation also applies when removing factions or NPC types and their creatures.
- New player-character turns default to manual initiative entry; new NPC turns default to app-calculated initiative. These defaults are hard-coded at creation time, while every turn stores its own mode and can be changed independently.
- Existing rolled initiative results remain unchanged when the order is recalculated. The DM must explicitly reroll to change them.
- A tie is two or more turns in the same faction with equal initiative, whether rolled or static. After initiatives are collected, the DM decides the order of each tied group, and the decisions are saved in the challenge's run state. Turn-order generation is blocked until every tie is resolved, and the unresolved groups are shown to the DM. Rerolling a turn discards the decisions for tie groups it belonged to; recalculating the order keeps the remaining decisions. Ties between turns in different factions are not decided by the DM; the fairness weight handles them.
- The DM can hide or show a creature's turns in the list. In the DM view, hidden turns remain visible but are greyed out. In read-only view, hidden turns are omitted.
- At the end of the turn list, each round has a **Spawn** step. The DM can add creatures to or remove creatures from the challenge there. Changes may require the turn order to be recalculated.

## Challenge workflow

1. **Set up the challenge.** The DM creates or loads a challenge, configures factions and NPC types, adds creatures (including player characters), and configures their turns and initiative placement.
2. **Collect turn initiatives.** Each rolling turn stores whether its result is calculated by the app or entered by the DM. New character turns default to manual entry and new NPC turns default to app calculation. The results are saved with the challenge so they can be restored.
3. **Resolve ties.** If turns in the same faction have equal initiative, the DM chooses their order. The decisions are saved with the challenge.
4. **Generate the turn order.** The app combines the initiative results and tie decisions with static initiatives and placement hooks to produce the ordered turns. The generated order is also saved with the challenge so the running setup can be restored.

A challenge with a generated turn order is running. The first entry is the current turn; the DM's **Next turn** button moves it to the end of the order, and the run state saves how many Spawn steps have been completed (`spawnCount`), shown above the list. The DM can then run the encounter. At the end of each round, the DM handles the Spawn step; if that changes the challenge, initiatives are collected again as needed and the order is regenerated.

Setup, Roll, and Run are tabs on one challenge detail page at `/challenges/[challengeId]`. Tab selection is local page state and returns to Setup after a reload.

## App navigation and views

- The landing page offers:
  - Create a new challenge.
  - Load an existing challenge.
  - Display a running challenge in read-only mode.
- Landing-page create and load actions both open `/challenges`. The hub creates a blank saved challenge and lists saved challenges to load, each as a card showing its name, last-modified date, player character names, and NPC type names, with a Load button. `/challenges/[challengeId]` hosts Setup, Roll, and Run as tabs. The join action opens `/view`, which currently reuses the join-session placeholder; live session joining and streaming are not implemented yet. The obsolete `/challenges/new`, per-step challenge routes, and `/join` route are removed.
- The app has no navigation bar. All views share one app shell provided by the root layout: the Soulstone header, the page content area, and the light/dark theme toggle. Pages render only their own content and reuse the shared view layout component rather than repeating the shell.
- The light/dark theme can be toggled from every view. The preference is app-wide, defaults to light, and is stored in the browser's `localStorage` (key `soulstone-theme`) so it persists across reloads. It is a display preference, not challenge data, so it is not part of the IndexedDB challenge library or its export formats. Server-side rendering uses the light theme, so a returning dark-mode user may briefly see light until the page loads in the browser.
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
- Challenge-library format version 1 contains challenges. Challenges contain their factions, NPC types, creature instances (characters store their own name and optional initiative stat), and turn setup. Each rolling turn stores its initiative mode (`manual` or `app`), recording whether the result is entered by the DM or calculated by the app, not who rolls. New character turns default to manual and new NPC turns to app calculation; these defaults are hard-coded and are not challenge data. Stable IDs connect references between records. A challenge's optional run state stores initiative results, tie decisions, the generated turn order, and the completed Spawn count, allowing steps 1–4 to be restored after a restart. Player attendance and group membership are session-time data, not saved groups in the challenge library. Live-session credentials are not part of this library.
- Challenges store creation and last-modified timestamps as `Date` objects in the model. Creating a copy resets both timestamps to the copy time. JSON exports serialize them as ISO 8601 UTC strings; imports parse those strings back into `Date` objects.
- Challenge file workflows:
  1. **Back up the whole library.** Download all saved challenges from IndexedDB as human-readable, pretty-printed JSON. Include the format version and stable IDs; never include active-session credentials such as viewer codes or DM reconnect tokens.
  2. **Restore the whole library.** Load a library backup and replace the local library only after the entire file has been read and validated successfully. Invalid or unsupported files must leave the existing library unchanged; whole-library restore is always all-or-nothing.
  3. **Save one challenge.** Download a single challenge snapshot, including its current run state (collected initiative results, tie decisions, and generated turn order), so a running challenge can be continued later. Use the same versioned JSON format.
  4. **Load one challenge to continue playing.** Load a single-challenge file into the local library, preserving its run state. If a challenge with the same stable ID already exists, ask whether to replace it or import a copy. Never replace a challenge used by an active session; offer to import a copy or abort instead. When making a copy, assign fresh stable IDs to the challenge and its contained entities and update all internal references.
- For imports containing parts that cannot be imported, list those parts and ask whether to import only valid data or abort. For older supported format versions, ask the DM before migrating.
- Partial import applies to single-challenge file workflows, not whole-library restore. Import the challenge only when its complete structure and references validate. Require explicit confirmation before saving any partial import, and expose the validation issues so the DM can make an informed choice. Unsupported format versions and malformed JSON are not eligible for partial import.
- The single-challenge file reader returns recovered content together with unreadable-field issues and an explicit partial-read indicator. Import preparation is separate and does not persist data; callers save the prepared library through the storage layer only after the DM confirms the import.
- Data migrations are required when a released challenge data format changes and data from the previous release must remain usable; model changes during development before release do not require migrations.
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
- Object, array, tuple, and collection parameters must be read-only: use `Readonly<T>`, `readonly T[]`, `readonly [A, B]`, `ReadonlySet<T>`, or `ReadonlyMap<K, V>` as appropriate. Do not accept mutable object or collection parameters, including accumulators; keep mutation local and return the resulting value. ESLint enforces this for explicitly typed parameters.
- Use strict types and handle errors explicitly. Address compiler diagnostics rather than suppressing or bypassing them.
- Keep third-party dependencies to a minimum; add one only when it provides clear value.
- Target WCAG 2.2 Level AA, including semantic markup, keyboard operability, visible focus, and support for assistive technologies.
- Make the app usable on mobile devices, and use the available space on larger screens where practical.
- Implement changes incrementally in small, reviewable steps; avoid large bulk changes.
- Use a test-driven approach: clarify the expected behavior before implementation, then write or update tests for that behavior before writing or changing app code. Do not write app code while the expected behavior is unclear.
- Every production module (excluding index/barrel files) and UI component must have its own colocated test file covering behavior owned by that unit. Integration tests supplement but do not replace module- or component-owned tests. Type-only modules should use compile-time assertions where runtime tests do not apply.
- Run `npm test`, `npm run lint`, and `npm run check` before submitting pull requests; CI must pass.
- Write comments to explain non-obvious intent, not to restate the code.

## Still to decide
