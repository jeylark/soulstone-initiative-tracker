# Project TODOs

This backlog tracks product work from `PROJECT_DECISIONS.md`. The domain layer
already contains challenge models and validation, IndexedDB persistence,
challenge file processing, and turn-order generation; the remaining work is to
connect and complete the user-facing and server workflows around those
foundations.

## 1. Challenge navigation and setup

- [x] 1.1: Connect the landing-page actions to create a challenge, open a saved
      challenge, and join a live session.
- [x] 1.2: Build challenge setup and editing for factions, reusable characters, NPC
      types, creatures, turns, initiative placement, and fairness weight.
- [x] 1.3: Finish removing NPC type `Use`/`Selected` controls now that each NPC can
      select its own type; verify the first-type fallback and remembered
      cross-faction default for newly added NPCs.
- [x] 1.4: Let NPC type forms wrap onto multiple rows when they no longer fit
      horizontally on the screen.
- [x] 1.5: Add a faction color property and accessible palette selector. Keep
      colors distinguishable from each other and from app surfaces in light
      and dark themes; prefer unused defaults, allow reuse, and preserve colors
      through challenge copies and file workflows. No data migration is needed.
- [ ] 1.6: Support changing creature and turn setup order.
- [ ] 1.7: Support zero or multiple turns per creature.
- [ ] 1.8: Add controls to hide and show a creature's turns.
- [ ] 1.9: Reuse saved characters when setting up a challenge.
- [ ] 1.10: Support copying a challenge with fresh stable IDs and updated
       references, including turn IDs in saved tie decisions.
- [ ] 1.11: Persist setup changes to the local challenge library and restore saved
       setup when reopening a challenge.
- [ ] 1.12: Reduce the height of faction name inputs in challenge setup.

## 2. Initiative and encounter play

- [ ] 2.1: Collect initiative manually for player characters.
- [ ] 2.2: Roll NPC initiative using the initiative stat in d6s and sum the
      highest three dice, or all dice when fewer than three are rolled.
- [ ] 2.3: Preserve collected results when recalculating the order.
- [ ] 2.4: Provide an explicit reroll action for collected results.
- [ ] 2.5: Connect setup and collected results to turn-order generation, including
      fixed and relative placement hooks.
- [ ] 2.6: Show clear feedback for invalid placement hooks.
- [ ] 2.7: Display the DM turn list using each faction's selected color, with
      controls to reorder turns and hide or show them.
- [ ] 2.8: Omit hidden turns from the read-only view.
- [ ] 2.9: Save collected results and generated order as run state so a challenge
      can be resumed.
- [ ] 2.10: Add the end-of-round Spawn step for adding or removing creatures.
- [ ] 2.11: After Spawn changes, recollect initiatives as needed and regenerate
       the order.
- [ ] 2.12: Detect same-faction initiative ties and block turn-order generation
      until the DM has resolved them. Ties across factions stay with the
      fairness algorithm.
- [ ] 2.13: Add UI for the DM to order tied turns within a faction, and show
      unresolved ties when generation is blocked.
- [ ] 2.14: Save tie decisions in the run state. Discard them for a tie group when
      a member is rerolled, and keep the remaining decisions on recalculation.

## 3. Challenge library and file workflows

- [ ] 3.1: Add UI for backing up the whole library.
- [ ] 3.2: Add UI for restoring the whole library only after the complete backup
      has validated; leave existing data unchanged on failure.
- [ ] 3.3: Add UI for saving one challenge with run state (including tie
      decisions) and only its referenced reusable characters.
- [ ] 3.4: Add UI for loading a challenge to continue play, with replace-or-copy
      choices.
- [ ] 3.5: Protect challenges used by active sessions from replacement; offer to
      import a copy or abort instead.
- [ ] 3.6: Reuse matching reusable characters by stable ID and data when loading a
      challenge; assign a fresh ID and update references when an imported ID
      conflicts with different data.
- [ ] 3.7: Add UI for importing only reusable characters from a challenge file.
- [ ] 3.8: Present partial-import issues and require confirmation before importing
      valid sections; import the challenge only when its structure and references
      are complete and valid.
- [ ] 3.9: Reject malformed JSON and unsupported versions without partially
      importing data.
- [ ] 3.10: Ask before migrating older supported formats.
- [ ] 3.11: Explain when an unsupported format needs a compatible app version.

## 4. Live sessions and read-only viewers

- [ ] 4.1: Implement in-memory session creation and resume flows.
- [ ] 4.2: End sessions by removing their data; server restarts may lose active
      sessions.
- [ ] 4.3: Add a configurable active-session limit and refuse new sessions with a
      clear message without evicting existing sessions.
- [ ] 4.4: Add a configurable per-session viewer limit and refuse new connections
      with a clear message without disconnecting existing viewers.
- [ ] 4.5: Add DM reconnect credentials stored separately in IndexedDB and sent in
      an authorization header; invalidate them when the session ends and never
      log them.
- [ ] 4.6: Generate case-insensitive viewer codes that avoid easily confused
      characters.
- [ ] 4.7: Allow viewer-code regeneration to invalidate the previous code.
- [ ] 4.8: Stream live turn-order updates to read-only viewers with SSE.
- [ ] 4.9: Enforce that hidden turns are omitted from read-only viewer updates.
- [ ] 4.10: Add viewer-code entry to the read-only view.
- [ ] 4.11: Add QR-code joining to the read-only view.
- [ ] 4.12: End inactive sessions after the configured timeout; viewer activity must
      not reset it.

## 5. Hosting and operations

- [ ] 5.1: Read server configuration from the mounted JSON file, with configurable
      session limits, viewer limits, inactivity timeout, and maximum retained log
      size.
- [ ] 5.2: Write structured diagnostic logs to the mounted directory and exclude
      challenge contents, viewer codes, reconnect tokens, and authorization
      headers.
- [ ] 5.3: Add bounded log rotation and retention using the configured maximum
      retained log size.
- [ ] 5.4: Document configuration-change behavior and session loss on server
      restart.
- [ ] 5.5: Document reverse-proxy requirements for long-lived SSE.
- [ ] 5.6: Verify container permissions and production behavior for the mounted
      config directory.
- [ ] 5.7: Verify container permissions and production behavior for the mounted
      log directory.

## 6. Quality and release readiness

- [ ] 6.1: Complete keyboard, screen-reader, visible-focus, and WCAG 2.2 AA checks
      for challenge setup and DM workflows.
- [ ] 6.2: Complete keyboard, screen-reader, visible-focus, and WCAG 2.2 AA checks
      for import/export and viewer workflows.
- [ ] 6.3: Verify mobile layouts and efficient use of larger screens for challenge
      setup.
- [ ] 6.4: Verify mobile layouts and efficient use of larger screens for the
      turn-order views.
- [ ] 6.5: Add focused tests alongside each workflow, including session limits,
      authorization, inactivity expiry, SSE updates, and persistence or import
      failure cases.
- [ ] 6.6: Before pull requests, run `npm test`, `npm run lint`, `npm run check`,
      and `npm run build`; ensure CI passes.
