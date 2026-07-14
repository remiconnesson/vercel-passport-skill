# vercel-passport-skill

An agent skill that adds the auth layer to vibecoded apps deployed behind
[Vercel Passport](https://vercel.com/docs/passport). Passport authenticates
every visitor against your organization's identity provider before requests
reach the app — so there is no login page, OAuth flow, or password storage to
build. The skill teaches coding agents exactly that: don't build auth, read
the verified identity instead.

## Install (participants)

Inside your project repo:

```bash
npx skills add remiconnesson/vercel-passport-skill
```

This installs the `vercel-passport` skill for the coding agents you use
(Claude Code, GitHub Copilot, Cursor, Codex, and many others via
[skills.sh](https://skills.sh)). Then ask your agent:

> Show who's signed in on the home page and store their theme preference.
> Use the vercel-passport skill.

The agent copies `lib/auth.ts` into your project and builds on the verified
identity.

## What you get

```ts
import { getUser, requireUser } from "@/lib/auth";

const user = await getUser();     // { id, email, name, claims } | null
const user = await requireUser(); // throws when absent

user.id; // stable per-visitor id — key your data by this
```

Under the hood:

- Vercel Passport authenticates visitors at the platform edge and injects a
  signed identity token into the `x-vercel-oidc-passport-token` header.
  Vercel strips client-supplied values for that header, so the app can trust
  it.
- `lib/auth.ts` (~140 lines, zero dependencies) decodes the token and exposes
  a typed user. `external_sub` becomes `user.id`; email/name are null-safe
  because identity providers don't always share them.
- Local dev fallback: `PASSPORT_DEV_USER=you@example.com` in `.env.local`
  simulates a signed-in user. Disabled in production builds by construction.

Pairs with [vercel-blob-data-layer](https://github.com/remiconnesson/vercel-blob-data-layer):
`profiles.set(user.id, {...})` gives you per-user persistence with no
database either.

## Requirements

- A Vercel **Enterprise** team with Passport enabled on the project
  (Project Settings > Passport, or a team default). Hackathon organizers
  typically preconfigure this — participants don't touch it.
- Next.js App Router for `getUser()`/`requireUser()`;
  `getUserFromRequest(request)` works in any framework with standard
  `Request` objects.

## Repo layout

```
skills/vercel-passport/SKILL.md         instructions your agent follows
skills/vercel-passport/assets/auth.ts   the auth helper that gets copied into projects
tests/auth-test.ts                      local test of the helper (crafted JWTs, no infra)
```

## Development

```bash
pnpm install
pnpm typecheck   # checks auth.ts against next/headers types
pnpm test        # exercises token parsing, dev fallback, prod safety
```

MIT license.
