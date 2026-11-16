# Repository instructions

Follow these instructions for every task in this repository.

## Before changing files

- Check if there are any uncommitted changes in the working tree. If so, ask
  the user on how to proceed with them.
- Never merge into or push to `main`.
- Check if the current branch has an appropriate name for the task and, if not,
  suggest to the user a new branch to create and switch to.
- Before doing any additions or changes to the code, clarify the expected
  behavior and write appropriate tests. Do not write app code while the
  expected behavior is unclear.
- App behavior and architecture is documented in
  [PROJECT_DECISIONS.md](./PROJECT_DECISIONS.md). Refer to these, but when in
  doubt check back with the user. Update the documentation when new decisions
  are made.
  If decisions are made concerning the app's behavior
- Try to split large changes into separate edits that are also commited
  individually.
- Do not run app-wide `npm run check`, `npm run lint` or `npm test`. This will
  be done later by the CI. If necessary, reconfirm with the user if the command
  should be ran.

## Coding guidelines

- Public API documentation is mandatory for every exported symbol, including
  paramters, return types, generics and each public field. When making changes
  to such a symbol, verify that the documentation is still valid.
- Keep helpers module-private when they are not intended for use outside their
  module.
- Prefer clear names and simple designs. Keep functions and components focused,
  avoid duplication.
- Keep component-private classes and their styles within the owning component.
  A component `<style>` block should style classes owned by that component.
  Shared `.css` files may define reusable classes for multiple components.
  Do not use `:global()` in Svelte styles. Explicit `class` props are allowed:
  the component that passes the class owns and styles it.
- Use PascalCase for types, camelCase for identifiers and UPPER_SNAKE_CASE for
  constants.
- Prefix names of booleans with `is`, `are`, `has`, `have` or `can`.
- Write acronyms as words.
- Function parameters must be strictly read-only. Functions must be pure and
  have no side-effects.
- Use strict types and handle errors explicitly. Address compiler diagnostics
  rather than suppressing or bypassing them.
- Keep third-party dependencies to a minimum; suggest using one only when it
  provides clear value and get permission from the user before including them.
- Target WCAG 2.2 Level AA, including semantic markup, keyboard operability,
  visible focus, and support for assistive technologies.
- Make the app usable on mobile devices. Use available space on larger screens
  where possible.
- Every production module and UI component must have its own colocated test
  file covering behavior owned by that unit. Integration tests supplement but
  do not replace module- or component-owned tests.
- Write comments to explain non-obvious intent, not to restate the code.

## After implementation

- Review the session for learnings that could reduce future agents' workload,
  and add any useful learnings to this file's Lessons section.
- Run `npx prettier --write` on every changed file.

# Lessons

## UI Layout Lessons

- Shared form alignment requires parent-owned tracks as well as participating child markup; place custom controls directly inside `FormGroup` and keep each visual row's label, control, and feedback tracks independent.
- `FormGroup` wraps based on available container width. For wider controls, configure `--form-group-min-column-width` and gaps on an owning ancestor instead of replacing its grid or relying on viewport breakpoints; defaults are 160px minimum and 20px column gap.
- JSDOM can verify form-group structure and accessible associations, but not CSS subgrid geometry; verify rendered alignment separately in a browser.
- Svelte scopes selectors in a component's `<style>` block, but a plain `.css`
  file imported by a component is global. Put shared class rules in a dedicated
  stylesheet that owns those class names; use explicit `class` props for
  caller-owned child styling, and avoid `:global()`.
- A scoped selector targeting only a class passed to a child component can be reported unused and omitted by Svelte. Check compiler warnings and, where appropriate, pass styling through inherited CSS custom properties set on a parent-owned element.
- When a Card renders a visible heading around a fieldset, keep the fieldset
  legend for accessible group naming but visually hide it to avoid duplicate
  titles. When changing shared Card styles, audit every Card/fieldset wrapper
  and ensure page-level legend rules do not override the hidden state.
- When a grid layout has unexpected gaps or extra rows, inspect the rendered
  child order, including wrappers around actions. A visually empty wrapper can
  still consume a grid cell; scope layout fixes to the affected component
  variant.
- When a wrapper exists only to carry styling around an absolutely positioned
  control, and has no semantic or layout role of its own, make it
  `display: contents` in the owning reusable component so it does not consume
  flow space or a grid cell. Prefer this shared behavior over caller-specific
  wrapper classes and CSS overrides.
- In compact form grids, account for wrapped labels and controls overlaid near
  the fields. Reserve space for overlays and keep label rows a consistent
  height when inputs need to align.
- Prefer generalized customizations over element-specific fixes.
- CSS source assertions can guard layout rules, but they do not prove rendered
  geometry. Use focused tests and verify the affected view in a browser when
  available.

## Architecture and Code Organization Lessons

- Before planning route-specific content in the shared header, trace the owning page's state, validation, and save handlers; moving the controls must preserve those behaviors and their lifecycle.
- A layout-scoped Svelte context can expose a page-owned snippet to the header without global state. Clear the registered snippet by identity on teardown so an older page cannot remove newer header content, and provide for standalone page tests.

## Data and State Management Lessons

- Keep the complete validation issue set as the source for workflow blocking. Derive filtered presentation lists for inline fields and summaries so display changes cannot accidentally make an invalid workflow available.

## Accessibility and Interaction Lessons

- When tabs cannot be selected, expose and visibly distinguish their unavailable state for both validation failures and temporary navigation locks; restore availability when the lock clears.
- Before relying on shared disabled-control styles or theme colors, verify that the rendered control carries the required class and that the CSS variables are defined in both themes.
- Text inside a tab contributes to its accessible name even when visually clipped and referenced with `aria-describedby`; use an explicit `aria-label` when the tab's name must remain stable and expose supplemental status through its description.

## Testing and Verification Lessons

- In UI tests, query current semantic roles and names or rendered classes. A stale selector can pass vacuously without checking the visible UI; assert against the actual region or control that owns the behavior.
- When tab selection awaits persistence, wait for the destination panel or selected state before asserting that the previous panel's local state was cleared; `fireEvent.click` alone does not await the full async transition.
- When testing layout CSS with stylesheet-source assertions, also assert that the rendered owning element carries the class targeted by the selector; otherwise an unused rule can pass the test.
- Make CSS-source assertions tolerant of whitespace and line wrapping so Prettier formatting does not break otherwise valid tests.
- Testing Library's `DEBUG_PRINT_LIMIT` limits individual DOM dumps, not complete role listings or timeout errors. Test the actual Vitest failure output when changing diagnostic formatting; async queries can wrap an earlier error again.

## Runtime and Error Handling Lessons

## Tooling and Workflow Lessons

- After running Prettier on a large existing test file, inspect the diff for unrelated legacy reflows and avoid broadening the change.
- When type-aware ESLint reports that a source file is missing from the project service after dependency installation, run `npm run prepare` to generate SvelteKit's project metadata before changing parser configuration.

## Documentation and Decision Lessons
