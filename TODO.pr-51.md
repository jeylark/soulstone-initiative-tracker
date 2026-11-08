# PR #51 TODO

Implementation handoff for [PR #51](https://github.com/jeylark/soulstone-initiative-tracker/pull/51),
whose head branch was verified as `laughing-goggles` on 2026-11-08.
This file tracks the requested changes, not completed implementation.

## Session Instructions

- Read [AGENTS.md](AGENTS.md), [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md),
  this file, and relevant entries in [TODO.md](TODO.md) before implementation.
  Recheck the code and branch: the observations below describe discovery on
  2026-11-08, not guaranteed future state.
- Check the branch and worktree before editing. Use an approved task-specific
  branch appropriate for PR #51. Ask before creating or switching branches;
  preserve unrelated work and never merge into or push to `main`.
- Write or update owning colocated tests before changing app code. Make small
  coherent changes and immediately run focused validation. Reuse existing tests
  and integration helpers rather than creating duplicate test files.
- **After finishing overlapping work, update [TODO.md](TODO.md): move the fully
  completed matching task from Open to Done under its existing category,
  preserving its number and exact wording. Never delete completed tasks.**
  For a partial overlap, leave the main task Open and record the completed subset
  and remaining work here. Existing Done tasks stay Done.
- Check off a PR item only after its acceptance checks pass. Under that item,
  record the date/session, changed files, exact checks and results, manual checks,
  main TODO entries moved to Done, remaining overlap scope, and blockers.
- Update public API documentation for changed exports under `src/lib`, including
  every property, parameter, return value, and applicable thrown error. Keep
  implementation-only helpers private.
- Update [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md) when product or model rules
  change. Released data-format changes require migrations; unreleased development
  changes do not. Establish release/compatibility requirements before replacing
  the relative-placement schema, and ask before expanding migration scope.
- Format every edited file using `npx prettier --write` before any lint checks.
  Routine sessions use focused checks, not full-repository ESLint by default.
  Inspect the final diff and report exact results, including skipped checks.

## Session Order

1. Setup validity: PR51-01 and PR51-04, independently testable.
2. Add-entity focus: PR51-02, independent of setup validity.
3. Placement: PR51-03 followed by PR51-06. Coordinate the hook schema, editor,
   validation, algorithm, copy/import handling, and fixtures in one coherent session.
4. Turn-card display: PR51-05, PR51-10, PR51-11, and PR51-12 share a component.
5. Card whitespace: PR51-07; shared form changes have a broader validation scope.
6. Run controls/layout: PR51-08 and PR51-09, preferably after card simplification.

Do not implement unrelated Spawn editing, viewer streaming, setup/roll locking,
reset workflows, or new navigation controls as part of these items.

## Setup

### PR51-01: Blank NPC Identifiers

- [x] Allow blank NPC identifiers.

  - 2026-11-08 (Copilot session, branch `literate-goggles`). Changed:
    `setup-validation.ts`, `setup-validation.spec.ts`, `SetupPanel.spec.ts`,
    `PROJECT_DECISIONS.md`.
  - Checks: `npx vitest run src/routes/challenges src/lib/challenge` and prettier
    on edited files (results below).
  - Main TODO entries moved to Done: none. Remaining overlap: none. Blockers: none.
  - Note: existing `createTurnDisplayLookup` already trims combined names; the add
    handler is unchanged, so a saved blank is never auto-renamed.

**Behavior:** Accept an empty or whitespace-only identifier only when that NPC
is the sole creature of its NPC type in the entire challenge, across factions.
When a type has multiple NPCs, every identifier must be nonblank and unique,
ignoring case and surrounding whitespace. Other required names stay required.

**Implementation:** [setup-validation.ts](src/lib/challenge/core/setup-validation.ts)
currently rejects all blank NPC identifiers in `validateChallengeSetup`. Count
instances by `creatureTypeId` and apply the singleton exception. Existing duplicate
checks alone are insufficient: one blank plus one named NPC must also fail.
Revalidate when adding/removing NPCs or changing types. Do not silently rename an
existing blank identifier on addition; show the validation issue for correction.
Verify names/target labels show the type name without trailing whitespace;
`createTurnDisplayLookup` already trims the combined name in
[turn-display.ts](src/lib/challenge/initiative/turn-display.ts).

**Tests:** [setup-validation.spec.ts](src/lib/challenge/core/setup-validation.spec.ts)
and [SetupPanel.spec.ts](src/routes/challenges/%5BchallengeId%5D/SetupPanel.spec.ts).
Cover singleton empty/whitespace, blank plus named NPC, two blanks, separate types,
cross-faction instances, one-to-two and two-to-one transitions, type changes, and
saved/reopened valid blank identifiers. Update display-owned tests if needed.

**Main TODO:** No exact Open match.

### PR51-02: Focus After Addition

- [x] Upon adding an entity, focus/select its first field after the Remove button.

**Completion (2026-11-08):** Changed `SetupPanel.svelte` (`focusNewEntity` after each add), `data-entity-id` on the
faction, NPC type, creature, and turn editors, and `SetupPanel.spec.ts`. Checks: `npx vitest run src/routes/challenges`
(17 files, 141 tests passed); `npm run check` (0 errors). Not manually checked. Main TODO 6.1 stays Open; this
covers only its focus-after-add subset. Remaining: full keyboard, screen-reader, visible-focus, and WCAG checks.
No blockers.

**Behavior:** Focus the new entity's first enabled editable field and select its
text when native selection is supported. Apply to factions, NPC types, characters,
NPCs, and explicitly added turns. Do not steal focus on load, unrelated rerenders,
or automatically created nested default turns.

**Implementation:** Coordinate add handlers in
[SetupPanel.svelte](src/routes/challenges/%5BchallengeId%5D/SetupPanel.svelte) with
[EntityList.svelte](src/lib/components/EntityList.svelte),
[EntityListItem.svelte](src/lib/components/EntityListItem.svelte), and setup editors.
Use the new stable entity ID and wait for Svelte rendering, rather than global
autofocus. The first controls are faction name, NPC type name, character name,
NPC type select, and Turn initiative select respectively. Focus selects without
attempting unsupported text-selection calls.

**Tests:** Extend existing list-owned specs if shared behavior changes, plus
[SetupPanel.spec.ts](src/routes/challenges/%5BchallengeId%5D/SetupPanel.spec.ts)
and affected editor integration specs. Cover all five entity kinds, keyboard Add,
existing siblings, disabled Add, automatic default turns, and no focus on load or
unrelated rerenders.

**Main TODO:** Partial overlap with 6.1. Move it to Done only after its full
setup/DM keyboard, screen-reader, visible-focus, and WCAG checks are complete;
otherwise record this subset and leave it Open.

### PR51-03: Redundant Direction Inputs

- [ ] Remove Relationship and Count from inputs.

**Confirmed behavior:** Keep the Turn initiative choices Fixed position from top,
Fixed position from bottom, Before another turn, and After another turn. Remove
only the separate controls that repeat these choices. Keep Position and Target
turn; keep model `from` and `relation` fields.

**Implementation:** Remove the duplicate SelectInput blocks in
[TurnEditor.svelte](src/routes/challenges/%5BchallengeId%5D/setup/TurnEditor.svelte).
Remove now-unused `fixed-from` and `relative-relation` edit events from
[challenge-setup-types.ts](src/routes/challenges/%5BchallengeId%5D/setup/challenge-setup-types.ts)
and [SetupPanel.svelte](src/routes/challenges/%5BchallengeId%5D/SetupPanel.svelte).
Direction changes remain supported through `setTurnInitiative`.

**Tests:** [TurnEditor.integration.spec.ts](src/routes/challenges/%5BchallengeId%5D/setup/TurnEditor.integration.spec.ts)
and SetupPanel's tests: duplicate controls absent, all four choices update model
direction correctly, and saved/imported selections still render correctly.

**Main TODO:** No exact Open match.

### PR51-04: Zero Initiative Stat

- [x] Allow 0 as initiative stat.

  - 2026-11-08, branch `reimagined-succotash`. Changed: `initiative-roll.ts`,
    `setup-validation.ts`, `RollPanel.svelte`, `CreatureEditor.svelte`,
    `NpcTypeEditor.svelte`, and their specs (`initiative-roll`, `setup-validation`,
    `RollPanel`, `CreatureSetup.integration`).
  - Checks: `npx vitest run src/lib src/routes` — 448 passed. Not run: lint, check, build.
  - Structural validation (`validation.ts`) only requires finite numbers; unchanged.
  - Main TODO entries moved to Done: none. Remaining scope/blockers: none.

**Behavior:** Accept zero for NPC types and optional character stats. Rolling zero
dice returns 0 without calling the random source. Negative, fractional, nonfinite,
and unsafe-integer stats remain invalid. App-rolled characters still need a stat.

**Implementation:** Update positive-only checks in setup validation,
[RollPanel.svelte](src/routes/challenges/%5BchallengeId%5D/RollPanel.svelte)'s
`initiativeStat`, and `rollInitiative` in
[initiative-roll.ts](src/lib/challenge/initiative/initiative-roll.ts).
Update input minima, error messages, and API documentation in affected editors.
Inspect structural validation for consistency; do not assume it enforces setup rules.

**Tests:** [initiative-roll.spec.ts](src/lib/challenge/initiative/initiative-roll.spec.ts),
setup validation, affected editor integration tests, and
[RollPanel.spec.ts](src/routes/challenges/%5BchallengeId%5D/RollPanel.spec.ts).
Cover zero without randomness, single/roll-all paths, persisted results, zero ties,
and continued rejection of invalid/missing values.

**Main TODO:** No exact Open match. Done 2.2 is extended behavior, not a task to reopen.

## Hook Placement

### PR51-06: Adjacent Hooks and Sibling Ordering

- [ ] Fix hooked turns separated from their target; replace Distance with sibling Index.

**Confirmed behavior:** Remove Distance entirely. A single hook is adjacent to its
target and does not show or require an index. Multiple hooks sharing both
`targetTurnId` and `relation` require unique contiguous indices `1..N`.
Index 1 is nearest the target: after is `target, 1, 2`; before is `2, 1, target`.
Before and after groups are separate, and grouping is challenge-wide.

**Current evidence:** `SetupPanel.setTurnInitiative` creates `distance: 1`;
[turn-order.ts](src/lib/challenge/initiative/turn-order.ts) places an after hook at
`targetIndex + 1 + distance`, leaving an intervening turn. Existing tests define
distance zero as adjacent. This is a product/schema change, not just an off-by-one
patch. Later sequential hook insertions may also split previously placed hooks;
write a regression test rather than assuming a default change solves everything.

**Implementation:** Replace relative `distance` with an optional sibling index
(suggested model field: `index`) in `TurnInitiative` and `HookedTurn`. Validate
conditional group requirements in setup and generation, with field issues and
affected turn IDs. Show Index only for groups larger than one. Adding/removing
hooks or changing target/direction must update requirements and invalidate stale
generated order. Preserve valid indices; missing, duplicate, or gapped indices
block generation rather than being silently repaired.

Use dependency-aware sibling ordering instead of independent distance splices.
Preserve chained hooks, missing-target/cycle rejection, fairness ordering,
fixed-position behavior, and final Spawn. Ensure unrelated later insertions cannot
separate attached relative groups. Nested hook subtrees and conflicts with fixed
absolute positions need explicit fixtures and a documented resolution rule;
confirm any behavior change to fixed placement before implementing it.

**Coordinated files:**
[model.ts](src/lib/challenge/core/model.ts),
[validation.ts](src/lib/challenge/core/validation.ts),
[setup-validation.ts](src/lib/challenge/core/setup-validation.ts),
[turn-order.ts](src/lib/challenge/initiative/turn-order.ts),
[challenge-copy.ts](src/lib/challenge/files/challenge-copy.ts), TurnEditor,
CreatureEditor, SetupPanel, and setup change types. Update product documentation:
relative spacing/clamping no longer applies; fixed-position clamping remains.
Preserve stable IDs, collected results, and tie decisions.

**Compatibility gate:** Inspect storage/import paths and establish whether released
format data must remain usable before editing readers. If required, agree the
migration first. Do not silently reinterpret old `distance` as `index`; their
meanings differ. Update unreleased fixtures directly under repository policy.

**Tests:** [turn-order.spec.ts](src/lib/challenge/initiative/turn-order.spec.ts),
core model/validation specs, setup integration specs, RunPanel fixtures,
[challenge-copy.spec.ts](src/lib/challenge/files/challenge-copy.spec.ts), and
[challenge-files.spec.ts](src/lib/challenge/files/challenge-files.spec.ts).
Cover singleton adjacency; siblings on both sides; mixed directions/cross-faction
groups; missing, zero, negative, fractional, duplicate and gapped indices;
one-to-two/two-to-one transitions; changed targets; hooked targets/chains;
later insertions; fixed boundaries; cycles/missing targets; copy remapping;
and file roundtrips. Search for remaining distance fixtures before finishing.

**Main TODO:** No exact Open match. Keep documented behavior consistent with
already-Done 2.5 and 2.6 without reopening or duplicating them.

## Turn Cards

### PR51-05: Initiative Values

- [x] Display rolled initiatives in turn cards.

  - 2026-11-08, PR51 session order 4. Changed: `turn-display.ts`,
    `turn-display.spec.ts`, `Turn.svelte`, new `Turn.spec.ts`,
    `RunPanel.svelte`, `RunPanel.spec.ts`, and `turn-order.ts`.
  - Checks: focused Vitest run (3 files, 30 tests passed); turn-list integration
    test (1 passed). Replaced unsupported `Map.getOrInsert` usage found while
    exercising the Run view under Node 22 with equivalent standard Map access.
  - Manual checks: none. Main TODO 2.24 moved to Done because turn names are
    already prominent card headings and numeric initiatives now display.
  - Remaining overlap/blockers: none.

**Implementation:** Reuse the display pipeline in
[turn-display.ts](src/lib/challenge/initiative/turn-display.ts) and pass initiative
metadata to [Turn.svelte](src/routes/challenges/%5BchallengeId%5D/run/Turn.svelte).
For rolling turns, use saved `runState.initiativeResults` by turn ID and show 0
using an explicit undefined check. Static numeric values can also be displayed to
complete TODO 2.24. Hooks/Spawn have no fabricated numeric result. Rendering must
never reroll or change saved results.

**Tests:** [turn-display.spec.ts](src/lib/challenge/initiative/turn-display.spec.ts),
[Turn.integration.spec.ts](src/routes/challenges/%5BchallengeId%5D/run/Turn.integration.spec.ts),
and RunPanel's tests. Cover manual/app/static values, zero, missing results,
multiple turns with distinct values, restored/rotated order, and hooks/Spawn.

**Main TODO:** 2.24. After finishing, move it to Done only if both numeric initiative
and prominent creature name requirements are satisfied; otherwise leave it Open.

### PR51-10: Hidden Label

- [x] Rename the hidden control's visible label to Hidden.

  - 2026-11-08, PR51 session order 4. Changed: `Turn.svelte`, `Turn.spec.ts`,
    and `RunPanel.spec.ts`.
  - Checks: focused Vitest run (2 files, 27 tests passed).
  - Manual checks: none. Main TODO unchanged; 2.18 was already Done.
  - Remaining scope/blockers: none.

**Implementation:** Turn currently labels CheckboxInput
`Hidden from viewers: {creatureName}`. Change visible text to `Hidden`, retaining
contextual accessible naming through native attributes or heading associations.
Preserve checked state, creature-wide visibility, persistence/rollback, and greyed
hidden cards. Remove redundant status text only without losing state accessibility.

**Tests:** Turn and RunPanel's existing tests: short visible label, contextual
accessible names, multiple creatures/turns, saved visibility, and save-failure rollback.

**Main TODO:** No exact Open match; 2.18 is already Done.

### PR51-11: Order Indices

- [x] Remove index from turn cards.

  - 2026-11-08, PR51 session order 4. Changed: `Turn.svelte`, `Turn.spec.ts`,
    `RunPanel.spec.ts`, and `TurnList.integration.spec.ts`.
  - Checks: focused Vitest run (2 files, 28 tests passed).
  - Manual checks: none. Main TODO 2.25 remains Open because multi-turn title
    suffixes are intentionally unchanged.
  - Remaining scope/blockers: no order-index labels remain on turn or Spawn cards.

**Implementation:** Remove visible position spans for creature turns and Spawn,
and their unused CSS in Turn. Retain position metadata if other callers need it.
Do not mistake initiative values for positions. Multi-turn `- Turn N` title suffixes
are distinct from order indices and are not automatically removed by this item.

**Tests:** Turn and RunPanel's existing tests: no visible order-index markup/text,
including Spawn, while numeric initiatives remain visible.

**Main TODO:** Partial overlap with 2.25, which also removes turn numbers from card
titles. Move it to Done only if that requirement is already satisfied or separately
authorized and completed; otherwise record the index subset and leave it Open.

### PR51-12: Faction Text

- [x] Remove faction from turn cards.

  - 2026-11-08, PR51 session order 4. Changed: `Turn.svelte`, `Turn.spec.ts`,
    `RunPanel.spec.ts`, and `TurnList.integration.spec.ts`.
  - Checks: focused Vitest run (2 files, 29 tests passed).
  - Manual checks: none. Main TODO unchanged; faction tint and hidden styling
    remain, and faction membership data is untouched.
  - Remaining scope/blockers: none.

**Implementation:** Remove faction name text from Turn; retain faction color tint,
hidden styling, stored membership, and fairness behavior. Do not delete faction data.

**Tests:** Turn's existing tests: faction name absent, creature name present, color
tint/hidden style retained, and Spawn unaffected.

**Main TODO:** No exact Open match. Removing text does not complete 2.27's
requirement to strengthen faction colors.

### PR51-07: Bottom Whitespace

- [ ] Remove empty space at the bottom of turn cards.

**Current evidence:** [CheckboxInput.svelte](src/lib/components/forms/CheckboxInput.svelte)
always renders two `.form-control-message-slot` elements;
[form-controls.css](src/lib/components/forms/form-controls.css) gives each
`min-height: 1.3em` plus wrapper gaps. Confirm the rendered cause before editing.
Turn's hidden-status paragraph has zero bottom margin; do not change shared page
padding as a shortcut.

**Implementation:** Render message space only when messages exist, preserving
control width stability, real feedback, accessible associations, and focus/target
sizes. Checkbox-only changes must not accidentally regress other custom controls.
Completing full TODO 6.19 requires an explicitly scoped shared-control pass.

**Tests:** [CheckboxInput.spec.ts](src/lib/components/forms/CheckboxInput.spec.ts),
Turn's tests, and every changed control's owning tests. Check absent/present feedback,
width stability, hidden/nonhidden/Spawn cards, light/dark and desktop/mobile.
Real-browser height measurement is necessary; jsdom cannot validate visual spacing.

**Main TODO:** Direct overlap with 6.19. After finishing, move it to Done only if
all custom-input height reservations/empty slots in its full scope are removed and
tests updated. For a checkbox-only fix, list remaining controls and leave it Open.

## Run View

### PR51-08: Recalculate Action

- [ ] Remove the Recalculate button in Run view.

**Implementation:** [RunPanel.svelte](src/routes/challenges/%5BchallengeId%5D/RunPanel.svelte)
currently always renders generation, changing its label when saved order exists.
Hide generation while a generated order exists, including restored runs; preserve
initial generation and Next turn. Update the unknown-turn warning that currently
directs users to recalculate, without inventing a reset workflow. Do not change the
separate per-turn Calculate roll action.

**Tests:** [RunPanel.spec.ts](src/routes/challenges/%5BchallengeId%5D/RunPanel.spec.ts):
initial action present, absent after generation/reload, advancement/persistence
intact, and generation/save failures handled.

**Main TODO:** Partial overlap with 2.21, which also renames initial generation to
Start challenge. Completing that existing rename in this session would allow
moving 2.21 to Done; if it is not included, record the remainder and leave it Open.

### PR51-09: Two-Column Run Layout

- [ ] Split Run into two columns: cards right, everything else left.

**Behavior:** Left contains controls, challenge name, Spawn count, statuses,
errors, and all non-card content. Right contains the turn-order cards.
On mobile/narrow screens, stack left content before cards with usable reading
and keyboard order.

**Implementation:** Reorganize RunPanel using a responsive unframed layout;
preserve the shared ViewPage shell and reuse
[TurnList.svelte](src/routes/challenges/%5BchallengeId%5D/run/TurnList.svelte).
Do not wrap page sections in decorative cards or change saved turn order.

**Tests:** RunPanel's tests and
[TurnList.integration.spec.ts](src/routes/challenges/%5BchallengeId%5D/run/TurnList.integration.spec.ts)
for grouping/order. Check a real browser at desktop/mobile widths: columns versus
stacking, long names, errors/statuses, focus flow, no overlap or horizontal overflow,
and loading/empty/not-found/error/restored states.

**Main TODO:** Partial overlaps with 6.4 and 6.1. After finishing, move each to Done
only when its entire responsive turn-order or setup/DM accessibility scope has
been verified; otherwise record covered checks and leave it Open.

## Verification

- Run focused Vitest files with `npm run test:unit -- --run <test paths>`.
  Quote paths containing `[challengeId]` on Windows and verify the expected tests
  actually ran. Use owning tests listed above, not just broad integration coverage.
- Run `npm run check` for changed Svelte/type/model contracts. Format every edited
  file before lint. Model changes require copy/import fixture checks; shared forms
  require checks for every affected control.
- Verify card spacing, responsive layout, and keyboard accessibility in a real
  browser. Do not report jsdom-only layout checks as visual verification.
- Before submitting PR changes for review, run `npm test`, `npm run lint`,
  `npm run check`, and `npm run build` for production-affecting app changes.
  Report exact commands/results and disclose failures, skipped checks, or blockers.
- Inspect the final diff, update completed checkboxes and completion records,
  and apply the main-backlog completion instruction above. Never delete completed
  tasks from either checklist.
