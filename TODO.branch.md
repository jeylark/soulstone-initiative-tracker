# Branch Plan: Stable Input Dimensions

App-wide backlog: [TODO.md](./TODO.md). This branch covers 2.20.

## Working rules

- Work only on `todo-2-20-stable-input-dimensions`; do not merge into or push
  to `main`.
- Check the worktree before editing and preserve unrelated changes.
- Add or update tests before changing app code.
- Run Prettier on edited files before lint checks.
- Tick branch steps as they are completed. Tick 2.20 in `TODO.md` only after
  every branch step is complete and verified.

## Scope

| TODO | Covered by branch steps |
| ---- | ----------------------- |
| 2.20 | 1–4                    |

Keep the rendered footprint of a `NumberInput` stable as warning and invalid
messages appear or disappear. Preserve the current input value, validation
states, and accessible message announcements. The shared `NumberInput` is used
in both initiative rolling and challenge setup, so verify both contexts.

Out of scope: changing validation rules or message wording; unrelated card,
form, or page layout changes.

## Steps

- [ ] 1. Add focused `NumberInput` tests for no message, warning, invalid, both
      messages, and transitions between those states. Confirm the input retains
      its dimensions and that active messages remain correctly associated and
      announced.
- [ ] 2. Adjust the shared form-field message layout and styles to reserve a
      consistent message area without changing the existing input width or
      minimum height. Keep inactive messages out of the accessibility tree and
      preserve support for external `aria-describedby` values.
- [ ] 3. Verify the roll-page warning/invalid states and the setup-page invalid
      state retain a stable field footprint, including narrow layouts where
      messages can wrap. Keep the existing warning and error styling.
- [ ] 4. Run focused form-control and affected page tests, then
      `npm run check`, `npm run lint`, and `npm run build`; inspect the diff and
      tick 2.20 in `TODO.md` only if all checks pass.

## Verification

- Component tests cover each message combination and changes between states.
- Confirm message visibility, `role`, and `aria-describedby` behavior are
  unchanged.
- Manually inspect initiative rolling and challenge setup at desktop and mobile
  widths to confirm messages do not resize or displace their input fields.
