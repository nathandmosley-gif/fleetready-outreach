# FleetReady Index — Outreach + Auto-Reply System

## What's in here
- `outreach-copy.md` — initial email + SMS copy for cold carrier outreach
- `src/server.js` — Express server with two webhooks (SMS + email replies)
- `src/classify.js` — keyword-based reply classification (INTERESTED / OPT_OUT / QUESTION / UNCLEAR)
- `src/draftReply.js` — calls the Claude API to draft answers to open-ended questions
- `src/store.js` — Airtable integration to track lead status
- `.env.example` — copy to `.env` and fill in your keys

## Setup (roughly 30–45 min)

1. **Install deps**
   ```
   npm install
   ```

2. **Twilio**
   - Buy/verify a number for SMS.
   - Under that number's config, set "A message comes in" webhook to `https://yourdomain.com/webhook/sms`.
   - Twilio auto-handles STOP/HELP compliance keywords — don't disable this.

3. **SendGrid**
   - Verify your sending domain.
   - Set up **Inbound Parse**: point a subdomain (e.g. `reply.yourdomain.com`) at `https://yourdomain.com/webhook/email`.
   - Replies to your outbound emails should use that subdomain as the reply-to address.

4. **Airtable**
   - Create a base with a `Leads` table: columns `Name`, `Phone`, `Email`, `DOT Number`, `Status`, `Last Reply`, `Last Reply At`.
   - Grab your API key + base ID from airtable.com/create/tokens.

5. **Env vars**
   - Copy `.env.example` to `.env`, fill in Twilio, SendGrid, Airtable, and Anthropic keys.

6. **Run it**
   ```
   npm start
   ```
   Deploy behind a real domain (Render, Railway, Fly.io, or a small VPS all work fine) so Twilio/SendGrid can reach the webhook.

## How it behaves out of the box

- **"YES" / "interested"** → auto-sends the assessment link immediately.
- **"STOP" / "not interested"** → marks opted out in Airtable (Twilio/SendGrid also handle compliance-level suppression).
- **Questions** ("how much," "?") → drafts a reply with Claude but does **NOT** auto-send yet — it logs the draft to console and flags the lead as "Needs Manual Reply" in Airtable. This is intentional: review a few weeks of drafts before flipping `AUTO_SEND_AI_REPLIES = true` in `server.js`.
- **Anything else** → flagged "Needs Manual Review," no auto-response sent.

## Before you send at volume
- Confirm your lead source gives you consent to text carriers (TCPA) — this varies by how the numbers were collected.
- Add a physical mailing address to your email footer (CAN-SPAM requirement).
- Test both webhooks with a real reply before your first real batch send.
