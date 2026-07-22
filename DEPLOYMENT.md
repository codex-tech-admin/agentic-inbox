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

The catch-all Email Routing rule remains disabled. Incoming mail is retained in
this inbox and is not forwarded to the previous destination.

## Configuration

Production configuration lives in `wrangler.jsonc`. Cloudflare stores
`POLICY_AUD` and `TEAM_DOMAIN` as Worker secrets; do not commit their values.

The upstream MCP tools, including send and delete, remain enabled. The outbound
email binding is restricted to `contact@raihanrazi.com` as the sender.

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
