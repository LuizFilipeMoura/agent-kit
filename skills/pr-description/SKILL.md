---
name: pr-description
description: Write or rebuild a PR body that lowers the reviewer's load (AGENTS.md rule 18). It leads with how the system works differently, in domain words, then gives the reviewer what the diff cannot: the decisions made with their ADRs, where to look first, the rollout risk and what nobody verified. Three shapes: model change, behaviour addition, bundle of fixes. Ends with a cold-read check by a fresh Haiku subagent. Use whenever a PR is opened, its body is updated, or its story changes after a push.
---

# PR description (AGENTS.md rule 18)

The reader is a developer reviewer who knows the codebase, not this change. With the least effort they should be able to:

1. **Agree with the idea:** see how the system works differently, in domain words.
2. **Check the code does it:** jump from each claim to the code that enforces it and the test that proves it.
3. **Judge whether it is safe to ship:** see the rollout risk, the costs accepted, and what nobody verified.

## Sources

The body is a projection of what was agreed before code, not a reconstruction from the diff:

- the grilling answers (rule 2), the project's glossary and ADRs (domain words, decisions);
- the rule 12 page's concept diagrams;
- the current diff against the PR's base.

Where the code differs from the plan, say so in the body.

## Rebuild, never append

Write the whole body from scratch on every update, so it always describes the end state. History goes in a PR comment (below).

## 1. Pick the kind

| Kind | When | Target |
|---|---|---|
| **Model change** | the system's rules or ownership change | about 800 to 1,000 words plus diagrams, for the largest |
| **Behaviour addition** | one new behaviour inside the existing model | 150 to 350 words |
| **Bundle of fixes** | independent fixes in one PR | about 60 words per fix |

Omit any section that has nothing to say. Worked examples, one per kind, are in `examples/`.

## 2. Model change

1. **Opening:** one to three sentences on what the system does differently and why.
2. **New terms:** one line each, linked to the glossary. Every term used later in the body is defined here or in the glossary.
3. **Decisions made:** a numbered list, one line per decision: the decision in a few words and the ADR it links to, nothing else ("1. Shipped means carrier-accepted ([ADR-0013](…))"). No why, cost, rejected alternative or decider. Write "no ADR" when there is none. The ADRs hold the why, the cost and the rejected alternatives, so the body never repeats them.
4. **The rule table,** the spine of the body:

   | Rule | Before | After |
   |---|---|---|

   Domain words only. No file names in the table and no file-by-file list under it: "Look first" is the only place that ties rows to code.
5. **Diagrams:** one Mermaid map of the concepts (entities, ownership, lifecycles, who may move what). A further diagram zooms into one node of the map and must show something the table cannot.
6. **What changes for people:** users, operators and API consumers, including what is newly refused and any cost a decision accepted (for example "existing duplicates stay").
7. **For the reviewer:**
   - **Look first:** 3 to 5 entry points. Each is a link to the file at the PR's head (`https://github.com/<repo>/blob/<head sha>/<path>`), the table rows it enforces, and the spec that proves them.
   - **Risk and rollout:** migration, deploy order, what breaks if done wrong. A single PR keeps its deploy gate here.
   - **Temporarily wrong until:** what this PR leaves incomplete on purpose, and which PR or manual step completes it.
   - **Not verified by anyone:** one line.
   - **Your call:** a question still open for the reviewer to decide, if any.
8. **Stack and counterpart:** one line each. Where this PR sits, what it depends on, what ships with it, and a link to the stack's tracking issue (below).
9. **Carried fixes** (rule 4): one line each, what it changes and why it rides here.

## 3. Behaviour addition

What it does, why, what it deliberately does not do, "Look first", and risk if any. No diagram unless the flow is not obvious.

## 4. Bundle of fixes

One opening line, then one row per fix:

| Symptom before | Behaviour after | Where |
|---|---|---|

Then one line naming the fixes that carry real behaviour and saying the rest are trivial.

## 5. Never in the body

- Branch history: rebuilds, rebases, replays, review rounds, finding ids, commit SHAs, "unchanged", "earlier design", PRs this one replaces.
- File-by-file inventories, commit lists, restating the diff.
- Checks tables and command output. Rule 17's proof goes in the chat report and the ledger; the body keeps only the "Not verified" line.
- Waiver lists. The ledger is committed in the PR; the body names only a waiver a reviewer must act on, one line, under "Risk and rollout".
- Review findings "resolved by this description". Findings are settled in code, the ledger or a comment.
- Agent housekeeping: Jest cleanup, typecheck baselines, worker caps.
- Empty sections ("Carried fixes: none").
- Content copied from other PRs.

## 6. Stack content has one home

When a stack has 2 or more PRs, `pr-workflow` creates one GitHub tracking issue for it: the stack map, merge order and deploy gate. Every PR body in the stack links to it in one line and never copies it.

## 7. History comment

After a push that changes what the PR does (a rebuild, a dropped piece, a new decision), rebuild the body and post one short comment:

- what changed since the last review;
- which rows of the rule table changed;
- a compare link between the two heads, `https://github.com/<repo>/compare/<old sha>..<new sha>`.

A pure restack with an identical diff gets one line or nothing.

## 8. Cold-read check

Before opening the PR or saving a rebuilt body, run a fresh `general-purpose` subagent with `model: "haiku"`. Give it only the body and `git diff --stat <base>...<head>`, with this prompt:

> You are a developer reviewer who knows the codebase but not this change. Using only the PR body and diff stat below, answer:
> 1. In three sentences, how does the system work differently after this PR?
> 2. What cost or behaviour change might a reviewer object to?
> 3. Where is the riskiest place to look?
> 4. What was not verified?
> 5. Quote every sentence about how the branch or PR came to be (earlier PRs, rebuilds, "unchanged", earlier designs). The stack line and carried fixes are not history.
> 6. Quote every term this change introduces that the body uses without defining. Skip words any developer on this codebase already knows.

Compare the answers with your intent. If any answer misses or contradicts it, move each quoted history sentence to the history comment, define each unclear term, rewrite, and run a fresh reader again: at most 3 tries. After 3 misses, stop and show the user what the reader misunderstood.

Report the result in chat, never in the body.

## 9. Feedback changes the skill first

When the user corrects a PR body (a section to drop, a shape to change, a word to avoid), change this skill, its examples and the spec in `docs/specs/` in the same turn, push the kit, then rebuild the PR from the updated skill. A correction applied only to one PR is lost on the next one.

## 10. Save

`gh pr create --body-file <file>` or `gh pr edit <n> --body-file <file>`. End the body with the attribution line the session gives you.
