# werra

Werra is a proof of concept marketplace for SMEs to hire content creators with managed wallets and CKB testnet escrow.

## Community preview quick start

Prerequisite: Node.js 20+ and npm.

From the repo root:

```bash
npm run preview
```

That single command will:

- install prototype dependencies if they are missing
- start the Werra API
- create hidden issuer and escrow system wallets
- start the frontend

Open:

```text
http://127.0.0.1:5173
```

## Hosted public test funding

For a public Vercel preview, configure one funded CKB testnet sponsor wallet. When a tester signs in with email, Werra creates that user's managed wallet and prepares test balances for that account.

Add this environment variable to the Vercel project:

```text
WERRA_CKB_FAUCET_PRIVATE_KEY=<funded CKB testnet private key>
```

Fund that sponsor wallet with testnet CKB only. After deployment:

1. Open the app.
2. Sign in with an email as `SME` or `Creator`.
3. Run the test flow.

The sign-in setup targets `500 CKB` and `1000 USDW` for the signed-in user's managed wallet. It is idempotent: if the wallet already meets the target, it will not keep issuing or sending funds.

If `WERRA_CKB_FAUCET_PRIVATE_KEY` is not configured, users can still sign in and get managed wallets, but test funding will not be sponsored automatically.

## Test flow

1. Sign in as an `SME` using an email.
2. Post a content brief.
3. Sign out, sign in as a `Creator` using a different email, and apply to the latest brief.
4. Sign out, sign in again as the `SME`, open Applications, then `Award & fund`.
5. Sign out, sign in again as the `Creator`, submit completed work.
6. Sign out, sign in again as the `SME`, approve payout or open dispute.

## Fresh local run

To reset the local POC store and generate a clean state:

```bash
npm run preview:reset
```

## Vercel Hobby deployment

This repo is ready to deploy as a Vercel Hobby POC preview.

Use the repo root as the Vercel project root. The deployment settings are already captured in `vercel.json`:

- Framework Preset: `Other`
- Install Command: `npm --prefix prototype ci`
- Build Command: `npm --prefix prototype run build`
- Output Directory: `prototype/dist`
- API: one Serverless Function at `api/index.ts`

Recommended Vercel environment variables:

```text
CKB_NETWORK=testnet
WERRA_WALLET_ENCRYPTION_KEY=<long random secret>
WERRA_CKB_FAUCET_PRIVATE_KEY=<optional funded CKB testnet private key for public test gas sponsorship>
WERRA_STORE_DRIVER=postgres
DATABASE_URL=<Neon Postgres connection string>
WERRA_STORE_KEY=werra-poc
```

`CKB_RPC_URL` is optional. Set it only if you want to use a specific CKB testnet RPC endpoint.

For persistent hosted storage on Vercel Hobby, attach a Neon Postgres database from Vercel Marketplace or provide a compatible Postgres connection string manually. The app stores the POC marketplace state, generated managed wallets, agreements, deliveries, and disputes in one JSONB row. Keep `WERRA_WALLET_ENCRYPTION_KEY` stable after the first deployment, because managed wallet keys are encrypted with it.

If `WERRA_STORE_DRIVER=postgres` is set without `DATABASE_URL`, the API will fail fast instead of silently using ephemeral storage. Without Postgres configuration, local development still uses the JSON store under `prototype/.werra-poc`.

For a funded hosted test, add `WERRA_CKB_FAUCET_PRIVATE_KEY`, fund the sponsor address with CKB testnet funds, redeploy, then sign in with email.

## Notes

- The POC uses CKB testnet and a local JSON store under `prototype/.werra-poc`.
- Managed wallet private keys are generated locally and encrypted with a development key by default.
- The prototype is not production software. It is for community review of the flow, UX, and CKB escrow direction.
