# Echo Craft Music — Persistent Project Context

**Official site:** https://echocraftmusic.com  
**GitHub repository:** `echocraftmusic/echocraft.github.io`  
**Updated:** 2026-10-22  
**Evidence classification:** Homepage identity was inspected in this repository; further details below come from prior project discussions unless explicitly described as verified. This file does **not** claim a production deployment was audited.

## Business and site identity
- Echo Craft Music is the artist/store side of Echo Craft LLC, separate from Echo Craft Studio services.
- Confirmed in repository homepage: title "Echo Craft - All Genres. All Music. All Together."; `data-site-theme="fall"`; links to `studio.echocraftmusic.com` and `www.echocraftmusic.com`.
- Other repository `echocraft.github.io-main` exists. Verify whether it is a stale export before adopting its files.

## Design and shopping workflow
- User-preferred design: glass-effect left sidebar; three-across music cards; embedded previews; glossy buttons; readable footer.
- Site themes discussed: Original, Fall and Christmas, changed via admin control.
- Store prices discussed: singles $0.99 (Christmas singles $1.49); standard albums $9.99; long albums $14.99; video $7.99; bundle $14.99. Verify current configured prices in code before edits.
- Checkout: Square live payments reported and Google Pay tested; Apple Pay and Cash App desired; no PayPal preference. Auto-registration checkbox and simpler checkout were discussed.
- Customer downloads: Cloudflare R2 MP3 delivery, 320kbps target, three downloads per purchase with optional $0.99 extension for three more; verify implementation and checkout enforcement. ZIP for multi-item delivery was proposed.
- Account area: My Music includes download access; forgot-email/recovery functionality was requested.
- Album inventory previously discussed: Word-Fi: Psalms, Midnight Series Vol.1, Stinking Overthinking, Requiem of His Grace, Christmas album, Beatography Vol.1. Album titles and counts need verification in current catalog.
- Other services discussed: DistroKid distribution, ASCAP affiliation, quarterly Sender newsletter.
- Security/operations: vulnerability review, download-counter work, per-item analytics on sales requested. Do not mark unverified changes as shipped.

## Mandatory handoff and operational safety
1. Read this file first, then inspect current source, branch and recent history before any edit.
2. Confirm the current GitHub repository actually matches production; manual Cloudflare deployments can differ.
3. Check design on desktop and mobile, links, integrations and critical account/payment workflows.
4. Distinguish **verified in repository**, **historically discussed**, **planned**, and **confirmed deployed**. Never silently promote plans to live features.
5. Make minimal, reversible edits and log significant changes and verified deployments.
6. Never commit credentials, API tokens, private keys, sensitive client data or private account data.
7. Respect the current owner's instruction over old documented preferences.

## Verification still needed
- [ ] Map production host and deployment triggers to exact repository and branch
- [ ] Document entry points, Worker routes, Cloudflare bindings and external services by nonsecret names
- [ ] Confirm which discussed features actually ship in production
- [ ] Inspect current forms, navigation, mobile design, accessibility and security
- [ ] Record latest deployment and outstanding tasks

## Change log
- 2026-10-22 — Original context file established.
- 2026-10-22 — Expanded with historical project decisions and inspected homepage identity. No production code or site deployment changed.
