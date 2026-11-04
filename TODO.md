# Project TODOs

This backlog tracks product work from `PROJECT_DECISIONS.md`. The domain layer
already contains challenge models and validation, IndexedDB persistence,
challenge file processing, and turn-order generation; the remaining work is to
connect and complete the user-facing and server workflows around those
foundations.

## 1. Challenge navigation and setup

- [x] 1.1: Connect the landing-page actions to create a challenge, open a saved
      challenge, and join a live session.
- [ ] 1.2: Build challenge setup and editing for factions, reusable characters, NPC
      types, creatures, turns, initiative placement, and fairness weight.
- [x] 1.3: Finish removing NPC type `Use`/`Selected` controls now that each NPC can
      select its own type; verify the first-type fallback and remembered
      cross-faction default for newly added NPCs.
- [x] 1.4: Let NPC type forms wrap onto multiple rows when they no longer fit
      horizontally on the screen.
- [ ] 1.5: Add a faction color property and accessible palette selector. Keep
      colors distinguishable from each other and from app surfaces in light
      and dark themes; prefer unused defaults, allow reuse, and preserve colors
      through challenge copies and file workflows. No data migration is needed.
- [ ] 1.6: Support creature and turn ordering, zero or multiple turns per creature,
      and hide/show settings.
- [ ] 1.7: Reuse saved characters and support copying a challenge with fresh stable
      IDs and updated references.
- [ ] 1.8: Persist setup changes to the local challenge library and restore saved
      setup when reopening a challenge.

## 2. Initiative and encounter play

- [ ] 2.1: Collect initiative manually for player characters and by app roll for
      NPCs; app rolls must roll the initiative stat in d6s and sum the highest
      three, or all dice when fewer than three are rolled.
- [ ] 2.2: Preserve collected results when recalculating the order and provide an
      explicit reroll action.
- [ ] 2.3: Connect setup and collected results to turn-order generation, including
      fixed and relative placement hooks and clear feedback for invalid hooks.
- [ ] 2.4: Display the DM turn list with controls to reorder and hide/show turns;
      use each faction's selected color and omit hidden turns from the
      read-only view.
- [ ] 2.5: Save collected results and generated order as run state so a challenge
      can be resumed.
- [ ] 2.6: Add the end-of-round Spawn step for adding or removing creatures, then
      recollect initiatives as needed and regenerate the order.
- [ ] 2.7: Decide and document tie-break behavior between same-initiative turns in
      different factions. Same-faction ties already follow creature and turn
      setup order.

## 3. Challenge library and file workflows

- [ ] 3.1: Add UI for backing up and restoring the whole library; restore only after
      the complete backup has validated, and leave existing data unchanged on
      failure.
- [ ] 3.2: Add UI for saving one challenge with run state and only its referenced
      reusable characters.
- [ ] 3.3: Add UI for loading a challenge to continue play, including replace/copy
      choices, protection for challenges in active sessions, and character ID
      conflict handling.
- [ ] 3.4: Add UI for importing only reusable characters from a challenge file.
- [ ] 3.5: Present partial-import issues and require confirmation before importing
      valid sections; unsupported versions and malformed JSON must not be partially
      imported.
- [ ] 3.6: Ask before migrating older supported formats and explain when an
      unsupported format needs a compatible app version.

## 4. Live sessions and read-only viewers

- [ ] 4.1: Implement in-memory session creation, resume, and end flows; ending a
      session must remove its data, and server restarts may lose active sessions.
- [ ] 4.2: Add configurable limits for active sessions and viewers per session,
      refusing new connections with a clear message without evicting existing
      sessions or viewers.
- [ ] 4.3: Add DM reconnect credentials stored separately in IndexedDB and sent in
      an authorization header; invalidate them when the session ends and never
      log them.
- [ ] 4.4: Generate case-insensitive viewer codes that avoid easily confused
      characters; allow regeneration to invalidate the previous code.
- [ ] 4.5: Stream live turn-order updates to read-only viewers with SSE and enforce
      that hidden turns are omitted.
- [ ] 4.6: Add viewer-code entry and QR-code joining to the read-only view.
- [ ] 4.7: End inactive sessions after the configured timeout; viewer activity must
      not reset it.

## 5. Hosting and operations

- [ ] 5.1: Read server configuration from the mounted JSON file, with configurable
      session limits, viewer limits, inactivity timeout, and maximum retained log
      size.
- [ ] 5.2: Write structured diagnostic logs to the mounted directory with bounded
      rotation and retention; exclude challenge contents, viewer codes, reconnect
      tokens, and authorization headers.
- [ ] 5.3: Document operational behavior for configuration changes, session loss on
      server restart, and reverse-proxy requirements for long-lived SSE.
- [ ] 5.4: Verify container permissions and production behavior for mounted config
      and log directories.

## 6. Quality and release readiness

- [ ] 6.1: Complete keyboard, screen-reader, visible-focus, and WCAG 2.2 AA checks
      across setup, DM, import/export, and viewer workflows.
- [ ] 6.2: Verify mobile layouts and efficient use of larger screens for the
      challenge setup and turn-order views.
- [ ] 6.3: Add focused tests as each workflow is implemented, including session
      limits, authorization, inactivity expiry, SSE updates, and persistence or
      import failure cases.
- [ ] 6.4: Before pull requests, run `npm test`, `npm run lint`, `npm run check`,
      and `npm run build`; ensure CI passes.
