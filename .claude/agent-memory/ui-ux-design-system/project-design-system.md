---
name: project-design-system
description: Established design tokens, component library, typography, and theming conventions for the credit scoring SPA
metadata:
  type: project
---

This project is a credit scoring and sales system built as a Vue 3 SPA with PrimeVue 4 (Aura preset) and a Fastify backend. The frontend is spec-defined but not yet scaffolded as of 2026-05-15.

**Stack:** Vue 3 + PrimeVue 4 (Aura preset) + TypeScript + Vite + Pinia

**Theming:** Dark mode default, toggled via `data-theme="light"` on `<html>`. PrimeVue surface tokens must be remapped via `definePreset` to avoid white bleed in dark mode (documented in THEME_ISSUES.md).

**Color tokens (custom CSS variables):**
- Backgrounds: `--bg-base`, `--bg-sidebar`, `--bg-surface`, `--bg-elevated`, `--bg-input`, `--bg-hover`
- Borders: `--border-subtle`, `--border-default`, `--border-focus`
- Text: `--text-primary`, `--text-secondary`, `--text-muted`, `--text-accent`
- Accent: `--accent-1` (#7b68ee), `--accent-2` (#9d4edd), `--accent-3` (#c77dff), `--accent-glow`
- Semantic: `--success` (#00b894), `--warning` (#e17055), `--danger` (#d63031), plus `-bg` variants
- Gradients: `--gradient-accent`, `--gradient-hero`, `--gradient-card`, `--gradient-btn`

**Typography:**
- UI font: system-ui stack (ui-sans-serif, system-ui, sans-serif + emoji)
- Mono font: JetBrains Mono — used exclusively for amounts, reference numbers, and scores

**Buttons:**
- Primary: `--gradient-btn` (linear-gradient(90deg, #9E40FF 23.47%, #2802A4 106.32%)) — NOT `--gradient-hero`
- Height locked globally to 40px via `.p-button { height: 40px !important; }`
- Note in THEME_ISSUES.md: any inline style using `--gradient-hero` on buttons must be updated to `--gradient-btn`

**Score bands:**
- Excellent (800–1000): `--success`
- Good (600–799): `#4ea8de` (hardcoded — NOT a token; this is a gap)
- Fair (400–599): `--warning`
- Poor (200–399): `--danger`
- Critical (0–199): `--danger` + glow

**Warning:** "Good" band uses hardcoded `#4ea8de` with no CSS token defined. This is an inconsistency in the design spec.

**Why:** PrimeVue 4 Aura preset uses its own surface color scale that overrides custom CSS variables in dark mode; requires both `definePreset` remapping AND belt-and-suspenders `!important` CSS overrides.

**How to apply:** Always use `var(--token-name)` for new component styles. Never hardcode hex values except inside `definePreset` token maps. When adding new PrimeVue components, check for dark mode bleed first.
