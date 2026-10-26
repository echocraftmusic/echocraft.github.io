# Echo Craft Music — Verification Register

**Public domain:** https://echocraftmusic.com  
**Source repository:** `echocraftmusic/echocraft.github.io`  
**Last documentation review:** 2026-10-25  
**Purpose:** Preserve completed verification evidence. Before declaring a previously tested feature broken or requesting a repeat test, **read this register, then identify what has actually changed in production since the recorded test**.

> **Critical distinction:** GitHub contains storefront source and an older/sandbox-oriented Cloudflare Worker snapshot. The live Cloudflare Worker was also edited/deployed separately. **Do not infer production behavior or a missing production fix from a GitHub Worker route alone.** A GitHub commit does not necessarily deploy the Worker. The records below are **historical test results**, not a guarantee that a future deployment remains unchanged.

## Previously verified in production — October 18, 2026

| Feature | Recorded test evidence | Result |
| --- | --- | --- |
| Live Square checkout | Real **$0.99** purchase of **“A Light Through Darkness”**, purchase reference **EC-F608DBC5**; owner reported successful real payment/charge | **PASSED (historical production test)** |
| Order/payment recording | Associated production order was marked **paid**, amount **99 cents**; Square confirmed payment | **PASSED** |
| Delivery after payment | Purchased full MP3 was delivered successfully following payment | **PASSED** |
| Remaining-download display | After first purchase download, remaining allowance showed **2 of 3** | **PASSED** |
| My Music recovery | Purchaser signed in with original checkout email and recovered the order | **PASSED** |
| Customer account isolation | A separate signed-in email account showed no access to the purchased order | **PASSED** |

**Evidence provenance:** October 18 owner/assistant test conversation plus the recorded paid production order. This README intentionally omits personal checkout email addresses, payment IDs, private object keys and other sensitive transaction details. The test was a **real production purchase**, not only a sandbox run.

## Download-limit enforcement — October 19, 2026

| Test | Recorded observation | Result |
| --- | --- | --- |
| Three-download maximum | Live purchase/download page counted down to **0 remaining** | **PASSED (production)** |
| UI after exhaustion | Download button faded/was disabled with **0 left** | **PASSED (production)** |
| Server-side fourth attempt | Direct fourth download returned **HTTP 409** with “This file has reached its 3-download limit.” | **PASSED (production)** |
| Concurrent-request protection | In a **local/simulated test**, 15 simultaneous attempts produced **exactly 3 successful reservations**; concurrent competing attempts were rejected using conditional R2 writes | **PASSED (simulation)** |

**Deployment record from October 19:** Cloudflare Worker `echocraft-music-admin`, production deployment identifier **`c27e03d5`** was reported during rollout. This is a *historical* deployment reference, **not proof that it is still the current deployed version**.

**Maintenance rule:** Do **not** re-open “the download counter is missing” as an unverified bug solely because older files such as `cloudflare/customer-accounts.inc.js` do not contain the production implementation. Check the live deployed Worker/version or evidence of a regression first. Do not overwrite the proven production Worker with the older repository snapshot.

## Code protections observed in the repository (not a new live penetration test)

During the October 25 source review, the checked-in sandbox/older Worker included:
- Server-side authentication and an admin allowlist.
- Customer-specific private order paths rather than accepting a browser-supplied customer identity.
- Catalog-derived checkout prices instead of trusting browser price values.
- Payment completion/amount/refund checks before serving private purchase files in the checked-in customer flow.
- Existing regression test files for customer account isolation, Square sandbox checkout, and private purchase file handling.

These are **code-review observations only** and must not be represented as a fresh audit of today's deployed production Worker.

## Security hardening update — October 25, 2026

- **YouTube video cards (source fixed):** Commit `b5eed83405bfb44a54adfe66808c66eca244b2d8` updated `index.html` to escape external video titles, validate 11-character YouTube IDs, allow only HTTPS YouTube thumbnail hosts, and add `rel="noopener noreferrer"` to external video links. **Verified in GitHub source. Live deployment and browser regression test have not been independently confirmed.**
- **Commerce untouched:** No edits to Square, customer authorization, three-download enforcement, R2 files, catalog, pricing, or production Cloudflare Worker.
- **Security headers:** Their live HTTP response values have **not** been independently retrieved; do not claim CSP, HSTS, anti-framing, or referrer headers are enabled or disabled. Confirm delivery host and inspect production response headers before changing them.
- **Admin/R2 checks:** Repository includes owner allowlist and private-bucket use, but current production binding and access settings remain to be independently verified.

- **2026-10-25 — Homepage outbound-link privacy:** Commit `50e84d846d65b181ce5645cea4413b10874f52ed` adds `rel="noopener noreferrer"` to 12 previously unprotected new-tab links and a `strict-origin-when-cross-origin` HTML referrer policy on the homepage. **Confirmed in GitHub source; live production response headers and browser behavior still require separate verification.** No checkout, Worker, downloads, catalog, or R2 code was changed.

## Open items — do not mark these complete without evidence

1. **Live Worker/source parity:** Record current deployed production Worker version and confirm what code it runs; distinguish deployed `/api/checkout` and `/api/order/...` from older sandbox/customer routes in GitHub.
2. **Website content rendering:** Source fix committed October 25 (see above); verify live deployment and browser playback/card appearance before marking production verified.
3. **Live HTTP security headers:** Verify deployed CSP, HSTS, framing, content-type and referrer protections, accounting for scripts and checkout integrations.
4. **Admin / R2 access controls:** Finish production authorization and bucket-public-access checks without altering or exposing secrets.
5. **Per-item sales analytics:** The desired private dashboard reporting products sold was **not yet verified as complete** in October 19 discussions. This is separate from confirmed Square payment processing and existing page/play/click analytics.
6. **Search Console:** October 25 sitemap submission for the Music domain initially returned “Couldn't fetch” / HTTP 404 while the XML subsequently loaded in the owner's browser. Follow up separately; this is **not evidence of a payment or download vulnerability**.

## How future assistants and developers should use this register

1. Read **this README first**, then `PROJECT_CONTEXT.md`, `MAINTENANCE_PLAYBOOK.md`, and `SITE-INTEGRITY-GUARDRAILS.md`.
2. **Honor completed October 18–19 tests.** Only request another payment/download test if a subsequent code or infrastructure change, new evidence of breakage, or a specifically necessary regression check warrants it.
3. **Inspect production before making claims.** No production Cloudflare Worker access is implied by GitHub access. Do not overwrite a working production Worker based on older source.
4. Keep the distinctions **production test / simulated test / source inspected / not yet verified** visible in every audit summary.
5. Do not deploy live payment, customer-account, music-file, catalog, or theme changes without owner approval. Avoid live purchases solely to repeat known prior tests.
6. Never commit tokens, customer emails, receipts with personal data, order access links or R2 keys. Store only non-sensitive test summaries and deployment references.

## Documentation history

- **2026-10-18:** Confirmed $0.99 Square production order, delivery, first decrement, My Music recovery, and separate-account isolation.
- **2026-10-19:** Confirmed three-download exhaustion and fourth-request HTTP 409 in production. Separately tested 15 concurrent requests in simulation; Cloudflare production deployment `c27e03d5` recorded.
- **2026-10-25:** Consolidated these past results in GitHub documentation. **Documentation-only update**; no checkout, account, Worker, MP3 or Cloudflare configuration changed.
