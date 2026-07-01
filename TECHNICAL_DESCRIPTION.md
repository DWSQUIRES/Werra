# Werra Technical Description

## Purpose

Werra will use Nervos CKB as the settlement and escrow layer for creator gigs. Businesses will fund approved content creator gigs in USDI stablecoin, the funds will be locked in an on-chain escrow, and payouts will be released automatically or semi-automatically when the agreed delivery conditions are met.

The application experience should remain simple for Kenyan SMEs and creators. The blockchain layer should provide verifiable escrow, contract agreement anchoring, dispute resolution paths, and transparent USDI payouts without forcing users to understand CKB internals.

## Technical Positioning

Werra is a marketplace application with blockchain-backed settlement.

The off-chain application handles:

- User accounts and verification
- Creator profiles
- SME profiles
- Gig briefs
- Creator bids
- Chat and notifications
- Deliverable uploads and review workflow
- Dispute case management
- Compliance records
- Fiat quoting and payment UX

CKB handles:

- Escrow custody of USDI token cells
- Ownership and spend rules through lock scripts
- Token validity through the USDI token type script
- Agreement and deliverable hashes
- Final settlement transactions
- Public auditability of funded, released, refunded, or disputed payments

## Core CKB Concepts Used

Werra's escrow model is designed around CKB's cell model.

On CKB, assets and state are represented as Cells. A Cell has capacity, a lock script, an optional type script, and data. The lock script controls who can spend a Cell. The type script controls state transition rules for a Cell type. CKB cells are immutable after creation, so state changes happen by consuming existing live cells and creating new cells.

For Werra, this maps naturally to escrow:

- A funded escrow is a live USDI token Cell locked by Werra escrow rules.
- Releasing payment consumes the escrow Cell and creates new USDI Cells for the creator and Werra fee account.
- Refunding payment consumes the escrow Cell and creates a new USDI Cell for the business.
- Dispute resolution consumes the escrow Cell and creates outputs according to the arbitration decision.

USDI is expected to be represented as a user-defined fungible token on CKB, likely through xUDT or a compatible token standard. This must be confirmed before implementation.

## USDI Integration Assumptions

Before engineering starts, Werra must confirm the production USDI parameters:

- USDI token standard on CKB, such as xUDT, sUDT, or another compatible type script
- USDI type script code hash, hash type, args, and resulting type hash
- Token decimals
- Minimum cell capacity requirements for holding USDI
- Whether the token has issuer controls, blacklist controls, pause controls, or upgrade paths
- Available liquidity for USDI to KES and KES to USDI
- Supported wallets and indexers
- Testnet deployment details
- Mainnet deployment details
- Redemption or off-ramp path for creators who want local currency

Until these are confirmed, this document treats USDI as a CKB fungible token that can be locked in a custom or standard escrow lock.

## High-Level Architecture

```text
SME Web/Mobile App
        |
Creator Web/Mobile App
        |
Werra API Backend
        |
--------------------------------------------------
| Accounts | Gigs | Bids | Agreements | Disputes |
| Chat     | KYC  | Admin | Payments   | Indexer |
--------------------------------------------------
        |
CKB Transaction Service
        |
-------------------------------
| CCC SDK / CKB SDK           |
| CKB RPC                     |
| CKB Indexer                 |
| Wallet Connectors           |
-------------------------------
        |
Nervos CKB
        |
USDI Token Cells + Werra Escrow Lock
```

## Main Components

### 1. Frontend Application

The frontend lets businesses post briefs, review creators, fund escrow, approve work, and track disputes. It lets creators apply for gigs, accept agreement terms, deliver content, and receive USDI payouts.

The frontend should hide most blockchain complexity. Users should see:

- Gig amount
- Platform fee
- Creator payout
- Escrow funded status
- Delivery status
- Approval status
- Payout status
- Transaction references when needed

### 2. Werra API Backend

The backend is the operational source of truth for marketplace workflow. It stores structured gig data, identity verification data, creator portfolios, bids, chat messages, off-chain agreement terms, dispute evidence, and status history.

The backend should not be the sole source of truth for escrowed funds. Escrow status must be verified against CKB transactions and live cells.

### 3. CKB Transaction Service

This service constructs, validates, submits, and tracks CKB transactions.

Responsibilities:

- Generate funding transaction templates
- Build USDI escrow cells
- Add correct cell deps for USDI and escrow scripts
- Estimate and attach CKB capacity and transaction fees
- Request signatures from wallets or managed signing flows
- Submit transactions to CKB RPC
- Track confirmations
- Detect failed, replaced, or conflicting transactions
- Reconcile on-chain state with the Werra database

### 4. CKB Indexer Service

The indexer watches CKB for Werra-related cells and transactions.

It should index:

- Escrow cells by agreement ID
- USDI token cells locked by Werra escrow script
- Release transactions
- Refund transactions
- Dispute resolution transactions
- Creator payout transactions
- Platform fee transactions

The application should not mark an escrow as funded, released, or refunded until the relevant transaction is confirmed on-chain according to Werra's confirmation policy.

### 5. Wallet Layer

Werra should support a mobile-friendly CKB wallet flow. The first implementation should evaluate CCC because it is the current JavaScript/TypeScript SDK and wallet connector recommended in CKB documentation.

Possible wallet approaches:

- Non-custodial user wallets for businesses and creators
- Embedded wallet or passkey-based wallet for mainstream SME UX
- Platform-sponsored transaction fees where possible
- Managed wallet only if Werra is prepared for the custody, compliance, and operational risk

For the Kenyan market, the product should avoid making users manage complex seed phrases during the first interaction.

## Escrow Model

### MVP Escrow Model

The MVP should prioritize correctness, auditability, and implementation speed.

Recommended MVP:

- Store the full agreement off-chain in Werra's database.
- Hash the canonical agreement terms.
- Lock USDI in a CKB escrow Cell.
- Include the agreement hash and agreement ID in the escrow lock args or associated agreement cell data.
- Use either a well-tested standard CKB lock pattern or a small custom escrow lock.
- Keep dispute resolution manually operated by Werra in the MVP.

The MVP should not try to put every marketplace state transition on-chain. On-chain state should focus on funds and proof of agreement.

### V2 Escrow Model

After the MVP proves demand, Werra can introduce a fuller on-chain agreement state Cell with a custom type script.

The V2 model can enforce:

- Funded state
- Delivered state
- Review window
- Auto-release conditions
- Cancellation rules
- Dispute state
- Arbitrated resolution
- Partial payouts or milestones

This adds stronger automation but also increases script complexity, audit cost, and product rigidity.

## On-Chain Data Model

### Agreement Record

The complete agreement should live off-chain and be stored in Werra's database. A canonical hash of the agreement should be anchored on-chain.

Example agreement fields:

```json
{
  "agreementId": "werra_agr_001",
  "gigId": "werra_gig_001",
  "businessUserId": "business_001",
  "creatorUserId": "creator_001",
  "businessCkbLockHash": "0x...",
  "creatorCkbLockHash": "0x...",
  "werraFeeLockHash": "0x...",
  "werraArbitratorLockHash": "0x...",
  "usdiTypeHash": "0x...",
  "grossAmountUsdi": "100.00",
  "platformFeeBps": 1000,
  "creatorPayoutUsdi": "90.00",
  "deliverablesHash": "0x...",
  "termsHash": "0x...",
  "deadlineUnixMs": 1780000000000,
  "reviewWindowSeconds": 172800,
  "revisionCount": 1
}
```

The `termsHash` should be generated from canonical JSON so both parties sign the same data. The hash should include deliverables, usage rights, deadlines, payout amount, cancellation rules, and dispute rules.

### Escrow USDI Cell

The escrow Cell holds the USDI amount for the gig.

Conceptual structure:

```text
Cell {
  capacity: ckb_capacity_for_cell_storage_and_fees,
  lock: WerraEscrowLock(agreement_id, terms_hash, parties, fee_policy),
  type: USDITypeScript,
  data: usdi_amount
}
```

The exact token data encoding depends on the confirmed USDI standard.

### Optional Agreement State Cell

For V2, Werra can create a separate agreement state Cell.

Conceptual structure:

```text
Cell {
  capacity: ckb_capacity_for_state,
  lock: WerraAgreementOwnerLock,
  type: WerraAgreementTypeScript,
  data: encoded_agreement_state
}
```

This state Cell can track status transitions such as `FUNDED`, `DELIVERED`, `APPROVED`, `DISPUTED`, `RESOLVED`, and `CANCELLED`.

## Escrow Unlock Paths

The escrow lock should support a small number of explicit spend paths.

### 1. Mutual Release

Used when both parties agree the deliverables were met.

Required authorization:

- Business approval signature
- Creator acceptance signature, or creator signature already captured when accepting the final agreement

Required outputs:

- Creator receives agreed creator payout in USDI.
- Werra receives platform fee in USDI.
- Remaining CKB capacity is returned according to the capacity policy.

### 2. Mutual Refund

Used when both parties agree to cancel before completion.

Required authorization:

- Business signature
- Creator signature

Required outputs:

- Business receives refundable USDI.
- Werra receives cancellation fee only if the agreement allows one.
- CKB capacity is returned according to the capacity policy.

### 3. Dispute Resolution

Used when one party disputes completion or quality.

Required authorization:

- Werra arbitrator signature
- Winning party signature, or an arbitrator-only path if legal and product policy allow it

Required outputs:

- Creator payout, business refund, and Werra fee are distributed according to the dispute decision.
- The resolution transaction hash is linked to the dispute case in Werra's backend.

### 4. Timeout Refund

Used when the creator misses a deadline and no valid delivery was recorded.

This path is easier in V2 if delivery state is recorded on-chain. In the MVP, timeout refunds should be handled through mutual cancellation or Werra arbitration.

### 5. Silent Client Auto-Release

Used when the creator delivered work and the business does not respond within the review window.

This requires either:

- On-chain delivery proof and a state script that can enforce the review window, or
- A Werra platform oracle/arbitrator signature in the MVP.

For MVP, use the platform-assisted path. For V2, consider automating this with an agreement state Cell.

## Agreement Lifecycle

### 1. Draft

The SME selects a creator and Werra creates a draft agreement.

The draft includes:

- Deliverables
- Deadline
- Review window
- Revision count
- Usage rights
- Payout amount
- Platform fee
- Refund rules
- Dispute rules
- Creator wallet
- Business wallet

### 2. Acceptance

The business and creator accept the agreement terms in the app.

Werra stores:

- Terms payload
- Terms hash
- Business acceptance signature
- Creator acceptance signature
- Timestamp
- IP/device metadata where appropriate

Only the hash should be anchored on-chain. PII and private business details should stay off-chain.

### 3. Funding

The business funds the agreement in USDI.

Funding transaction:

- Consumes one or more business USDI Cells.
- Creates one escrow USDI Cell locked by Werra escrow rules.
- Creates business USDI change Cell if needed.
- Pays CKB transaction fees.

The agreement becomes `FUNDED` only after on-chain confirmation.

### 4. Delivery

The creator submits the deliverable in Werra.

Deliverables can include:

- Uploaded video file
- TikTok link
- Instagram Reel link
- YouTube Shorts link
- Screenshot proof
- Performance screenshot after 24 or 48 hours

Werra stores file metadata and hashes. If needed, a delivery hash can be anchored on-chain later.

### 5. Approval

The SME approves the deliverable.

Werra builds a release transaction. Depending on the lock design, the transaction is signed by:

- The business wallet
- The creator wallet, or by a prior creator authorization
- The Werra fee account only if needed for fee or sponsored transaction policy

After confirmation, Werra marks the gig as paid.

### 6. Payout

The creator receives USDI in their CKB wallet.

Optional next steps:

- Creator keeps USDI.
- Creator sends USDI to another CKB wallet.
- Creator uses an off-ramp partner to convert USDI to KES.
- Werra facilitates off-ramp through a licensed partner, if available.

### 7. Dispute

If the business rejects the delivery and the creator disagrees, Werra opens a dispute case.

Dispute evidence can include:

- Original brief
- Accepted agreement terms
- Chat history
- Delivery files
- Posted content links
- Timestamps
- Revision requests
- Creator response
- Platform policy checklist

The dispute decision is executed by a CKB transaction that releases or refunds the escrowed USDI.

## Backend Data Model

Suggested tables or collections:

- `users`
- `business_profiles`
- `creator_profiles`
- `creator_social_accounts`
- `gigs`
- `bids`
- `agreements`
- `agreement_acceptances`
- `deliverables`
- `escrows`
- `ckb_transactions`
- `ckb_cells`
- `disputes`
- `dispute_events`
- `payouts`
- `wallets`
- `kyc_records`
- `audit_logs`

Important escrow fields:

- `agreement_id`
- `terms_hash`
- `usdi_type_hash`
- `escrow_lock_hash`
- `funding_tx_hash`
- `funding_output_index`
- `release_tx_hash`
- `refund_tx_hash`
- `status`
- `gross_amount`
- `platform_fee`
- `creator_payout`
- `business_lock_hash`
- `creator_lock_hash`
- `arbitrator_lock_hash`
- `confirmation_count`

## Transaction States

Werra backend statuses should be reconciled against CKB.

Suggested escrow statuses:

- `DRAFT`
- `ACCEPTED`
- `FUNDING_PENDING`
- `FUNDED`
- `DELIVERED`
- `REVISION_REQUESTED`
- `APPROVED`
- `RELEASE_PENDING`
- `RELEASED`
- `DISPUTED`
- `REFUND_PENDING`
- `REFUNDED`
- `RESOLVED`
- `FAILED`

On-chain state should override backend assumptions for funds. If the backend says `FUNDED` but the indexer cannot find the live escrow Cell, the agreement must be flagged for reconciliation.

## Fees and Capacity

CKB requires capacity to store Cells. USDI token cells also require CKB capacity because the token data exists inside CKB cells.

Werra must define who provides and receives capacity:

- Business can provide the capacity when funding escrow.
- Werra can sponsor capacity for smoother UX.
- Creator payout cells need enough CKB capacity to hold USDI.
- Refund outputs need enough CKB capacity.
- Capacity should be returned where possible when cells are consumed.

Werra should also decide who pays network fees:

- Business pays when funding escrow.
- Werra sponsors release/refund fees and recovers cost from platform fee.
- Advanced option: fee abstraction so creators do not need CKB to receive payouts.

## Payout Currency Flow

The product should display local pricing simply while settling in USDI.

Possible flow:

1. SME sees a KES estimate and USDI equivalent.
2. SME funds in USDI directly, or pays KES through an on-ramp partner.
3. USDI is locked on CKB escrow.
4. Creator is paid in USDI.
5. Creator optionally off-ramps USDI to KES.

Important: Werra should not represent USDI as equivalent to fiat held by Werra unless Werra actually controls regulated reserves or works through a compliant partner.

## Script Implementation Strategy

### MVP Option A: Standard Multisig or Omnilock Pattern

Use an existing, audited CKB lock pattern if it can satisfy the required escrow paths.

Advantages:

- Faster to ship
- Lower script audit burden
- Easier wallet compatibility
- Fewer custom consensus-critical bugs

Tradeoffs:

- Limited automation
- Timelocks and conditional release may be harder
- More platform-assisted dispute handling

### MVP Option B: Minimal Custom Escrow Lock

Build a small custom lock script that validates only the essential payout paths.

The script should validate:

- Agreement ID and terms hash are bound to the escrow Cell.
- USDI type script matches the configured USDI token.
- Release outputs pay the agreed creator payout and Werra fee.
- Refund outputs return funds to the business according to policy.
- Dispute outputs require Werra arbitrator authorization.
- Signatures match the expected business, creator, and arbitrator locks.

The script should avoid:

- Complex content quality rules
- Large on-chain data
- Subjective deliverable validation
- Upgrade mechanisms that let Werra move funds unilaterally outside the published dispute rules

### V2 Option: Agreement Type Script

Add a type script to validate agreement state transitions.

This can support:

- Milestone payments
- On-chain delivery hashes
- Review windows
- Auto-release after silence
- Deadline-based refunds
- Partial refunds
- Stronger public audit trail

This should only be attempted after the MVP flow is proven and the script can be audited.

## Security Requirements

### Smart Contract and Script Security

- Keep the escrow script small.
- Write unit tests for every unlock path.
- Write transaction-level integration tests on devnet/testnet.
- Include malformed output tests.
- Include wrong-token tests.
- Include wrong-recipient tests.
- Include wrong-fee tests.
- Include replay and duplicate agreement ID tests.
- Include partial fill and cell splitting tests.
- Run an external audit before mainnet funds are handled.

### Key Management

Werra arbitrator keys are sensitive. They should be stored in a hardware-backed or threshold signing setup before mainnet launch.

Recommended controls:

- Separate hot keys and cold keys
- Multi-person approval for dispute resolution
- Transaction preview before signing
- Immutable audit logs
- Emergency key rotation plan
- Clear policy for lost user wallets

### Privacy

Do not store private business information, identity documents, chat content, raw deliverables, or dispute evidence directly on-chain.

Store hashes on-chain and keep private data in Werra-controlled storage with access controls.

### Operational Reconciliation

Werra must reconcile its database against CKB.

Checks:

- Every `FUNDED` agreement has a matching live escrow Cell.
- Every `RELEASED` agreement has a confirmed release transaction.
- No live escrow Cell remains for a completed agreement.
- Every payout amount matches expected fee policy.
- Every failed transaction is retried or marked for manual review.

## Compliance and Risk Notes

Werra will touch payments, stablecoins, escrow, and possibly fiat on/off-ramps. This requires legal review before launch.

Key areas:

- Stablecoin handling
- Custody vs non-custody
- KYC and AML
- Sanctions screening
- Consumer protection
- Dispute policy
- Tax records
- Creator income reporting
- M-Pesa or bank integration rules
- Cross-border payouts if expanding beyond Kenya

The safest initial model is non-custodial escrow with clear user authorization and licensed partners for fiat conversion.

## MVP Technical Scope

The first technical release should include:

- Business and creator accounts
- Wallet address collection or wallet connection
- Manual creator verification
- Gig and bid workflow
- Agreement generation
- Agreement terms hash
- Business and creator acceptance records
- USDI escrow funding transaction
- CKB transaction tracker
- Manual or semi-automatic release transaction
- Manual dispute resolution
- Creator USDI payout
- Admin dashboard for escrow state
- Reconciliation job between database and CKB indexer

Do not include in MVP:

- Multi-milestone contracts
- Fully automated quality arbitration
- Complex on-chain state machine
- Cross-border off-ramp routing
- Unbounded creator campaign analytics

## Recommended Build Phases

### Phase 0: Validation

- Confirm USDI technical parameters.
- Confirm USDI liquidity and off-ramp path.
- Confirm wallet strategy for Kenyan SMEs and creators.
- Choose standard lock vs custom escrow lock.
- Define legal posture for escrow and stablecoin handling.

### Phase 1: Devnet Prototype

- Build agreement hash flow.
- Create and lock test token cells.
- Build escrow funding transaction.
- Build release and refund transactions.
- Build indexer reconciliation.
- Test with fake gigs and internal wallets.

### Phase 2: Testnet Pilot

- Deploy escrow script or configure standard lock.
- Use testnet USDI or test token.
- Onboard pilot creators and SMEs.
- Run end-to-end funded gigs with tiny values.
- Exercise dispute flow manually.

### Phase 3: Mainnet Controlled Launch

- Launch with transaction limits.
- Require verified creators.
- Require manual review for high-value gigs.
- Monitor all escrow cells.
- Keep dispute response times short.
- Gradually increase limits after reliability is proven.

## Open Technical Questions

- Is USDI available on CKB mainnet today, and under which token standard?
- What are the exact USDI type script details and decimals?
- What wallets currently support USDI transfers on CKB?
- Will Werra require users to hold CKB capacity, or will Werra sponsor capacity?
- Should businesses pay in USDI directly or through KES to USDI conversion?
- Who provides KES off-ramp liquidity for creators?
- Should Werra use a standard multisig or write a custom escrow lock?
- What dispute signature policy is acceptable for users and regulators?
- Should agreement state be only off-chain for MVP, or partially on-chain from day one?
- What transaction confirmation threshold is required before work starts?

## Technical References

- CKB docs: https://docs.nervos.org/
- How CKB Works: https://docs.nervos.org/docs/getting-started/how-ckb-works
- Cell Model: https://docs.nervos.org/docs/ckb-fundamentals/cell-model
- Cell structure: https://docs.nervos.org/docs/tech-explanation/cell
- Script structure: https://docs.nervos.org/docs/tech-explanation/script
- Lock scripts: https://docs.nervos.org/docs/tech-explanation/lock-script
- Type scripts: https://docs.nervos.org/docs/tech-explanation/type-script
- Lock script vs type script: https://docs.nervos.org/docs/tech-explanation/lock-type-diff
- Assets and token standards: https://docs.nervos.org/docs/assets-token-standards/assets-overview
- xUDT token standard overview: https://docs.nervos.org/docs/assets-token-standards/xudt
- CCC JavaScript/TypeScript SDK: https://docs.nervos.org/docs/sdk-and-devtool/ccc
- CCC wallet connector: https://docs.nervos.org/docs/integrate-wallets/ccc-wallet
- Nervos RFC repository: https://github.com/nervosnetwork/rfcs

