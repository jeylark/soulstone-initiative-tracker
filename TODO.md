# Project TODOs

This backlog tracks product work from `PROJECT_DECISIONS.md`. The domain layer
already contains challenge models and validation, IndexedDB persistence,
challenge file processing, and turn-order generation; the remaining work is to
connect and complete the user-facing and server workflows around those
foundations.

## Open

### 2. Initiative and encounter play

#### Rolling

- 2.16: Add an animated "rolling" effect for initiative rolls.

### 3. Challenge library and file workflows

- 4.11: Add QR-code joining to the read-only view.

### 5. Hosting and operations

- 5.6: Verify container permissions and production behavior for the mounted
  config directory.
- 5.7: Verify container permissions and production behavior for the mounted
  log directory.

### 6. Quality and release readiness

- 6.5: Add focused tests alongside each workflow, including session limits,
  authorization, inactivity expiry, SSE updates, and persistence or import
  failure cases.
- 6.1: Complete keyboard, screen-reader, visible-focus, and WCAG 2.2 AA checks
  for challenge setup and DM workflows.
- 6.2: Complete keyboard, screen-reader, visible-focus, and WCAG 2.2 AA checks
  for import/export and viewer workflows.
- 6.3: Verify mobile layouts and efficient use of larger screens for challenge
  setup.