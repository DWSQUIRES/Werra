import {
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Eye,
  FileCheck2,
  Gavel,
  HandCoins,
  LayoutDashboard,
  Link as LinkIcon,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import type { AppState, Bid, BidForm, BriefForm, Creator, Escrow, Gig, Role, Tab } from "./state";
import {
  activeCreatorId as managedActiveCreatorId,
  awardBidState,
  creators,
  createBriefState,
  fundEscrowState,
  getMetrics as calculateMetrics,
  initialState as managedInitialState,
  loadState as loadManagedState,
  openDisputeState,
  refundEscrowState,
  releaseEscrowState,
  requestRevisionState,
  storageKey as managedStorageKey,
  submitBidState,
  submitDeliveryState,
} from "./state";

function App() {
  const [role, setRole] = useState<Role>("business");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selectedGigId, setSelectedGigId] = useState("gig-burger");
  const [state, setState] = useState<AppState>(() => loadManagedState());

  useEffect(() => {
    localStorage.setItem(managedStorageKey, JSON.stringify(state));
  }, [state]);

  const selectedGig = state.gigs.find((gig) => gig.id === selectedGigId) ?? state.gigs[0];
  const selectedEscrow = selectedGig
    ? state.escrows.find((escrow) => escrow.gigId === selectedGig.id)
    : undefined;
  const selectedBids = selectedGig
    ? state.bids.filter((bid) => bid.gigId === selectedGig.id)
    : [];
  const metrics = useMemo(() => calculateMetrics(state), [state]);

  function addBrief(form: BriefForm) {
    const gigId = `gig-${Date.now()}`;
    setState((current) => createBriefState(current, form, gigId));
    setSelectedGigId(gigId);
    setTab("briefs");
  }

  function addBid(gigId: string, form: BidForm) {
    setState((current) => submitBidState(current, gigId, form, `bid-${Date.now()}`, managedActiveCreatorId));
    setSelectedGigId(gigId);
    setTab("marketplace");
  }

  function awardBid(bid: Bid) {
    setState((current) => awardBidState(current, bid.id));
    setSelectedGigId(bid.gigId);
    setTab("escrow");
  }

  function fundEscrow(escrowId: string) {
    setState((current) => fundEscrowState(current, escrowId));
  }

  function submitDelivery(gigId: string, deliveryUrl: string, deliveryNote: string) {
    setState((current) => submitDeliveryState(current, gigId, deliveryUrl, deliveryNote));
    setTab("workspace");
  }

  function releaseEscrow(escrowId: string) {
    setState((current) => releaseEscrowState(current, escrowId));
  }

  function requestRevision(gigId: string) {
    setState((current) => requestRevisionState(current, gigId));
  }

  function openDispute(gigId: string) {
    setState((current) => openDisputeState(current, gigId));
    setTab("admin");
  }

  function refundEscrow(escrowId: string) {
    setState((current) => refundEscrowState(current, escrowId));
  }

  function resetPrototype() {
    localStorage.removeItem(managedStorageKey);
    setState(managedInitialState);
    setSelectedGigId("gig-burger");
    setRole("business");
    setTab("dashboard");
  }

  const navItems = getNav(role);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">W</div>
          <div>
            <h1>Werra</h1>
            <p>Creator escrow desk</p>
          </div>
        </div>

        <div className="role-switcher" aria-label="Role switcher">
          {(["business", "creator", "admin"] as Role[]).map((item) => (
            <button
              key={item}
              className={role === item ? "active" : ""}
              onClick={() => {
                setRole(item);
                setTab(item === "creator" ? "marketplace" : item === "admin" ? "admin" : "dashboard");
              }}
            >
              {roleLabel(item)}
            </button>
          ))}
        </div>

        <nav>
          {navItems.map((item) => (
            <button
              key={item.tab}
              className={tab === item.tab ? "nav-item active" : "nav-item"}
              onClick={() => setTab(item.tab)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="wallet-panel">
          <div className="wallet-row" data-testid="business-wallet">
            <span>Business</span>
            <strong>{state.wallets.businessUsdi.toFixed(2)} USDI</strong>
          </div>
          <div className="wallet-row" data-testid="creator-wallet">
            <span>Creator</span>
            <strong>{state.wallets.creatorUsdi.toFixed(2)} USDI</strong>
          </div>
          <div className="wallet-row" data-testid="werra-wallet">
            <span>Werra fees</span>
            <strong>{state.wallets.werraUsdi.toFixed(2)} USDI</strong>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{roleLabel(role)} mode</p>
            <h2>{pageTitle(tab, role)}</h2>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={resetPrototype} title="Reset prototype">
              <RefreshCcw size={18} />
            </button>
            <button
              className="primary-button"
              onClick={() => setTab(role === "creator" ? "marketplace" : "briefs")}
            >
              {role === "creator" ? <Sparkles size={18} /> : <Plus size={18} />}
              <span>{role === "creator" ? "Find gigs" : "New brief"}</span>
            </button>
          </div>
        </header>

        {tab === "dashboard" && (
          <BusinessDashboard
            metrics={metrics}
            state={state}
            selectedGigId={selectedGigId}
            onSelectGig={(gigId) => {
              setSelectedGigId(gigId);
              setTab("escrow");
            }}
            onCreateBrief={() => setTab("briefs")}
          />
        )}

        {tab === "briefs" && (
          <BriefsView
            state={state}
            selectedGig={selectedGig}
            selectedBids={selectedBids}
            onSelectGig={setSelectedGigId}
            onAddBrief={addBrief}
            onAwardBid={awardBid}
          />
        )}

        {tab === "marketplace" && (
          <MarketplaceView
            state={state}
            activeCreatorId={managedActiveCreatorId}
            onAddBid={addBid}
            onSelectGig={setSelectedGigId}
          />
        )}

        {tab === "workspace" && (
          <CreatorWorkspace
            state={state}
            activeCreatorId={managedActiveCreatorId}
            onSubmitDelivery={submitDelivery}
          />
        )}

        {tab === "escrow" && selectedGig && (
          <EscrowView
            gig={selectedGig}
            bids={selectedBids}
            escrow={selectedEscrow}
            onFund={fundEscrow}
            onRelease={releaseEscrow}
            onRevision={requestRevision}
            onDispute={openDispute}
          />
        )}

        {tab === "admin" && (
          <AdminView
            state={state}
            onRelease={releaseEscrow}
            onRefund={refundEscrow}
            onSelectGig={(gigId) => {
              setSelectedGigId(gigId);
              setTab("escrow");
            }}
          />
        )}
      </main>
    </div>
  );
}

function BusinessDashboard({
  metrics,
  state,
  selectedGigId,
  onSelectGig,
  onCreateBrief,
}: {
  metrics: ReturnType<typeof calculateMetrics>;
  state: AppState;
  selectedGigId: string;
  onSelectGig: (gigId: string) => void;
  onCreateBrief: () => void;
}) {
  return (
    <div className="content-grid">
      <section className="metric-grid">
        <Metric icon={<BriefcaseBusiness />} label="Active briefs" value={metrics.activeGigs} />
        <Metric icon={<Users />} label="Creator bids" value={metrics.pendingBids} />
        <Metric icon={<ShieldCheck />} label="Funded escrow" value={`${metrics.fundedUsdi} USDI`} />
        <Metric icon={<HandCoins />} label="Released payouts" value={`${metrics.releasedUsdi} USDI`} />
      </section>

      <section className="two-column">
        <Panel
          title="Hiring Pipeline"
          action={
            <button className="secondary-button" onClick={onCreateBrief}>
              <Plus size={16} />
              <span>Brief</span>
            </button>
          }
        >
          <div className="pipeline">
            {state.gigs.map((gig) => {
              const bidCount = state.bids.filter((bid) => bid.gigId === gig.id).length;
              return (
                <button
                  key={gig.id}
                  className={gig.id === selectedGigId ? "pipeline-item selected" : "pipeline-item"}
                  onClick={() => onSelectGig(gig.id)}
                >
                  <div>
                    <StatusBadge status={gig.status} />
                    <h3>{gig.title}</h3>
                    <p>{gig.businessName} · {gig.platform} · {bidCount} bids</p>
                  </div>
                  <ChevronRight size={18} />
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title="Escrow Timeline">
          <div className="timeline">
            <TimelineItem icon={<FileCheck2 />} title="Brief accepted" text="Creator and business terms are hashed before funding." />
            <TimelineItem icon={<Wallet />} title="USDI locked" text="Funding creates a mock CKB escrow cell in this prototype." />
            <TimelineItem icon={<Upload />} title="Creator delivery" text="Delivery link, note, and review status are tracked against the gig." />
            <TimelineItem icon={<Banknote />} title="Payout released" text="Approval creates a mock release transaction and updates balances." />
          </div>
        </Panel>
      </section>
    </div>
  );
}

function BriefsView({
  state,
  selectedGig,
  selectedBids,
  onSelectGig,
  onAddBrief,
  onAwardBid,
}: {
  state: AppState;
  selectedGig?: Gig;
  selectedBids: Bid[];
  onSelectGig: (gigId: string) => void;
  onAddBrief: (form: BriefForm) => void;
  onAwardBid: (bid: Bid) => void;
}) {
  return (
    <div className="content-grid">
      <section className="two-column wide-left">
        <Panel title="Post Content Brief">
          <BriefForm onSubmit={onAddBrief} />
        </Panel>

        <Panel title="Briefs">
          <div className="brief-list">
            {state.gigs.map((gig) => (
              <button
                key={gig.id}
                className={selectedGig?.id === gig.id ? "brief-row selected" : "brief-row"}
                onClick={() => onSelectGig(gig.id)}
              >
                <div>
                  <StatusBadge status={gig.status} />
                  <h3>{gig.title}</h3>
                  <p>{gig.contentType} · {gig.budgetUsdi} USDI · {gig.deadline}</p>
                </div>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </Panel>
      </section>

      {selectedGig && (
        <section className="two-column wide-right">
          <Panel title="Selected Brief">
            <GigSummary gig={selectedGig} />
          </Panel>

          <Panel title="Creator Applications">
            {selectedBids.length === 0 ? (
              <EmptyState
                icon={<Users />}
                title="No applications yet"
                text="Creators will appear here after they bid on this brief."
              />
            ) : (
              <div className="bid-stack">
                {selectedBids.map((bid) => (
                  <BidCard key={bid.id} bid={bid} onAward={() => onAwardBid(bid)} />
                ))}
              </div>
            )}
          </Panel>
        </section>
      )}
    </div>
  );
}

function MarketplaceView({
  state,
  activeCreatorId,
  onAddBid,
  onSelectGig,
}: {
  state: AppState;
  activeCreatorId: string;
  onAddBid: (gigId: string, form: BidForm) => void;
  onSelectGig: (gigId: string) => void;
}) {
  const openGigs = state.gigs.filter((gig) => gig.status === "OPEN");
  const activeCreator = creators.find((creator) => creator.id === activeCreatorId)!;

  return (
    <div className="content-grid">
      <section className="creator-strip">
        <CreatorCard creator={activeCreator} compact={false} />
        <div className="creator-stats">
          <Metric icon={<Eye />} label="Avg views" value={activeCreator.avgViews} />
          <Metric icon={<UserCheck />} label="Completed" value={activeCreator.completed} />
          <Metric icon={<CircleDollarSign />} label="Base rate" value={`${activeCreator.rate} USDI`} />
        </div>
      </section>

      <section className="gig-market">
        {openGigs.map((gig) => {
          const hasBid = state.bids.some(
            (bid) => bid.gigId === gig.id && bid.creatorId === activeCreatorId,
          );

          return (
            <Panel key={gig.id} title={gig.title}>
              <div className="market-card">
                <GigSummary gig={gig} />
                {hasBid ? (
                  <div className="notice success">
                    <Check size={18} />
                    <span>Your application is waiting for SME review.</span>
                  </div>
                ) : (
                  <BidFormPanel
                    gig={gig}
                    creator={activeCreator}
                    onSubmit={(form) => {
                      onAddBid(gig.id, form);
                      onSelectGig(gig.id);
                    }}
                  />
                )}
              </div>
            </Panel>
          );
        })}
      </section>
    </div>
  );
}

function CreatorWorkspace({
  state,
  activeCreatorId,
  onSubmitDelivery,
}: {
  state: AppState;
  activeCreatorId: string;
  onSubmitDelivery: (gigId: string, deliveryUrl: string, deliveryNote: string) => void;
}) {
  const selectedGigs = state.gigs.filter((gig) => gig.selectedCreatorId === activeCreatorId);

  return (
    <div className="content-grid">
      <section className="section-header">
        <div>
          <p className="eyebrow">Creator workspace</p>
          <h3>Awarded gigs and delivery queue</h3>
        </div>
      </section>

      <div className="workspace-grid">
        {selectedGigs.length === 0 ? (
          <EmptyState
            icon={<BriefcaseBusiness />}
            title="No awarded gigs yet"
            text="Apply to open briefs from the creator marketplace."
          />
        ) : (
          selectedGigs.map((gig) => {
            const escrow = state.escrows.find((item) => item.gigId === gig.id);
            return (
              <Panel key={gig.id} title={gig.title}>
                <GigSummary gig={gig} />
                {escrow && <EscrowMini escrow={escrow} />}
                {gig.status === "FUNDED" || gig.status === "REVISION_REQUESTED" ? (
                  <DeliveryForm gig={gig} onSubmit={onSubmitDelivery} />
                ) : gig.deliveryUrl ? (
                  <div className="delivery-card">
                    <div>
                      <p className="eyebrow">Submitted content</p>
                      <h3>{gig.deliveryUrl}</h3>
                      <p>{gig.deliveryNote}</p>
                    </div>
                    <StatusBadge status={gig.status} />
                  </div>
                ) : (
                  <div className="notice">
                    <Clock3 size={18} />
                    <span>Waiting for escrow funding before work starts.</span>
                  </div>
                )}
              </Panel>
            );
          })
        )}
      </div>
    </div>
  );
}

function EscrowView({
  gig,
  bids,
  escrow,
  onFund,
  onRelease,
  onRevision,
  onDispute,
}: {
  gig: Gig;
  bids: Bid[];
  escrow?: Escrow;
  onFund: (escrowId: string) => void;
  onRelease: (escrowId: string) => void;
  onRevision: (gigId: string) => void;
  onDispute: (gigId: string) => void;
}) {
  const selectedBid = bids.find((bid) => bid.status === "SELECTED");
  const creator = gig.selectedCreatorId
    ? creators.find((item) => item.id === gig.selectedCreatorId)
    : undefined;

  return (
    <div className="content-grid">
      <section className="two-column wide-left">
        <Panel title="Agreement">
          <GigSummary gig={gig} />
          {creator && (
            <div className="selected-creator">
              <CreatorCard creator={creator} compact />
              {selectedBid && (
                <div className="agreement-terms">
                  <div>
                    <span>Accepted bid</span>
                    <strong>{selectedBid.amountUsdi} USDI</strong>
                  </div>
                  <div>
                    <span>Timeline</span>
                    <strong>{selectedBid.timeline}</strong>
                  </div>
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Delivery Review">
          {gig.deliveryUrl ? (
            <div className="review-box">
              <div className="delivery-link">
                <LinkIcon size={18} />
                <div>
                  <span>Delivery link</span>
                  <strong>{gig.deliveryUrl}</strong>
                </div>
              </div>
              <p>{gig.deliveryNote}</p>
              <div className="button-row">
                {escrow && gig.status === "DELIVERED" && (
                  <button className="primary-button" onClick={() => onRelease(escrow.id)}>
                    <HandCoins size={18} />
                    <span>Approve payout</span>
                  </button>
                )}
                {gig.status === "DELIVERED" && (
                  <button className="secondary-button" onClick={() => onRevision(gig.id)}>
                    <RefreshCcw size={16} />
                    <span>Revision</span>
                  </button>
                )}
                {gig.status === "DELIVERED" && (
                  <button className="danger-button" onClick={() => onDispute(gig.id)}>
                    <Gavel size={16} />
                    <span>Dispute</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Upload />}
              title="No delivery submitted"
              text="Creator delivery will appear here after escrow is funded and work is submitted."
            />
          )}
        </Panel>
      </section>

      <Panel title="CKB Escrow Simulation">
        {escrow ? (
          <div className="escrow-detail">
            <StatusBadge status={escrow.status} />
            <div className="escrow-amount">
              <span>Locked amount</span>
              <strong>{escrow.grossUsdi.toFixed(2)} USDI</strong>
            </div>
            <div className="escrow-breakdown">
              <div>
                <span>Creator payout</span>
                <strong>{escrow.creatorPayoutUsdi.toFixed(2)} USDI</strong>
              </div>
              <div>
                <span>Werra fee</span>
                <strong>{escrow.platformFeeUsdi.toFixed(2)} USDI</strong>
              </div>
            </div>
            <HashBlock label="Agreement ID" value={escrow.agreementId} />
            <HashBlock label="Terms hash" value={escrow.termsHash} />
            <HashBlock label="Escrow cell" value={escrow.escrowCell} />
            {escrow.fundingTxHash && <HashBlock label="Funding tx" value={escrow.fundingTxHash} />}
            {escrow.releaseTxHash && <HashBlock label="Release tx" value={escrow.releaseTxHash} />}
            {escrow.refundTxHash && <HashBlock label="Refund tx" value={escrow.refundTxHash} />}

            {escrow.status === "DRAFT" && (
              <button className="primary-button full" onClick={() => onFund(escrow.id)}>
                <Wallet size={18} />
                <span>Fund escrow</span>
              </button>
            )}

            {escrow.status === "FUNDED" && gig.status !== "DELIVERED" && (
              <div className="notice success">
                <ShieldCheck size={18} />
                <span>USDI is locked. Creator can submit delivery.</span>
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            icon={<ShieldCheck />}
            title="No escrow yet"
            text="Award a creator application to generate agreement terms and a mock CKB escrow cell."
          />
        )}
      </Panel>
    </div>
  );
}

function AdminView({
  state,
  onRelease,
  onRefund,
  onSelectGig,
}: {
  state: AppState;
  onRelease: (escrowId: string) => void;
  onRefund: (escrowId: string) => void;
  onSelectGig: (gigId: string) => void;
}) {
  return (
    <div className="content-grid">
      <section className="section-header">
        <div>
          <p className="eyebrow">Ops console</p>
          <h3>Escrow monitor and dispute queue</h3>
        </div>
      </section>

      <div className="admin-table">
        <div className="admin-head">
          <span>Agreement</span>
          <span>Gig</span>
          <span>Status</span>
          <span>Amount</span>
          <span>Actions</span>
        </div>
        {state.escrows.map((escrow) => {
          const gig = state.gigs.find((item) => item.id === escrow.gigId);
          return (
            <div className="admin-row" key={escrow.id}>
              <div>
                <strong>{escrow.agreementId}</strong>
                <small>{shortHash(escrow.termsHash)}</small>
              </div>
              <button className="link-button" onClick={() => onSelectGig(escrow.gigId)}>
                {gig?.title ?? escrow.gigId}
              </button>
              <StatusBadge status={escrow.status} />
              <strong>{escrow.grossUsdi.toFixed(2)} USDI</strong>
              <div className="button-row compact">
                {escrow.status === "DISPUTED" && (
                  <>
                    <button className="secondary-button" onClick={() => onRelease(escrow.id)}>
                      <Check size={15} />
                      <span>Creator</span>
                    </button>
                    <button className="danger-button" onClick={() => onRefund(escrow.id)}>
                      <X size={15} />
                      <span>Refund</span>
                    </button>
                  </>
                )}
                {escrow.status !== "DISPUTED" && (
                  <span className="muted">No action</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BriefForm({ onSubmit }: { onSubmit: (form: BriefForm) => void }) {
  const [form, setForm] = useState<BriefForm>({
    title: "",
    category: "Food and restaurants",
    objective: "",
    contentType: "Creator posted TikTok",
    deliverables: "1 video, 30-60 seconds",
    location: "Nairobi",
    platform: "TikTok",
    usageRights: "Organic reposting for 30 days",
    revisionCount: 1,
    budgetUsdi: 120,
    deadline: "2026-07-15",
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.objective.trim()) return;
    onSubmit(form);
    setForm((current) => ({ ...current, title: "", objective: "" }));
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label>
        Brief title
        <input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="UGC video for skincare launch"
        />
      </label>
      <label>
        Objective
        <textarea
          value={form.objective}
          onChange={(event) => setForm({ ...form, objective: event.target.value })}
          placeholder="Generate product awareness and drive WhatsApp orders."
        />
      </label>
      <div className="form-row">
        <label>
          Category
          <select
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          >
            <option>Food and restaurants</option>
            <option>Fashion and beauty</option>
            <option>Events and nightlife</option>
            <option>Fitness and wellness</option>
            <option>Online shops</option>
            <option>Local experiences</option>
          </select>
        </label>
        <label>
          Content type
          <select
            value={form.contentType}
            onChange={(event) => setForm({ ...form, contentType: event.target.value })}
          >
            <option>Creator posted TikTok</option>
            <option>Instagram Reel + Story</option>
            <option>UGC video delivered to business</option>
            <option>Creator location visit</option>
            <option>Product review video</option>
          </select>
        </label>
      </div>
      <label>
        Deliverables
        <input
          value={form.deliverables}
          onChange={(event) => setForm({ ...form, deliverables: event.target.value })}
        />
      </label>
      <div className="form-row">
        <label>
          Budget USDI
          <input
            type="number"
            min="20"
            value={form.budgetUsdi}
            onChange={(event) => setForm({ ...form, budgetUsdi: Number(event.target.value) })}
          />
        </label>
        <label>
          Deadline
          <input
            type="date"
            value={form.deadline}
            onChange={(event) => setForm({ ...form, deadline: event.target.value })}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Platform
          <select
            value={form.platform}
            onChange={(event) => setForm({ ...form, platform: event.target.value })}
          >
            <option>TikTok</option>
            <option>Instagram</option>
            <option>YouTube Shorts</option>
          </select>
        </label>
        <label>
          Revisions
          <input
            type="number"
            min="0"
            max="3"
            value={form.revisionCount}
            onChange={(event) => setForm({ ...form, revisionCount: Number(event.target.value) })}
          />
        </label>
      </div>
      <label>
        Usage rights
        <input
          value={form.usageRights}
          onChange={(event) => setForm({ ...form, usageRights: event.target.value })}
        />
      </label>
      <button className="primary-button full" type="submit">
        <Plus size={18} />
        <span>Post brief</span>
      </button>
    </form>
  );
}

function BidFormPanel({
  gig,
  creator,
  onSubmit,
}: {
  gig: Gig;
  creator: Creator;
  onSubmit: (form: BidForm) => void;
}) {
  const [form, setForm] = useState<BidForm>({
    amountUsdi: Math.min(creator.rate, gig.budgetUsdi),
    timeline: "3 days",
    pitch: "",
    sample: creator.samples[0],
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.pitch.trim()) return;
    onSubmit(form);
    setForm((current) => ({ ...current, pitch: "" }));
  }

  return (
    <form className="bid-form" onSubmit={submit}>
      <div className="form-row">
        <label>
          Bid USDI
          <input
            type="number"
            min="20"
            value={form.amountUsdi}
            onChange={(event) => setForm({ ...form, amountUsdi: Number(event.target.value) })}
          />
        </label>
        <label>
          Timeline
          <input
            value={form.timeline}
            onChange={(event) => setForm({ ...form, timeline: event.target.value })}
          />
        </label>
      </div>
      <label>
        Pitch
        <textarea
          value={form.pitch}
          onChange={(event) => setForm({ ...form, pitch: event.target.value })}
          placeholder="Explain the content angle and how you will deliver it."
        />
      </label>
      <label>
        Relevant sample
        <select
          value={form.sample}
          onChange={(event) => setForm({ ...form, sample: event.target.value })}
        >
          {creator.samples.map((sample) => (
            <option key={sample}>{sample}</option>
          ))}
        </select>
      </label>
      <button className="primary-button full" type="submit">
        <ArrowRight size={18} />
        <span>Submit bid</span>
      </button>
    </form>
  );
}

function DeliveryForm({
  gig,
  onSubmit,
}: {
  gig: Gig;
  onSubmit: (gigId: string, deliveryUrl: string, deliveryNote: string) => void;
}) {
  const [url, setUrl] = useState(gig.deliveryUrl ?? "https://tiktok.com/@aminaeats/video/demo");
  const [note, setNote] = useState(
    gig.deliveryNote ?? "Posted with location tag, lunch offer CTA, and pinned business comment.",
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(gig.id, url, note);
  }

  return (
    <form className="delivery-form" onSubmit={submit}>
      <label>
        Delivery link
        <input value={url} onChange={(event) => setUrl(event.target.value)} />
      </label>
      <label>
        Delivery note
        <textarea value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <button className="primary-button full" type="submit">
        <Upload size={18} />
        <span>Submit delivery</span>
      </button>
    </form>
  );
}

function BidCard({ bid, onAward }: { bid: Bid; onAward: () => void }) {
  const creator = creators.find((item) => item.id === bid.creatorId)!;
  return (
    <article className="bid-card">
      <div className="bid-card-top">
        <CreatorCard creator={creator} compact />
        <StatusBadge status={bid.status} />
      </div>
      <p>{bid.pitch}</p>
      <div className="bid-meta">
        <span>{bid.amountUsdi} USDI</span>
        <span>{bid.timeline}</span>
        <span>{bid.sample}</span>
      </div>
      {bid.status === "PENDING" && (
        <button className="primary-button" onClick={onAward}>
          <ShieldCheck size={18} />
          <span>Award and draft escrow</span>
        </button>
      )}
    </article>
  );
}

function CreatorCard({ creator, compact }: { creator: Creator; compact: boolean }) {
  return (
    <article className={compact ? "creator-card compact" : "creator-card"}>
      <div className="avatar">{initials(creator.name)}</div>
      <div>
        <div className="creator-name">
          <h3>{creator.name}</h3>
          <span>{creator.verified}</span>
        </div>
        <p>{creator.handle} · {creator.niche}</p>
        {!compact && (
          <div className="creator-metrics">
            <span>{creator.followers} followers</span>
            <span>{creator.engagement}</span>
            <span>{creator.audience}</span>
          </div>
        )}
      </div>
    </article>
  );
}

function GigSummary({ gig }: { gig: Gig }) {
  return (
    <div className="gig-summary">
      <div className="summary-title">
        <StatusBadge status={gig.status} />
        <h3>{gig.title}</h3>
      </div>
      <p>{gig.objective}</p>
      <div className="summary-grid">
        <SummaryItem label="Deliverables" value={gig.deliverables} />
        <SummaryItem label="Content type" value={gig.contentType} />
        <SummaryItem label="Budget" value={`${gig.budgetUsdi} USDI · KES ${gig.kesEstimate.toLocaleString()}`} />
        <SummaryItem label="Deadline" value={gig.deadline} />
        <SummaryItem label="Location" value={gig.location} />
        <SummaryItem label="Usage rights" value={gig.usageRights} />
      </div>
    </div>
  );
}

function EscrowMini({ escrow }: { escrow: Escrow }) {
  return (
    <div className="escrow-mini">
      <ShieldCheck size={18} />
      <div>
        <span>{escrow.agreementId}</span>
        <strong>{escrow.grossUsdi.toFixed(2)} USDI · {escrow.status}</strong>
      </div>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <article className="metric">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function TimelineItem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="timeline-item">
      <div className="timeline-icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="empty-state">
      <div>{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HashBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="hash-block">
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status ${status.toLowerCase()}`}>{status.replace(/_/g, " ")}</span>;
}

function getNav(role: Role): { tab: Tab; label: string; icon: typeof LayoutDashboard }[] {
  if (role === "creator") {
    return [
      { tab: "marketplace", label: "Marketplace", icon: Sparkles },
      { tab: "workspace", label: "Workspace", icon: Upload },
      { tab: "escrow", label: "Escrow", icon: ShieldCheck },
    ];
  }

  if (role === "admin") {
    return [
      { tab: "admin", label: "Escrow monitor", icon: Gavel },
      { tab: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { tab: "escrow", label: "Agreement", icon: ShieldCheck },
    ];
  }

  return [
    { tab: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { tab: "briefs", label: "Briefs", icon: BriefcaseBusiness },
    { tab: "escrow", label: "Escrow", icon: ShieldCheck },
  ];
}

function pageTitle(tab: Tab, role: Role) {
  if (tab === "dashboard") return "Marketplace dashboard";
  if (tab === "briefs") return "Brief builder";
  if (tab === "marketplace") return "Open content briefs";
  if (tab === "workspace") return "Creator workspace";
  if (tab === "escrow") return "Agreement and escrow";
  if (tab === "admin") return "Operations console";
  return roleLabel(role);
}

function roleLabel(role: Role) {
  if (role === "business") return "SME";
  if (role === "creator") return "Creator";
  return "Admin";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

function shortHash(hash: string) {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

export default App;
