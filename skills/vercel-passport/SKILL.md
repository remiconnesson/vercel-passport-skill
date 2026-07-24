---
name: vercel-passport
description: Add authentication and per-user authorization to applications deployed behind Vercel Passport. Use when an application on a Vercel Enterprise team needs sign-in, the current visitor, protected routes, per-user data, or identity-aware access. Use the official @vercel/passport package. Do not build a second login system for a Passport-protected application.
---

# Vercel Passport

Use Passport as the authentication layer for internal applications and agents.
Passport authenticates the visitor before a request reaches the deployment.
Application code reads the verified identity and applies its own authorization
rules.

Follow the current official guide:
[Read Passport identity in your application](https://vercel.com/docs/passport/read-identity).
Treat that page and the installed `@vercel/passport` types as authoritative if
the package changes.

## Set up

1. Confirm that Passport protects the Vercel project. Passport is an Enterprise
   feature configured by the team or project administrator.

2. Install the official helper:

   ```bash
   pnpm add @vercel/passport
   ```

   Use the package manager already used by the project.

3. Read identity only in server-side code:

   ```ts
   import { getIdentity } from "@vercel/passport";

   const identity = await getIdentity();
   ```

`getIdentity()` reads Vercel's request context, verifies the Passport token
against Vercel's JWKS, and returns `null` when no identity is available. It can
throw when token verification fails. Treat that request as unauthenticated.

## Use the identity

```ts
const identity = await getIdentity();

identity?.subject;          // Stable Passport subject for one issuer
identity?.payload.iss;      // Passport issuer
identity?.externalSubject;  // User id from the configured identity provider
identity?.email;            // Optional
identity?.name;             // Optional
identity?.payload;          // Full verified claims
identity?.verified;         // false for the local development fixture
```

Use `identity.subject` as the visitor identifier when the application accepts
one Passport issuer. If it accepts more than one Passport team, persist
`identity.payload.iss` and `identity.subject` together.

Do not parse `identity.subject`. Do not use `externalSubject`, email, or name as
the application storage key. Passport scopes the subject to the Vercel team and
Connector application. Profile fields depend on what the identity provider
returns.

## Develop locally

Passport runs in Vercel's network, so localhost does not receive the real
Passport cookie or request header. In local development outside Vercel,
`getIdentity()` returns a development identity by default and logs a warning.
The fixture has `verified: false` and no token.

Customize its identifiers when application logic depends on them:

```bash
VERCEL_PASSPORT_DEV_OWNER=acme
VERCEL_PASSPORT_DEV_OWNER_ID=team_123
VERCEL_PASSPORT_DEV_PROJECT=my-project
VERCEL_PASSPORT_DEV_PROJECT_ID=prj_123
VERCEL_PASSPORT_DEV_CONNECTOR_ID=scl_dev
VERCEL_PASSPORT_DEV_EXTERNAL_SUB=user_dev
VERCEL_PASSPORT_DEV_EXTERNAL_ISS=https://idp.example.com
```

Disable the fixture when testing an unauthenticated request:

```bash
VERCEL_PASSPORT_DEV=0
```

Or disable it for one call:

```ts
const identity = await getIdentity(undefined, { development: false });
```

Test the real sign-in redirect, session cookie, injected header, and verified
claims on a Passport-protected Vercel deployment.

## Recipes

### Personalize a server component

```tsx
import { getIdentity } from "@vercel/passport";

export default async function Home() {
  const identity = await getIdentity();
  const displayName = identity?.name ?? identity?.email ?? "there";

  return <main>Welcome, {displayName}!</main>;
}
```

Pass plain identity fields as props when a client component needs them. Never
send the token to the browser.

### Require identity in a route handler

```ts
import { getIdentity } from "@vercel/passport";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await getIdentity();

    if (!identity) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    return Response.json({
      issuer: identity.payload.iss,
      subject: identity.subject,
      email: identity.email,
      name: identity.name,
    });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
```

Put repeated authorization checks in a shared server-side helper and call it
from each protected route.

### Store per-user data

```ts
"use server";

import { getIdentity } from "@vercel/passport";
import { getCollection } from "@/lib/blob-db";

type Preferences = { theme: string };
const preferences = getCollection<Preferences>("preferences");

export async function saveTheme(theme: string) {
  const identity = await getIdentity();
  if (!identity) throw new Error("Unauthorized");

  await preferences.set(identity.subject, { theme });
}
```

For multiple Passport issuers, store the issuer and subject as a compound key
instead of using the subject alone.

### Apply application-level authorization

```ts
import { getIdentity } from "@vercel/passport";

const ADMIN_SUBJECTS = new Set([
  "owner:team_123:connector:scl_123:principal:user_123",
]);

export async function requireAdmin() {
  const identity = await getIdentity();

  if (!identity || !ADMIN_SUBJECTS.has(identity.subject)) {
    throw new Error("Admins only");
  }

  return identity;
}
```

Passport decides who may reach the deployment. Application code decides what
that visitor may do inside it.

### Pass a request explicitly

If the runtime does not expose Vercel's request context, pass the request or
headers:

```ts
const identity = await getIdentity(request);
```

This works with a standard `Request` and other request-like objects supported
by the package.

### Verify a token forwarded to another backend

Do not trust a forwarded Passport header by itself. Verify the token in the
receiving service:

```ts
import { verifyIdentity } from "@vercel/passport";

const identity = await verifyIdentity(request, {
  ownerId: "team_123",
  projectId: "prj_123",
  environment: "production",
});
```

Use the source project's expected owner, project, and environment.

## Rules

- Use `@vercel/passport`. Do not decode the JWT, read the
  `_vercel_passport` cookie, or parse the header by hand.
- Never add NextAuth, Clerk, Better Auth, password forms, magic links, or
  another login system to a Passport-protected application.
- Keep identity reads server-side.
- Use `subject`, or issuer plus subject, for application data.
- Treat email, name, groups, and other profile claims as optional.
- Never send the raw token to the browser or write it to logs.
- Use `verifyIdentity()` when another backend receives a forwarded token.
- Do not use a Next.js proxy function to bypass Passport. Passport makes its
  access decision before proxy functions run, and identity verification may
  require a network request.
- Use a Protection Bypass for Automation secret for webhooks, cron jobs, or
  other machine requests that must reach a protected deployment without a
  Passport session. Those requests do not have a Passport identity.

## Troubleshoot

- If `getIdentity()` returns `null` on Vercel, confirm that the request reached
  a Passport-protected deployment. Automation bypass requests can legitimately
  have no Passport identity.
- If the runtime does not expose Vercel request context, pass the request or
  headers explicitly.
- If verification fails, return an unauthorized response. Confirm that code
  reads the Vercel-injected header and do not log the token.
- If profile or group claims are missing, confirm that the identity provider
  returns them and that the Connector requests the required scopes. Start a
  new Passport session after changing scopes.
- If Passport settings are unavailable, ask the Enterprise team administrator
  to enable or configure Passport.

Passport handles authentication. Keep roles, permissions, and record-level
authorization in the application.
