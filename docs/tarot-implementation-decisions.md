# 实施记录与取舍

# SDD ledger — plan: docs/superpowers/plans/2026-10-26-tarot.md

Execution: 2026-10-26. User authorizes full implementation, incremental commits, and only user-observable tests.
Workspace: E:/project/mirror/own/worktrees/tarot-20261026/{F,B,AI}; branch codex/tarot-20261026 in each repo.
Base commits: F 8cee4ba, B abe7ea2, AI b76c740. Original checkouts remain intact.
Ruling: consolidate plan's many unit tests into behavior-focused integration/acceptance tests plus builds — explicit user preference — fewer implementation-detail regressions detected, compensated by existing suites and end-to-end checks.
Ruling: use original Python venv and a frontend node_modules junction for tools — identical dependencies, avoids redundant installation — final builds must resolve from worktree sources.
Pre-flight: Task 1 catalog/RPC -> Tasks 2/4 share stable IDs and wire fields; compatible. Task 2 persisted reading -> Task 5 async analysis uses same reading ID; compatible. Task 3 source refs -> Tasks 4/5 citations and revalidation agree. Task 6 contexts default off outside final answer. Task 7 HTTP consumes snake_case through existing interceptor. No unresolved interface conflict.

Task 1: in progress. Catalog and protocol compilation; no new schema-only tests per user request.

Task 1: complete. B Maven compile passed; AI generated protocol plus existing assistant context tests 3 passed. Commits recorded in git log. Baseline F 50 passed; B AssistantContextServiceTest passed. Task 2 starting.
Ruling: implement SQL access with Spring JdbcTemplate in focused TarotMapper repository for explicit atomic PostgreSQL statements — existing Spring JDBC dependency available — no ORM entity scaffolding; behavior verified against PostgreSQL.

Task 2: complete. TarotExperienceDatabaseTest: 3 tests, 0 failures/errors/skips, PostgreSQL 16.4 at loopback:55439/mirror_tarot_test. Covers 20 concurrent draws, next-day retry all request aliases, fresh next-day draw, repeated question draws never collecting, account isolation, saved settings/version conflict. Uses actual v12 migration with minimal existing-table fixture. Task 3 starting.
Ruling: Docker engine unavailable; use isolated downloaded PostgreSQL 16.4 binary under this ignored workspace (loopback only), no production database touched. Full baseline schema with pgvector is not yet validated.

Task 3: complete. TarotExperienceDatabaseTest + TarotReferencesDatabaseTest: 5 tests passed, no skips. Covers 7/30 day scope, all off, blank question no context, authorization/vault exclusions, mirror/todo independent switches, revocation and changed todo invalidation.
Ruling: use bounded keyword matching (100 recent diary candidate chunks / 50 open todos) instead of requiring an embedding call for short single-card reading — avoids extra model dependency and latency — semantic-only matches can be missed; notices explicitly disclose keyword matching and incomplete coverage.

Task 4: complete, AI 28d66b4. Reading + sync tests 5 passed.
Task 5: complete, B 65c3cd1. Three PostgreSQL experience suites: 7 passed, no skips.
Task 6: complete, B e60276c / AI 4a23e74. Added observable concurrent-chat quota/task/suppression checks, existing AgentRun/assistant/grpc suites passed; AI context/reading/upload 8 passed. Live-model tone review remains Task 8.
Task 7: in progress. Production Vue pages and scoped store; feature is separate from art prototype.

Task 7: complete. Vite production build and existing frontend 50 tests passed. Browser HTTP fixture acceptance passed at 375/768/1440: lost draw response reuse, immutable card, daily-only collection, locked gallery, preference persistence, same-card failed analysis retry, refresh and midnight; screenshots inspected. Real service integration remains Task 8.
Ruling: reuse original PNG for card viewing with lazy collection loading rather than introduce converted artwork in this pass — exact approved art preserved — larger first image download (~2–3 MB), WebP thumbnails can be added later.

Task 8: service integration completed. Full PG18.6/vector0.8.7 schema and v12 applied. Real Java→Python gRPC→local OpenAI-compatible stub completed; diary/todo/mirror sources and revocation verified. Real browser opened all sources and cleared data on live account switch. Baseline B9 failures reproduced in abe7ea2; new suite 497 total/488 pass/9 same failures. AI715pass15skip, F50pass + build.
Ruling: no configured real model credentials available; synthetic transport acceptance is complete but real-model quality/tone review is explicitly deferred to rollout — deterministic boundaries tested — prompt wording remains model-dependent.
Ruling: leave existing nine ChatRetrievalTest/ToolsTest baseline failures unchanged; isolated baseline reproduces all nine — unrelated retrieval fixes are outside tarot scope — whole-suite status remains non-green.

Final review: first reviewer gpt-6-astra hit quota without final findings; replacement gpt-6.1-terra completed one read-only whole-feature review. Two Important findings, no Minor findings. No second review requested.
Final: fixed cross-midnight recovered card hidden — browser tarot.mjs 768px cross-midnight retry RED (missing recovered region) → GREEN; 3 viewport acceptance, live-service browser, F50/50 tests and production build passed.
Final: fixed "可以再提" resume intent — chatKeepsTasksClearAndOffersDailyCardOnlyOnce RED expected true/false → GREEN; Tarot DB8/8; B whole suite 497 total, 9 previously reproduced baseline failures unchanged.
Final: Ruling: reviewer declined real-model quality judgment because only synthetic endpoint available — keep target-model tone evaluation as explicit pre-rollout requirement — model-specific wording remains unverified.
Task 8: final local verification complete with disclosed limits. Full baseline-to-v12 upgrade and migration replay passed. Preview 3-tab flow and preview build passed. Runtime upload sync clean. Work retained on feature branches, not deployed.
