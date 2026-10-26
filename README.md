# Echo Craft Music — Verification Register

> **Connected services verified 2026-10-26:** ChatGPT successfully accessed both **Cloudflare** and **Supabase** via connected tools (read-only checks). For future work, inspect the integrations directly when available rather than requesting repeat setup. Read [CONNECTED_SERVICES.md](CONNECTED_SERVICES.md) for safe-use guidance and the requirement to recheck access each session.


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

- **2026-10-25 — Cloudflare response headers:** Owner's Cloudflare Rules Overview screenshot confirms an **Active** Response Header Transform Rule named `Echo Craft Music - Security Headers`, scoped to hostname `echocraftmusic.com`. The rule was configured with `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `Referrer-Policy: strict-origin-when-cross-origin`. A prior Chrome screenshot separately showed HSTS `max-age=2592000`. **Cloudflare rule activation confirmed; final browser Network response-header check remains pending.** Do not create duplicate rules.

- **2026-10-25 — Live browser validation COMPLETE:** Chrome DevTools → Network → `https://echocraftmusic.com/` document response showed `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and existing `Strict-Transport-Security: max-age=2592000`. Owner provided screenshot after Cloudflare rule activation. **All three new headers confirmed live; no further repeat check needed absent a relevant configuration change.**

## Historical Cloudflare R2 and Worker configuration — October 14–19, 2026

- **October 14:** The customer-download R2 bucket `echocraft-music-downloads` was set up for private music delivery. The Worker binding `PURCHASE_FILES` → `echocraft-music-downloads` was confirmed in the setup conversation.
- **October 16–17:** The `echocraft-music-admin` Cloudflare production Worker configuration was observed with `PURCHASE_FILES` bound to the bucket, `SQUARE_ENVIRONMENT=production`, and a configured production Square location and encrypted access token. Secret values intentionally omitted.
- **October 18:** A real $0.99 purchase, successful MP3 delivery and isolation between purchaser and a different account were tested (see the verified production section above).
- **October 19:** Production Worker review found Supabase bearer-token identity verification, confirmed-email/admin allowlist checks and Square order, location, amount, currency, completed-payment and cancellation/refund checks in inspected production code. The three-download limit was also verified in production.
- **Not yet confirmed from historical records:** whether the R2 bucket's *public development URL (r2.dev)* is disabled and whether the bucket has *no public custom domain*. These are two specific settings, distinct from the confirmed private Worker binding and authenticated delivery. Do not relabel the entire storage/payment system as unverified merely because these settings are undocumented.
- **Scope of evidence:** Historical configuration screenshots, source/code inspection and actual purchase tests; no independent October 25 Cloudflare console read. Check only those two bucket-public-exposure settings to close this issue.

## Search optimization — October 25, 2026

- Updated public homepage, Soul of Solomon, Get a Track and Sync Licensing pages with descriptive HTML titles, meta descriptions, self-referencing canonical URLs and Open Graph metadata. Homepage includes MusicGroup structured data using existing artist links.
- Added `robots.txt` pointing to the already published public sitemap. The public sitemap initially lists four published public pages; admin, private customer, checkout, preview and scheduled unreleased product URLs remain excluded.
- Confirmed `Echo Craft Christmas: Volume 1` and multiple Christmas singles are scheduled in the catalog for **October 31, 2026 (Eastern)**. Did **not** publish, alter or prematurely index their catalog records or preview files.
- Changes are limited to crawl/metadata configuration, without changes to Square, download limits, R2, customer data or storefront layout. Verify production publication and Google Search Console separately.

- **October 25 — Christmas SEO:** Added public release-information page `albums/echo-craft-christmas-volume-1.html` for Echo Craft Christmas: Volume 1 with seven catalog-confirmed track titles, October 31 release date, music album structured data, canonical and social metadata. Prior to release, the page displays a coming-soon state; after launch the album/previews link appears. Linked the album card to its permanent URL and included only this public landing page in the sitemap. **No catalog publication status, price, track, preview, payment or download was changed.**

- **October 25 — Featured Christmas singles SEO:** Published `/songs/lil-drumma-boi.html` and `/songs/silent-night.html`, each with canonical, Open Graph, music-recording structured data and time-gated links that do not expose music previews or checkout before October 31. Linked both from the Christmas album landing page; sitemap now includes 7 public URLs. Album/single release status and commerce unchanged. Live deployment and search indexing require separate validation.

## Open items — do not mark these complete without evidence

1. **Live Worker/source parity:** Record current deployed production Worker version and confirm what code it runs; distinguish deployed `/api/checkout` and `/api/order/...` from older sandbox/customer routes in GitHub.
2. **Website content rendering:** Source fix committed October 25 (see above); verify live deployment and browser playback/card appearance before marking production verified.
3. **Live HTTP security headers:** HSTS, X-Frame-Options, X-Content-Type-Options and Referrer-Policy verified in Chrome on October 25, 2026. **CSP remains deferred** pending compatibility review of inline scripts and payment/auth/media integrations.
4. **Admin / R2 access controls:** Owner-approved binding, authenticated purchase delivery and October 19 admin/payment verification were already inspected/tested historically. Remaining narrowly scoped configuration check: disabled public r2.dev URL and no public custom domain for `echocraft-music-downloads`.
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

## Echo Craft Music homepage performance follow-up — 2026-10-26

User-supplied Lighthouse baseline: **mobile Performance 59, LCP 27.1s; desktop Performance 91, LCP 1.8s**. Images and cache delivery remain concerns on slower mobile network simulation. The repo already uses compact `hero-city.webp` (~150 KiB) and `sidebar-city.webp` (~148 KiB); **do not revert to their old PNGs**. The prominent gold hero-logo PNG is ~1.08 MiB, and the Christmas Nativity image is ~2.32 MiB (already lazy-loaded). No image recompression was done because exact brand fidelity needs preserving.

**Applied narrow, safe source update:** prioritized existing hero gold image via `<link rel="preload" as="image">` and `fetchpriority="high"`, async image decoding, retained current artwork and theme logic; Nativity image remains lazy-loaded with async decode; named mobile hamburger control and tied it to real `siteSidebar`. Verified resulting repository HTML. No changes to purchasing, Square, auth, download limits, Workers, checkout, media files, or R2. **Performance improvement not yet demonstrated**: rerun mobile/desktop PageSpeed after production deploy and inspect expanded LCP element and image delivery audit; if scores regress, remove the new logo preload. For large asset reduction, acquire/prepare visually identical optimized WebP logos or configure image delivery with production verification before deployment.

## Cloudflare static image cache rule — verified 2026-10-26

With owner authorization, inspected the **echocraftmusic.com** Cloudflare Free-plan zone: global Browser Cache TTL was **14,400 seconds (4 hours)**, global cache level **aggressive**, and no preexisting `http_request_cache_settings` entrypoint ruleset was configured. Created a **narrow Cache Rule** named `Echo Craft Music static media browser cache` in the zone's `http_request_cache_settings` phase. The rule matches **GET** requests on `echocraftmusic.com` exclusively within `/assets/images/` or `/assets/themes/`, and only paths ending in `.webp`, `.png`, `.jpg`, `.jpeg`. Sets `cache: true` and browser TTL **86,400 seconds (24 hours)**. The global cache TTL was not changed; no HTML, API requests, protected download routes, checkout, account session or auth responses are matched. Read-back of the live Cloudflare entrypoint verified rule enabled and exact action/condition.

**Scope/limitations:** This improves browser caching on returning requests for static imagery, **not the first cold-load LCP** nor image file sizes. Changing an image at an identical URL can remain stale in a visitor's browser for a day; version the URL when replacing existing assets. Actual response headers, Cache-Control and the mobile PageSpeed score have not been verified post-rule. The owner will rerun PageSpeed after reaching the office. Do not claim that the 27.5s mobile LCP has been solved. Additional site performance changes need the specific LCP/image URLs and timing breakdown.

## Mobile PageSpeed expanded evidence — 2026-10-26

Owner supplied expanded Lighthouse Mobile screenshots. **Confirmed downloaded image resources** include `assets/themes/fall-background.png` (2,299.7 KiB; estimated saving 2,043.7 KiB) and `assets/themes/gold-logo.png` (1,110.5 KiB; estimated saving 1,103.2 KiB). Combined potential savings ~3,146.9 KiB. Lighthouse image audit estimated 4,773 KiB savings total, including image assets served from `distrokid.imgix.net` (800x800 covers displayed near 296x296 or 132x132) and `i.ytimg.com` (480x268 thumbnails displayed smaller). Modern image formats/resized formats should target these sources separately. The 21.9 MiB archived `assets/images/hero-city.png` was NOT identified in network requests; site uses the 150 KiB WebP.

**Render blocking confirmed:** local `css/cart.css`, `css/seasonal-themes.css`, `css/customer-checkout.css`; Font Awesome CDN CSS and Google Fonts CSS. Lighthouse estimated 2,410ms render-blocking opportunity. Browser cache warning ~1,502 KiB. **Exact LCP element still not identifiable** because the user's `LCP breakdown` row was collapsed; do not falsely attribute the 27.5s LCP to any particular file solely from these screenshots.

**Safe change committed:** added `preconnect` hints to DistroKid image host and YouTube image host; does not change original covers, checkout or site features. Larger fixes need same-picture WebP assets and careful handling of external Imgix URLs, plus inspect expanded LCP breakdown before prioritizing critical-path CSS. Static Cloudflare image cache rule already verified; caching is not a solution for cold-load oversized PNGs. Avoid claiming an improved Lighthouse score until retested.

## Production source swap: fall background and gold hero logo WebP — 2026-10-26

Owner provided optimized WebP variants for the fall background and gold logo. Due to binary-upload limitations on the connected GitHub API, a GitHub Actions repository-side Pillow conversion of the original source PNGs generated equivalent optimized WebP files at `assets/themes/fall-background.webp` (293,608 B) and `assets/themes/gold-logo.webp` (330,816 B). These are workflow-generated replacements, not byte-identical copies of the owner's uploaded versions. Original PNGs were retained as backups (`fall-background.png` 2,354,938 B; `gold-logo.png` 1,137,113 B).

**Verified source updates:** `css/seasonal-themes.css` fall theme now references `fall-background.webp` instead of PNG; `index.html` preload and hero image both reference `gold-logo.webp` instead of PNG. GitHub refetch confirms all three active references point to WebP and both files exist. Calculated asset byte reduction for these two resources: 2,867,627 bytes (~2.74 MiB); actual transfer savings and LCP improvement require a fresh mobile PageSpeed run after the production deployment/cache expiry. Christmas background and business workflows untouched. Note: browser caching for `/assets/themes` may retain prior files for 24h, but new WebP URLs avoid prior PNG browser caches.

## Targeted mobile render-blocking CSS update — 2026-10-26

Following real Lighthouse Mobile evidence of ~2,410ms estimated render-blocking opportunity, committed a **narrow CSS loading adjustment** to homepage `index.html`: cart CSS (`css/cart.css?v=20261017-live1`) and checkout CSS (`css/customer-checkout.css?v=20261014-2`) now use `media="print"` with `onload="this.media='all'"`, with full `<noscript>` fallbacks. This avoids having non-first-screen commerce styles block the initial render while loading the same styles and leaving all cart/checkout JavaScript and business logic unchanged. **Critical seasonal theme CSS remains synchronous** to avoid visual flashes and theme layout changes. Font Awesome and Google Fonts also remain synchronous pending measured/visual validation. GitHub fetch-back verified both deferred links, noscript fallback and critical seasonal CSS intact. Commit `a2e599cb834c8a351be9e230c48d44e94b07bd2b`. Live mobile checkout visual/regression test and PageSpeed rerun are pending; do not claim a measured speed increase or verified deployment. Risk: very brief cart/checkout style flash if a visitor opens the UI before deferred styles finish loading.

## Automated DistroKid Imgix cover sizing — 2026-10-26

Owner-authorized source change to `js/music.js`, commit `a04ac6b607260b7394fb681657a8dcb16b413e15`. Added centralized `optimizedCoverUrl()` helper. Only image URLs on the exact hostname `distrokid.imgix.net` receive Imgix query parameters for maximum requested width, `fit=max`, automatic format/compression, and quality 78; existing query parameters are preserved. Single music cards request width 400, album artwork 500, smaller album selectors 160. Other image hosts and original catalog URLs remain unaltered. Both card types retain existing fallback assets; images use async decode. **These are request hints, not proof of transformed delivery** until the live provider response and Lighthouse are measured. GitHub source was refetched and logic verified; no edits to album metadata, purchase/download logic, R2, customer accounts, or Cloudflare Worker. Retest mobile PageSpeed and inspect actual resized DistroKid URL dimensions. If an image fails, revert the helper to return unmodified URLs.
