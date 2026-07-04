# Werra Product Architecture

## 1. Product Architecture Summary

Werra is a marketplace for SMEs to hire verified content creators, structure creator deals, hold payment in escrow, and release payouts when agreed deliverables are met.

The product should be built as four connected layers:

1. Marketplace layer: discovery, briefs, bids, creator profiles, and matching.
2. Agreement layer: deal terms, deliverables, acceptance, review windows, revisions, and disputes.
3. Payment and escrow layer: USDI escrow on CKB, funding, release, refund, and payout tracking.
4. Trust and operations layer: verification, ratings, admin review, dispute handling, fraud controls, and reconciliation.

The first version should feel simple to SMEs and creators, while keeping the internal architecture strict enough to support escrow and future blockchain integration.

## 2. Core Product Actors

### SME / Business

The SME is the buyer of content.

Main jobs:

- Create business profile
- Post content brief
- Review creator bids
- Award gig
- Fund escrow
- Review delivery
- Approve payout, request revision, or open dispute
- Rate creator

### Creator

The creator is the seller of content and distribution.

Main jobs:

- Create creator profile
- Add niche, platforms, audience stats, and samples
- Browse open briefs
- Submit bids
- Accept agreement terms
- Deliver content
- Track escrow and payout status
- Rate business

### Werra Admin / Operations

The admin team maintains trust and resolves edge cases.

Main jobs:

- Verify creators and businesses
- Monitor escrow states
- Review disputes
- Resolve refund or payout decisions
- Flag suspicious accounts
- Manage categories, rates, and platform policies
- Reconcile off-chain records with CKB transactions

### Payment / Chain Services

This is a system actor, not a human user.

Main jobs:

- Generate agreement hashes
- Build CKB escrow transactions
- Track USDI escrow cells
- Confirm funding, release, and refund transactions
- Reconcile blockchain state with Werra application state

## 3. Product Modules

### 3.1 Identity and Profiles

Purpose:

Create trustworthy public profiles for both sides of the marketplace.

Business profile fields:

- Business name
- Business category
- Location
- Contact person
- Phone/email verification
- Billing wallet or payment method
- Business verification status
- Past gigs and ratings

Creator profile fields:

- Creator name
- Handle
- Location
- Niche
- Platform links
- Follower count
- Average views
- Engagement rate
- Audience location
- Sample content
- Starting rate
- Verification status
- Completed gigs and ratings

Architecture rule:

Creator profiles should be optimized for commercial evaluation, not social vanity. The profile must help an SME answer: "Can this creator deliver useful promotional content for my business?"

### 3.2 Creator Discovery

Purpose:

Help SMEs find creators before or after posting a brief.

Search/filter dimensions:

- Niche
- Location
- Platform
- Budget range
- Audience location
- Average views
- Engagement rate
- Verification status
- Completed gigs
- Availability

MVP behavior:

Discovery can start as a curated creator directory with filters. Advanced ranking can come later.

V1 behavior:

Rank creators using a commercial-fit score:

- Category match
- Location match
- Past completion rate
- Rating
- Response speed
- Audience fit
- Budget fit
- Engagement quality

### 3.3 Brief Builder

Purpose:

Turn vague SME needs into structured creator work.

Brief fields:

- Campaign objective
- Category
- Content type
- Deliverables
- Platform
- Deadline
- Budget
- Location requirement
- Creator posting requirement
- Usage rights
- Revision count
- Review window
- Required proof of delivery

Supported brief types:

- UGC video delivered to business
- Creator-posted TikTok
- Instagram Reel and Story
- Product review video
- Creator location visit
- Multi-creator campaign

Architecture rule:

The brief is the source of truth for deliverables. Escrow approval should be tied to this structured brief, not to vague chat messages.

### 3.4 Bidding and Matching

Purpose:

Allow creators to compete for briefs and let SMEs compare applicants.

Creator bid fields:

- Bid amount
- Timeline
- Pitch
- Relevant sample
- Proposed content angle
- Required logistics
- Usage rights acceptance

SME review view:

- Creator profile summary
- Bid amount
- Timeline
- Pitch
- Samples
- Ratings
- Platform stats
- Verification badges

MVP behavior:

Creators submit bids manually. SME selects one creator.

V1 behavior:

Werra can recommend creators and show rate guidance before the SME awards the gig.

### 3.5 Agreement Engine

Purpose:

Convert an awarded bid into a clear contract-like agreement.

Agreement contents:

- Business identity
- Creator identity
- Brief snapshot
- Accepted bid
- Gross amount
- Platform fee
- Creator payout
- Delivery deadline
- Review window
- Revision count
- Usage rights
- Posting requirements
- Refund rules
- Dispute rules
- Wallet/payment addresses
- Agreement hash

Agreement states:

- Draft
- Accepted
- Funding pending
- Funded
- Delivered
- Revision requested
- Disputed
- Released
- Refunded
- Cancelled

Architecture rule:

Once escrow is funded, agreement terms should be immutable. Any material change should create a new version or require explicit mutual acceptance.

### 3.6 Escrow and Payments

Purpose:

Protect both parties by locking funds before work starts and releasing payment only after valid completion or resolution.

Payment currency:

- USDI stablecoin on CKB/Nervos

Escrow flow:

1. SME awards bid.
2. Werra generates agreement and agreement hash.
3. SME accepts terms.
4. Creator accepts terms.
5. SME funds escrow in USDI.
6. CKB transaction is confirmed.
7. Creator starts work.
8. Creator submits delivery.
9. SME approves, requests revision, or disputes.
10. Escrow releases payout or refunds based on the final outcome.

Escrow outputs:

- Creator payout
- Werra platform fee
- SME refund, if applicable

MVP behavior:

The app can use a platform-assisted escrow flow with manual admin resolution for disputes.

V1 behavior:

The app should support stronger CKB transaction automation, wallet integration, on-chain agreement hashes, and automated reconciliation.

Architecture rule:

The backend must never assume payment status only from its database. Funding, release, and refund states must be confirmed against CKB transaction/indexer data.

### 3.7 Delivery and Review

Purpose:

Track whether the creator delivered the agreed work.

Delivery inputs:

- Uploaded file or external link
- Caption/description
- Posting link
- Screenshot proof
- Analytics screenshot, if required
- Creator note

Review actions:

- Approve payout
- Request revision
- Open dispute

Role rule:

Only the SME can approve payout, request revision, or open dispute from the delivery review view. Creators should only see delivery status and escrow status.

Auto-release rule for future:

If the SME does not respond within the agreed review window, the system may auto-release payment if the delivery meets objective proof requirements. This should not be in the first MVP unless policy and dispute handling are mature.

### 3.8 Dispute Resolution

Purpose:

Handle disagreement without breaking trust in the marketplace.

Dispute triggers:

- SME says work does not match brief
- Creator says SME is unfairly withholding approval
- Creator missed deadline
- Content was removed early
- Usage rights were violated
- Payment or wallet issue occurred

Dispute evidence:

- Brief snapshot
- Agreement terms
- Chat history
- Delivery files/links
- Revision requests
- Timestamps
- Platform screenshots
- Admin notes

Resolution outcomes:

- Full creator payout
- Full SME refund
- Partial payout/refund
- Revision required
- Account warning or suspension

Architecture rule:

Every dispute decision must produce an audit log and a final payment action.

### 3.9 Trust, Verification, and Reputation

Purpose:

Make the marketplace safer than Instagram DMs or WhatsApp referrals.

Creator trust signals:

- Phone verified
- Identity verified
- Platform linked
- Portfolio reviewed
- Audience stats reviewed
- Past gig completion
- Ratings
- Dispute history

Business trust signals:

- Phone/email verified
- Payment method verified
- Business profile complete
- Past hiring history
- Creator ratings

Reputation metrics:

- Completion rate
- Response speed
- On-time delivery
- Revision frequency
- Dispute rate
- Repeat hire rate

Architecture rule:

Verification and reputation should affect marketplace ranking, bid visibility, and transaction limits.

### 3.10 Notifications and Communication

Purpose:

Keep both sides moving through time-sensitive work.

Notification events:

- New bid received
- Bid accepted
- Agreement ready
- Escrow funded
- Delivery submitted
- Revision requested
- Review window ending
- Dispute opened
- Payout released
- Refund processed

Channels:

- In-app notifications
- Email
- SMS
- WhatsApp later, if policy and integration allow

Architecture rule:

Important payment and dispute events should be durable system events, not only UI messages.

## 4. Core User Journeys

### Journey A: Happy Path

1. SME posts brief.
2. Creators submit bids.
3. SME selects creator.
4. Agreement is generated.
5. Both parties accept terms.
6. SME funds USDI escrow.
7. Creator delivers content.
8. SME approves delivery.
9. Creator receives payout.
10. Werra receives platform fee.
11. Both parties rate each other.

### Journey B: Revision Path

1. Creator submits delivery.
2. SME requests revision.
3. Creator submits revised delivery.
4. SME approves.
5. Payout is released.

### Journey C: Dispute Path

1. Creator submits delivery.
2. SME disputes work.
3. Werra collects evidence.
4. Admin decides outcome.
5. Escrow is released, refunded, or split.
6. Dispute outcome is logged.

### Journey D: Creator Discovery Path

1. SME browses creators.
2. SME filters by niche, location, platform, and budget.
3. SME invites selected creators to a brief.
4. Creators submit bids.
5. SME awards gig.

## 5. Product State Model

### Brief States

- Draft
- Open
- Awarded
- Cancelled
- Converted to agreement

### Bid States

- Pending
- Selected
- Declined
- Withdrawn

### Agreement States

- Draft
- Accepted
- Funding pending
- Funded
- Delivered
- Revision requested
- Disputed
- Released
- Refunded
- Cancelled

### Escrow States

- Draft
- Funding pending
- Funded
- Release pending
- Released
- Refund pending
- Refunded
- Disputed
- Failed

### Payout States

- Not eligible
- Pending approval
- Pending chain confirmation
- Paid
- Refunded
- Failed

Architecture rule:

State transitions should be guarded centrally, not scattered across UI components. The frontend prototype already follows this pattern with a shared state layer. The backend should follow the same rule.

## 6. Suggested System Architecture

```text
Web / Mobile App
  |
  |-- SME workspace
  |-- Creator workspace
  |-- Admin console
  |
API Backend
  |
  |-- Identity and profiles
  |-- Briefs and bids
  |-- Agreement engine
  |-- Delivery review
  |-- Disputes
  |-- Notifications
  |-- Admin operations
  |
Payment and Escrow Service
  |
  |-- Agreement hash generation
  |-- USDI escrow transaction builder
  |-- CKB wallet integration
  |-- CKB indexer reconciliation
  |-- Release/refund transaction tracking
  |
Data Stores
  |
  |-- App database
  |-- File/object storage
  |-- Event log
  |-- Analytics warehouse
  |
Nervos CKB
  |
  |-- USDI token cells
  |-- Escrow cells
  |-- Agreement hashes
  |-- Payout/refund transactions
```

## 7. Data Architecture

### Core Tables / Collections

- users
- business_profiles
- creator_profiles
- creator_platform_accounts
- creator_portfolio_items
- briefs
- bids
- agreements
- agreement_versions
- agreement_acceptances
- escrows
- escrow_transactions
- deliveries
- delivery_reviews
- disputes
- dispute_events
- ratings
- notifications
- audit_logs
- admin_actions

### Event Log

Werra should maintain an append-only event log for important business events:

- brief.created
- bid.submitted
- bid.selected
- agreement.created
- agreement.accepted
- escrow.funded
- delivery.submitted
- delivery.approved
- delivery.revision_requested
- dispute.opened
- dispute.resolved
- escrow.released
- escrow.refunded
- rating.submitted

Architecture rule:

Events should drive notifications, audit logs, and admin visibility.

## 8. MVP Product Boundaries

### Include in MVP

- SME account
- Creator account
- Creator profile
- Business profile
- Brief posting
- Creator bidding
- Award creator
- Agreement generation
- Mock or testnet escrow flow
- Delivery submission
- SME approval
- Revision request
- Manual dispute handling
- Admin escrow monitor
- Ratings after completion

### Keep Manual in MVP

- Creator verification
- Business verification
- Dispute decisions
- High-value transaction review
- USDI off-ramp support
- Suspicious account review

### Exclude from MVP

- Multi-milestone campaigns
- Automated creator ranking
- Fully automated dispute resolution
- Auto-release after silence
- Complex campaign analytics
- Cross-border payouts
- Agency team accounts
- Paid ad performance attribution

## 9. V1 Product Expansion

After validating paid transactions, expand into:

- Creator recommendations
- Invite-to-bid
- Rate guidance
- Verified audience stats
- Multi-creator campaigns
- Usage rights add-ons
- Creator availability calendar
- Business subscriptions
- Creator pro profiles
- On-chain transaction explorer inside Werra
- Automated reconciliation dashboard
- KES/USDI on-ramp and off-ramp partnerships

## 10. Key Product Principles

1. Trust is the product.
   Werra wins if both sides believe the platform is safer than informal DMs.

2. Structured deliverables reduce disputes.
   Every gig must define what is being delivered, when, where, and under what rights.

3. Escrow should be visible but not confusing.
   Users should understand that money is protected without needing to understand CKB cells.

4. Creators should not need to chase payments.
   Once work is approved or fairly resolved, payout should be predictable.

5. SMEs should not need to understand creator marketing deeply.
   Brief templates and rate guidance should make hiring easier.

6. Admin operations matter early.
   Manual review is acceptable in MVP because it teaches the team where automation is needed.

7. Do not overbuild the chain layer first.
   Prove marketplace demand and escrow behavior before adding complex on-chain automation.

## 11. Product Success Metrics

Marketplace metrics:

- Number of posted briefs
- Number of bids per brief
- Brief-to-award conversion rate
- Award-to-funded conversion rate
- Funded-to-completed conversion rate
- Repeat hiring rate

Creator metrics:

- Active verified creators
- Creator response rate
- Creator completion rate
- Average payout
- Time to payout
- Repeat client rate

SME metrics:

- Active businesses
- First brief completion rate
- Average budget per brief
- Repeat purchase rate
- Dispute rate

Trust metrics:

- Escrow funding success rate
- Release/refund success rate
- Dispute rate
- Average dispute resolution time
- Fraud/abuse reports

Payment metrics:

- Total USDI escrowed
- Total USDI released
- Total USDI refunded
- Platform fee revenue
- Failed transaction rate

## 12. Recommended Build Order

1. Lock the state model.
2. Build SME brief and creator bid flow.
3. Build agreement generation.
4. Add escrow simulation/testnet flow.
5. Add delivery review.
6. Add admin dispute handling.
7. Add ratings and reputation.
8. Add real wallet/CKB integration.
9. Add verification workflows.
10. Add creator discovery and recommendation improvements.
