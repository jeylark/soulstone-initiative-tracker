# Project TODOs

This backlog tracks product work from `PROJECT_DECISIONS.md`. The domain layer
already contains challenge models and validation, IndexedDB persistence,
challenge file processing, and turn-order generation; the remaining work is to
connect and complete the user-facing and server workflows around those
foundations.

Never delete a completed task from this backlog. Move it from `Open` to `Done`
under the same category, keeping its task number and wording.

## Open

### 2. Initiative and encounter play

#### Setup

- 2.33: Remove the Setup, Roll, and Run navigation buttons from their
  respective tabs.

#### Rolling

- 2.16: Add an animated "rolling" effect for initiative rolls.
- 2.29: Stabilize the width of cards for app-rolled turns in the rolling view.

### 3. Challenge library and file workflows

- 3.2: Add UI for restoring the whole library only after the complete backup
  has validated; leave existing data unchanged on failure.
- 3.7: Reject malformed JSON and unsupported versions without partially
  importing data.
- 3.8: Ask before migrating older supported formats.
- 3.9: Explain when an unsupported format needs a compatible app version.
- 3.6: Present partial-import issues and require confirmation before importing
  valid sections; import the challenge only when its structure and references
  are complete and valid.
- 3.10: Support copying a challenge with fresh stable IDs and updated
  references, including turn IDs in saved tie decisions.
- 3.4: Add UI for loading a challenge to continue play, with replace-or-copy
  choices.
- 3.5: Protect challenges used by active sessions from replacement; offer to
  import a copy or abort instead.

### 4. Live sessions and read-only viewers

- 4.7: Allow viewer-code regeneration to invalidate the previous code.
- 4.10: Add viewer-code entry to the read-only view.
- 4.11: Add QR-code joining to the read-only view.
- 4.8: Stream live turn-order updates to read-only viewers with SSE.
- 4.4: Add a configurable per-session viewer limit and refuse new connections
  with a clear message without disconnecting existing viewers.
- 4.9: Enforce that hidden turns are omitted from read-only viewer updates.
- 4.13: Omit hidden turns from the read-only view.
- 4.12: End inactive sessions after the configured timeout; viewer activity must
  not reset it.

### 5. Hosting and operations

- 5.1: Read server configuration from the mounted JSON file, with configurable
  session limits, viewer limits, inactivity timeout, and maximum retained log
  size.
- 5.2: Write structured diagnostic logs to the mounted directory and exclude
  challenge contents, viewer codes, reconnect tokens, and authorization
  headers.
- 5.3: Add bounded log rotation and retention using the configured maximum
  retained log size.
- 5.4: Document configuration-change behavior and session loss on server
  restart.
- 5.5: Document reverse-proxy requirements for long-lived SSE.
- 5.6: Verify container permissions and production behavior for the mounted
  config directory.
- 5.7: Verify container permissions and production behavior for the mounted
  log directory.

### 6. Quality and release readiness

- 6.5: Add focused tests alongside each workflow, including session limits,
  authorization, inactivity expiry, SSE updates, and persistence or import
  failure cases.
- 6.9: Split the challenge hub's saved-challenge list (`/challenges`) into
  smaller sub-components where feasible, improving readability and following
  single responsibility.
- 6.10: Split the challenge creation workflow on `/challenges` into smaller
  sub-components where feasible, improving readability and following single
  responsibility.
- 6.14: Split the viewer entry page (`/view`) into smaller sub-components where
  feasible as live-session joining is implemented.
- 6.17: Extract reusable radio-button controls and use them throughout the
  app wherever radio-button controls are needed.
- 6.19: Rework existing custom-input dimension stability to apply only to
  width. Remove empty slots and reserved height for potential validation
  messages; render message space only when warnings or errors are displayed,
  allowing field height to grow and shrink without changing control width.
  Update focused component tests. This supersedes the height-reservation
  behavior from task 2.20.
- 6.20: Add consistent optional warning and error display to all custom input
  components (text, number, select, range, and checkbox), using NumberInput's
  existing validation props and depending on 6.19. Preserve native attributes,
  accessible message associations, and stable control widths without reserving
  empty message height; add focused component tests and public API
  documentation.
- 6.21: Wire existing validation warnings and errors to the relevant custom
  input components across forms, depending on 6.20. Reuse existing validation
  rules, show field-level feedback, preserve non-blocking warnings and existing
  invalid-input behavior, and add focused integration tests. Keep new
  setup-validation rules in task 1.18.
- 6.1: Complete keyboard, screen-reader, visible-focus, and WCAG 2.2 AA checks
  for challenge setup and DM workflows.
- 6.2: Complete keyboard, screen-reader, visible-focus, and WCAG 2.2 AA checks
  for import/export and viewer workflows.
- 6.3: Verify mobile layouts and efficient use of larger screens for challenge
  setup.
- 6.6: Before pull requests, run `npm test`, `npm run lint`, `npm run check`,
  and `npm run build`; ensure CI passes.

## Done

### 1. Challenge navigation and setup

- 1.1: Connect the landing-page actions to create a challenge, open a saved
  challenge, and join a live session.
- 1.2: Build challenge setup and editing for factions, characters, NPC
  types, creatures, turns, initiative placement, and fairness weight.
- 1.3: Finish removing NPC type `Use`/`Selected` controls now that each NPC can
  select its own type; verify the first-type fallback and remembered
  cross-faction default for newly added NPCs.
- 1.4: Let NPC type forms wrap onto multiple rows when they no longer fit
  horizontally on the screen.
- 1.5: Add a faction color property and accessible palette selector. Keep
  colors distinguishable from each other and from app surfaces in light
  and dark themes; prefer unused defaults, allow reuse, and preserve colors
  through challenge copies and file workflows. No data migration is needed.
- 1.6: Support changing creature and turn setup order.
- 1.7: Support zero or multiple turns per creature.
- 1.8: Add controls to hide and show a creature's turns.
- 1.9: Remove "reusable characters" and treat characters like any other
  setup entity.
- 1.11: Persist setup changes to the local challenge library and restore saved
  setup when reopening a challenge.
- 1.12: Reduce the height of faction name inputs in challenge setup.
- 1.13: Use the shared ActionButton component for the Roll Initiatives
  action.
- 1.14: Move the "Add" buttons in setup to the bottom of their containers.
- 1.15: Move the "Remove" buttons in setup to the top of their containers.
- 1.16: Make every "Remove" button in setup state which kind of entity it
  removes.
- 1.17: Remove sorting of creatures in setup.
- 1.19: Remove faction selection from a faction's creatures in setup.
- 1.20: Hide the initiative-stat input for faction creatures when it isn't
  needed for rolling, while preserving any entered value in storage.
- 1.21: Remove the navigation bar altogether.
- 1.22: Link the header page icon (and app name) to the landing page.

### 2. Initiative and encounter play

- 2.1: Collect initiative manually for player characters.
- 2.2: Add per-turn app-roll and **Roll all** controls for missing results.
  Roll every app-configured turn using the NPC type's or
  character's initiative stat as the number of d6; sum all dice when fewer
  than three are rolled, otherwise sum the highest three. Require a valid
  character stat for app-configured character turns, and handle missing or
  invalid stats in imported data. Persist results by turn ID, preserve
  existing results until an explicit reroll, and restore them on reload.
- 2.3: Preserve collected results when recalculating the order.
- 2.4: Provide an explicit reroll action for collected results.
- 2.5: Connect setup and collected results to turn-order generation, including
  fixed and relative placement hooks.
- 2.6: Show clear feedback for invalid placement hooks.
- 2.7: Display the DM turn list using each faction's selected color.
- 2.27: Rework faction colors so they stand out from the page background in light and dark mode and are distinguishable from one another.
- 2.10: Detect same-faction initiative ties and block turn-order generation
  until the DM has resolved them. Ties across factions stay with the
  fairness algorithm.
- 2.9: Save collected initiative results as run state so a challenge can
  resume initiative collection.
- 2.11: Add UI for the DM to order tied turns within a faction, and show
  unresolved ties when generation is blocked.
- 2.12: Save tie decisions in the run state. Discard them for a tie group when
  a member is rerolled, and keep the remaining decisions on recalculation.
- 2.15: Save generated turn order as run state so a challenge can resume with
  the generated order.
- 2.17: Remove creature names from inside the cards in the roll view; keep
  them in card titles and accessible control names.
- 2.18: Add controls to hide or show a creature's turns in the DM turn list;
  hidden turns stay visible but greyed out.
- 2.19: Remove "this result is still valid" explanations from warnings; the
  warning itself is sufficient.
- 2.20: Keep input dimensions stable when warnings or errors appear or
  disappear.
- 2.26: Move the hide checkbox inside each running-challenge turn card.
- 2.28: When an initiative stat changes, discard affected app-rolled results
  and invalidate the generated order; preserve manual/static values.
- 2.32: Combine the setup, rolling, and run views into a single page with
  separate tabs for each view.
- 2.35: Validate setup values.
- 2.34: Add a separate disable option for each input control and button.
- 2.36: Extract a reusable input component that combines a slider with its
  associated input field.
- 2.37: Add a **Next turn** button to running challenges that rotates the
  turn order, saves it, and shows the number of completed Spawn steps above
  the list.
- 2.24: Make the creature name prominent inside each turn card and show its
  numeric initiative when one exists.
- 2.25: For turn cards in run view: Use the faction name as the cards title. The creature name (i.e. type name + index) should be a large label inside the card, by far the most prominent item in it.
- 2.13: Add the end-of-round Spawn step for adding or removing creatures.
- 2.14: After Spawn changes, recollect initiatives as needed and regenerate
  the order.
- 2.21: Label turn-order generation **Start challenge** and remove the
  recalculation action while a challenge is running. This does not rename
  the separate per-turn **Calculate roll** action.
- 2.22: After turn-order generation starts the challenge, lock setup and
  rolling until the challenge is reset.
- 2.23: Show the challenge name in the run view.
- 2.31: Add **Next** and **Previous** buttons to the run view.
- 2.30: Disable editing of a running challenge outside of **Spawn** turns.

### 3. Challenge library and file workflows

- 3.1: Add UI for backing up the whole library.
- 3.3: Add UI for saving one challenge with run state (including tie
  decisions).

### 4. Live sessions and read-only viewers

- 4.1: Implement in-memory session creation and resume flows.
- 4.2: End sessions by removing their data; server restarts may lose active
  sessions.
- 4.3: Add a configurable active-session limit and refuse new sessions with a
  clear message without evicting existing sessions.
- 4.5: Add DM reconnect credentials stored separately in IndexedDB and sent in
  an authorization header; invalidate them when the session ends and never
  log them.
- 4.6: Generate case-insensitive viewer codes that avoid easily confused
  characters.

### 6. Quality and release readiness

- 6.7: Organize files in `src/lib/challenge` into one or more logical
  subdirectories to reduce the number of files at the folder root.
- 6.8: Split the landing-page view (`/`) into smaller sub-components where
  feasible, improving readability and following single responsibility.
  6.11: Further split the Setup tab on `/challenges/[challengeId]` into smaller
  sub-components where feasible, improving readability and following single
  responsibility.
  6.12: Further split the Roll tab on `/challenges/[challengeId]` into smaller
  sub-components where feasible, improving readability and following single
  responsibility.
  6.13: Further split the Run tab on `/challenges/[challengeId]` into smaller
  sub-components where feasible, improving readability and following single
  responsibility.
- 6.13: Split the running-challenge view
  (`/challenges/[challengeId]/run`) into smaller sub-components where
  feasible, improving readability and following single responsibility.
- 6.15: Extract a reusable checkbox input component and use it throughout
  the app wherever checkbox controls are needed.
- 6.16: Extract a reusable color-picker component and use it throughout the
  app wherever color-picking controls are needed.
- 6.18: Speed up reading and applying the saved dark/light mode on page load.
- 6.4: Verify mobile layouts and efficient use of larger screens for the
  turn-order views.
