# Model center and mobile chat

Implemented on the `ai` branch. Existing Tarot changes are retained.

## Interaction

- `/models`: named model connections, explicit save vs apply, a test of the draft without switching the effective connection, and a separate memory-retrieval tab.
- Provider presets supply protocol and service root. Model IDs remain editable to support account-specific availability and newly released models.
- Secrets are encrypted by the backend. List responses contain availability flags only. Blank keys on edit retain the saved key.
- Applying a profile updates the existing effective settings used by AI requests. Editing an applied profile is pending until explicitly applied again.
- Mobile `/chat` removes application navigation and decorative framing, retains history/today/memory actions, and uses the visible viewport for keyboard space. Desktop presentation remains independent.
- Records contains a mobile chat entry. Explore also opens chat. Calendar replaces chat in the bottom navigation.
- The default home is records; explicit user preference for chat remains honored.

## Release requirements

Apply backend `src/main/resources/db/migration-v15-model-profiles.sql` after v14 before running the updated backend. This task does not apply migrations to a real user database or deploy services.

## Verification boundaries

The browser preview uses synthetic data and simulated model responses. Provider presets are configuration conveniences, not evidence of a successful live invocation for every provider or every model. No paid provider credentials are required or used in this change.

Mobile browser viewport tests cover compact layouts and reduced available height. A physical mobile keyboard and device-specific browser behavior remain separate acceptance checks.

AI compatibility regression: 90 tests passed (`test_runtime_clients`, `test_graph_planning_protocol`, `test_thinking`, `test_json_task`).

## Final verification, 2026-11-05

- Frontend unit suite: 60 passed. Production and preview builds passed.
- Backend focused run: 16 passed, zero skipped (11 profile service, 2 PostgreSQL lifecycle/concurrency, 1 draft gRPC transport, 2 existing settings).
- PostgreSQL v15 migration was applied twice in an isolated test schema. The test runner sends the complete SQL to PostgreSQL so dollar-quoted blocks are preserved.
- Model browser workflow passed against the final built preview at port 5190: draft test, result invalidation, save/apply distinction, pending active edits, retained secret, backup switch/delete, retrieval test, compact mobile details and home preference.
- Chat presentation fixtures passed six viewport/layout combinations against the dev preview. Final built navigation passed four viewport/layout combinations; Tarot preview regression also passed.
- Preview: http://127.0.0.1:5190/models and http://127.0.0.1:5190/chat . Refresh existing tabs after rebuilding.
