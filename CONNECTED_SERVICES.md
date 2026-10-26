# ChatGPT Connected Services — Verification Register

**Last verified:** 2026-10-26
**Applies to:** The user's ChatGPT connections used for Echo Craft Music and Echo Craft Studio.
**Purpose:** Stop future assistant sessions from overlooking already-connected tools and unnecessarily asking the owner for screenshots or credentials.

## Verified working on October 26, 2026

| Service | Connection verification | How to use it |
|---|---|---|
| **Cloudflare** | The connected Cloudflare integration successfully returned the authenticated user/account identity through a read-only `whoami` request. | Search for available Cloudflare tools and inspect the applicable zone, DNS, rules, Workers, Pages, R2 or D1 directly **when the connector's available permissions support the requested action**. |
| **Supabase** | The connected Supabase integration successfully returned the user's project listing through a read-only `list_projects` request. | Identify the intended project first; inspect its schema, RLS policies, functions, authentication configuration, logs and security advisors using connected Supabase tools. |
| **GitHub** | The GitHub integration read and updated project documentation during this work. | Read the latest repository state and guardrails before source changes. Do not assume source equals deployed production. |

## Required approach in future sessions

1. **Check the connected tools first.** The owner's Cloudflare and Supabase accounts were connected and their read access was verified on the date above. Tool availability and scopes can change; re-confirm with a small read-only call in each new session as needed. This Markdown document records prior access; it does **not** itself grant access or guarantee permanent access.
2. **Use connected resources rather than asking the owner to manually duplicate work** when the requested action is supported by the connector. Ask for dashboard screenshots or owner action only when the connector lacks the necessary scope, the target cannot be identified confidently or a sensitive decision needs authorization.
3. **Read first, modify cautiously.** For security reviews, start with read-only inspection. Obtain explicit owner approval before database migrations, permission changes, destructive/production changes, secrets rotation, transactions, deletions or anything that could disrupt checkout, client records, commissions, authentication or downloads. Observe tool-specific authorization.
4. **Verify the correct target.** Cloudflare zones, Supabase projects and GitHub repositories are distinct; do not assume credentials or deployments map one-to-one. Echo Craft Music may have a separately deployed production Cloudflare Worker that differs from checked-in sandbox source.
5. **Do not put secrets in GitHub.** Never copy API tokens, personal account details, bearer tokens, passwords, connection responses, project private IDs or database data into this file. The fact that a connection worked is sufficient.
6. **After a change**, check the source and, where practical, the *live* result; keep the site's security/verification register current. Never call an untested production change verified.

## Current related work

- **Echo Craft Studio:** Security headers verified live October 26, 2026. Next priority: read-only Supabase RLS, grants, and `SECURITY DEFINER` function review for admin, partners, referral commissions and intake; then verify deployed legacy admin routes and public forms. Refer to `SECURITY_AUDIT.md` in the Studio repository.
- **Echo Craft Music:** Read the existing purchase/download verification register before new testing. Do not replace the production Worker with older GitHub code. Cloudflare connector can help inspect actual zone, Worker and R2 configurations if permissioned.
