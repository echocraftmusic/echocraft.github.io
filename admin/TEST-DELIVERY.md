# Owner Sandbox delivery test

This first test supports a single with a ready, privately uploaded MP3. It is restricted to the existing confirmed admin accounts and disabled outside Square Sandbox. It does not enable customer downloads, emails, real sales counts, or a three-download entitlement.

1. Deploy the complete updated `cloudflare/music-admin-worker.js` to the existing music admin Worker. No new secrets or bindings are needed beyond existing Sandbox credentials, ADMIN_STAGING, and PURCHASE_FILES.
2. Sign in at Admin, choose Purchase Files, and choose **Test checkout & delivery** for A Light Through Darkness.
3. Confirm the test selection and start Square checkout. Use the Sandbox panel's **Test Payment** operation.
4. Follow Square's return link to the new `/purchase-complete.html?test=…` page. If necessary, reopen `/admin/test-delivery.html` in the same browser to resume the last test.
5. Echo Craft retrieves the Square order and its payments server-side. A COMPLETED payment must belong to the saved order/location, cover its USD total, and have no refund. Only then does **Download full MP3** appear. Download rechecks the payment and returns the saved MP3 snapshot with no-store headers.

Sessions expire after 24 hours. Replacing an upload does not change the existing test's file snapshot. No public storage URL or bearer download token is created. Sharing this page does not bypass owner authentication. Failed Square verification never falls back to an unverified download.

The normal storefront cart and its existing return page remain unchanged. This test validates payment-to-download delivery for the administrator; it does not validate transactional email or customer entitlement limits. Production fulfillment remains a separate, unfinished feature.

Checks: `node cloudflare/sandbox-delivery.test.mjs`, `node cloudflare/square-checkout.test.mjs`, `node cloudflare/purchase-files.test.mjs`, and `node cloudflare/music-admin-worker.test.mjs`.

Recovery reference before the original delivery test: main commit `76f9e1c7d51572b839f8c90756f622e4241c782b`. The styled confirmation page and updated test return URL were added after `1dbbb5419fb7899b07cbbaeb87a85f1034d57afc`. No catalog, cover art, preview files, product prices, or storefront theme is changed.

## Styled confirmation page

`/purchase-complete.html?preview=1` is a clearly labeled design preview; its download button is disabled and its sample three-download count is not a real entitlement. `/purchase-complete.html?test=<saved-session>` uses owner authentication and live Square Sandbox verification. No query flag can unlock a download. The test displays no numerical download limit because enforcement is not implemented yet. The page without a valid test link does not assert payment success or grant any files.

The normal storefront checkout continues to return to its existing Sandbox placeholder. Production customer fulfillment, three-download entitlements, order emails, and production payment activation remain unfinished. The new page does not clear unrelated cart items during an admin test.
