# Spawn Editing Implementation Handoff

Implementation plan for TODO **2.13** and **2.14**, researched on 2026-11-08.
The approved branch is `feat/spawn-challenge-editing`, created from
`todo-2.30-lock-running-edits` with a clean worktree. No application implementation
has been performed. This document is the handoff for later sessions.

## Session Instructions

- Read [AGENTS.md](AGENTS.md), [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md),
  this document, and the relevant entries in [TODO.md](TODO.md).
- Recheck the branch, worktree, and current code before editing. Observations here
  are not guaranteed future state. Preserve other work; ask before switching or
  creating another branch. Never merge into or push to `main`.
- Implement the steps below in order, with **one separate commit per step**.
  Later sessions should resume at the first unchecked step, not repeat completed
  work. Do not implement beyond the scope authorized for that session.
- Write or update owning colocated tests before changing application code. Reuse
  existing test files and helpers. After the first substantive change, run its
  focused test before reading or editing adjacent implementation areas.
- Keep exported API documentation under `src/lib` complete, including all public
  properties, parameters, return values, and applicable thrown errors. Keep
  implementation-only helpers private.
- Format every edited file with `npx prettier --write` before lint checks. Use
  focused checks for routine steps; inspect the final diff and stage only that
  step's changes. Do not revert or commit unrelated work.
- Check off a step only after its acceptance checks pass. Add a completion record
  with date/session, changed files, exact checks/results, manual checks, skipped
  checks, blockers, and commit hash. Record the hash in a subsequent completion
  note when necessary; do not amend a commit just to insert its own hash.
- Move only fully completed matching tasks from Open to Done in [TODO.md](TODO.md),
  retaining their original numbers and wording. Do not mark 2.13 or 2.14 complete
  merely because model or UI groundwork is finished.

## Confirmed Behavior

- Run has an **Edit Challenge** button, enabled only when Spawn is current and
  editing is not already active.
- Clicking it starts explicit Spawn editing and opens Setup. Merely reaching
  Spawn does not unlock anything.
- Editing permits adding and removing creatures, NPC types, and turns.
- Existing configuration fields remain locked. Newly added creatures, NPC types,
  and turns can be configured. Existing creatures can gain or lose turns.
- Challenge settings and faction creation, removal, and configuration stay locked.
- Roll permits collecting previously missing initiatives and resolving ties.
  Results already collected before editing remain unchanged. App results cannot
  be rerolled during editing, including results just collected for new turns.
- A manual field that was missing when editing started remains editable for
  multi-digit typing and corrections until editing finishes.
- **Next turn** stays visible but disabled throughout editing.
- **Calculate Turn Order** becomes available during editing. Successful
  calculation and saving finish editing, relock Setup and Roll, and enable Next
  turn. Validation or save failure leaves editing active.
- Calculation leaves Spawn current and preserves the completed Spawn count.
  Only the later Next turn action completes Spawn and starts the next round.
- Unfinished editing and new-entity permissions survive a browser reload. Tab
  selection remains local; reload opens Setup under the existing page convention.
- Edits use existing autosaving. No cancel-and-rollback transaction is requested.

## Design Contract

### Saved Editing State

Add an optional, documented `spawnEdit` object to `ChallengeRunState`, containing
UUID arrays named `newCreatureIds`, `newNpcTypeIds`, `newTurnIds`, and
`lockedInitiativeTurnIds`. Its presence means editing is active. Use arrays, not
sets, in persistent data so JSON and IndexedDB share the same model.

On Edit Challenge, initialize the new-entity arrays empty and populate
`lockedInitiativeTurnIds` from existing initiative-result keys. Record new IDs as
entities are created, including a newly created creature's automatic first turn.
Prune removed IDs from every relevant array. Validate UUID syntax, uniqueness,
appropriate entity references, and locked result references. Malformed readable
progress should remain diagnosable through the existing Setup recovery pathway.

Preserve initiative results, valid tie decisions, and `spawnCount`. Replace the
completed round's generated order with a single Spawn entry while editing. This
pending order keeps Spawn current and avoids dangling references when creatures
or turns are removed. Validate that active editing requires this Spawn-only order.
Do not delete that order in Setup or Roll mutation handlers during editing.

Update every explicit run-state sanitizer, copier, JSON path, and fresh-ID import
copy path so editing metadata is preserved or correctly remapped. The optional
field's absence must preserve existing behavior. Follow the repository's
development-format policy; establish any released-format compatibility requirement
before adding migration machinery.

### Entering and Finishing

Run owns explicit editing entry and calculation. Coordinate with the parent page
for navigation and shared saving state. Save entry before opening Setup. Block tab
switches and relevant mutations during explicit transition saves so another panel
cannot edit a state that may be rolled back.

Reuse `prepareTurnOrder` with collected results and tie decisions. Its fresh
order ends with Spawn; move that Spawn to the front without calling `advanceTurn`.
Remove editing metadata from the proposed completed state, save it, and relock
controls only after successful saving. Save failure restores the prior editing
state. Do not increment `spawnCount` on entry or calculation.

Reuse the existing Next turn advancement and hidden-turn skipping after editing
finishes. Its handler must also guard against advancing while editing, not rely
only on the disabled button.

### Mutation Permissions

Setup needs per-control permissions instead of a single blanket disabled fieldset.
Pass capabilities through the existing editor hierarchy, and guard callbacks as
well as native controls. Keep removals and additions outside disabled existing
configuration groups; disabling an existing creature must not disable Add turn.

Reuse removal confirmations and transitive dependent-turn cleanup. Delete removed
initiative-result keys and prune invalid tie decisions without losing unaffected
decisions. Keep the pending Spawn entry throughout mutations.

New configuration changes may invalidate affected newly collected results. Do
not clear results for unchanged existing entities. Ensure the component-local NPC
type default is initialized from available types after mounting or reload.

Roll unlocks only for explicit editing. Per-turn permissions must use the result
lock boundary recorded at entry, not just `newTurnIds`: a pre-existing turn may
also have a missing result. Roll all continues to fill missing app results only.
Distinguish disabled editing from invalid initiative stats in status messages.

### Locked-Configuration Edge Cases

- Adding another NPC of a type whose existing sole NPC has a blank identifier
  would invalidate that locked identifier. Do not silently rename or unlock it.
  Reject the addition without changing the challenge and show an actionable error;
  the DM can use another type or remove and recreate the existing NPC. Newly added
  NPC identifiers remain editable. Test this across factions.
- Adding or removing a relative hook can make an existing sibling index invalid.
  Do not silently normalize locked indices. Keep generation blocked and expose
  existing validation errors; the DM can revise the new placement or remove and
  recreate affected turns. Test valid additions as well as this restriction.
- A new app-rolled turn on an existing character still requires a valid existing
  initiative stat. Do not unlock that character's stat as a side effect. The new
  turn can instead use manual initiative or another valid placement.

## Implementation Steps

### SPAWN-01: Persist Editing Permissions

- [x] Complete and commit `feat: persist spawn editing state`.

**Dependencies:** None. Do not unlock UI controls in this step.

**Files:** [model.ts](src/lib/challenge/core/model.ts),
[validation.ts](src/lib/challenge/core/validation.ts),
[raw-sanitizer.ts](src/lib/challenge/core/raw-sanitizer.ts),
[challenge-copy.ts](src/lib/challenge/files/challenge-copy.ts),
[challenge-files.ts](src/lib/challenge/files/challenge-files.ts), and their
existing colocated tests. Reuse file and storage tests for round-trip coverage.

**Work:** Implement the saved-state contract, documented public types, strict and
readable validation, sanitizer fields, independent deep copies, and fresh-ID
remapping. In the import-copy path, remap creature/type arrays through the entity
ID map and turn/result-lock arrays through the turn ID map.

**Acceptance:** Cover absent metadata; all four arrays surviving raw sanitization,
typed copying, JSON round trip, and IndexedDB reload; malformed shapes; duplicate,
missing, and wrong-kind references; invalid pending order; and fresh-ID imports.
Copies must not share mutable arrays with the source. Existing saved challenges
without metadata must still load unchanged.

**Gate:** Focused core, file, and storage tests; format edited files;
`npm run check`; inspect the step diff before committing.

**Completion:** 2026-11-08, Copilot session on branch `feat/spawn-edit-state`
(the named `feat/spawn-challenge-editing` was checked out in another worktree).
Commit `32d5316`. Changed: `model.ts` (`SpawnEditState`, `runState.spawnEdit`),
`validation.ts` (shape, duplicate/missing/wrong-kind references, Spawn-only order;
reference and order problems stay readable), `raw-sanitizer.ts`, `challenge-copy.ts`,
`challenge-files.ts` (fresh-ID remap), and colocated core/files/storage specs.
Checks: `npx vitest run src/lib/challenge` (15 files, 299 tests passed);
`npm run check` (0 errors); `npx prettier --check` on edited files passed.
Manual checks: none (no UI). Skipped: `npm test`/`npm run lint`/`npm run build`
(pre-PR only). Blockers: none.

### SPAWN-02: Run Editing Transitions

- [x] Complete and commit `feat: add Spawn editing controls to Run`.

**Dependencies:** SPAWN-01.

**Files:** [RunPanel.svelte](src/routes/challenges/%5BchallengeId%5D/RunPanel.svelte),
[RunPanel.spec.ts](src/routes/challenges/%5BchallengeId%5D/RunPanel.spec.ts),
[+page.svelte](src/routes/challenges/%5BchallengeId%5D/+page.svelte), and
[+page.spec.ts](src/routes/challenges/%5BchallengeId%5D/+page.spec.ts).

**Work:** Add Edit Challenge, entry saving and Setup navigation, transition locks,
Next turn guards, and Calculate Turn Order during editing. Preserve the existing
initial Generate turn order action outside editing. Reuse generation errors;
clear stale errors on a fresh edit entry. Complete editing transactionally while
keeping Spawn first. Setup and Roll remain locked until their later steps.

**Acceptance:** Cover disabled entry outside Spawn; no automatic unlock at Spawn;
entry metadata and save-before-navigation; entry save failure; locked Next during
editing/saves; missing-result, unresolved-tie, and placement failures; calculation
save failure restoring editing; successful calculation preserving results/count;
no-op editing; repeated editing at the same Spawn; empty and hidden-turn orders.
Advancing after completion must count Spawn exactly once.

**Gate:** Focused RunPanel and page tests; formatting; `npm run check`; step diff.

**Completion:** 2026-11-08, Copilot session on branch `upgraded-spoon`. Changed:
`RunPanel.svelte` (Edit Challenge, entry save before Setup navigation, guarded Next
turn, Calculate Turn Order completing editing with Spawn first), `+page.svelte`
(tab switches blocked during transition saves, `onTabChange` wiring), and their
specs. Checks: `npx vitest run "src/routes/challenges/[challengeId]"` (167 tests
passed); `npm run check` (0 errors); eslint on edited files clean; prettier applied.
Not covered: no-op/empty/hidden-turn edge tests beyond existing generation tests.
Manual checks: none. Skipped: `npm test`/`npm run build` (pre-PR only). Blockers: none.

### SPAWN-03: Restricted Setup Controls

- [x] Complete and commit `feat: enable restricted Spawn setup editing`.

**Dependencies:** SPAWN-02.

**Files:** [SetupPanel.svelte](src/routes/challenges/%5BchallengeId%5D/SetupPanel.svelte),
[SetupPanel.spec.ts](src/routes/challenges/%5BchallengeId%5D/SetupPanel.spec.ts),
the existing CreatureSetup, FactionEditor, CreatureEditor, TurnEditor, and
NpcTypeEditor components under `src/routes/challenges/[challengeId]/setup`, and
their existing integration tests. Modify shared components only if their existing
APIs cannot express the required disabled states.

**Work:** Propagate scoped permissions; unlock add/remove actions and new fields
only. Record creation IDs, including default turns. Preserve focus-after-add.
Initialize the NPC creation default on reload. Reuse cascade confirmation and
cleanup; prune result keys, tie decisions, and metadata after removals. Preserve
pending Spawn order when new configuration changes invalidate results.

**Acceptance:** Existing fields remain visibly disabled and callback-guarded;
new entries are configurable; Add turn works for existing creatures; settings
and faction controls stay locked; reload preserves new-entry permissions; adding
and removing the last NPC type updates defaults; cascade acceptance cleans all
references; cancel changes nothing; unaffected results/ties survive. Cover the
locked-configuration edge cases above.

**Gate:** SetupPanel tests and each touched editor's owned integration tests;
formatting; focused diagnostics; step diff. App-wide `npm run check`, lint, and
test are deferred to CI per the current repository instructions.

**Completion:** 2026-11-08, Copilot session on branch `feat/spawn-challenge-editing`.
Changed: SetupPanel and ChallengeSettings scoped locks; per-entity permissions in
CreatureSetup, FactionEditor, CreatureEditor, TurnEditor, and NpcTypeEditor;
creation/removal ID tracking, result/tie cleanup, pending-order preservation,
NPC default initialization and locked blank-identifier protection; focused
SetupPanel and setup-editor integration coverage. Checks: focused setup Vitest
suite (7 files, 98 tests passed); editor/source diagnostics (no errors);
`git diff --check` (clean); Prettier applied to every changed file. Manual
checks: none; desktop/mobile interaction is reserved for SPAWN-05. Skipped:
app-wide `npm run check`, `npm run lint`, and `npm test` per AGENTS.md. Blockers:
none. Commit: `1b23456`.

### SPAWN-04: Missing Initiatives and Ties

- [x] Complete and commit `feat: collect missing initiatives during Spawn edits`.

**Dependencies:** SPAWN-02. Sequential sessions should finish SPAWN-03 first to
avoid overlapping shared-file edits. Integration requires both steps.

**Files:** [RollPanel.svelte](src/routes/challenges/%5BchallengeId%5D/RollPanel.svelte),
[RollPanel.spec.ts](src/routes/challenges/%5BchallengeId%5D/RollPanel.spec.ts),
[InitiativeFactionSection.svelte](src/routes/challenges/%5BchallengeId%5D/roll/InitiativeFactionSection.svelte),
[InitiativeTurnCard.svelte](src/routes/challenges/%5BchallengeId%5D/roll/InitiativeTurnCard.svelte),
and their existing colocated tests. Reuse existing tie-resolution APIs/tests.

**Work:** Add per-turn collection permissions and correct disabled-state messages.
Keep previously collected manual values locked; allow typing/correction for
initially missing manual values. App-roll handlers require a missing result and
cannot reroll a newly collected result. Enable tie resolution while editing;
preserve pending Spawn order in initiative and tie handlers.

**Acceptance:** Collect missing results for new and pre-existing turns; preserve
baseline results; multi-digit manual entry works; app results lock after rolling;
Roll all fills only missing app results; invalid-stat messages are not shown just
because a result is locked; ties can be resolved; valid decisions survive while
affected decisions are discarded; normal running remains fully locked.

**Gate:** RollPanel and touched initiative/tie component tests; formatting;
`npm run check`; step diff.

**Completion:** 2026-11-08, Copilot session on branch `feat/spawn-missing-initiatives`.
Changed: `RollPanel.svelte` (per-turn locks from `lockedInitiativeTurnIds`, no rerolls
while editing, pending Spawn order preserved, **Roll all** renamed **Roll all
remaining**), `InitiativeFactionSection.svelte`, `InitiativeTurnCard.svelte`
(`isInputLocked`/`isRollLocked`), and their specs. Checks: `npx vitest run
"src/routes/challenges/[challengeId]"` (184 tests passed); prettier applied.
`npm run check` reports 5 pre-existing errors in SetupPanel.svelte and
TurnEditor.integration.spec.ts (SPAWN-03 files), none in touched files. Manual
checks: none. Blockers: none.

### SPAWN-05: Integration and Product Documentation

- [ ] Complete and commit `test: verify and document Spawn editing workflow`.

**Dependencies:** SPAWN-03 and SPAWN-04.

**Files:** Existing challenge page integration tests and fixtures,
[PROJECT_DECISIONS.md](PROJECT_DECISIONS.md), [TODO.md](TODO.md), and this handoff.

**Work:** Exercise Spawn -> Edit Challenge -> Setup -> Roll -> Run -> Calculate
Turn Order -> Next turn. Verify persisted reloads, results, removals, failure
recovery, and count behavior. Document the editing exception and saved state.
Move only completed 2.13 and 2.14 to Done with their exact original wording.

**Acceptance:** Reload mid-edit retains permissions and locks; invalid setup,
missing results, unresolved ties, and failed saves cannot finish editing or
advance play; successful calculation relocks Setup/Roll and stays at Spawn;
Next increments the count once and skips hidden turns as before. Verify desktop,
mobile, keyboard access, disabled controls, and focus after navigation/additions.
Disclose manual checks that could not be performed.

**Gate:** Focused challenge-route and affected domain tests; formatting;
`npm run check`; final task-related diff. Before opening a PR, also run
`npm test`, `npm run lint`, `npm run check`, and `npm run build` as required by the
repository. Record exact results rather than assuming earlier checks cover them.

**Completion:** Not started.

## Focused Check Commands

Use narrower touched-file tests first where possible. These filters are available
for step-level coverage:

```powershell
npx vitest run src/lib/challenge/core src/lib/challenge/files src/lib/challenge/storage
npx vitest run src/routes/challenges
npm run check
```

Format the actual edited file list with `npx prettier --write` before linting.
Quote paths containing `[challengeId]` and verify literal-path handling on Windows.
Do not create a commit when focused checks are failing or the diff contains other
work. No application tests are required for creating this documentation-only
handoff, and none have been run for it.

## Scope Boundaries

Do not implement full reset/cancel transactions, editing existing configuration
or collected results, faction/settings editing, live viewers or server features,
animations, Previous turn navigation, or the global Start challenge rename.
Do not silently complete 2.30, 2.21, 2.22, or unrelated backlog items through this
work. Existing generation, tie, visibility, and advancement algorithms should be
reused; change them only when a focused test exposes a required invariant.
