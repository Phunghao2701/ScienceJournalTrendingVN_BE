---
title: "Codex Goal"
kind: "codex-goal"
created_at: "2026-06-30T07:13:18.070Z"
source: "repo-harness-mcp"
---
# Codex Goal

## Source of truth

- PRD: `plans/prds/20260630-1412-paper-vn-analysis-entity-filter-semantics-corrective.prd.md`
- Checklist Sprint: `plans/sprints/20260630-1413-paper-vn-analysis-entity-filter-semantics-corrective.sprint.md`
- Reference repo: `ScienceJournalTrendingVN_FE` (read-only comparison source)

## Role

Codex is the executor. ChatGPT/repo-harness may prepare planning artifacts, but implementation ownership stays in the local Codex session.

## Scope

- Open or use an isolated worktree for the sprint implementation.
- Execute the checklist Sprint task cards in order.
- Update the Sprint checklist as phases complete.
- Stage each completed phase before continuing to the next phase.
- Do not modify the reference repo or ignored secrets/ops state.

## Required workflow

1. Read the PRD and Sprint paths above before editing.
2. Build the P1/P2/P3 map required by repo-local AGENTS.md for non-trivial changes.
3. Execute one checklist task card at a time.
4. After each phase, run the relevant focused checks, update the checklist, and stage the completed slice.
5. Continue until the Sprint checklist is complete or a real blocker is reached.
6. Leave a concise handoff with staged state and verification evidence.

Work on existing BE branch hao/refactor/BE. Preserve unrelated dirty/staged changes. This sprint must run before the FE corrective sprint. Add shared institution_id support to list, lightweight analytics and analysis through buildArticleFilter. Institution filtering must use Article→Author_Article→Author(non-deleted)→Institution_Author where year=Article.publication_year→Institution(non-deleted); never use last_known_institution. Fix topic_id filtering so it matches either Article.primary_topic or an Article/Topic pair in Sub_Topic, matching the Analysis ranking semantics and deduplicating articles naturally through EXISTS. Start with failing tests, keep parameter ordering deterministic, update both discovery and analysis contract docs, perform only read-only Supabase smoke checks, stage each phase, and do not migrate, commit or push.

## Required checks

- Run the checks named by the Sprint task card.
- At sprint closeout, run repo-required checks unless the Sprint narrows the verification surface with a stated reason.

## Done when

- The checklist Sprint is complete.
- Every completed phase is staged.
- Checks pass or failures are documented with exact blocker evidence.
- No commit is created unless the user explicitly asks for commit.

## Host-native /goal prompt

```text
/goal
Read: plans/prds/20260630-1412-paper-vn-analysis-entity-filter-semantics-corrective.prd.md
Open or use a worktree and complete: plans/sprints/20260630-1413-paper-vn-analysis-entity-filter-semantics-corrective.sprint.md
After each completed phase, stage the result before continuing.
Use the user's language for status reports unless repo-local instructions require otherwise.
Reference repo: ScienceJournalTrendingVN_FE
```
