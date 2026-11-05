# Repository instructions

Follow these instructions for every task in this repository. See
[PROJECT_DECISIONS.md](./PROJECT_DECISIONS.md) for product, architecture, and
detailed coding guidelines.

## Before changing files

- Check the current branch and worktree before editing.
- Do implementation work on a task-specific branch; never merge into or push to
  `main`. If the current branch is unsuitable, create or switch to the task
  branch before editing, but only after confirming with the user.
- Preserve existing work. Do not switch branches if doing so could move,
  overwrite, or obscure uncommitted changes; ask the user how to proceed if the
  work cannot be safely isolated.
- Clarify the expected behavior and identify relevant tests. For app changes,
  add or update tests before changing implementation. For documentation-only
  changes, tests are not needed unless the repository provides documentation
  tests.
- Public API documentation is mandatory for every symbol exported from any
  module under `src/lib`, whether or not it is re-exported from `src/lib/index.ts`.
  For each public type, document the meaning of every property. For functions
  and constructors, document every parameter and return value, and document
  thrown errors where applicable. For exported constants containing structured data, document
  the meaning of each public field. Keep documentation updated whenever the API
  changes, and keep helpers module-private when they are not intended for use
  outside their module.

## Before finishing

- After all edits are complete, run `npx prettier --write` on every edited file before running any lint checks.
- For routine changes, run only relevant focused checks; do not run ESLint for
  every change. Before opening a pull request, run `npm test`, `npm run lint`,
  and `npm run check`; also run `npm run build` when changes
  affect the production build or deployment.
- Inspect the final diff and confirm only task-related changes are included.
- Report the exact checks run and their results. Clearly disclose failures,
  skipped checks, and environment blockers; do not describe an unverified result
  as passing.
