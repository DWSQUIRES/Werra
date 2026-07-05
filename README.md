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
- create local managed demo wallets
- print the CKB testnet addresses to fund
- start the frontend
- auto-issue `1000 USDW` to the Demo SME once the issuer wallet has CKB

Open:

```text
http://127.0.0.1:5173
```

## Only manual step

Fund the CKB testnet addresses printed in the terminal:

- Demo SME: suggested `500 CKB`
- USDW issuer / Admin: suggested `300 CKB`
- Werra escrow custody: suggested `300 CKB`
- Demo Creator: optional for this POC

These are testnet wallets generated locally on the tester's machine. Do not send mainnet funds.

## Test flow

1. Continue as `SME`.
2. Post a content brief.
3. Sign out, continue as `Creator`, and apply to the latest brief.
4. Sign out, continue as `SME`, open Applications, then `Award & fund`.
5. Sign out, continue as `Creator`, submit completed work.
6. Sign out, continue as `SME`, approve payout or open dispute.
7. If disputed, continue as `Werra Admin`, open Support, then pay creator or refund SME.

## Fresh local run

To reset the local POC store and generate a clean demo state:

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
- API: `api/[...path].ts`

Recommended Vercel environment variables:

```text
CKB_NETWORK=testnet
WERRA_WALLET_ENCRYPTION_KEY=<long random secret>
```

`CKB_RPC_URL` is optional. Set it only if you want to use a specific CKB testnet RPC endpoint.

The hosted Vercel deployment uses Vercel serverless functions and stores POC state under `/tmp`. That is enough for a community UI preview, but it is not durable storage. For the full CKB-funded test flow, use the local one-command preview because the local store keeps the generated test wallets on the tester's machine.

If you still want to run a funded hosted test, open the deployed app once, then check `/api/poc/wallets` on the same deployment to view the generated testnet addresses. Fund only with CKB testnet funds.

## Notes

- The POC uses CKB testnet and a local JSON store under `prototype/.werra-poc`.
- Managed wallet private keys are generated locally and encrypted with a development key by default.
- The prototype is not production software. It is for community review of the flow, UX, and CKB escrow direction.
