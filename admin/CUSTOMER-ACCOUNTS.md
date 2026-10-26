> **Current production verification reference (October 18–19):** [Verification Register in root README](../README.md#previously-verified-in-production--october-18-2026) and [download-limit results](../README.md#download-limit-enforcement--october-19-2026). This document describes an earlier, sandbox-era implementation. Its statements that production payments or three-download enforcement are unfinished **were superseded by later owner-tested production results**. Do not deploy its older Worker over the verified live production version.


# Customer registration and My Music

This feature adds a prechecked registration choice during checkout, passwordless customer sign-in, private purchase history, independent promotional email preferences, and reversible closure of music-account access. Payments remain Sandbox-only. Real payment activation, receipt emails, and three-download enforcement are unfinished.

## One-time setup

1. Deploy the complete updated `cloudflare/music-admin-worker.js` to the existing music admin Worker. It uses the existing ADMIN_STAGING and PURCHASE_FILES private bindings; no new binding or privileged Supabase key is required.
2. In the existing Supabase project, open Authentication → URL Configuration. **Add** `https://echocraftmusic.com/my-music.html` to Redirect URLs. Keep existing admin URLs and the existing Site URL. The public auth settings were checked: email sign-up is enabled and email confirmation is required.
3. Open My Music, register with your own email, and follow the email sign-in link. The name and promotional email choice populate the music profile after confirmation. If an existing identity lacks registration metadata, finish the short account setup form.
4. Add A Light Through Darkness to the cart, keep account registration selected, accept the purchase agreement, and run Square Sandbox checkout. Other releases need all full tagged MP3s uploaded before registered checkout can proceed.
5. After Test Payment, return to the confirmation page. Only a matching completed, unrefunded Square payment unlocks downloads. The purchase is also visible later in My Music. Library visits can verify pending purchases even if the customer never returned immediately from Square.

The preview at `/customer-checkout-preview.html` uses a separate preview cart and cannot send a registration email or begin a payment. `/customer-account-layout-review.html` offers phone/tablet/desktop layout checks.

## Access boundaries

- Customer sessions use `echo-craft-customer-auth-v1`; admin sessions retain their existing storage. Customer sign-out uses local session scope.
- Supabase verifies the bearer token server-side. Confirmed user ID and email come from that response, never request fields.
- Customer routes are handled before, and separately from, the unchanged admin email allowlist. Registration never adds an admin.
- Data stays in the private ADMIN_STAGING namespace `customer-accounts/<verified-user-id>/`. Orders are immutable file snapshots with separate newest-first library pointers. A customer can only retrieve their own records.
- Full MP3s stay in private PURCHASE_FILES. Public responses never contain R2 object keys. Downloads recheck order, location, USD amount, completed payment status, refund status, and account access.
- Prices come from the server catalog. Missing or stale tagged files block checkout. Digital quantity stays one.
- Production requests are rejected; neither guest nor registered checkout enables real payments.

## Preferences and closure

The promotional checkbox starts unchecked. Opting out only changes the private music-profile preference; purchases and sign-in still work. No newsletter campaign or external mailing list is connected or modified by this feature. Future campaign delivery must honor this preference and the closure marker.

Closing the music account requires a warning and explicit confirmation. It writes a separate closure marker that profile updates cannot remove, disables purchase access, and turns promotional email preference off. It retains transactions and the authentication identity; it is not permanent data erasure. Previously downloaded local files remain on the customer's device. Signing in and choosing Restore My Music access removes the closure marker but does not opt the customer back into promotions.

## Validation and recovery

Run `node cloudflare/customer-accounts.test.mjs`, the existing Worker/payment/file-delivery tests, `node scripts/customer-auth.test.mjs`, `node scripts/cart-digital.test.mjs ../js/cart-customer.js`, and `node scripts/purchase-complete.test.mjs`.

Recovery reference before customer-account work: `a3a43dcdb55f1bc36298375667402836cd144489`. The old `js/cart.js` is retained. Catalog JSON, prices, covers, preview audio, themes, admin auth, and existing admin uploads are unchanged. Restore the prior index and receipt files to remove storefront links; restore the previous Worker to remove customer routes. Keep private customer records for recovery.
