# Branch Plan: Initiative Collection

## Completed

- [x] Move challenge setup to `/challenges/{id}/setup`.
- [x] Keep `/challenges/new` as a draft initializer that saves the new challenge to IndexedDB and redirects to setup without page state.
- [x] Load setup data from IndexedDB only, never from page state; show loading, not-found, and load-error states with recovery.
- [x] Autosave setup edits to IndexedDB.
- [x] Add `/challenges/{id}/roll` as a separate running-challenge view.
- [x] Add a **Roll Initiatives** action that saves pending setup edits before navigating to rolling, and an explicit return-to-setup action that only navigates. The roll view reads the latest challenge from storage.
- [x] Collect results for every turn configured as `roll/manual`, including turns whose creature kind normally uses app rolling. Display the creature and turn identity and prefill any existing result.

## Data Flow

- Read challenge and reusable-character data from IndexedDB (the stored library), keyed by the route ID. Do not read it from SvelteKit page state, and do not pass it between views through page state.
- The roll view must load its challenge from storage, with loading, not-found, and load-error states and a recovery action, like setup.

## Remaining

1. Accept any non-negative integer initiative value without an upper bound. Values above 18 remain valid and display a non-blocking warning. Empty, negative, fractional, and otherwise invalid values must not be stored as results.
2. Store valid values in the challenge's `runState.initiativeResults`, keyed by stable turn ID. Clear a result when its input is cleared or becomes invalid; preserve other results when changing one turn. Persisting run state to storage and resuming it remains TODO 2.9.
3. Add focused tests for Roll Initiatives navigation, eligible turns, existing values, valid edits, clearing and invalid values, the warning above 18, loading the challenge from storage, not-found and load-error recovery, and returning to setup.

## Verification

- Run focused route tests for setup and rolling.
- Run `npm run check` and ESLint on all changed files.
- Run Prettier checks on changed files.
- Manually verify `/challenges/new` to setup to roll to setup, reload restoration, and direct URL or new-tab loading from storage.

## Out Of Scope

- Persisted run state/resume (TODO 2.9).
- App-rolled NPC initiative (TODO 2.2).
- Turn-order generation, rerolls, tie resolution, DM order controls, and read-only views (TODOs 2.3-2.8).
