# vercel-passport-skill

An agent skill for applications deployed behind
[Vercel Passport](https://vercel.com/docs/passport/read-identity). Passport
authenticates visitors before requests reach the application. The skill teaches
coding agents to use the official `@vercel/passport` package, read verified
identity in server-side code, and keep application authorization separate.

## Install

Inside an application repository:

```bash
npx skills add remiconnesson/vercel-passport-skill
```

Then ask the coding agent:

> Show who is signed in on the home page and store their theme preference.
> Use the vercel-passport skill.

The agent installs `@vercel/passport` in the application and uses
`getIdentity()`:

```ts
import { getIdentity } from "@vercel/passport";

const identity = await getIdentity();

identity?.subject;          // Stable identifier for one Passport issuer
identity?.payload.iss;      // Persist with subject for multiple issuers
identity?.externalSubject;  // Identity provider user id
identity?.email;            // Optional profile field
identity?.name;             // Optional profile field
```

The package verifies request tokens against Vercel's Passport JWKS. The skill
does not copy a JWT decoder into the application.

## Local development

Passport runs in Vercel's network. On localhost, `getIdentity()` supplies a
Passport-shaped development identity by default. Set `VERCEL_PASSPORT_DEV=0`
to test an unauthenticated request. Use the `VERCEL_PASSPORT_DEV_*` variables
documented in the skill to customize the fixture.

Use a Passport-protected deployment to test the real identity provider
redirect, session cookie, request header, and verified claims.

## Requirements

- A Vercel Enterprise team with Passport enabled
- Node.js 20 or newer, as required by `@vercel/passport`
- Server-side application code that can call `getIdentity()`

## Repository layout

```text
skills/vercel-passport/SKILL.md   Instructions followed by the coding agent
tests/passport-test.ts            Checks the official package behavior used by the skill
```

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
```

MIT license.
