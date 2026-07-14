/**
 * Local test of the vendored auth helper. Crafts Passport-shaped JWTs and
 * exercises parsing, the dev fallback, and production safety. No network,
 * no Vercel account needed. Run with: pnpm test
 */
import {
  type PassportUser,
  getUserFromRequest,
} from "../skills/vercel-passport/assets/auth";

let passed = 0;
let failed = 0;

function ok(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}${detail ? `  (${detail})` : ""}`);
  }
}

function fakeToken(claims: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(claims)}.fake-signature`;
}

function requestWith(token?: string): Request {
  return new Request("http://localhost/", {
    headers: token ? { "x-vercel-oidc-passport-token": token } : {},
  });
}

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

console.log("— token parsing —");
const full = getUserFromRequest(
  requestWith(
    fakeToken({
      external_sub: "okta|user-123",
      email: "grace@example.com",
      name: "Grace Hopper",
      sub: "owner:connector:okta|user-123",
      custom_role: "admin",
    }),
  ),
);
ok("valid token yields a user", full !== null);
ok("id comes from external_sub", full?.id === "okta|user-123");
ok("email mapped", full?.email === "grace@example.com");
ok("name mapped", full?.name === "Grace Hopper");
ok("extra claims exposed", full?.claims.custom_role === "admin");
ok("not flagged as dev fallback", full?.isDevFallback === false);

const bare = getUserFromRequest(requestWith(fakeToken({ external_sub: "u-1" })));
ok("missing profile claims become null", bare?.email === null && bare?.name === null);

const noSub = getUserFromRequest(requestWith(fakeToken({ email: "x@y.z" })));
ok("token without external_sub is rejected", noSub === null);

const garbage = getUserFromRequest(requestWith("not.a.jwt"));
ok("garbage token is rejected", garbage === null);

const alsoGarbage = getUserFromRequest(requestWith("complete-garbage"));
ok("non-JWT string is rejected", alsoGarbage === null);

console.log("— dev fallback —");
const dev = withEnv(
  { NODE_ENV: "development", PASSPORT_DEV_USER: "dev@example.com" },
  () => getUserFromRequest(requestWith()),
);
ok("dev fallback activates in development", dev !== null);
ok("dev fallback id is prefixed", dev?.id === "dev:dev@example.com");
ok("dev fallback flagged", dev?.isDevFallback === true);

const devNoOptIn = withEnv(
  { NODE_ENV: "development", PASSPORT_DEV_USER: undefined },
  () => getUserFromRequest(requestWith()),
);
ok("no fallback without PASSPORT_DEV_USER", devNoOptIn === null);

console.log("— production safety —");
const prod = withEnv(
  { NODE_ENV: "production", PASSPORT_DEV_USER: "dev@example.com" },
  () => getUserFromRequest(requestWith()),
);
ok("fallback never activates in production", prod === null);

const prodWithToken: PassportUser | null = withEnv(
  { NODE_ENV: "production", PASSPORT_DEV_USER: "dev@example.com" },
  () => getUserFromRequest(requestWith(fakeToken({ external_sub: "real-1" }))),
);
ok("real token still wins in production", prodWithToken?.id === "real-1");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
