# Archive — not part of the deployed application

Everything in this directory is **historical material preserved for reference. None of
it is deployed, maintained, or safe to use as a product.** The canonical LEAPS
application is the Next.js + Supabase app in `src/` at the repository root.

## `static-demo/`

The original single-file HTML prototype (`index.html`, and its identical copy
`leaps-research-assistant.html`, formerly served from `static-site/` via Netlify).

**Do not deploy or use this prototype. It is intentionally insecure:**

- "Authentication" is client-side only, with plaintext passwords stored in
  `localStorage` — anyone with the browser profile can read all data, and the
  login screen can be bypassed entirely.
- It asks the user to paste an Anthropic API key, stores it in `localStorage`,
  and calls `api.anthropic.com` directly from the browser using the
  `anthropic-dangerous-allow-browser` header.
- AI-generated report text is rendered through a non-escaping formatter into
  `innerHTML` (an XSS vector that could exfiltrate the stored API key).

These issues are why the prototype was retired in Phase 1 (July 2026). It is kept
only as a record of the original UX and feature set.

## `netlify-market-recommendations/`

The Netlify serverless function that powered the static prototype's Market
Recommendations feature, plus the original `netlify.toml`. This code is the
best-engineered part of the original project — request validation, a
Demo/Polygon/Alpaca market-data provider abstraction, deterministic scoring, and
a well-guarded Claude enrichment step (forced tool-use JSON, hallucinated-ticker
filtering, deterministic scores kept authoritative).

It is archived rather than deleted because **Phase 2 is expected to port its
provider abstraction and data-labeling patterns** (`dataStatus` / `feedType` /
per-metric `asOf` stamps) into the Next.js app's API routes. It is not wired to
any deployment: the root `netlify.toml` no longer declares a functions directory.
