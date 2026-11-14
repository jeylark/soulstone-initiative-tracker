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

## Before commiting changes

- Run `npx prettier --write` on every changed file.

## UI Layout Lessons

- Svelte scopes selectors in a component's `<style>` block, but a plain `.css`
  file imported by a component is global. Put shared class rules in a dedicated
  stylesheet that owns those class names; use explicit `class` props for
  caller-owned child styling, and avoid `:global()`.
- When a Card renders a visible heading around a fieldset, keep the fieldset
  legend for accessible group naming but visually hide it to avoid duplicate
  titles. When changing shared Card styles, audit every Card/fieldset wrapper
  and ensure page-level legend rules do not override the hidden state.
- When a grid layout has unexpected gaps or extra rows, inspect the rendered
  child order, including wrappers around actions. A visually empty wrapper can
  still consume a grid cell; scope layout fixes to the affected component
  variant.
- In compact form grids, account for wrapped labels and controls overlaid near
  the fields. Reserve space for overlays and keep label rows a consistent
  height when inputs need to align.
- CSS source assertions can guard layout rules, but they do not prove rendered
  geometry. Use focused tests and verify the affected view in a browser when
  available.