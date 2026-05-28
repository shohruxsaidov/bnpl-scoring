# ADR 0003: Frontend Stack & UI

**Status:** Accepted

## Stack

| Concern | Choice |
|---|---|
| Monorepo | Turborepo |
| Framework | Vue 3.5 (Composition API) |
| Component library | PrimeVue 4.5 — styled mode |
| Theme package | `@primeuix/themes` 2.x (replaces deprecated `@primevue/themes`) |
| Layout | Tailwind CSS 4 (Vite plugin, CSS-first config) |
| Routing | Vue Router 5 |
| Server state | TanStack Query (`@tanstack/vue-query`) |
| UI state | Pinia 3 |
| Forms | VeeValidate + Zod 4 |
| Theming | ClickUp token set, dual light/dark |
| Architecture pattern | MVVM |

## Decisions

**MVVM as the component architecture pattern across all three frontends.** The three layers map onto Vue 3 artifacts as follows:

| MVVM Layer | Artifact | Responsibility |
|---|---|---|
| View | `<template>` in .vue SFCs | Declarative rendering only — v-if/v-for/event binding, no logic |
| ViewModel | `<script setup>` in .vue SFCs | Component-local reactive state, computed values, event handlers; imports from Model layer and exposes only what the template needs |
| Model | Pinia stores, TanStack Query hooks, composables wrapping API calls | Domain state, server state cache, HTTP calls, business rules |

Raw API calls (fetch or the HTTP client) must not appear in `<script setup>` directly — they belong in a composable or store. Inline fetch helpers inside components are a pattern violation and are flagged as technical debt (`StepClient.vue:14` is a known instance).

**Turborepo monorepo for all frontends and the backend.** All three frontends (Merchant App, Client Web Portal, Platform Admin) and the backend share a single Turborepo monorepo. Separate repos rejected — the frontends share domain types, formatting utilities, and UI primitives. Without a monorepo these would be duplicated or published as private packages. Turborepo provides task caching and parallel builds with minimal configuration.

**`@primeuix/themes` replaces `@primevue/themes`.** PrimeVue 4.3+ moved the theming engine to a framework-agnostic `primeuix` layer. The import paths change (`@primeuix/themes` and `@primeuix/themes/aura`) but `definePreset` and the Aura preset API are identical — only the package name differs.

**Tailwind CSS v4 — Vite plugin, CSS-first config.** `@tailwindcss/vite` replaces the PostCSS plugin; `tailwind.config.js` is deleted. Theme customisation moves to `@theme {}` blocks in CSS. Content scanning is automatic via Vite. Preflight is omitted by importing `tailwindcss/theme` and `tailwindcss/utilities` separately rather than `tailwindcss` wholesale — PrimeVue owns component resets.

**`@vee-validate/zod` peer conflict with Zod 4.** As of Zod 4.4, `@vee-validate/zod` still declares `zod@^3` as its peer. The adapter works at runtime — Zod 4 preserves the `.safeParse()` interface that the adapter relies on — but the peer warning is expected until `@vee-validate/zod` ships a v5. Revisit when a compatible release lands.

**Vue 3 + PrimeVue over React.** The React + PrimeReact styled-mode bundle measured at ~990KB. Vue 3's smaller core (~22KB vs ~45KB) reduces baseline weight. Vue's `<Transition>` + Vue Router's `<RouterView>` provides first-class page transitions with no additional dependencies (React requires Framer Motion, ~30KB). PrimeVue owns component CSS; Tailwind handles page shell layout. Pinia replaces Zustand; VeeValidate + Zod preserves shared schema validation with the backend.

**ClickUp dual theme — light and dark, user-controlled.** Default follows OS preference (`prefers-color-scheme`); a manual toggle persists the override to `localStorage` — no DB round-trip. Typography: `Plus Jakarta Sans` for all UI text, `JetBrains Mono` for amounts, credit references, TXN IDs, and scores. Same token set across all three apps; information density differs (Merchant App compact, Client Portal spacious, Platform Admin utilitarian).

**Dark theme tokens:**
```css
--bg-base: #1a1a27;  --bg-sidebar: #13131e;  --bg-surface: #22223a;
--accent-1: #7b68ee; --accent-2: #9d4edd;    --accent-3: #c77dff;
--text-primary: #e2e2f5;  --text-secondary: #9898bb;
--success: #00d4aa;  --warning: #ffb02e;  --danger: #ff5c5c;
```

**Light theme tokens:**
```css
--bg-base: #ffffff;  --bg-sidebar: #f3f4f8;  --bg-surface: #f7f8fc;
--accent-1: #7b68ee; --accent-2: #9d4edd;    --accent-3: #c77dff;
--text-primary: #1a1a27;  --text-secondary: #5c5c7a;
--success: #00d4aa;  --warning: #ffb02e;  --danger: #ff5c5c;
```

**Key usage rules:** Primary buttons → `--gradient-hero`; active nav → `--gradient-accent` + `--accent-glow`; amounts/refs/scores → `--gradient-hero` gradient text + JetBrains Mono; semantic states → color pairs (`--success` + `--success-bg`).

**Merchant App targets tablet and laptop — responsive, minimum 768px.** The app runs on counter terminals (laptop) and tablets (handed to Clients during MyID verification). A dedicated native mobile app rejected — a responsive web app covers the real device range without a separate codebase and app-store overhead. Touch targets and form inputs are sized for finger interaction.

**New Deal Wizard uses SSE for external API progress.** The Wizard streams step-level progress (MyID, KATM, Plum) via Server-Sent Events, keyed by the Deal UUID (`deal_id`) created when the Wizard opens. Each step shows pending/in-progress/succeeded/failed with a per-step retry button on failure. Synchronous HTTP rejected — sequential external calls can take 20+ seconds, exceeding acceptable timeouts. Async job queue with polling rejected as more infrastructure than needed. SSE maps directly onto the step-level progress UI with no polling overhead and no WebSocket handshake complexity.

**Deal detail view uses lazy per-tab TanStack Query.** The main Deal query fires on mount. Each tab query is lazy (`enabled: activeTab === 'X'`) — fires only when the agent first activates that tab and stays cached for the session. Prefetching all tabs on mount rejected: agents typically open the detail page for the header or to download the Договор PDF, not to review the installment schedule. Lazy activation makes the common path fast. Follows directly from the sub-resource API structure (ADR 0002).
