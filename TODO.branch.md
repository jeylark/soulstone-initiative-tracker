# Branch Plan: Initiative Collection

## Completed

- [x] Move challenge setup to `/challenges/{id}/setup`.
- [x] Keep `/challenges/new` as a draft initializer that redirects to setup with the challenge and reusable characters in SvelteKit page state.
- [x] Validate route identity and provide recovery when setup state is unavailable or mismatched.
- [x] Preserve setup state when navigating through browser history.

## Remaining

1. Add `/challenges/{id}/roll` as a separate running-challenge view. Validate that the route ID matches the challenge carried in page state; show a clear recovery action if the state is missing or mismatched.
2. Add a **Start Challenge** action to setup and an explicit return-to-setup action from rolling. Pass the latest challenge and reusable characters through page state on both transitions.
3. Collect results for every turn configured as `roll/manual`, including turns whose creature kind normally uses app rolling. Display the creature and turn identity and prefill any existing result.
4. Accept any non-negative integer initiative value without an upper bound. Values above 18 remain valid and display a non-blocking warning. Empty, negative, fractional, and otherwise invalid values must not be stored as results.
5. Store valid values in the challenge's in-memory `runState.initiativeResults`, keyed by stable turn ID. Clear a result when its input is cleared or becomes invalid; preserve other results when changing one turn.
6. Add focused tests for Start Challenge handoff, eligible turns, existing values, valid edits, clearing and invalid values, the warning above 18, route-ID validation, missing-state recovery, and returning with the latest state.

## Verification

- Run focused route tests for setup and rolling.
- Run `npm run check` and ESLint on all changed files.
- Run Prettier checks on changed files.
- Manually verify `/challenges/new` to setup to roll to setup, reload restoration, and direct URL or new-tab recovery.

## Out Of Scope

- IndexedDB setup saving/restoration (TODO 1.11) and persisted run state/resume (TODO 2.9).
- App-rolled NPC initiative (TODO 2.2).
- Turn-order generation, rerolls, tie resolution, DM order controls, and read-only views (TODOs 2.3-2.8).
