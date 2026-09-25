# PHASE 0 — Requirements Audit: Grow-a-Garden Pro vs. Enterprise Agricultural Simulation Platform

Spec source: `docs/hermes-agri-spec.pdf` (HERMES MASTER DEVELOPMENT PROMPT, 652 lines).
Code audited: `frontend/`, `backend/`, `database/`, `shared/` (1,178 LOC total).

## 1. Scope gap (honest headline)

The spec is an **enterprise AAA simulation platform** contract (428 catalog elements, 20 domains:
ECS, world partitioning, ISO-730 hitches, PTO/hydraulics, livestock, production chains, AI workers,
authoritative multiplayer, modding). The current repo is a **single-player cozy browser farming game**
— 3D plot grid, 11 crops, 5 decor items, weather table, save/localStorage + thin SQLite backend.

These are different products. **Do not pretend the current game "is" the spec.** The spec's own rules
agree: *"Do not begin by generating hundreds of unrelated source files. First establish the validated
architecture, data contracts, implementation boundaries, and acceptance criteria."*

**Decision:** treat the spec as the *direction* for Grow-a-Garden's growth — adopt its principles and
architecture, implement a **vertical slice** first, expand catalogs in later phases. Full 428-element
EAC simulation is out of scope for this project and honestly stated as such.

## 2. Source-quality report (spec document)

The spec itself is high-quality: coherent layered architecture, clear dependency rules, canonical
units, explicit entity-component model, authority ownership. Identified gaps (spec admits these —
they are flagged in the doc itself as needing validation):

| # | Item | Status |
|---|------|--------|
| 1 | Source "Technical Architecture... 428 Elements" document | **Missing** — referenced but not supplied. Spec is the only artifact. |
| 2 | ISO 730:2009 linkage tables | **Not reproduced** — spec explicitly forbids unverified reuse. Treat as reference only. |
| 3 | 428-element catalog | Not provided in this PDF. Null until supplied. |
| 4 | Default values / balancing numbers | Not provided → all provisional. |
| 5 | Multiplayer ownership / persistence rules | Defined at policy level; concrete schema absent. |

**Provisional assumption register:**
- A1: Real implementation language = the project's existing stack (JS/Node/SQLite/WebGL), not Unreal/C#. Rationale: repo reality; the spec's "engine references" are unverified. Validation: agree at review; swap engines only with real justification.
- A2: Canonical units per spec adopted for any new sim fields (m, kg, s, N, kW, Pa, °C).
- A3: Client-authoritative ONLY for cosmetic/prediction; server authorizes economy/state. Already true in repo's POST-fallback model → keep.
- A4: 428 elements = target catalog capacity, not required-today count.

## 3. Current-code gap analysis (field-by-field)

Map spec §PRODUCT SCOPE (A–T) to existing code:

| Domain (spec) | Current state | Gap |
|---|---|---|
| A core runtime/scheduling | `game.js` render loop (`requestAnimationFrame`), fixed-ish ticks | No fixed-timestep sim; no catch-up; weather/crop ticks ad-hoc |
| B entity-component | none | Plots are plain object array; no ECS |
| C world partitioning | none (single 4×5 grid) | none needed at this scale — YAGNI for now |
| D terrain/field | `world3d.js` static 3D plots | no height/soil layers |
| E soil/agronomy | none (only watered boolean + weather) | crop growth = static timer, not data-driven agronomy |
| F weather/seasons | `data.js` 4-entry table, random pick | no seeded state, no season/calendar, no evaporation/forecast |
| G vehicles/machinery | `world3d.js` tractor loop (decor) | no real vehicle sim |
| H hitches/PTO/hydraulics | none | not present |
| I crops/harvest | `data.js` CROPS (grow time + sell) | no growth stages, no yield, no harvest product/fill |
| J livestock | none | — |
| K buildings/production | none | — |
| L economy | coins/xp/level, decor shop | no transactions ledger, no contracts, no prices |
| M NPCs/AI | none | — |
| N traffic/nav | none | — |
| O render/audio/VFX | WebGL + `sfx.js` synth | ok for scope; no LOD/streaming |
| P multiplayer | none (single-player save) | not present |
| Q save games | SQLite (players, plots) + localStorage; **no version/migration/checksum** | weakest gap vs spec §SAVE |
| R content pipeline/modding | none | — |
| S UI/input/a11y/i18n | HTML/CSS, no i18n, minimal a11y | |
| T observability/test/release | `metrics.js` telemetry, `shared/state.test.js` node:test, GH Actions CI+Pages | good start; no perf gates |

## 4. Security integrity check (existing — good)

Repo already implements several spec §SECURITY items (verified in code):
- `sanitizePlayer` regex allowlist ✓
- server-side `isValidState` on POST ✓ (spec §data trust)
- clamp coins/xp/level/unlocked before INTEGER write ✓
- per-IP rate limit 429 ✓
- metrics sanitized to 64 chars ✓
- static path traversal guard (`startsWith(FRONTEND_DIR)`) ✓
- transactions for save ✓

**Still missing vs spec:** save corruption detection (no checksum), save version id, inventory
transfer authority checks (server trusts whole client state wholesale — acceptable now, must change
when multiplayer/economy grow).

## 5. Canonical-units conformance (new work)

Existing economy uses plain integers (coins/xp). When production/economy expands, adopt spec §CANONICAL
UNITS: integers for currency (minor units), m/kg/s internally, display-only km/h/hp/ha/L/t. Record this
as a **standing convention** for all new sim fields.

## 6. Normalized record structure gap

Spec §ASSET CATALOG NORMALIZATION (28 fields/element). Current `CROPS` has 7 fields (emoji, name, cost,
grow, sell, xp, lvl) — 1 emoji-free of the 28-field target. Migration path: introduce a normalized
**schema** for crops/plants first (stable `id`, `version`, `namespace`, validation), keep balancing
separate from geometry. Do this in the slice, not a mass rewrite.

## 7. Priority roadmap (realistic for this repo)

1. **P0 — Save integrity** (spec §SAVE, lowest risk, unblocks everything): versioned save id, atomic
   write, checksum + corruption detection, migration hook. *Doing next.*
2. **P1 — Fixed-timestep sim scheduler** (spec §SIMULATION LOOP): decouple weather/crop progression
   from render frames.
3. **P1 — Data-driven crop model** (spec §AGRONOMY): promote `CROPS` to a typed schema; add stages,
   yield, harvest product; keep balance data separate.
4. **P2 — Transactional economy** (spec §ECONOMY): coin/xp ledger with server authority; no client-set
   balance bypass.
5. **P3+ — vertical slice** per spec §PHASE 4: one field, one crop, one harvest→sell flow, one AI
   worker, one save/migration test.
6. **P4+ — escalate** (vehicles/hitches, multiplayer) only when a slice is green. Not now.

## 8. Acceptance criteria (first 3 increments)

- **Save integrity done when:** old saves load-warn-not-crash; corrupt save detected + logged + ignored;
  `schema_version` persisted; migration path tested in `node:test`.
- **Sim scheduler done when:** crop/weather grow on fixed tick independent of FPS; determinism test
  (same seed → same outcome) passes.
- **Data-driven crops done when:** all crop constants move out of `game.js` into validated data; invalid
  crop data rejected at import by the shared validator (extend `shared/state.js`).

## 9. Risks & mitigations

- **Over-scope** (build ECS/MP now) → blocked: does not fit repo, no slice, unverifiable. Mitigate: slice-first, catalog-later.
- **Save schema drift** (adding fields breaks old players) → mitigate: versioned schema + migration from P0.
- **Client-trust regression** (moving to server-authority later) → mitigate: keep single-writer save path
  (backend writes; frontend only submits validated state) — already the shape.
- **False completeness claim** → spec rule: never claim all 428 elements done. Track per-element validation
  status.

## 10. Traceability

Production decisions map to: spec §PERSISTENT OPERATING INSTRUCTION (slice-first), §SAVE (P0), §SIMULATION
LOOP (P1), §AGRONOMY (P1), §ECONOMY (P2), §CANONICAL UNITS (standing), §RESPONSE RULES (honest scope).
