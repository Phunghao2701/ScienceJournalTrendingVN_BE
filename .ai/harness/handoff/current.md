# Harness Handoff

> **Generated**: 2026-06-30 15:05:22
> **Reason**: session-stop

## Paper VN Analysis Entity Filter Semantics Corrective

Completed on 2026-06-30.

Sprint: `plans/sprints/20260630-1413-paper-vn-analysis-entity-filter-semantics-corrective.sprint.md` (Status: Completed)
PRD: `plans/prds/20260630-1412-paper-vn-analysis-entity-filter-semantics-corrective.prd.md`

### Implemented

- Added `institution_id` to list (`GET /api/v1/articles`), analytics (`GET /api/v1/articles/analytics`), and analysis (`GET /api/v1/articles/analysis`) via the shared `buildArticleFilter()`.
- Institution filter uses exact-year affiliation: `Article -> Author_Article -> Author -> Institution_Author(year=publication_year) -> Institution`, excluding soft-deleted authors and institutions.
- Topic filter (`topic_id`) now matches `Article.primary_topic` OR `Sub_Topic` (single reused placeholder, EXISTS-based, deduped — an article matching via both is counted once), aligned with how Analysis topic ranking unions primary topic and `Sub_Topic`.
- `last_known_institution` is not used anywhere in this filter.
- `articleAnalysis.service.js`'s `buildAnalysisFilter()` required no code change — `institutionId`/the topic semantics flow through automatically via its existing `...filterParams` spread into `buildArticleFilter()`.

### Verification

- Focused tests: `node --test src/tests/unit/service/article.test.js src/tests/unit/service/articleFilter.test.js src/tests/unit/service/articleAnalysis.test.js src/tests/unit/service/paperVnDiscovery.test.js` — 50/50 passed.
- Institution smoke (read-only, Supabase): `institution_id=8` — service count 14 = independent SQL count 14.
- Topic smoke (read-only, Supabase): `topic_id=50` — service count 138 = independent SQL count 138 (primary-only 41 + sub-topic-only 97 = 138, confirms dedup correctness).
- Full suite: 283/359 passed; 76 pre-existing/unrelated failures (Keyword/Project/Subject Category/Author/journal/issue controller tests, DB-mock and sandbox issues) — none reference `institutionId`, `topicId`, or `articleFilter`.
- No schema migration, production write, commit, or push performed.

### FE Contract

FE may now send `institution_id` and `topic_id` to:
- `GET /api/v1/articles`
- `GET /api/v1/articles/analytics`
- `GET /api/v1/articles/analysis`

`institution_id` pins one exact institution by exact-year affiliation (independent of `scope=vn_universities`, which can coexist). `topic_id` matches primary topic or sub-topic, deduped. Invalid `institution_id` returns `INVALID_ENTITY_ID` (400).

See `docs/researches/paper-vn-discovery-api-contract.md` and `docs/researches/paper-vn-trending-analysis-api-contract.md` for full contract details.

---

## Goal

No active plan. Continue from the latest user request and filesystem state.

## Decisions

- Use filesystem artifacts as source of truth; treat SQLite/thread state as a rebuildable read model only.

## Files Touched

```
.agents/skills/repo-harness-chatgpt-bridge/SKILL.md
.agents/skills/repo-harness-chatgpt-bridge/references/chatgpt-connector-manual.md
.agents/skills/repo-harness-chatgpt-bridge/references/workflow.md
.ai/context/capabilities.json
.ai/context/capability-source-map.json
.ai/context/context-map.json
.ai/harness/architecture/.gitkeep
.ai/harness/brain-manifest.json
.ai/harness/checks/latest.json
.ai/harness/handoff/codex-goal.md
.ai/harness/handoff/current.md
.ai/harness/planning/.gitkeep
.ai/harness/policy.json
.ai/harness/scripts/.gitkeep
.ai/harness/security/.gitkeep
.ai/harness/triage/.gitkeep
.ai/harness/workflow-contract.json
.ai/hooks/README.md
.ai/hooks/lib/minimal-change.sh
.ai/hooks/lib/session-state.sh
.ai/hooks/lib/workflow-state.sh
.claude/.skill-version
.claude/settings.json
.claude/templates/contract.template.md
.claude/templates/implementation-notes.template.md
.claude/templates/plan.template.md
.claude/templates/prd.template.md
.claude/templates/research.template.md
.claude/templates/review.template.md
.claude/templates/spec.template.md
.claude/templates/sprint.template.md
.gitignore
AGENTS.md
CLAUDE.md
deploy/README.md
deploy/env/.gitkeep
deploy/release-checklists/.gitkeep
deploy/runbooks/.gitkeep
deploy/scripts/.gitkeep
deploy/sql/.gitkeep
deploy/submissions/.gitkeep
docs/architecture/diagrams/.gitkeep
docs/architecture/domains/.gitkeep
docs/architecture/index.md
docs/architecture/modules/.gitkeep
docs/architecture/requests/.gitkeep
docs/architecture/snapshots/.gitkeep
docs/reference-configs/agentic-development-flow.md
docs/reference-configs/document-generation.md
docs/reference-configs/external-tooling.md
docs/reference-configs/global-working-rules.md
docs/reference-configs/handoff-protocol.md
docs/reference-configs/harness-overview.md
docs/reference-configs/heartbeat-triage.md
docs/reference-configs/minimal-change-hooks.md
docs/reference-configs/sprint-contracts.md
docs/researches/README.md
docs/researches/paper-vn-affiliation-scope.md
docs/researches/paper-vn-discovery-api-contract.md
docs/researches/paper-vn-trending-analysis-api-contract.md
docs/spec.md
package.json
plans/plan-implement-lens-style-article-detail-data.md
plans/plan-implement-paper-vn-discovery-backend.md
plans/plan-implement-paper-vn-entity-filters-unified-search.md
plans/plan-implement-paper-vn-lens-detail-data-citation-semantics.md
plans/prds/20260629-1246-paper-vn-discovery-scope-api.prd.md
plans/prds/20260629-1416-paper-vn-entity-filters-unified-search.prd.md
plans/prds/20260629-2040-lens-style-article-detail-data-institution-analytics.prd.md
plans/prds/20260629-2046-paper-vn-lens-detail-data-citation-semantics.prd.md
plans/prds/20260630-0323-paper-vn-trending-analysis-api.prd.md
plans/prds/20260630-1256-paper-vn-analysis-aggregation-corrective.prd.md
plans/prds/20260630-1412-paper-vn-analysis-entity-filter-semantics-corrective.prd.md
plans/sprints/20260629-1247-paper-vn-discovery-backend.sprint.md
plans/sprints/20260629-1418-paper-vn-entity-filters-unified-search.sprint.md
plans/sprints/20260629-2043-lens-style-article-detail-data.sprint.md
plans/sprints/20260629-2047-paper-vn-lens-detail-data-citation-semantics.sprint.md
plans/sprints/20260630-0323-paper-vn-trending-analysis-api.sprint.md
plans/sprints/20260630-1257-paper-vn-analysis-aggregation-corrective.sprint.md
plans/sprints/20260630-1413-paper-vn-analysis-entity-filter-semantics-corrective.sprint.md
... (99 total changed/untracked paths; inspect git status --short)
```

## Commands Run

- {"ts":"2026-06-30T15:04:15+0700","event_type":"PostToolUse","tool_name":"Edit","file_path":"e:\\Science_Journal_Trending_VN\\ScienceJournalTrendingVN_BE\\.ai\\harness\\handoff\\current.md","exit_code":0,"duration_ms":20,"session_key":"da96f23b-b189-40ca-8e7c-0f694152c5bb","run_id":"run-session-da96f23b-b189-40ca-8e7c-0f694152c5bb","host":"unknown","agent_name":"unknown","session_source":"unknown"}
- {"ts":"2026-06-30T15:04:30+0700","event_type":"PostToolUse","tool_name":"Edit","file_path":"e:\\Science_Journal_Trending_VN\\ScienceJournalTrendingVN_BE\\.ai\\harness\\handoff\\current.md","exit_code":0,"duration_ms":13,"session_key":"da96f23b-b189-40ca-8e7c-0f694152c5bb","run_id":"run-session-da96f23b-b189-40ca-8e7c-0f694152c5bb","host":"unknown","agent_name":"unknown","session_source":"unknown"}
- {"ts":"2026-06-30T15:04:42+0700","event_type":"PostToolUse","tool_name":"Bash","file_path":"","exit_code":0,"duration_ms":3979,"session_key":"da96f23b-b189-40ca-8e7c-0f694152c5bb","run_id":"run-session-da96f23b-b189-40ca-8e7c-0f694152c5bb","host":"unknown","agent_name":"unknown","session_source":"unknown"}
- {"ts":"2026-06-30T15:04:53+0700","event_type":"PostToolUse","tool_name":"Bash","file_path":"","exit_code":0,"duration_ms":3828,"session_key":"da96f23b-b189-40ca-8e7c-0f694152c5bb","run_id":"run-session-da96f23b-b189-40ca-8e7c-0f694152c5bb","host":"unknown","agent_name":"unknown","session_source":"unknown"}
- {"ts":"2026-06-30T15:05:03+0700","event_type":"PostToolUse","tool_name":"TodoWrite","file_path":"","exit_code":0,"duration_ms":0,"session_key":"da96f23b-b189-40ca-8e7c-0f694152c5bb","run_id":"run-session-da96f23b-b189-40ca-8e7c-0f694152c5bb","host":"unknown","agent_name":"unknown","session_source":"unknown"}

## Checks

- Checks file: .ai/harness/checks/latest.json
- Latest trace: .ai/harness/checks/latest.json

## Blockers

- (none recorded)

## Active Artifacts

- Active plan: (none)
- Active contract: (none)
- Active sprint row: (none)
- Review file: (none)
- Latest trace/checks file: .ai/harness/checks/latest.json
- Resume packet: .ai/harness/handoff/resume.md

## Exact Next Step

- (none)

## Resume Prompt

- Resume packet: .ai/harness/handoff/resume.md
- Start a fresh Codex session and read source artifacts first, then this handoff, before continuing; do not rely on auto-compact.

## Source Artifacts

- Spec: docs/spec.md
- Plan: (none)
- Todo Source Plan: (none)
- Contract: (none)
- Review: (none)
- Notes: (none)
- Checks: .ai/harness/checks/latest.json
- Resume Packet: .ai/harness/handoff/resume.md
- Policy: .ai/harness/policy.json
- Context Map: .ai/context/context-map.json

## Current Status

- Next action stage: none
- Next recommended action: (none)
- Working tree:  29 files changed, 3996 insertions(+), 232 deletions(-); 70 untracked files
- Parent Run ID: run-20260630T150521-579
- Supersedes: (none)

## Changed Files

```
.agents/skills/repo-harness-chatgpt-bridge/SKILL.md
.agents/skills/repo-harness-chatgpt-bridge/references/chatgpt-connector-manual.md
.agents/skills/repo-harness-chatgpt-bridge/references/workflow.md
.ai/context/capabilities.json
.ai/context/capability-source-map.json
.ai/context/context-map.json
.ai/harness/architecture/.gitkeep
.ai/harness/brain-manifest.json
.ai/harness/checks/latest.json
.ai/harness/handoff/codex-goal.md
.ai/harness/handoff/current.md
.ai/harness/planning/.gitkeep
.ai/harness/policy.json
.ai/harness/scripts/.gitkeep
.ai/harness/security/.gitkeep
.ai/harness/triage/.gitkeep
.ai/harness/workflow-contract.json
.ai/hooks/README.md
.ai/hooks/lib/minimal-change.sh
.ai/hooks/lib/session-state.sh
.ai/hooks/lib/workflow-state.sh
.claude/.skill-version
.claude/settings.json
.claude/templates/contract.template.md
.claude/templates/implementation-notes.template.md
.claude/templates/plan.template.md
.claude/templates/prd.template.md
.claude/templates/research.template.md
.claude/templates/review.template.md
.claude/templates/spec.template.md
.claude/templates/sprint.template.md
.gitignore
AGENTS.md
CLAUDE.md
deploy/README.md
deploy/env/.gitkeep
deploy/release-checklists/.gitkeep
deploy/runbooks/.gitkeep
deploy/scripts/.gitkeep
deploy/sql/.gitkeep
deploy/submissions/.gitkeep
docs/architecture/diagrams/.gitkeep
docs/architecture/domains/.gitkeep
docs/architecture/index.md
docs/architecture/modules/.gitkeep
docs/architecture/requests/.gitkeep
docs/architecture/snapshots/.gitkeep
docs/reference-configs/agentic-development-flow.md
docs/reference-configs/document-generation.md
docs/reference-configs/external-tooling.md
docs/reference-configs/global-working-rules.md
docs/reference-configs/handoff-protocol.md
docs/reference-configs/harness-overview.md
docs/reference-configs/heartbeat-triage.md
docs/reference-configs/minimal-change-hooks.md
docs/reference-configs/sprint-contracts.md
docs/researches/README.md
docs/researches/paper-vn-affiliation-scope.md
docs/researches/paper-vn-discovery-api-contract.md
docs/researches/paper-vn-trending-analysis-api-contract.md
docs/spec.md
package.json
plans/plan-implement-lens-style-article-detail-data.md
plans/plan-implement-paper-vn-discovery-backend.md
plans/plan-implement-paper-vn-entity-filters-unified-search.md
plans/plan-implement-paper-vn-lens-detail-data-citation-semantics.md
plans/prds/20260629-1246-paper-vn-discovery-scope-api.prd.md
plans/prds/20260629-1416-paper-vn-entity-filters-unified-search.prd.md
plans/prds/20260629-2040-lens-style-article-detail-data-institution-analytics.prd.md
plans/prds/20260629-2046-paper-vn-lens-detail-data-citation-semantics.prd.md
plans/prds/20260630-0323-paper-vn-trending-analysis-api.prd.md
plans/prds/20260630-1256-paper-vn-analysis-aggregation-corrective.prd.md
plans/prds/20260630-1412-paper-vn-analysis-entity-filter-semantics-corrective.prd.md
plans/sprints/20260629-1247-paper-vn-discovery-backend.sprint.md
plans/sprints/20260629-1418-paper-vn-entity-filters-unified-search.sprint.md
plans/sprints/20260629-2043-lens-style-article-detail-data.sprint.md
plans/sprints/20260629-2047-paper-vn-lens-detail-data-citation-semantics.sprint.md
plans/sprints/20260630-0323-paper-vn-trending-analysis-api.sprint.md
plans/sprints/20260630-1257-paper-vn-analysis-aggregation-corrective.sprint.md
plans/sprints/20260630-1413-paper-vn-analysis-entity-filter-semantics-corrective.sprint.md
... (99 total changed/untracked paths; inspect git status --short)
```

<!-- repo-harness:minimal-change-review begin -->

## Minimal Change Review

- Report: `.ai/harness/checks/minimal-change.latest.json`
- Verdict: `unknown`
- Findings: `0`

<!-- repo-harness:minimal-change-review end -->
