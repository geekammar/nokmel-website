# W5 external integrations — setup handoff

Engineering handoff for Google Analytics 4 reporting/tracking and owner
Telegram notifications. These are **external operator actions**. The coding
agent did not create Google Cloud/GA4/Telegram resources, obtain credentials,
configure Vercel, or apply hosted migrations.

Both integrations are disabled by default. The business Overview and all owner
request management continue to work when either integration is unconfigured,
disabled, failing or out of quota.

## 1. Google Analytics 4

### 1.1 Create the property and stream

1. Create or use a **standard GA4 property** (not Universal Analytics).
2. Set the property timezone to **Africa/Cairo**. The dashboard sends
   Africa/Cairo calendar dates; GA4 date ranges are evaluated in the property
   timezone. A different property timezone makes the two date ranges disagree.
3. Create one **web data stream** for the public website origin
   (`https://nokmel.tech` in Production; the exact Preview origin for QA).
4. Record the public **Measurement ID** (`G-...`).
5. Record the numeric **Reporting Property ID** (Admin → Property settings).
6. Keep separate QA and Production GA4 properties/streams. Do not mix Preview
   test traffic with Production reporting.
7. Disable unrelated advertising features: no Google Ads links, remarketing,
   Google Signals or ad personalization.
8. Keep the approved minimal event vocabulary. In the web stream's Enhanced
   measurement settings, disable the options that would add events outside it:
   **Scrolls**, **Outbound clicks**, **Site search**, **Video engagement**,
   **File downloads** and **Form interactions**. Also disable the page-view
   advanced setting **“Page changes based on browser history events”** (or the
   equivalent history-based pageview option). Page-view collection itself is an
   automatic GA4 measurement; the app sets `send_page_view: false` and emits one
   manual, sanitized `page_view` per allowed route. Verify in DebugView/Realtime
   that one route produces one pageview. These provider-side settings are
   external and must not be assumed verified until checked.
9. Register `join_request_success` as a **key event (conversion)** if a
   join-specific rate is required. GA4 exposes
   `sessionKeyEventRate:join_request_success` only for a registered key event;
   otherwise the dashboard shows the rate as unavailable rather than zero. The
   app sends the event only after a successful intake response.
   `join_cta_click` is an ordinary event. Do not treat pageviews or form opens
   as conversions.
10. Do not rely on manual event sanitization alone. The app also sets sanitized
    `page_location`/`page_referrer` as tag-level defaults, disables Google
    Signals and ad personalization, and sets `send_page_view: false`; external
    enhanced-measurement settings must still be reviewed as above.

### 1.2 Read-only reporting service account

1. Create a Google Cloud service account for reporting (no interactive user).
2. Enable the **Google Analytics Data API** for its project.
3. Create a JSON key. Store it in the secret manager; never commit it.
4. In GA4 Admin → Property access management, add the service-account email as
   a **Viewer** (read-only). It needs no edit/publish role.
5. Confirm the minimum OAuth scope used by the app:
   `https://www.googleapis.com/auth/analytics.readonly`.

The app signs its own JWT assertion with the service-account private key and
calls the Data API directly. No Google Cloud SDK or extra runtime is installed.

### 1.3 Server environment variables

Configure these in the scoped Preview environment only. Never use
`NEXT_PUBLIC_*` for credentials and never put them in public settings, props,
client bundles, logs or issue/PR text.

| Variable | Secret? | Purpose |
|---|---|---|
| `GA4_PROPERTY_ID` | no (but server-only) | Numeric reporting property ID |
| `GA4_CLIENT_EMAIL` | no (but server-only) | Read-only service-account email |
| `GA4_PRIVATE_KEY` | **yes** | Service-account private key (PEM or `\n`-escaped) |
| `GA4_MEASUREMENT_ID` | no (public identifier) | `G-...` tag ID; required for public tracking |

Endpoint overrides are **not** operator settings. `GA4_API_BASE_URL`,
`GA4_TOKEN_ENDPOINT` and `GA4_TAG_BASE_URL` are accepted only when
`NOKMEL_DISPOSABLE_TEST_ENV=1` and the runtime is not hosted Preview/Production.
Never set these in Vercel.

### 1.4 Enablement and consent

1. Deploy the scoped Preview with the reporting and measurement variables.
2. Sign in as owner → Settings → Analytics. Verify reporting status is
   “ready” and tracking status is “ready”.
3. Leave the analytics preference **disabled** until the W6 privacy/consent
   approval is recorded. Enabling the preference shows the consent banner and,
   after a visitor grants consent, the GA4 script. No script, dataLayer,
   analytics cookie or event is created before that decision.
4. Visitors can change their choice at any time from the accessible
   **تفضيلات التحليلات** entry in the public footer. The initial default is
   disabled; declining and later granting (or the reverse) is supported.
   Consent is not required to use the site or submit a join request.
5. Admin, login, protected previews, request details and API routes are
   excluded from the public tracker. Only the seven public routes are sent,
   with sanitized page locations/referrers (no query strings or personal
   data). If the public layout unmounts while navigating to a protected route,
   cleanup additionally sets `window['ga-disable-MEASUREMENT_ID'] = true`.
   GA4 property settings and DebugView behavior must still be verified
   externally; the app does not claim provider-side guarantees.
6. Withdrawing consent immediately stops application-generated events, sends a
   documented Consent Mode `update` with `analytics_storage: 'denied'`, sets
   the documented `ga-disable` flag, and expires accessible first-party `_ga`,
   `_ga_*` and `_gid` cookies on the current host/path. A loaded tag may require
   a page reload to unload fully; the preferences UI offers an explicit reload
   action, and a reload does not resume tracking because the denied choice is
   persisted. Withdrawal does **not** retroactively delete data already sent to
   Google, and cookies outside the current document's path/domain control may
   remain.
7. If the property is unavailable, quota-limited, misconfigured or returns
   malformed data, the dashboard shows an honest unavailable/not-configured or
   partial state; no zero or fake visitor value is substituted.
8. Provider consent/processing/retention wording and final activation remain
   subject to W6 privacy approval.

### 1.5 What is reported

Bounded server reports: `totalUsers`, `sessions`, `screenPageViews`; top public
`pagePath` views; `sessionSourceMedium`; event counts for `join_cta_click` and
`join_request_success`. Pricing/join page views are derived from the public
`pagePath` rows. If (and only if) the success-event count is greater than zero,
one optional report requests `sessionKeyEventRate:join_request_success`. That
metric exists only when the event is registered as a key event; an unavailable
optional conversion report does not make valid traffic totals unavailable.
The generic `sessionConversionRate` is **not** requested or presented as
join-request conversion.

At most one token request plus five reports (four parallel traffic reports and
the optional event-specific rate) are made per dashboard load, with 5-second
timeouts and a 5-minute in-process cache. Reports are aggregate only; owner
sessions are not cached.

Conversion limits: a join-specific rate is shown only when the event is
registered and sessions exist. Browser events may be missing due to consent,
blockers, network failures or reporting delay. The authoritative
accepted-request count always comes from PostgreSQL. A requests-to-users value
is a labelled cross-source ratio, not a verified visitor conversion rate.

Official references:
- Data API schema/metrics: https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema
  (see `sessionKeyEventRate:event_name`).
- Consent mode: https://developers.google.com/tag-platform/security/guides/consent
- Privacy controls / `ga-disable`: https://developers.google.com/tag-platform/security/guides/privacy
- Enhanced measurement options: https://support.google.com/analytics/answer/9216061

W6 must approve the final provider processing/consent/retention wording and any
required consent-management changes before Production activation.

## 2. Owner Telegram notifications

### 2.1 Create a dedicated website bot

1. Create a **new dedicated bot** for the website via the official BotFather.
   Do not reuse any commerce/store bot.
2. Record its token. The token is a server secret: environment variable only,
   never settings, a public page, logs, PR text or the repository.
3. The owner must start a private chat with the new bot (send it a message).
4. Determine that private chat's numeric ID. Use only the dedicated website bot
   for this one-time manual step. **Never call `getUpdates` on an existing
   commerce bot or any bot belonging to another workflow.** The application
   itself never drains updates or pairs chats publicly.
5. Keep the destination private. It must never be accepted from a visitor or an
   arbitrary user-supplied chat ID.

### 2.2 Configure and verify

Server environment (scoped Preview only):

| Variable | Secret? | Purpose |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | **yes** | Dedicated website bot token |
| `TELEGRAM_API_BASE_URL` | no | Disposable-test override only; never set in Vercel |

1. Sign in as owner → Settings → Notifications.
2. Enter the numeric private chat ID and save. The group has its own optimistic
   revision. The protected owner page may hold the full destination for editing;
   mutation readbacks return only the masked destination, and public loaders
   never select private destination fields.
3. Use **Send test message** (explicit owner action) **before enabling automatic
   delivery**. Testing is allowed while automatic delivery is disabled, requires
   the saved destination and configured bot token, calls `getMe`, and sends a
   synthetic non-PII message to the fixed destination. It is limited to one test
   per 30 seconds by a durable database slot.
4. Testing never enables automatic delivery as a side effect. Only after the
   test succeeds, enable automatic notifications and save.
5. Changing the destination clears the cached bot identity and last test
   timestamp, so a previous verification is never presented as verification of
   the new destination. Send a new test before relying on it.
6. If the token/destination is missing or invalid, test/enablement remains
   safely unavailable; request intake is unaffected.

### 2.3 Delivery behavior and limits

- Accepted requests are persisted/committed first. Delivery is attempted after
  commit and awaited (bounded ~6 s); a notification failure never rolls back or
  invalidates the request.
- Durable states: `skipped`, `pending`, `sending`, `sent`, `failed`,
  `uncertain`. The request detail shows the state and a manual retry only for
  safely recoverable states.
- A database claim prevents concurrent retries. The claim writes a stable
  attempt timestamp (`notification_attempted_at`); completion updates are
  fenced on `notification_state = 'sending'` **and** that exact attempt. A
  delayed older attempt therefore cannot overwrite a newer claim or a completed
  result. A `sending` claim older than 5 minutes is treated as
  stale/recoverable. A sent notification is never automatically resent.
- If Telegram may have accepted the message but the completion result cannot be
  persisted (database failure), the outcome is reported as `uncertain`
  (`persistence`), not as a definite failure. The durable row may remain
  `sending` until the stale window; the owner can retry explicitly and may
  receive a duplicate. No exactly-once delivery is guaranteed or claimed.
- A timeout or 5xx may mean Telegram accepted the message. Such results are
  `uncertain`; manual retry may duplicate the message and the UI warns about
  this.
- No notification is sent for rejected/invalid submissions or same-token
  replays. The public success response stays the minimal generic contract.
- The message is plain text (no markup/`parse_mode`) and includes only status,
  plan, bounded source, historical promotion context, Cairo time and the
  protected owner request link. It excludes name, phone, email, business
  activity, notes, raw request IDs/tokens and credentials.

## 3. Activation checklist (external)

- [ ] W5 migration 0005 applied to hosted Development with temporary migrator
      database-level CREATE, then revoked.
- [ ] `GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO
      nokmel_runtime;` applied; runtime still has no DDL/TRUNCATE.
- [ ] Scoped Preview environment variables set (never Production).
- [ ] GA4 property timezone Africa/Cairo; separate QA data; Data API enabled;
      read-only service account has Viewer access.
- [ ] Enhanced measurement reduced to the approved vocabulary (Scrolls,
      Outbound clicks, Site search, Video engagement, File downloads, Form
      interactions off; history pageviews off); DebugView shows one pageview
      per route.
- [ ] `join_request_success` registered as a key event if the join-specific
      rate is required; otherwise the dashboard shows it unavailable.
- [ ] Consent banner and footer preferences tested for accept, decline,
      withdrawal, reload and previously-declined visitors; no script/cookie/
      event before decision; no admin tracking.
- [ ] Telegram dedicated website bot created; owner started it; private chat ID
      saved; explicit test message received while automatic delivery was
      disabled; only then automatic delivery enabled.
- [ ] Changing the Telegram destination clears verification and requires a new
      test.
- [ ] Owner analytics/notification preferences enabled only after W6 privacy
      approval and successful verification.
- [ ] Independent acceptance of Overview, Settings, GA4 states and Telegram
      success/failure/retry/deduplication/attempt-fencing behavior.
- [ ] No Production activation, DNS change, indexing enablement or paid resource
      creation without explicit W6 launch approval.

## 4. Failure/limitation summary

- GA4 reporting may be delayed; the dashboard never claims real-time data.
- Provider events are not authoritative request counts and may be missing.
- The join-specific key-event rate is unavailable unless the event is
  registered in GA4; traffic totals remain available without it.
- Withdrawal stops future app events and applies Consent Mode/`ga-disable`/
  cookie expiry, but cannot retroactively delete data already sent to Google or
  guarantee unloading an already-executed third-party script without a reload.
- Telegram delivery is best-effort with honest `uncertain` states; duplicates
  are possible on manual retry. A provider success whose result cannot be
  persisted is `uncertain`, not a confirmed failure.
- Notification and analytics configuration is per environment; setting one
  environment does not configure another.
