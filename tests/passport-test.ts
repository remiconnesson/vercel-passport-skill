import assert from "node:assert/strict";
import { getIdentity } from "@vercel/passport";

type Environment = Record<string, string | undefined>;

async function withEnvironment<T>(
  environment: Environment,
  run: () => Promise<T>,
): Promise<T> {
  const previous: Environment = {};

  for (const [key, value] of Object.entries(environment)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function fakeToken(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");

  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.fake-signature`;
}

function requestWith(token: string): Request {
  return new Request("http://localhost/", {
    headers: { "x-vercel-oidc-passport-token": token },
  });
}

await withEnvironment(
  {
    VERCEL: undefined,
    VERCEL_ENV: undefined,
    VERCEL_PASSPORT_DEV: undefined,
    VERCEL_PASSPORT_TOKEN: undefined,
  },
  async () => {
    const identity = await getIdentity();

    assert.ok(identity);
    assert.equal(
      identity.subject,
      "owner:local:connector:local:principal:test-user",
    );
    assert.equal(identity.externalSubject, "test-user");
    assert.equal(identity.email, "test-user@passport.local");
    assert.equal(identity.verified, false);
    assert.equal(identity.token, null);
  },
);

await withEnvironment(
  {
    VERCEL: undefined,
    VERCEL_ENV: undefined,
    VERCEL_PASSPORT_DEV: undefined,
    VERCEL_PASSPORT_DEV_OWNER: "acme",
    VERCEL_PASSPORT_DEV_CONNECTOR_ID: "scl_dev",
    VERCEL_PASSPORT_DEV_EXTERNAL_SUB: "user_dev",
    VERCEL_PASSPORT_TOKEN: undefined,
  },
  async () => {
    const identity = await getIdentity();

    assert.ok(identity);
    assert.equal(
      identity.subject,
      "owner:acme:connector:scl_dev:principal:user_dev",
    );
    assert.equal(identity.payload.iss, "https://passport.vercel.com/acme");
  },
);

await withEnvironment(
  {
    VERCEL: undefined,
    VERCEL_ENV: undefined,
    VERCEL_PASSPORT_DEV: "0",
    VERCEL_PASSPORT_TOKEN: undefined,
  },
  async () => {
    assert.equal(await getIdentity(), null);
  },
);

await assert.rejects(
  getIdentity(
    requestWith(
      fakeToken({
        external_sub: "attacker-controlled",
        iss: "https://example.com/not-passport",
        owner: "local",
        sub: "owner:local:connector:local:principal:attacker-controlled",
        typ: "passport",
      }),
    ),
    { development: false },
  ),
  /Expected Passport token iss claim/,
);

await withEnvironment(
  {
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_PASSPORT_DEV: undefined,
    VERCEL_PASSPORT_TOKEN: undefined,
  },
  async () => {
    assert.equal(await getIdentity(), null);
  },
);

console.log("Passport identity tests passed.");
