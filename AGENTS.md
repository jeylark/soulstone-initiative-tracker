# Repository instructions

Follow these instructions for every task in this repository. See
[PROJECT_DECISIONS.md](./PROJECT_DECISIONS.md) for product, architecture, and
detailed coding guidelines.

## Before changing files

- Check the current branch and worktree before editing.
- Do implementation work on a task-specific branch; never merge into or push to
  `main`. If the current branch is unsuitable, create or switch to the task
  branch before editing.
- Preserve existing work. Do not switch branches if doing so could move,
  overwrite, or obscure uncommitted changes; ask the user how to proceed if the
  work cannot be safely isolated.
- Clarify the expected behavior and identify relevant tests. For app changes,
  add or update tests before changing implementation. For documentation-only
  changes, tests are not needed unless the repository provides documentation
  tests.

## Before finishing

- Run the relevant checks. Before submitting a pull request, run `npm test`,
  `npm run lint`, and `npm run check`; also run `npm run build` when changes
  affect the production build or deployment.
- Inspect the final diff and confirm only task-related changes are included.
- Report the exact checks run and their results. Clearly disclose failures,
  skipped checks, and environment blockers; do not describe an unverified result
  as passing.
