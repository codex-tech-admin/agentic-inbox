# Raihan Agentic Inbox deployment

This fork is deployed to Cloudflare as a standalone managed inbox for
`contact@raihanrazi.com`.

## Production resources

- Worker: `raihan-agentic-inbox`
- Custom domain: `inbox.raihanrazi.com`
- R2 bucket: `raihan-agentic-inbox`
- Durable Objects: `MailboxDO`, `EmailAgent`, and `EmailMCP`
- Email Routing: exact-address rule for `contact@raihanrazi.com`
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
email binding is restricted to `contact@raihanrazi.com` as the sender.

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
