# Raihan Agentic Inbox deployment

This fork is deployed to Cloudflare as a standalone managed inbox. It hosts six
mailboxes:

- `contact@raihanrazi.com` — Raihan Career Inbox
- `hello@codexdigital.ai` — Codex Digital Enquiries
- `hello@semanticlab.ai` — SemanticLab Inbox
- `hello@sponsoredfeeds.com` — SponsoredFeeds Inbox
- `codex-studio-test@sponsoredfeeds.com` — SponsoredFeeds app test identity
- `demo@sponsoredfeeds.com` — SponsoredFeeds web video demo identity

## Production resources

- Worker: `raihan-agentic-inbox`
- Custom domain: `inbox.raihanrazi.com`
- R2 bucket: `raihan-agentic-inbox`
- Durable Objects: `MailboxDO`, `EmailAgent`, and `EmailMCP`
- Email Routing: exact-address rules for `contact@raihanrazi.com`,
  `hello@codexdigital.ai`, `hello@semanticlab.ai`, and
  `hello@sponsoredfeeds.com`, `codex-studio-test@sponsoredfeeds.com`, and
  `demo@sponsoredfeeds.com`
  (`worker:raihan-agentic-inbox`)
- Email Sending: enabled for `raihanrazi.com`, `codexdigital.ai`,
  `semanticlab.ai`, and `sponsoredfeeds.com`
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
email binding is restricted to the six configured mailbox addresses as
senders.

`DOMAINS` and `EMAIL_ADDRESSES` list every domain and mailbox address this
Worker accepts. Adding a mailbox requires both: the address in
`EMAIL_ADDRESSES`, then the mailbox record itself. It also requires an exact
Email Routing rule to deliver incoming mail to the Worker. Mail stays in
`inbox.raihanrazi.com`; it is not forwarded to an external mailbox.

## SponsoredFeeds demo mailbox rollout

The web video uses `demo@sponsoredfeeds.com` as a separate app login identity.
The mailbox address is restricted in `wrangler.jsonc` as an accepted recipient
and an outbound sender; it does not grant access to other mailboxes or change
SponsoredFeeds web app permissions.

1. Run `npm run check`. This regenerates Wrangler binding types and checks the
   source and flattened artifact allowlists, build, and both Wrangler dry runs.
   Confirm the generated
   `worker-configuration.d.ts` reflects the configuration.
2. After approval, merge the exact reviewed commit into `main` and wait for its
   Cloudflare Workers Build to finish. Confirm the deployed version has
   `demo@sponsoredfeeds.com` in `EMAIL_ADDRESSES` and in the `EMAIL`
   binding's `allowed_sender_addresses`.
3. Create the exact-address Email Routing rule (the catch-all remains disabled):

   ```sh
   npx --yes wrangler@4.149.0 email routing rules create sponsoredfeeds.com \
     --name "SponsoredFeeds demo inbox" \
     --match-type literal --match-field to \
     --match-value demo@sponsoredfeeds.com \
     --action-type worker --action-value raihan-agentic-inbox
   ```

   The repository's pinned Wrangler version does not yet expose the Email
   Routing CLI commands, so use the version shown for this step.

4. Open the authenticated `https://inbox.raihanrazi.com/` mailbox hub. Its
   configured-address list creates the R2 mailbox record and Durable Object
   folders on first load. Verify `demo@sponsoredfeeds.com` appears in the hub.
5. Send a test message to the address and verify it appears in the new mailbox.
   Then request a SponsoredFeeds web sign-in code and verify delivery in the
   same mailbox. Only after that should the demo account be onboarded.

Rollback: disable or delete only the `SponsoredFeeds demo inbox` routing rule,
then revert the config commit and wait for the resulting Workers Build. Preserve
the R2 mailbox record and Durable Object messages until any demo login or
recordings are no longer needed; deleting them would discard received mail.

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
