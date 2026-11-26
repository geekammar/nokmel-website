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
8. Disable the enhanced-measurement **“Page changes based on browser history
   events”** option (or equivalent history-based pageview measurement). The app
   sends one manual pageview per allowed route; leaving history pageviews on can
   duplicate App Router navigations.
9. Register `join_request_success` as a **conversion event** if conversion
   reporting is required. The app sends it only after a successful intake
   response. `join_cta_click` is an ordinary event. Do not treat pageviews or
   form opens as conversions.

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
   approval is recorded. Enabling the preference loads the consent banner and,
   after a visitor grants consent, the GA4 script.
4. The app never loads the script, sets analytics cookies or sends events when
   the preference is disabled or before consent. Admin, login, protected
   previews, request details and API routes are excluded. Only the seven public
   routes are sent, with sanitized page locations/referrers (no query strings
   or personal data).
5. If the property is unavailable, quota-limited, misconfigured or returns
   malformed data, the dashboard shows an honest unavailable/not-configured or
   partial state; no zero or fake visitor value is substituted.

### 1.5 What is reported

Bounded server reports: `totalUsers`, `sessions`, `screenPageViews`,
`sessionConversionRate`; top public `pagePath` views; `sessionSourceMedium`;
event counts for `join_cta_click` and `join_request_success`. Pricing/join page
views are derived from the public `pagePath` rows. At most one token request
plus four reports are made per dashboard load, with 5-second timeouts and a
5-minute in-process cache. Reports are aggregate only; owner sessions are not
cached.

Conversion limits: a provider-native session conversion rate is shown only when
the success event count and sessions exist. Browser events may be missing due
to consent, blockers, network failures or reporting delay. The authoritative
accepted-request count always comes from PostgreSQL. A requests-to-users value
is a labelled cross-source ratio, not a verified visitor conversion rate.

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
   revision; the ID is shown masked and is not rendered on public pages.
3. Use **Send test message** (explicit owner action). It calls `getMe` and sends
   a synthetic non-PII message to the fixed configured destination. It is
   limited to one test per 30 seconds by a durable database slot. Verify the
   bot identity and message arrive.
4. Only after the test succeeds, enable notifications and save.
5. If the token/destination is missing or invalid, test/enablement remains
   safely unavailable; request intake is unaffected.

### 2.3 Delivery behavior and limits

- Accepted requests are persisted/committed first. Delivery is attempted after
  commit and awaited (bounded ~6 s); a notification failure never rolls back or
  invalidates the request.
- Durable states: `skipped`, `pending`, `sending`, `sent`, `failed`,
  `uncertain`. The request detail shows the state and a manual retry only for
  safely recoverable states.
- A database claim prevents concurrent retries; a `sending` claim older than
  5 minutes is treated as stale/recoverable. A sent notification is never
  automatically resent.
- A timeout or 5xx may mean Telegram accepted the message. Such results are
  `uncertain`; manual retry may duplicate the message and the UI warns about
  this. **Exactly-once delivery is not guaranteed or claimed.**
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
- [ ] GA4 property timezone Africa/Cairo; separate QA data; history pageviews
      off; Data API enabled; read-only service account has Viewer access.
- [ ] Telegram dedicated website bot created; owner started it; private chat ID
      saved; explicit test message received.
- [ ] Owner analytics/notification preferences enabled only after W6 privacy
      approval and successful verification.
- [ ] Independent acceptance of Overview, Settings, GA4 states and Telegram
      success/failure/retry/deduplication.
- [ ] No Production activation, DNS change, indexing enablement or paid resource
      creation without explicit W6 launch approval.

## 4. Failure/limitation summary

- GA4 reporting may be delayed; the dashboard never claims real-time data.
- Provider events are not authoritative request counts and may be missing.
- Telegram delivery is best-effort with honest `uncertain` states; duplicates
  are possible on manual retry.
- Notification and analytics configuration is per environment; setting one
  environment does not configure another.
