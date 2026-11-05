# Branch Plan: Turn Order View

App-wide backlog: [TODO.md](./TODO.md). Completing this branch ticks 2.3, 2.5,
2.6, 2.7, 2.15 and 2.18 there.

## Working rules (apply to every session)

- Stay on the current branch (`turn-order-view`) for all work; do not create or
  switch branches, and never merge into or push to `main`. Check the worktree for
  uncommitted changes before editing.
- Write tests before implementation, and run Prettier on edited files when done.
- Tick the matching box in this file as each step finishes.
- Tick an item in [TODO.md](./TODO.md) only once every branch step listed for it
  in the Scope table is done and verified. Do not tick partially finished items.

## Scope

| TODO | Covered by branch steps |
| ---- | ----------------------- |
| 2.3  | 3                       |
| 2.5  | 2, 3                    |
| 2.6  | 2, 3                    |
| 2.7  | 4                       |
| 2.15 | 3                       |
| 2.18 | 5                       |

Out of scope: ties (2.10–2.12), read-only view (2.8), Spawn (2.13–2.14),
animation (2.16), roll-card names (2.17), turn-order layout checks (6.4).

## Steps

- [x] 1. Extract `creatureName` and turn-label logic from the roll page into a
      shared module under `src/lib/challenge`, with a turn-ID lookup for creature,
      faction, label and hidden state. Roll page behavior and tests unchanged.
      Document all exports.
- [x] 2. (2.5, 2.6) Add a generation helper wrapping `generateTurnOrder`: returns
      the order, the turns with missing roll results (blocking generation), or the
      `TurnOrderError.turnIds`. Unit tests for all three outcomes.
- [x] 3. (2.3, 2.5, 2.6, 2.15) Add the route
      `/challenges/[challengeId]/run` with title "Turn order": load from
      IndexedDB with loading, not-found and error states, "Return to home"
      recovery and the saved `generatedTurnOrder`
      if present. Add "Generate turn order" / "Recalculate": save
      `runState.generatedTurnOrder` with the queued-save pattern and `hasSaveError`
      alert, keep `initiativeResults`, and list turns with invalid placement or
      missing results.
- [x] 4. (2.7) Render the order as numbered cards in faction colors with creature
      and turn labels; drop unknown turn IDs and prompt to recalculate.
- [ ] 5. (2.18) Add per-creature hide/show saving `isHidden`; hidden turns stay
      visible, greyed out and labeled "Hidden" in text. Reuse the setup hide/show
      logic.
- [ ] 6. Add "Continue to turn order" on the roll page that saves pending edits
      first; make sure any result or setup change that invalidates the order
      clears `generatedTurnOrder`.
- [ ] 7. Run `npm test`, `npm run check`, `npm run lint` and `npm run build`;
      inspect the diff; tick the finished items in `TODO.md`.

## Verification

- Route tests: load states, generate, recalculate, restore after reload, error
  listing, hide/show, results preserved.
- Manual: new challenge, setup, roll, turn order, reload, direct URL.
