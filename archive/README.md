# Archive — not part of the deployed application

Everything in this directory is **historical material preserved for reference.
None of it is deployed, maintained, or safe to use as a product.** The canonical
LEAPS application is the Next.js + Supabase app in `src/` at the repository root.

## `static-demo/` — REMOVED from the current tree

The original single-file HTML prototype (`static-site/index.html` and its
identical copy `leaps-research-assistant.html`) was **removed from the current
repository tree** in Phase 1 pre-merge cleanup.

**Why it was removed:** the prototype was insecure by design and could not be
safely restored or redeployed. It contained:

- Client-side-only "authentication" with **plaintext passwords stored in
  `localStorage`** — anyone with the browser profile could read all data, and
  the login screen could be bypassed entirely.
- A user-pasted **Anthropic API key stored in `localStorage`** and sent
  **directly from the browser** to `api.anthropic.com` using the
  `anthropic-dangerous-allow-browser` header.
- AI-generated report text rendered through a **non-escaping formatter into
  `innerHTML`** — an XSS vector that could exfiltrate the stored API key.

**Recoverability:** the prototype remains fully recoverable from Git history
**at or before commit `8a52b4a`** (the last commit that contained it), e.g.:

```
git show 8a52b4a:archive/static-demo/index.html
git show 8a52b4a:archive/static-demo/leaps-research-assistant.html
```

**It must not be restored to the working tree, rebuilt, or redeployed.** It is
kept in history only as a record of the original UX and feature set. Do not
copy code from it into the active application.

## `netlify-market-recommendations/` — reference only, NOT an active endpoint

The Netlify serverless function that powered the retired static prototype's
Market Recommendations feature, plus the original `netlify.toml`. **This code is
reference-only. It is not wired to any deployment and must not be treated as an
active endpoint** — the root `netlify.toml` no longer declares a functions
directory, and nothing in `src/` imports from here.

It is retained (unlike the static prototype) because it is the best-engineered
part of the original project and is intended Phase 2 reference material:
request validation, a Demo/Polygon/Alpaca market-data **provider abstraction**,
**deterministic scoring**, and a **guarded Claude enrichment** step (forced
tool-use JSON, hallucinated-ticker filtering, deterministic scores kept
authoritative, and explicit `dataStatus` / `feedType` / per-metric `asOf`
data-source labels). Phase 2 is expected to port those patterns into the
Next.js app's API routes rather than run this function.
