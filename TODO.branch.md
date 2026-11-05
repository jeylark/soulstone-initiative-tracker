# Branch Plan: Initiative Collection

## Completed

- [x] Move challenge setup to `/challenges/{id}/setup`.
- [x] Keep `/challenges/new` as a draft initializer that saves the new challenge to IndexedDB and redirects to setup without page state.
- [x] Load setup data from IndexedDB only, never from page state; show loading, not-found, and load-error states with recovery.
- [x] Autosave setup edits to IndexedDB.
- [x] Add `/challenges/{id}/roll` as a separate running-challenge view.
- [x] Add a **Roll Initiatives** action that saves pending setup edits before navigating to rolling, and an explicit return-to-setup action that only navigates. The roll view reads the latest challenge from storage.
- [x] Collect results for every turn configured as `roll/manual`, including turns whose creature kind normally uses app rolling. Display the creature and turn identity and prefill any existing result.
- [x] Accept any non-negative integer initiative value without an upper bound. Values above 18 remain valid and display a non-blocking warning. Empty, negative, fractional, and otherwise invalid values must not be stored as results.
- [x] Store valid values in the challenge's `runState.initiativeResults`, keyed by stable turn ID. Clear a result when its input is cleared or becomes invalid; preserve other results when changing one turn.
- [x] Persist collected initiative results to IndexedDB and restore them when resuming a challenge, preserving other run-state values.
- [x] Add focused tests for Roll Initiatives navigation, eligible turns, existing values, valid edits, clearing and invalid values, the warning above 18, loading the challenge from storage, save and load recovery, reload restoration, and returning to setup.
- [x] Add an optional initiative stat to reusable player characters and expose it in setup; require a positive whole number when a character has an app-roll turn.
- [x] Make setup readiness extensible with structured issues, show initiative-stat problems, and block Roll Initiatives until those issues are fixed.
- [x] Preserve character initiative stats through IndexedDB saves and challenge/library JSON import and export.

## Data Flow

- Read challenge and reusable-character data from IndexedDB (the stored library), keyed by the route ID. Do not read it from SvelteKit page state, and do not pass it between views through page state.
- The roll view must load its challenge from storage, with loading, not-found, and load-error states and a recovery action, like setup.

## Remaining

- Roll every `roll/app` turn using its creature stat: NPC type initiative stat or reusable character initiative stat. Roll that many d6 and sum all dice when fewer than three are rolled, otherwise sum the highest three.
- Add a per-turn roll action and **Roll all** for app-roll turns without a saved result. Persist by stable turn ID, preserve existing results, and restore results on reload.
- Add an explicit per-turn reroll action for changing an existing result (TODO 2.4).
- Change the page's title to always display 'Initiative rolling'. Move any information currently displayed there to the view's body.

## Verification

- Run focused route tests for setup and rolling.
- Run `npm run check` and ESLint on all changed files.
- Run Prettier checks on changed files.
- Manually verify `/challenges/new` to setup to roll to setup, reload restoration, and direct URL or new-tab loading from storage.

## Out Of Scope

- Turn-order generation, tie resolution, DM order controls, and read-only views (TODOs 2.3, 2.5-2.8).
