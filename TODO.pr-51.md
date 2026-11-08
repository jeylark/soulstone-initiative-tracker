# PR #51 TODO

## Run View

### PR51-08: Recalculate Action

- [x] Remove the Recalculate button in Run view.

**Completion (2026-11-08):** `RunPanel.svelte` now hides order generation after a
generated order is saved, including after reload. The unknown-turn warning no
longer suggests recalculation, and a failed generation save restores the prior
run state. Updated `RunPanel.spec.ts` to cover the behavior.

Checks: focused `RunPanel.spec.ts` on Node 26 (22 passed); `npm run check`;
focused ESLint; Prettier; secret scan. A Node 22 test attempt failed because the
existing turn-order implementation uses `Map.getOrInsert`; CI uses Node 26.

**Main TODO:** 2.21 remains Open because its **Start challenge** label change was
not part of this task.
