# Raihan Agentic Inbox deployment

This fork is deployed to Cloudflare as a standalone managed inbox. It hosts two
mailboxes:

- `contact@raihanrazi.com` — Raihan Career Inbox
- `hello@codexdigital.ai` — Codex Digital Enquiries

## Production resources

- Worker: `raihan-agentic-inbox`
- Custom domain: `inbox.raihanrazi.com`
- R2 bucket: `raihan-agentic-inbox`
- Durable Objects: `MailboxDO`, `EmailAgent`, and `EmailMCP`
- Email Routing: exact-address rules for `contact@raihanrazi.com` and
  `hello@codexdigital.ai` (`worker:raihan-agentic-inbox`)
- Email Sending: enabled for `raihanrazi.com` and `codexdigital.ai`
- Cloudflare Access application: `Raihan Agentic Inbox`
- Access administrator: `contact@codextech.com.au`
- Human policy: `Raihan Inbox Admin` (`Allow`)
- Machine policy: `Raihan Career Agent Service` (`Service Auth`), scoped to the
  `Raihan Career Agent Inbox` service token

The catch-all Email Routing rule remains disabled. Incoming mail is retained in
this inbox and is not forwarded to the previous destination.

## Configuration

Production configuration lives in `wrangler.jsonc`. Cloudflare stores
`POLICY_AUD` and `TEAM_DOMAIN` as Worker secrets; do not commit their values.

The upstream MCP tools, including send and delete, remain enabled. The outbound
email binding is restricted to `contact@raihanrazi.com` and
`hello@codexdigital.ai` as senders.

`DOMAINS` and `EMAIL_ADDRESSES` list every domain and mailbox address this
Worker accepts. Adding a mailbox requires both: the address in
`EMAIL_ADDRESSES`, then the mailbox record itself.

## Codex Digital website enquiries

The `codexdigital` Worker (separate repository, `codexdigital.ai`) handles
`POST /api/contact` and sends the notification to `hello@codexdigital.ai` from
`website@codexdigital.ai`, with `Reply-To` set to the enquirer. Mail then flows
through the `hello@codexdigital.ai` routing rule into the Codex Digital
Enquiries mailbox. Replying from this inbox answers the enquirer directly.

Lead delivery therefore depends on the `EMAIL_ADDRESSES` value in this Worker's
configuration. Do not remove `hello@codexdigital.ai` from that list while the
website form is live.

The career agent reads the REST API using Cloudflare Access service-token
headers. The token value is stored outside Git in the career-agent state
directory. Its current five-year credential expires on 21 July 2031.

## Mailbox initialization

Create the mailbox through the authenticated API after the first deployment;
the R2 object key must end in `.json`, and the API also initializes its Durable
Object folders:

```sh
curl -X POST https://inbox.raihanrazi.com/api/v1/mailboxes \
  -H 'Content-Type: application/json' \
  -H 'CF-Access-Client-Id: ...' \
  -H 'CF-Access-Client-Secret: ...' \
  --data '{"email":"contact@raihanrazi.com","name":"Raihan Career Inbox"}'
```

Do not create a bare `mailboxes/contact@raihanrazi.com` R2 key; the application
looks for `mailboxes/contact@raihanrazi.com.json`.

## Deploy

```sh
npm ci
npm run typecheck
npm run build
npm run deploy
npx wrangler triggers deploy
```

The separate trigger step ensures the custom-domain route is applied when the
React Router build uses its redirected Wrangler configuration.

## Automatic production deployments

Cloudflare Workers Builds is connected directly to
`codex-tech-admin/agentic-inbox`.

- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`
- Non-production branch builds: disabled

Merging a pull request into `main` now starts a production build and deploys the
result to the existing `raihan-agentic-inbox` Worker.
