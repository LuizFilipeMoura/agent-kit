# PR descriptions that lower the reviewer's load

Status: accepted, 2026-10-29. Replaces rule 15 (file maps) and changes how rules 4, 5, 12, 14 and 17 reach a PR body.

## Problem

PR bodies written under the current rules are long and hard to review. Measured on three real PRs (a small one, a medium one and a very large one in one stack):

| | Small | Medium | Very large |
|---|---|---|---|
| Code change | +214, 8 files | +2,001, 71 files | +21,822, 258 files |
| Body words | 3,527 | 6,217 | 9,033 |
| Stack map, merge order and deploy gate, copied into every PR | 51% | 29% | 19% |
| Branch history (rebuilds, rebases, review rounds) | 9% | 11% | 15% |
| Checks and review notes | 8% | 9% | 13% |
| The opening paragraph | 6% | 3% | 4% |

The opening paragraph, 3 to 6% of each body, was already close to what a reviewer needs. Everything after it buried that paragraph.

The agents did not write badly. They obeyed every rule at once, and several rules push content into the body:

- Rule 12 asks for every flow drawn from the code paths, with file and function names.
- Rule 14 asks for the schema shown readable.
- Rule 4 asks for every carried fix to be named.
- Rule 5 (and project overlays) asks for every waiver to be carried into the description, and the review settles its own findings by editing the description ("resolved by this description").
- Rule 17 asks for verification output to be shown.
- Rule 15 adds a file map on top.

A body also gets longer with each update, because agents append instead of rewriting.

## Goal

A reviewer who opens the PR can, with the least effort:

1. **Agree with the idea:** see how the system works differently, in domain words.
2. **Check the code does it:** jump from each claim to the code that enforces it and the test that proves it.
3. **Judge whether it is safe to ship:** see the rollout risk, the costs accepted, and what nobody verified.

The reader is a developer reviewer: knows the codebase, not this change.

## Design

### 1. New kit skill `pr-description`, required by new rule 18

Every PR body is written, and rewritten on every update, with the `pr-description` skill. Rule 15 is retired (its number stays reserved, with a pointer to 18).

**Rule 18 text (draft):** Every PR body follows the `pr-description` skill: it leads with how the system works differently, in the project's domain words, and gives the reviewer what the diff cannot. Rebuild the body from scratch on every update; never append. Branch history goes in a PR comment, not the body.

### 2. The body is a projection of the agreed plan

The model a PR describes was agreed before code: in the grilling (rule 2), the glossary and ADRs (domain-modeling) and the diagram page (rule 12). The skill builds the body from those artifacts plus the current diff, and says where the result differs from the plan. It does not reconstruct the model from the diff at PR time.

### 3. Three PR kinds, three shapes

The agent picks the kind first. Omit any section that has nothing to say.

**Model change** (the system's rules or ownership change):

1. Opening: one to three sentences on what the system does differently and why.
2. New terms: one line each, linked to the glossary.
   Decisions made: a numbered list, one line per decision, the decision in a few words and its ADR link, nothing else: no why, cost, rejected alternative or decider ("no ADR" when there is none). (A "Decisions you might push back on" section with why, cost, rejected and decided by was tried on the pilot and dropped: it repeated the rule table, the risk notes and the ADRs, and "decided by" was always the same person.)
3. **The rule table,** the spine of the body:

   | Rule | Before | After |
   |---|---|---|
   | Who moves an order's status | any line item | only the order's fulfilment, through one gate |

   The table and the prose use domain words only. No file names here and no file-by-file list under it: "Look first" is the only place that ties rows to code.
4. Diagrams: one map diagram of the concepts (entities, ownership, lifecycles, who may move what). Any further diagram zooms into one node of the map and must show something the table cannot. No cap, but every diagram has to pass that test.
5. What changes for people: user, operator and API-consumer behaviour, including what is newly refused and any cost a decision accepted.
6. For the reviewer:
   - **Look first:** 3 to 5 entry points, each a link to the file at the PR's head, the table rows it enforces, and the spec that proves them.
   - **Risk and rollout:** migration, deploy order, what breaks if done wrong.
   - **Temporarily wrong until:** anything this PR leaves incomplete on purpose, and which PR completes it.
   - **Not verified by anyone:** one line.
7. Stack position and counterpart PR: one line each, linking to the stack's home (section 5).

Target: about 800 to 1,000 words plus diagrams for the largest changes.

**Behaviour addition** (one new behaviour inside the existing model): what it does, why, what it deliberately does not do, look first, risk if any. No diagram unless the flow is not obvious. Target: 150 to 350 words.

**Bundle of fixes** (independent fixes in one PR): one opening line, then one row per fix (symptom before, behaviour after, where), then one line naming the fixes that carry real behaviour and saying the rest are trivial. Target: about 60 words per fix.

### 4. Never in the body

- Branch history: rebuilds, rebases, replays, review rounds, finding ids, commit SHAs, "Simplified on". History goes in a PR comment (section 6).
- File-by-file inventories, commit lists, restating the diff.
- Checks tables and command output. Rule 17's proof goes in the chat report and the ledger; the body keeps only the "not verified" line.
- Waiver lists. The ledger is committed in the PR; the body names only waivers a reviewer must act on, one line each.
- Review findings "resolved by this description". Findings are settled in code, the ledger or a comment.
- Agent housekeeping: Jest orphan cleanup, typecheck baselines, worker caps.
- Empty sections ("Carried fixes: none", "No database writes").
- Content copied from other PRs (section 5).

### 5. Stack content has one home

The stack map, merge order and deploy gate live in one place: a GitHub tracking issue for the stack, created by `pr-workflow` once the stack has 2 or more PRs and linked from every PR in it. Each PR's body gives one line: where it sits, what it depends on, what ships with it. A single PR with a deploy gate keeps the gate in its own risk-and-rollout section.

### 6. History comment on each push that changes the story

After a push that changes what the PR does (a rebuild, a dropped piece, a new decision), post one short comment: what changed since the last review, which rows of the rule table changed, and a compare link between the two heads. A pure restack with an identical diff gets one line or nothing. The body is rebuilt in place, so it always describes the end state.

### 7. Cold-read check before publishing

Before opening the PR or saving a rebuilt body, a fresh Haiku subagent gets only the body and `git diff --stat`. It must:

1. restate in three sentences how the system works differently;
2. list the costs or behaviour changes a reviewer might object to;
3. name the riskiest place to look;
4. say what was not verified;
5. quote every sentence about how the branch or PR came to be (earlier PRs it replaces, rebuilds, "unchanged", "earlier design"). Each one is moved to the history comment.

If any answer misses or contradicts the author's intent, rewrite and run it again, at most 3 tries. After 3 misses, stop and show the user what the reader misunderstood. The result is reported in chat, not in the body. This is a skill step, not a hook: length and content stay guidance, and the cold read is the check that the guidance worked.

### 8. Diagram page (rule 12) shifts to concepts first

`diagram-page` keeps the planning-time HTML page, but each page leads with the concept map (entities, ownership, lifecycles, rules). Code-path diagrams with file and function names become a secondary section. Its "PR descriptions" section is replaced with a pointer to `pr-description`: the PR body draws from the page's concept diagrams, not from every flow.

### 9. Changes to the other rules

| Rule | Change |
|---|---|
| 4 stacked PRs | Carried fixes stay named in the body, one line each (what and why). Stack map and merge order move to the stack's tracking issue. |
| 5 survivable review | The ledger stays committed in the PR. `survivable-code-review` stops settling findings by editing the description. |
| 6 status report | Drop the file-map link. |
| 12 diagrams | Concept first (section 8). |
| 14 schema changes | Still shown before implementing, on the page and in chat. In the body, the data shape appears only as concepts in the rule table and map; the full schema stays on the page and in the ADR. |
| 15 file map | Retired. |
| 17 done means verified | Proof goes in the chat report and ledger; the body keeps one "not verified" line. |

### 10. Removals

- `skills/pr-file-map/` is deleted.
- `skills/pr-workflow`: step 3 says "write the body with `pr-description`"; step 5 (file map) is removed; step 6 drops the map link; "After a lower PR changes" drops "rebuild their file maps".
- `hooks/guard.js`: the reminder after a PR is opened no longer mentions the file map. The reminder after a push becomes "if the PR's story changed, rebuild its body with `pr-description` and post a history comment; rebase the PRs stacked above it". `guard.test.js` follows.
- `AGENTS.md` "At a glance" and the hooks paragraph drop rule 15 and add rule 18. README rows follow.
- `tools/pr-maps/` stays only for `teardown.js`, to remove maps already published, then goes in a later change.

### 11. Project overlays

Project `AGENTS.md` overlays add only their specifics:

- the glossary and ADR folder that supply the domain words;
- where the stack's tracking issue lives if not GitHub;
- any change-management evidence the project's compliance needs (for example SOC 2), and confirmation that the committed ledger and CI provide it, since the body no longer carries checks and waivers.

## Acceptance

- The skill holds three worked examples, one per PR kind, with invented names (the kit is public).
- A pilot PR is written with the skill, passes the cold-read check, and the user approves its body before it goes live.
- After the change, no kit file mentions file maps except the retired rule 15 line and `tools/pr-maps/teardown.js`.
- `node --test hooks/guard.test.js` passes.

## Out of scope

- PR size. A description cannot remove the load of a very large diff. Curating commits so each one covers one row of the rule table, with a link from the row to its commit's diff, is worth a separate proposal.
- A hook that measures length. Rejected for now; the cold read is the check.
