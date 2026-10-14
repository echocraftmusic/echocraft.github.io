# Seasonal theme rollout

The Music Manager includes **Theme Changer** with Original, Fall, and Christmas.
This is an owner-controlled appearance; no seasonal selector is added to the public site.
New visitors fetch the owner selection and open visible pages refresh it every minute.
Original keeps the established styling and logo. The owner requested Fall as the initial active theme. The fallback file and new Worker storage default to Fall.

## Storage and authentication

The existing Music Admin Worker and ADMIN_STAGING binding are reused.
Only `settings/site-theme.json` is written, containing a validated theme value.
`GET /api/site-theme` exposes that value publicly; `GET /api/theme` and
`PUT /api/theme` require the existing confirmed owner authentication.
No new secrets, permissions, bindings, product data, pricing or checkout changes are required.

## Deployment order

1. Deploy the updated `cloudflare/music-admin-worker.js` to the existing
   `echocraft-music-admin` Worker, preserving all existing bindings and secrets.
   Committing this file to GitHub does not deploy the Worker.
2. Verify public `GET /api/site-theme` returns Fall and owner-only saves
   return the persisted value. Rejected and signed-out accounts must not write.
3. Review the storefront in an isolated preview at desktop, tablet and phone
   widths, with both seasonal selections. Verify the collapsed sidebar,
   all albums/singles, audio previews, navigation and existing cart behavior.
4. Publish the frontend branch after review. Start on Fall; the owner
   can activate Fall now and Christmas after Thanksgiving.

The approved revised Nativity mockup is stored unchanged in
`assets/themes/christmas-approved.png`. The live image element displays only
the Nativity region, preserving its pixels and the approved faces. The heading
and subtitle are native HTML. Backgrounds and a transparent gold logo were
generated separately from the approved references.

## Validation completed

- `node cloudflare/music-admin-worker.test.mjs`
- `node scripts/seasonal-theme.test.mjs`
- JavaScript syntax and local HTML asset/ID checks
- Music catalog, original covers, previews, music and cart scripts unchanged

Desktop/tablet/mobile visual and live deployment verification are pending.
The local server was unreachable from the available cloud browser. A 95%
visual match is a build target, not a verified measurement.

Recovery source before this branch: `b97ee68e6fc5d5bb34f81979c6d33f78037107d7`.
Switch the owner selection to Original to restore the original appearance.
Future Spring/Easter themes require new assets/styles and new allowed values.
