# PRODUCT_SPEC.md — Nokmel Website

Status legend: **[APPROVED]** = decided by technical lead / product owner. **[PROPOSAL]** = proposed, needs approval. **[OPEN]** = unresolved question. **[UNVERIFIED]** = stated but not yet verified.

## 1. Product objective [APPROVED]

Build a simple, professional, mobile-first SaaS marketing website with a lightweight owner-only administration dashboard. Primary business objective: convert interested merchants into early-access applicants and, later, paying subscribers. Start simple, design for change, scale only when necessary.

## 2. Repository and environment [APPROVED]

- Repository: `geekammar/nokmel-website` (id 1470006851), default branch `main`. **[VERIFIED 2026-11-24]** — delivered via branch `vibe/w0-project-context-65bf39` and draft PR #1.
- Target domain: `nokmel.tech`
- Future hosting: Vercel, account `ammarjaberd`
- Separate marketing website; the Nokmel commerce platform repository must not be accessed or modified.

## 3. Public website scope [APPROVED]

Pages:
1. Home / Landing Page (includes How It Works and FAQ as homepage sections, not separate pages)
2. Features
3. Pricing
4. Join / Early Access
5. Contact
6. Privacy Policy
7. Terms of Service

- Primary CTA: **Request to Join (اطلب الانضمام)** — highly visible throughout, especially on mobile.
- No demo or demo page.
- The homepage interactive product showcase is retained but **hidden by default** at initial launch and controlled by one CMS visibility field on the existing homepage showcase section. Hiding keeps all configured content and CTA data. The owner has not approved the current showcase placement/presentation for launch. A future compact phone-based automatically animated walkthrough (optimized silent WebM/MP4 preferred over GIF, verified merchant capabilities, reduced-motion/pause controls) is a potential direction, not approved scope or a launch blocker. No generic media library or page builder is approved.

## 4. Admin scope [APPROVED]

Exactly five primary sections:
1. **Overview** — authoritative database-backed early-access request metrics (period KPIs, current follow-up backlog, source/plan/promotion breakdowns, latest protected request links) plus optional owner-only Google Analytics 4 aggregate reporting. No revenue, ARR, MRR or subscription metrics. See §10–§12.
2. **Content & SEO** — editable page content, images, predefined sections, FAQ, and page-level editable SEO metadata (titles, descriptions, social sharing metadata per page).
3. **Plans & Pricing** — owner-managed marketing plans: immutable URL-safe slug, name, short description, ordered features, optional monthly and yearly prices in an explicit supported currency (or an honest unannounced-price state), display order, draft/publish/hide visibility, optional featured flag and editable early-access CTA. New plans are unpublished by default; editing a live plan never changes the public offer before explicit publication. One optional scheduled promotional discount per plan (W4.1): percentage or fixed, monthly/yearly/both, custom label, Africa/Cairo scheduled start/end, manual enable/disable, draft/published separation, protected preview, automatic time-based activation/expiration and a historical offer snapshot on new planned join requests.
4. **Requests** — owner-only join-request list/detail: name, normalized phone, optional email/business activity, optional selected plan, server-generated historical offer snapshot, acquisition source, status (`new` / `contacted` / `closed`), optional internal notes, filters, bounded pagination, search, and optional Telegram notification delivery state/manual retry. Public submissions are write-only and always start as `new`.
5. **Settings** — public contact/social links, private integration preferences (analytics and owner notifications), and owner account information. Owner authentication data is stored separately; the owner email/password are not editable from general settings.

Lightweight CMS with predefined components only. No generic website builder.

## 5. Pricing boundary [APPROVED]

- Website-managed plan offers are marketing data only during early access. Published marketing plans may be displayed on `/pricing` and selected from `/join?plan=<slug>`; this is lead intake, not merchant registration, checkout or a commercial subscription.
- A plan price may be absent (`NULL`, displayed as announced later) or explicitly zero; prices are exact integer minor units and are never used for billing or entitlement calculations. Promotional prices are derived at request time from published plan data and the authoritative server clock; no promotion stack, coupon, customer-specific discount or billing effect exists.
- Early-access join intake is controlled by a fail-closed server environment gate (`JOIN_INTAKE_ENABLED`). W4 enables it only for the authorized isolated development Preview; Production intake and the approved privacy/retention policy remain W6 launch prerequisites.
- They must not control actual subscriptions, commerce entitlements, or merchant permissions.
- Before commercial subscription activation, authoritative pricing and entitlement ownership belong to the Nokmel platform.
- No billing or payment processing in this phase. No invented or approved commercial prices.
- Commercial purchasing must not be enabled until the authoritative platform pricing and subscription flow are ready.

## 6. Brand identity [APPROVED reference / VERIFIED artifact]

- Only accepted reference: `Nokmel_Deep_Brand_Kit_v2.0.zip`. **[VERIFIED 2026-11-24 in the execution environment — archive SHA-256 `7c04840fc335daff52048f27b13ff3ac1e0159a3dc0d9299fbe8bf55b6931ff9`, independently confirmed by the external reviewer; see DESIGN_SYSTEM.md]**
- Do not use Brand Kit v1.0; do not recreate the logo, substitute fonts, or invent tokens.
- Working marketing headline (subject to owner approval) [PROPOSAL]: متجرك في المحادثة. وبزنسك في مكان واحد.
- Working brand tagline [PROPOSAL]: خلي بزنسك يكمل.

## 7. Design direction [APPROVED]

Premium minimal SaaS; Arabic-first with full RTL; English-ready architecture; mobile-first; clean typography and generous spacing; light surfaces with selected dark brand sections; clear, highly visible conversion CTAs; accessible interactions; no unnecessary animations or decorative complexity.

## 8. Explicitly out of scope [APPROVED]

Live demo, demo management, media library dashboard, security & activity dashboard, advanced CRM, blog, help center, marketing automation, advanced analytics, multiple admin roles, public account registration, automated subscriptions and billing, microservices, generic page builder. Security and authorization remain mandatory even without a dedicated security dashboard.

## 9. Acceptance gates per workstream

- W0: docs present, branch + draft PR exist, scope/boundaries documented. Gate: external review of docs.
- W1: foundation builds; design tokens derived from Brand Kit v2.0 only.
- W2: all approved public pages render RTL-first, mobile-first, with visible CTA.
- W3: owner-only admin auth works; content/SEO editable via predefined components.
- W4: plans editable as marketing data only; join requests captured and listed. Implemented on `feature/w4-plans-join-requests` with additive migration `0003_w4-plans-join-requests`; hosted activation and independent acceptance remain external. No billing/payment/entitlement code.
- W4.1: one optional scheduled promotional discount per plan, shared effective-offer resolver/version, stale-offer recovery at activation/expiration, and expanded historical offer snapshots. Merged via PR #8 (accepted HEAD `7d33ab734cc84cb51f17d67aa972390559c71e86`, merge commit `d50f7d555859b5f0ee4dc5b7075127f9e02eafde`); independent live acceptance 18/18, 0 FAIL/PARTIAL/BLOCKED. W4.1 is accepted for continued development.
- W5: business overview, external website analytics, optional owner Telegram notifications and website settings. Implemented on `feature/w5-analytics-notifications-settings` with additive migration `0005_w5-settings-notifications`; hosted integration activation remains external. The owner-supplied independent acceptance record reports 20/20 PASS. W5 does not add billing, CRM, marketing automation or a first-party analytics pipeline.
- W2-S: premium marketing design refinement and a verified interactive product showcase on the existing seven public routes, with owner-controlled visibility (default hidden). Implemented on `feature/w2s-marketing-design-showcase`; no migration, new route, showcase backend or external activation. Independent design acceptance and owner publication of any copy/SEO changes remain external.
- W6: launch acceptance by owner; no deployment without explicit approval.

## 10. W5 metric definitions and data-source boundaries [APPROVED for W5 implementation]

- **Period:** “last 7/30/90 days” means that many Africa/Cairo calendar dates including today. The database range starts at the first instant of the first Cairo date and ends exclusively at the first instant of tomorrow in Cairo. Metric labels state whether a value is period-scoped or an all-time backlog.
- **Received in period:** accepted, persisted `join_requests` created inside the period. Rejected/failed validation attempts and same-token replays do not create additional requests. Hidden-plan impressions are not plan interest.
- **Needs attention now:** all-time count of `status = 'new'`, deliberately independent of the selected period so older unattended requests are never hidden.
- **Contacted/closed:** current status of the period cohort (requests created in the period), labelled accordingly.
- **Source breakdown:** the stored bounded acquisition hint (`direct | pricing | join`). UTM values are shown separately. This is attribution context, not proof of actual browser navigation.
- **Plan interest:** grouped by the historical plan name captured at submission (`offer_snapshot` for W4.1 rows, legacy `plan_name_snapshot` otherwise). Renaming or hiding a plan never rewrites this metric.
- **Promotion context:** derived only from the immutable historical `offer_snapshot` (`active`, no active promotion, legacy unknown, invalid/unknown, no plan). Current plan promotion status is never used.
- **Latest requests:** the five newest accepted requests overall, explicitly labelled all-time, linking to existing owner-protected detail pages.
- **No commercial metrics:** no revenue, ARR, MRR, subscription conversion or billing metric is derived from early-access leads.

## 11. W5 external analytics and notifications [APPROVED for W5 implementation]

- **Provider:** Google Analytics 4 is the initial external analytics provider. Aggregate reporting uses the Google Analytics Data API server-side with a read-only service account and the minimum `analytics.readonly` scope. No Universal Analytics API, custom analytics database, `analytics_events` table, warehouse or session replay is introduced.
- **Enablement/privacy:** analytics is disabled by default. Tracking loads only when the owner preference is enabled, the server measurement configuration exists, and the visitor explicitly consents. No script, tracking cookie or event is sent before consent or when disabled. The public footer provides accessible preferences to view/change the decision, including for previously declined visitors; withdrawal immediately stops app-generated events, applies documented Consent Mode/`ga-disable` behavior, expires accessible first-party analytics cookies, and persists denial across reloads. Withdrawal does not retroactively delete data already sent to Google. Admin, login, protected previews, request details and API routes are not tracked; the public layout disables measurement when unmounting for protected navigation. Only the seven public routes are sent, with sanitized `page_location`/`page_referrer` and tag-level defaults; query strings and personal data are excluded. Google Ads, remarketing, Google Signals and ad personalization are disabled; external GA4 enhanced-measurement options must be reduced and verified.
- **Event vocabulary:** manual `page_view` (no duplicate initial pageview), `join_cta_click`, and `join_request_success` only after a successfully completed intake response. Same-token attempts do not add another browser conversion. Browser event counts are distinct from authoritative accepted-request counts and may be missing because of consent, blockers, network or reporting delay. A join-specific `sessionKeyEventRate:join_request_success` is shown only when GA4 registers the event as a key event; otherwise the rate is explicitly unavailable rather than zero or a generic conversion rate.
- **Provider failures:** disabled, not configured, unavailable and partial states are shown honestly; unavailable is never rendered as zero. Provider calls are bounded, timed out, server-cached briefly, validated before rendering, and mocked in automated tests.
- **Owner notifications:** optional Telegram Bot API notification to one fixed private owner destination. This is a separate website notification bot, not a commerce/store bot. The bot token is a server environment secret; the numeric chat destination is private owner configuration. The owner must save the destination and send an explicit test **before** enabling automatic delivery; testing is allowed while automatic delivery is disabled and never enables it. The message is plain text, contains no name/phone/email/business/notes/tokens, and links to the protected owner request page. Delivery is attempted only after the accepted request commits; failures never invalidate the request. Delivery attempts are fenced by a stable claim timestamp so an older attempt cannot overwrite a newer one; a provider success whose result cannot be stored is uncertain, not a confirmed failure. States are durable, retries are owner-triggered and database-guarded, and exactly-once delivery is not claimed.

## 12. W5 settings ownership [APPROVED for W5 implementation]

- One typed `site_settings` row with an allowlist of known fields. No generic key/value configuration editor.
- **Public values:** business contact email/phone, explicit Telegram/WhatsApp and social profile links. Public loaders select only these approved fields; unsupported hosts, unsafe schemes, credentials, queries and fragments are rejected. Empty means not configured.
- **Private values:** notification enablement, private Telegram destination, analytics enablement and owner-only integration status. Bot tokens and GA credentials remain server environment secrets and are never stored in settings or returned to clients/logs. Notification mutations return only the masked destination; the protected owner edit page may hold the full destination for intentional editing, but public loaders/pages never receive it. Changing the destination clears prior test/identity verification.
- **Ownership:** CMS remains authoritative for editable page copy, FAQ and SEO. Settings own contact/social destinations and integration preferences. Existing code-controlled CTA destinations are unchanged; no competing global CTA setting is introduced in W5.
- **Persistence:** owner-authorized server actions, strict server-side validation, independent optimistic revisions per settings group, atomic database updates, and visible success only after commit. Public settings changes are immediately effective; CMS content keeps its separate draft/published workflow.

## 13. Open questions [OPEN]

- ~~Delivery of `Nokmel_Deep_Brand_Kit_v2.0.zip`~~ — **RESOLVED 2026-11-24**: supplied and verified (SHA-256 match); W1 prerequisite met.
- Final approval of headline/tagline copy.
- ~~Choice of authentication library and external analytics provider~~ — **RESOLVED**: Better Auth 1.7.28 (W3.1) and Google Analytics 4 (W5).
- W2-S social-sharing candidate visual approval and any owner decision to select it for a page remain open; the current default social image is unchanged.
- Final W6 privacy/consent/retention approval for the analytics provider and owner notifications.
