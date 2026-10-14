# Owner Sandbox delivery test

This first test supports a single with a ready, privately uploaded MP3. It is restricted to the existing confirmed admin accounts and disabled outside Square Sandbox. It does not enable customer downloads, emails, real sales counts, or a three-download entitlement.

1. Deploy the complete updated `cloudflare/music-admin-worker.js` to the existing music admin Worker. No new secrets or bindings are needed beyond existing Sandbox credentials, ADMIN_STAGING, and PURCHASE_FILES.
2. Sign in at Admin, choose Purchase Files, and choose **Test checkout & delivery** for A Light Through Darkness.
3. Confirm the test selection and start Square checkout. Use the Sandbox panel's **Test Payment** operation.
4. Follow Square's return link. If necessary, reopen `/admin/test-delivery.html` in the same browser to resume the last test.
5. Echo Craft retrieves the Square order and its payments server-side. A COMPLETED payment must belong to the saved order/location, cover its USD total, and have no refund. Only then does **Download full MP3** appear. Download rechecks the payment and returns the saved MP3 snapshot with no-store headers.

Sessions expire after 24 hours. Replacing an upload does not change the existing test's file snapshot. No public storage URL or bearer download token is created. Sharing this page does not bypass owner authentication. Failed Square verification never falls back to an unverified download.

The normal storefront cart and its existing return page remain unchanged. This test validates payment-to-download delivery for the administrator; it does not validate transactional email or customer entitlement limits. Production fulfillment remains a separate, unfinished feature.

Checks: `node cloudflare/sandbox-delivery.test.mjs`, `node cloudflare/square-checkout.test.mjs`, `node cloudflare/purchase-files.test.mjs`, and `node cloudflare/music-admin-worker.test.mjs`.

Recovery reference before this change: main commit `76f9e1c7d51572b839f8c90756f622e4241c782b`. No catalog, cover art, preview files, product prices, or storefront theme is changed.
