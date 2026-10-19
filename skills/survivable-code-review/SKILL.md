---
name: survivable-code-review
description: Strict two-lens branch review (correctness/security plus structure/quality) that is guaranteed to end. It has a closed BLOCKER list, a ledger that never re-raises settled rows, delta-only re-review, a three-pass cap and an APPROVED WITH NOTES exit. It is mandatory on every PR of a stack before the PR is pushed or opened. Use for code review, PR review, thermonuclear or thermo-nuclear review, "review this branch" and "review the stack".
---

# Survivable Code Review

This is adapted from Cursor's thermo-nuclear review skills (`cursor/plugins`, `cursor-team-kit`, MIT License, Copyright (c) 2026 Cursor; see `LICENSE` in this folder). The rigour is kept. The approval bar changes, because the original bar has no exit. It refuses to approve while any "code judo" move might exist, and the next pass always finds one. Reviews then loop forever, moving code between files.

This version keeps the original's demands. It adds three things: a closed definition of what blocks a PR, a ledger that remembers what was settled, and a hard limit on passes.

## Scope

- **One PR = one review.** The diff is the PR against its parent: `origin/<base branch>` for the bottom of a stack (the project's base branch, by default the repo's default branch), otherwise the PR branch beneath it. Use `git diff <parent>...HEAD`.
- Report only code the PR **adds or modifies**. Debt the PR did not touch is at most a NOTE marked `follow-up`. It is never a BLOCKER or a MAJOR.
- Incoming merges from the base branch or `main` were reviewed upstream. Review the conflict resolutions only.
- If the PR has a counterpart in another repo (an API contract change), read the other side's diff before filing. Never file "fine if the other side handles it" when you can open it and check.

## The two lenses

Run them as **two parallel subagents** (Agent tool, same message). Give each the parent ref, the diff, and the ledger rows already settled. Then merge the findings, dedupe them, and weigh overlaps more heavily.

### Lens A: correctness and security

Find bugs, behaviour regressions, data loss, races and non-atomic writes. Also look for security holes, feature-flag or permission leaks, and devex breaks. Devex breaks include changed env vars, secret loading, ports, or new manual setup steps. Trace side effects across modules and across the client↔server boundary. If the branch's stated intent is the breakage, and its scope is contained, do not report it. Never inflate a tier. A false BLOCKER costs more than a missed NOTE.

### Lens B: structure and quality

Keep the thermo-nuclear standards and stay ambitious about simplification. Look for:

- code-judo moves that delete whole branches, layers or modes
- files crossing 1000 lines
- ad-hoc conditionals bolted onto unrelated flows
- feature logic leaking into shared code
- thin wrappers and pass-through helpers
- `any`, `unknown`, casts or optionality that hide the real contract
- bespoke helpers where a canonical one exists
- logic in the wrong layer
- needless sequential orchestration

Apply the ponytail ladder to the diff: YAGNI → stdlib → platform → installed dependency → one line → minimum that works.

### Hygiene (both lenses, cheap)

Check for:

- debug output
- focused or skipped tests (`.only`, `.skip`, `xit`)
- localhost URLs
- committed secrets or `.env` changes
- docs added nobody asked for
- comments that restate the code

Comments that record a why, a race, an invariant or a vendor quirk stay.

## Tiers: the survivability core

Every finding gets exactly one tier.

### BLOCKER: a closed list

Nothing outside this list is ever a BLOCKER.

1. **Wrong behaviour.** Wrong output, a regression in an existing feature, data loss or corruption, a race, or a half-applied write that leaves bad state. Each needs a traced path or a concrete failing input.
2. **Security or exposure.** An auth or permission bypass, a gated feature leaking, PII or secrets exposed, or an injection.
3. **Devex break.** Local build, run, test or seed stops working without a documented new step.
4. **Size.** The PR pushes a file from ≤1000 lines to >1000 lines. Spec files count.
5. **Spaghetti in shared code.** The PR scatters feature-specific checks or special-case branches into a shared or unrelated flow. Feature-specific means `if (provider === …)`, `if (isSpecialCustomer)` and the like.
6. **Broken build.** Typecheck, lint, or the existing tests the PR touches fail.

### MAJOR: structural, must be resolved but may be waived

Code-judo restructurings, duplicated logic, the wrong layer, an unnecessary abstraction, cast or `any` churn, a near-duplicate of a canonical helper, avoidable non-atomic orchestration, and missing tests for new behaviour.

**A missed simplification is a MAJOR at most, however good it is.** Each MAJOR ends **fixed** or **waived**. Every waiver needs a one-line reason, for example "pattern predates the branch; follow-up", "two instances only; extract on the third", or "different semantics on purpose". Waiving is a legitimate outcome, not a failure.

### NOTE: never blocks

Naming, small legibility points, follow-ups and pre-existing debt. Keep at most 5 NOTEs per pass and drop the weakest.

## Admission rules for a finding

A finding is filed only if it has all four of these:

- **Evidence**: `file:line`, plus the traced path or the failing input for Lens A.
- **A concrete remedy**: what to change, not "consider improving".
- **A done-when**: the observable condition that closes the row. Examples: "spec back under 1000 lines", "one `findExistingPerson` caller", "test X fails before and passes after".
- **A net win.** The remedy fixes behaviour, or it removes concepts, branches, files or lines. A remedy that only **moves** code without reducing what a reader must hold in their head is a NOTE.

It must also pass two guards:

- **Flip-flop guard.** A finding must not reverse a fix recorded in an earlier pass. If you think an earlier fix was wrong, file a NOTE that names the row and leave it to the user.
- **Re-raise guard.** A `fixed`, `waived` or `moot` row is never filed again. The one exception is when new code in this pass reintroduces the problem; then cite the old row ID in the new claim.

## The ledger

The ledger file is `docs/reviews/<branch-name-with-slashes-as-dashes>.md`, committed in the PR it covers. A branch keeps one ledger across passes, and IDs keep counting up across passes (`TNR-001`, `TNR-002`, …).

```markdown
# Review ledger: <branch> (<repo>)

## Pass N (YYYY-MM-DD): <parent-or-last-reviewed-sha>..<head-sha>

<Scope in one or two sentences. Hygiene result. Which settled rows were checked and still hold.>

After fixes: <exact commands run and their results, e.g. `tsc --noEmit` clean, touched suites pass>.

Verdict: **APPROVED WITH NOTES**. <one line: which BLOCKERs were fixed, what is waived>

| ID | Tier | Claim | Location | Status | Resolution |
|---------|---------|-------|----------|--------|------------|
| TNR-001 | BLOCKER | ... | file.ts:42 | fixed | <sha> (<what changed>) |
| TNR-002 | MAJOR | ... | file.ts | waived | <one-line reason> |
| TNR-003 | NOTE | ... | file.ts | open | follow-up |
```

Each row has one of four statuses:

- `open`
- `fixed`, with the commit sha
- `waived`, with a reason
- `moot`, when the code was deleted for another reason

## Passes and the exit

1. **Pass 1** reviews the whole PR diff with both lenses.
2. **The author resolves** every BLOCKER and every MAJOR. Fix BLOCKERs. Fix or waive each MAJOR. NOTEs are optional. Fixes preserve behaviour unless the row is a bug. Run typecheck, lint and the touched tests, then record the shas in the ledger.
3. **Pass 2 and 3 are delta-only.** Review only `last-reviewed-sha..HEAD` (the fix commits) and the rows still open. Do not sweep the whole PR again. A new BLOCKER is allowed only when the fix commits introduced it. Anything else found late goes in as a NOTE.
4. **The cap is three passes.** After pass 3, every open MAJOR and NOTE becomes `waived (pass cap)`. If a BLOCKER is still open, stop. Report it to the user with the rows and do not start pass 4 unless they ask.

### Verdict

The verdict comes mechanically from the ledger. It is never a judgement call.

| Verdict | Condition | PR may be pushed or opened |
|---|---|---|
| **APPROVED** | every row is `fixed` or `moot`, or there are no rows | yes |
| **APPROVED WITH NOTES** | no open BLOCKER and no open MAJOR, plus at least one `waived` row or one open NOTE | yes |
| **CHANGES REQUESTED** | any open BLOCKER or open MAJOR | no |

APPROVED WITH NOTES is a pass. Do not start another pass to turn it into APPROVED.

## Stacks

- Review bottom-up. Each PR is reviewed against its own parent and gets its own ledger.
- A fix belongs in the PR that **introduced** the problem. Commit it there, then rebase the PRs above it. A descendant's review never files rows that belong to an ancestor's diff. If one is spotted, add it to the ancestor's ledger instead.
- Every PR in the stack needs APPROVED or APPROVED WITH NOTES before the stack is pushed. A rebase that only replays already-reviewed commits does not need a new pass. Conflict resolutions made during the rebase do.

## Report back

Return the verdict, the counts (fixed / waived / open by tier), and one line per BLOCKER. Point to the ledger path. Do not paste the whole table into chat.
