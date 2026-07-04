import {
  Banknote,
  BriefcaseBusiness,
  Check,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Gavel,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  awardApiBid,
  bootstrapPocWallets,
  createApiBid,
  createApiBrief,
  fundUsdwEscrow,
  getManagedUsers,
  getMarketplace,
  getUsdwBalance,
  issueUsdw,
  openApiDispute,
  releaseUsdwEscrow,
  settleApiDispute,
  submitApiDelivery,
  type ApiAgreement,
  type ApiBid,
  type ApiBrief,
  type ApiDelivery,
  type ApiDispute,
  type ApiEscrow,
  type ApiMarketplace,
  type ApiRole,
  type ApiUsdwBalance,
  type ApiUser,
} from "./api";

type SessionRole = ApiRole;
type ViewKey =
  | "overview"
  | "briefs"
  | "applications"
  | "payments"
  | "opportunities"
  | "workspace"
  | "earnings"
  | "operations"
  | "support"
  | "funding";

const sessionKey = "werra-session-email";

const demoAccounts: Record<
  SessionRole,
  { email: string; title: string; subtitle: string; defaultView: ViewKey }
> = {
  business: {
    email: "demo-sme@werra.local",
    title: "SME",
    subtitle: "Post briefs, select creators, approve payout.",
    defaultView: "overview",
  },
  creator: {
    email: "demo-creator@werra.local",
    title: "Creator",
    subtitle: "Find paid content work, submit delivery, track payout.",
    defaultView: "opportunities",
  },
  admin: {
    email: "demo-issuer@werra.local",
    title: "Werra Admin",
    subtitle: "Monitor payments, support disputes, manage beta balances.",
    defaultView: "operations",
  },
};

const emptyMarket: ApiMarketplace = {
  briefs: [],
  bids: [],
  agreements: [],
  escrows: [],
  deliveries: [],
  disputes: [],
};

function App() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [market, setMarket] = useState<ApiMarketplace>(emptyMarket);
  const [balances, setBalances] = useState<Record<string, ApiUsdwBalance>>({});
  const [sessionEmail, setSessionEmail] = useState(() => localStorage.getItem(sessionKey) ?? "");
  const [view, setView] = useState<ViewKey>("overview");
  const [notice, setNotice] = useState("Preparing Werra workspace...");
  const [busy, setBusy] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const currentUser = users.find((user) => user.email === sessionEmail);
  const currentRole = currentUser?.role;

  const context = useMemo(() => buildContext(users, market), [users, market]);

  async function refresh(options: { loadBalances?: boolean } = { loadBalances: true }) {
    const [loadedUsers, loadedMarket] = await Promise.all([getManagedUsers(), getMarketplace()]);
    setUsers(loadedUsers);
    setMarket(loadedMarket);

    if (options.loadBalances) {
      const relevant = loadedUsers.filter((user) =>
        Object.values(demoAccounts).some((account) => account.email === user.email)
        || loadedMarket.agreements.some((agreement) => agreement.businessId === user.id || agreement.creatorId === user.id),
      );
      const entries = await Promise.all(
        relevant.map(async (user) => [user.id, await getUsdwBalance(user.id)] as const),
      );
      setBalances(Object.fromEntries(entries));
    }
  }

  async function boot() {
    try {
      setReady(false);
      await bootstrapPocWallets();
      await refresh();
      setNotice("");
    } catch (error) {
      setNotice(humanError(error));
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    if (!currentRole) return;
    const allowed = navFor(currentRole).map((item) => item.view);
    if (!allowed.includes(view)) {
      setView(demoAccounts[currentRole].defaultView);
    }
  }, [currentRole, view]);

  function login(role: SessionRole) {
    localStorage.setItem(sessionKey, demoAccounts[role].email);
    setSessionEmail(demoAccounts[role].email);
    setView(demoAccounts[role].defaultView);
  }

  function logout() {
    localStorage.removeItem(sessionKey);
    setSessionEmail("");
    setView("overview");
  }

  async function runAction(label: string, action: () => Promise<void>) {
    try {
      setBusy(label);
      setNotice(label);
      await action();
      setNotice("Workspace updated.");
      return true;
    } catch (error) {
      setNotice(humanError(error));
      return false;
    } finally {
      setBusy(null);
    }
  }

  if (!currentUser) {
    return (
      <LoginScreen
        ready={ready}
        notice={notice}
        users={users}
        onLogin={login}
        onRefresh={() => void boot()}
      />
    );
  }

  const activeRole = currentUser.role;
  const nav = navFor(activeRole);
  const balance = balances[currentUser.id];

  return (
    <div className="app-shell role-app">
      <aside className="sidebar clean-sidebar">
        <div className="brand">
          <h1 className="brand-wordmark">werra</h1>
        </div>

        <div className="account-card">
          <span>Signed in as</span>
          <strong>{demoAccounts[activeRole].title}</strong>
          <small>{currentUser.email}</small>
        </div>

        <nav>
          {nav.map((item) => (
            <button
              key={item.view}
              className={view === item.view ? "nav-item active" : "nav-item"}
              onClick={() => setView(item.view)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="wallet-panel">
          <div className="wallet-row">
            <span>Available</span>
            <strong>{balance ? `${balance.amount} USDW` : "Syncing"}</strong>
          </div>
          <div className="wallet-row">
            <span>Account</span>
            <strong>Managed</strong>
          </div>
        </div>

        <button className="secondary-button full" onClick={logout}>
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{demoAccounts[activeRole].title}</p>
            <h2>{titleFor(view)}</h2>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => void runAction("Refreshing workspace...", () => refresh())} title="Refresh">
              <RefreshCcw size={18} />
            </button>
          </div>
        </header>

        {notice && <div className="notice-bar">{notice}</div>}

        {activeRole === "business" && (
          <BusinessWorkspace
            user={currentUser}
            context={context}
            balance={balance}
            busy={busy}
            view={view}
            setView={setView}
            runAction={runAction}
            refresh={refresh}
          />
        )}

        {activeRole === "creator" && (
          <CreatorWorkspace
            user={currentUser}
            context={context}
            balance={balance}
            busy={busy}
            view={view}
            setView={setView}
            runAction={runAction}
            refresh={refresh}
          />
        )}

        {activeRole === "admin" && (
          <AdminWorkspace
            user={currentUser}
            users={users}
            context={context}
            balances={balances}
            busy={busy}
            view={view}
            setView={setView}
            runAction={runAction}
            refresh={refresh}
          />
        )}
      </main>
    </div>
  );
}

function LoginScreen({
  ready,
  notice,
  users,
  onLogin,
  onRefresh,
}: {
  ready: boolean;
  notice: string;
  users: ApiUser[];
  onLogin: (role: SessionRole) => void;
  onRefresh: () => void;
}) {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand login-brand">
          <h1 className="brand-wordmark">werra</h1>
        </div>

        <div className="login-grid">
          {(Object.keys(demoAccounts) as SessionRole[]).map((role) => {
            const account = demoAccounts[role];
            const available = users.some((user) => user.email === account.email);
            return (
              <button
                key={role}
                className="login-card"
                disabled={!ready || !available}
                onClick={() => onLogin(role)}
              >
                <span>{account.title}</span>
                <strong>Continue as {account.title}</strong>
                <small>{account.subtitle}</small>
              </button>
            );
          })}
        </div>

        <div className={`login-footer ${notice ? "" : "empty"}`}>
          {notice && <span>{notice}</span>}
          <button className="secondary-button" onClick={onRefresh}>
            <RefreshCcw size={16} />
            <span>Refresh</span>
          </button>
        </div>
      </section>
    </main>
  );
}

function BusinessWorkspace(props: WorkspaceProps & { user: ApiUser; balance?: ApiUsdwBalance }) {
  const { user, context, view, balance, busy, runAction, refresh } = props;
  const myBriefs = newestFirst(context.briefs.filter((brief) => brief.businessId === user.id));
  const myAgreements = newestFirst(context.agreements.filter((agreement) => agreement.businessId === user.id), "updatedAt");
  const pendingBids = newestFirst(
    context.bids.filter((bid) => {
      const brief = context.briefById.get(bid.briefId);
      return brief?.businessId === user.id && bid.status === "PENDING";
    }),
  );
  const reviewReady = myAgreements.filter((agreement) => agreement.status === "DELIVERED");
  const held = myAgreements
    .filter((agreement) => agreement.status === "FUNDED" || agreement.status === "DELIVERED")
    .reduce((sum, agreement) => sum + agreement.grossUsdi, 0);

  if (view === "briefs") {
    return (
      <div className="content-grid">
        <Panel title="Post brief">
          <BriefForm
            onSubmit={async (input) => {
              let created: ApiBrief | undefined;
              const ok = await runAction("Posting brief...", async () => {
                created = await createApiBrief({ ...input, businessId: user.id });
                await refresh();
              });
              return ok ? created : undefined;
            }}
            busy={Boolean(busy)}
          />
        </Panel>
        <BriefList briefs={myBriefs} context={context} />
      </div>
    );
  }

  if (view === "applications") {
    return (
      <div className="content-grid">
        {pendingBids.length === 0 ? (
          <EmptyState icon={<Users />} title="No pending applications" text="New creator applications will appear here." />
        ) : (
          pendingBids.map((bid) => (
            <ApplicationCard
              key={bid.id}
              bid={bid}
              context={context}
              action={
                <button
                  className="primary-button"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    runAction("Awarding and funding escrow...", async () => {
                      try {
                        await awardApiBid(bid.id, user.id);
                      } finally {
                        await refresh();
                      }
                    })
                  }
                >
                  <UserCheck size={16} />
                  <span>Award & fund</span>
                </button>
              }
            />
          ))
        )}
      </div>
    );
  }

  if (view === "payments") {
    return (
      <AgreementList
        agreements={myAgreements}
        context={context}
        emptyText="Award a creator to fund escrow and start the job."
        renderActions={(agreement) => (
          <BusinessPaymentActions
            agreement={agreement}
            context={context}
            user={user}
            busy={busy}
            runAction={runAction}
            refresh={refresh}
          />
        )}
      />
    );
  }

  return (
    <div className="content-grid">
      <section className="metric-grid">
        <Metric icon={<CircleDollarSign />} label="Balance" value={`${balance?.amount ?? "0"} USDW`} />
        <Metric icon={<BriefcaseBusiness />} label="Briefs" value={myBriefs.length} />
        <Metric icon={<Users />} label="Applications" value={pendingBids.length} />
        <Metric icon={<ShieldCheck />} label="In escrow" value={`${held.toFixed(2)} USDW`} />
      </section>
      <section className="two-column">
        <Panel title="Review queue">
          {reviewReady.length === 0 ? (
            <EmptyState icon={<Clock3 />} title="No deliveries waiting" text="Approved work will move to payout from here." />
          ) : (
            reviewReady.map((agreement) => (
              <AgreementSummary key={agreement.id} agreement={agreement} context={context} />
            ))
          )}
        </Panel>
        <Panel title="Latest briefs">
          <BriefList briefs={myBriefs.slice(0, 4)} context={context} compact />
        </Panel>
      </section>
    </div>
  );
}

function CreatorWorkspace(props: WorkspaceProps & { user: ApiUser; balance?: ApiUsdwBalance }) {
  const { user, context, view, balance, busy, runAction, refresh, setView } = props;
  const openBriefs = newestFirst(context.briefs.filter((brief) => brief.status === "OPEN"));
  const myBids = newestFirst(context.bids.filter((bid) => bid.creatorId === user.id));
  const myAgreements = newestFirst(context.agreements.filter((agreement) => agreement.creatorId === user.id), "updatedAt");
  const readyToSubmit = myAgreements.filter(
    (agreement) => agreement.status === "FUNDED" && !context.deliveryByAgreement.has(agreement.id),
  );
  const readyIds = new Set(readyToSubmit.map((agreement) => agreement.id));
  const paid = myAgreements
    .filter((agreement) => agreement.status === "RELEASED")
    .reduce((sum, agreement) => sum + agreement.creatorPayoutUsdi, 0);

  if (view === "workspace") {
    return (
      <div className="content-grid">
        {readyToSubmit.length > 0 && (
        <Panel title="Latest work to submit">
            <div className="content-grid">
              {readyToSubmit.map((agreement) => (
                <CreatorWorkCard
                  key={agreement.id}
                  agreement={agreement}
                  context={context}
                  user={user}
                  busy={busy}
                  runAction={runAction}
                  refresh={refresh}
                />
              ))}
            </div>
          </Panel>
        )}

        <AgreementList
          agreements={myAgreements.filter((agreement) => !readyIds.has(agreement.id))}
          context={context}
          emptyText="Accepted work appears here after an SME awards your application."
          renderActions={(agreement) => (
            <CreatorDeliveryActions
              agreement={agreement}
              context={context}
              user={user}
              busy={busy}
              runAction={runAction}
              refresh={refresh}
            />
          )}
        />
      </div>
    );
  }

  if (view === "earnings") {
    return (
      <div className="content-grid">
        <section className="metric-grid">
          <Metric icon={<CircleDollarSign />} label="Available" value={`${balance?.amount ?? "0"} USDW`} />
          <Metric icon={<HandCoins />} label="Paid out" value={`${paid.toFixed(2)} USDW`} />
          <Metric icon={<BriefcaseBusiness />} label="Active work" value={myAgreements.filter((a) => a.status !== "RELEASED").length} />
          <Metric icon={<Check />} label="Completed" value={myAgreements.filter((a) => a.status === "RELEASED").length} />
        </section>
        <AgreementList agreements={myAgreements} context={context} emptyText="No earnings yet." />
      </div>
    );
  }

  return (
    <div className="content-grid">
      {readyToSubmit.length > 0 && (
        <Panel
          title="Latest ready to deliver"
          action={
            <button className="secondary-button" onClick={() => setView("workspace")}>
              <Upload size={16} />
              <span>Go to submit work</span>
            </button>
          }
        >
          <div className="submit-work-prompt">
            <Upload size={22} />
            <div>
              <h3>{readyToSubmit.length} funded job ready</h3>
              <p>Submit the completed content link from the Submit Work section so the SME can review and approve payout.</p>
            </div>
          </div>
        </Panel>
      )}

      {openBriefs.length === 0 ? (
        <EmptyState icon={<Sparkles />} title="No open briefs" text="New SME briefs will appear here." />
      ) : (
        openBriefs.map((brief) => {
          const existingBid = myBids.find((bid) => bid.briefId === brief.id);
          return (
            <Panel key={brief.id} title={brief.title}>
              <BriefDetails brief={brief} />
              {existingBid ? (
                <div className="notice success">
                  <Check size={18} />
                  <span>Application submitted: {statusLabel(existingBid.status)}</span>
                </div>
              ) : (
                <BidForm
                  brief={brief}
                  busy={Boolean(busy)}
                  onSubmit={(input) =>
                    runAction("Submitting application...", async () => {
                      await createApiBid(brief.id, { ...input, creatorId: user.id });
                      await refresh();
                    })
                  }
                />
              )}
            </Panel>
          );
        })
      )}
    </div>
  );
}

function AdminWorkspace(props: WorkspaceProps & { user: ApiUser; users: ApiUser[]; balances: Record<string, ApiUsdwBalance> }) {
  const { user, users, context, balances, view, busy, runAction, refresh } = props;
  const business = users.find((user) => user.email === demoAccounts.business.email);
  const creator = users.find((user) => user.email === demoAccounts.creator.email);
  const issuer = users.find((user) => user.email === demoAccounts.admin.email);
  const disputes = newestFirst(context.disputes.filter((dispute) => dispute.status === "OPEN"));
  const agreements = newestFirst(context.agreements, "updatedAt");
  const inEscrow = agreements
    .filter((agreement) => agreement.status === "FUNDED" || agreement.status === "DELIVERED")
    .reduce((sum, agreement) => sum + agreement.grossUsdi, 0);

  if (view === "support") {
    return (
      <div className="content-grid">
        {disputes.length === 0 ? (
          <EmptyState icon={<Gavel />} title="No open disputes" text="Support cases opened by SMEs will appear here." />
        ) : (
          disputes.map((dispute) => (
            <Panel key={dispute.id} title="Dispute review">
              <DisputeDetails dispute={dispute} context={context} />
              <div className="button-row">
                <button
                  className="primary-button"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    runAction("Settling dispute...", async () => {
                      await settleApiDispute(dispute.id, { adminId: user.id, decision: "release" });
                      await refresh();
                    })
                  }
                >
                  <HandCoins size={16} />
                  <span>Pay creator</span>
                </button>
                <button
                  className="danger-button"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    runAction("Settling dispute...", async () => {
                      await settleApiDispute(dispute.id, { adminId: user.id, decision: "refund" });
                      await refresh();
                    })
                  }
                >
                  <RefreshCcw size={16} />
                  <span>Refund SME</span>
                </button>
              </div>
            </Panel>
          ))
        )}
      </div>
    );
  }

  if (view === "funding") {
    return (
      <div className="content-grid">
        <section className="metric-grid">
          <Metric icon={<CircleDollarSign />} label="SME balance" value={`${business ? balances[business.id]?.amount ?? "0" : "0"} USDW`} />
          <Metric icon={<HandCoins />} label="Creator balance" value={`${creator ? balances[creator.id]?.amount ?? "0" : "0"} USDW`} />
          <Metric icon={<Banknote />} label="Werra fees" value={`${issuer ? balances[issuer.id]?.amount ?? "0" : "0"} USDW`} />
          <Metric icon={<ShieldCheck />} label="Protected" value={`${inEscrow.toFixed(2)} USDW`} />
        </section>
        <Panel title="Test balances">
          <div className="action-row">
            <div>
              <h3>Top up SME test balance</h3>
              <p className="muted">Adds spendable USDW to the demo SME account for marketplace testing.</p>
            </div>
            <button
              className="primary-button"
              disabled={Boolean(busy) || !business}
              onClick={() =>
                runAction("Adding SME test balance...", async () => {
                  if (!business) return;
                  await issueUsdw(business.id, "1000");
                  await refresh();
                })
              }
            >
              <Plus size={16} />
              <span>Add 1000 USDW</span>
            </button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="content-grid">
      <section className="metric-grid">
        <Metric icon={<BriefcaseBusiness />} label="Briefs" value={context.briefs.length} />
        <Metric icon={<ShieldCheck />} label="Active escrows" value={context.agreements.filter((a) => a.status === "FUNDED").length} />
        <Metric icon={<Upload />} label="In review" value={context.agreements.filter((a) => a.status === "DELIVERED").length} />
        <Metric icon={<Gavel />} label="Disputes" value={disputes.length} />
      </section>
      <AgreementList agreements={agreements} context={context} emptyText="No marketplace agreements yet." />
    </div>
  );
}

function BusinessPaymentActions({
  agreement,
  context,
  user,
  busy,
  runAction,
  refresh,
}: ActionProps & { agreement: ApiAgreement; user: ApiUser }) {
  const delivery = context.deliveryByAgreement.get(agreement.id);

  if (agreement.status === "DRAFT") {
    return (
      <button
        className="primary-button"
        disabled={Boolean(busy)}
        onClick={() =>
          runAction("Funding escrow...", async () => {
            await fundUsdwEscrow(agreement.id, user.id);
            await refresh();
          })
        }
      >
        <Wallet size={16} />
        <span>Complete funding</span>
      </button>
    );
  }

  if (agreement.status === "DELIVERED" && delivery) {
    return (
      <div className="button-row">
        <button
          className="primary-button"
          disabled={Boolean(busy)}
          onClick={() =>
            runAction("Approving payout...", async () => {
              await releaseUsdwEscrow(agreement.id, user.id);
              await refresh();
            })
          }
        >
          <HandCoins size={16} />
          <span>Approve payout</span>
        </button>
        <button
          className="danger-button"
          disabled={Boolean(busy)}
          onClick={() =>
            runAction("Opening support case...", async () => {
              await openApiDispute(agreement.id, {
                openedBy: user.id,
                reason: "Delivery needs Werra support review.",
              });
              await refresh();
            })
          }
        >
          <Gavel size={16} />
          <span>Open dispute</span>
        </button>
      </div>
    );
  }

  return <StatusBadge status={agreement.status} />;
}

function CreatorWorkCard({
  agreement,
  context,
  user,
  busy,
  runAction,
  refresh,
}: ActionProps & { agreement: ApiAgreement; user: ApiUser }) {
  const brief = context.briefById.get(agreement.briefId);

  return (
    <article className="submit-work-card">
      <div className="submit-work-heading">
        <div>
          <span>Completed content</span>
          <h3>{brief?.title ?? "Accepted work"}</h3>
          <p>Add the live content link or delivery file link. The SME will review it before payout is released.</p>
        </div>
        <StatusBadge status={agreement.status} />
      </div>
      <AgreementSummary agreement={agreement} context={context} />
      <CreatorDeliveryActions
        agreement={agreement}
        context={context}
        user={user}
        busy={busy}
        runAction={runAction}
        refresh={refresh}
      />
    </article>
  );
}

function CreatorDeliveryActions({
  agreement,
  context,
  user,
  busy,
  runAction,
  refresh,
}: ActionProps & { agreement: ApiAgreement; user: ApiUser }) {
  const delivery = context.deliveryByAgreement.get(agreement.id);

  if (delivery) {
    return (
      <div className="delivery-link">
        <Upload size={18} />
        <div>
          <span>Delivery submitted</span>
          <strong>{delivery.url}</strong>
        </div>
      </div>
    );
  }

  if (agreement.status !== "FUNDED") {
    return <StatusBadge status={agreement.status} />;
  }

  return (
    <DeliveryForm
      busy={Boolean(busy)}
      onSubmit={(input) =>
        runAction("Submitting delivery...", async () => {
          await submitApiDelivery(agreement.id, { ...input, creatorId: user.id });
          await refresh();
        })
      }
    />
  );
}

function BriefForm({
  onSubmit,
  busy,
}: {
  onSubmit: (input: Omit<ApiBrief, "id" | "businessId" | "status" | "createdAt">) => Promise<ApiBrief | undefined>;
  busy: boolean;
}) {
  const defaultForm = {
    title: "Nairobi lunch offer creator video",
    objective: "Drive store visits from nearby customers this week.",
    deliverables: "1 TikTok video, 1 Instagram Reel, delivery link",
    category: "Food and restaurants",
    contentType: "Creator posted short video",
    location: "Nairobi, Kenya",
    platform: "TikTok + Instagram",
    usageRights: "Organic reposting for 30 days",
    revisionCount: 1,
    budgetUsdi: 120,
    deadline: "2026-08-15",
  };
  const [form, setForm] = useState(defaultForm);
  const [postedBrief, setPostedBrief] = useState<ApiBrief | undefined>();
  const [posting, setPosting] = useState(false);
  const submitLock = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (busy || posting || postedBrief || submitLock.current) {
      return;
    }

    submitLock.current = true;
    setPosting(true);
    let created: ApiBrief | undefined;

    try {
      created = await onSubmit(form);

      if (created) {
        setPostedBrief(created);
      }
    } finally {
      if (!created) {
        submitLock.current = false;
      }
      setPosting(false);
    }
  }

  function startAnotherBrief() {
    submitLock.current = false;
    setPostedBrief(undefined);
    setForm({
      ...defaultForm,
      title: "",
      objective: "",
      deliverables: "",
    });
  }

  if (postedBrief) {
    return (
      <div className="posted-brief-card" role="status" aria-live="polite">
        <div className="posted-brief-heading">
          <Check size={20} />
          <div>
            <h3>Brief posted</h3>
            <p>{postedBrief.title} is live for creator applications.</p>
          </div>
        </div>
        <div className="summary-grid">
          <SummaryItem label="Budget" value={`${postedBrief.budgetUsdi.toFixed(2)} USDW`} />
          <SummaryItem label="Deadline" value={postedBrief.deadline} />
          <SummaryItem label="Status" value={statusLabel(postedBrief.status)} />
        </div>
        <button className="secondary-button" type="button" onClick={startAnotherBrief}>
          <Plus size={16} />
          <span>Post another brief</span>
        </button>
      </div>
    );
  }

  return (
    <form className="stack-form" onSubmit={submit} aria-busy={posting}>
      <fieldset className="form-fields" disabled={busy || posting}>
        <label>
          Brief title
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </label>
        <label>
          Goal
          <textarea value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} />
        </label>
        <label>
          Deliverables
          <input value={form.deliverables} onChange={(event) => setForm({ ...form, deliverables: event.target.value })} />
        </label>
        <div className="form-row">
          <label>
            Budget
            <input
              type="number"
              min="20"
              value={form.budgetUsdi}
              onChange={(event) => setForm({ ...form, budgetUsdi: Number(event.target.value) })}
            />
          </label>
          <label>
            Deadline
            <input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} />
          </label>
        </div>
        {posting && (
          <div className="form-status" role="status" aria-live="polite">
            <RefreshCcw size={16} />
            <span>Posting brief...</span>
          </div>
        )}
        <button className="primary-button full" type="submit" disabled={busy || posting}>
          {posting ? <RefreshCcw size={18} /> : <Plus size={18} />}
          <span>{posting ? "Posting..." : "Post brief"}</span>
        </button>
      </fieldset>
    </form>
  );
}

function BidForm({
  brief,
  onSubmit,
  busy,
}: {
  brief: ApiBrief;
  onSubmit: (input: Omit<ApiBid, "id" | "briefId" | "status" | "createdAt">) => void;
  busy: boolean;
}) {
  const [amountUsdi, setAmountUsdi] = useState(Math.min(brief.budgetUsdi, 110));
  const [timeline, setTimeline] = useState("3 days after escrow funding");
  const [pitch, setPitch] = useState("I can create a location-first short video with a clear customer offer.");

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      creatorId: "",
      amountUsdi,
      timeline,
      pitch,
      sample: "https://tiktok.com/@werra-demo/video/sample",
    });
  }

  return (
    <form className="stack-form compact-form" onSubmit={submit}>
      <div className="form-row">
        <label>
          Your rate
          <input type="number" min="20" value={amountUsdi} onChange={(event) => setAmountUsdi(Number(event.target.value))} />
        </label>
        <label>
          Timeline
          <input value={timeline} onChange={(event) => setTimeline(event.target.value)} />
        </label>
      </div>
      <label>
        Pitch
        <textarea value={pitch} onChange={(event) => setPitch(event.target.value)} />
      </label>
      <button className="primary-button full" type="submit" disabled={busy}>
        <Send size={16} />
        <span>Apply</span>
      </button>
    </form>
  );
}

function DeliveryForm({
  onSubmit,
  busy,
}: {
  onSubmit: (input: { url: string; note: string }) => void;
  busy: boolean;
}) {
  const [url, setUrl] = useState("https://tiktok.com/@werra-demo/video/delivery");
  const [note, setNote] = useState("Posted with offer CTA and business location tag.");

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ url, note });
  }

  return (
    <form className="stack-form compact-form" onSubmit={submit}>
      <label>
        Delivery link
        <input value={url} onChange={(event) => setUrl(event.target.value)} />
      </label>
      <label>
        Note
        <textarea value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <button className="primary-button full" type="submit" disabled={busy}>
        <Upload size={16} />
        <span>Submit completed work</span>
      </button>
    </form>
  );
}

function AgreementList({
  agreements,
  context,
  emptyText,
  renderActions,
}: {
  agreements: ApiAgreement[];
  context: AppContext;
  emptyText: string;
  renderActions?: (agreement: ApiAgreement) => ReactNode;
}) {
  if (agreements.length === 0) {
    return <EmptyState icon={<ShieldCheck />} title="Nothing here yet" text={emptyText} />;
  }

  return (
    <div className="content-grid">
      {newestFirst(agreements, "updatedAt").map((agreement) => (
        <Panel
          key={agreement.id}
          title={context.briefById.get(agreement.briefId)?.title ?? "Agreement"}
          action={<StatusBadge status={agreement.status} />}
        >
          <AgreementSummary agreement={agreement} context={context} />
          {renderActions?.(agreement)}
        </Panel>
      ))}
    </div>
  );
}

function AgreementSummary({ agreement, context }: { agreement: ApiAgreement; context: AppContext }) {
  const brief = context.briefById.get(agreement.briefId);
  const delivery = context.deliveryByAgreement.get(agreement.id);

  return (
    <div className="agreement-card">
      {brief && <BriefDetails brief={brief} compact />}
      <div className="summary-grid">
        <SummaryItem label="Escrowed" value={`${agreement.grossUsdi.toFixed(2)} USDW`} />
        <SummaryItem label="Creator payout" value={`${agreement.creatorPayoutUsdi.toFixed(2)} USDW`} />
        <SummaryItem label="Werra fee" value={`${agreement.platformFeeUsdi.toFixed(2)} USDW`} />
        <SummaryItem label="Status" value={statusLabel(agreement.status)} />
      </div>
      {delivery && (
        <div className="delivery-link">
          <Upload size={18} />
          <div>
            <span>Delivery</span>
            <strong>{delivery.url}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

function ApplicationCard({
  bid,
  context,
  action,
}: {
  bid: ApiBid;
  context: AppContext;
  action: ReactNode;
}) {
  const brief = context.briefById.get(bid.briefId);
  const creator = context.userById.get(bid.creatorId);

  return (
    <Panel title={brief?.title ?? "Application"} action={<StatusBadge status={bid.status} />}>
      <div className="application-card">
        <div>
          <h3>{displayName(creator)}</h3>
          <p>{bid.pitch}</p>
        </div>
        <div className="summary-grid">
          <SummaryItem label="Rate" value={`${bid.amountUsdi.toFixed(2)} USDW`} />
          <SummaryItem label="Timeline" value={bid.timeline} />
          <SummaryItem label="Brief" value={brief?.platform ?? "Content"} />
        </div>
        {action}
      </div>
    </Panel>
  );
}

function BriefList({ briefs, context, compact }: { briefs: ApiBrief[]; context: AppContext; compact?: boolean }) {
  if (briefs.length === 0) {
    return <EmptyState icon={<BriefcaseBusiness />} title="No briefs yet" text="Post a brief to start receiving creator applications." />;
  }

  return (
    <div className="brief-list">
      {newestFirst(briefs).map((brief) => {
        const bidCount = context.bids.filter((bid) => bid.briefId === brief.id).length;
        return (
          <article key={brief.id} className="brief-row static-row">
            <div>
              <StatusBadge status={brief.status} />
              <h3>{brief.title}</h3>
              <p>{brief.platform} · {brief.budgetUsdi.toFixed(2)} USDW · {bidCount} applications</p>
              {!compact && <p>{brief.objective}</p>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function BriefDetails({ brief, compact }: { brief: ApiBrief; compact?: boolean }) {
  return (
    <div className="brief-details">
      <div className="summary-title">
        <StatusBadge status={brief.status} />
        <h3>{brief.title}</h3>
      </div>
      {!compact && <p>{brief.objective}</p>}
      <div className="summary-grid">
        <SummaryItem label="Budget" value={`${brief.budgetUsdi.toFixed(2)} USDW`} />
        <SummaryItem label="Deadline" value={brief.deadline} />
        <SummaryItem label="Platform" value={brief.platform} />
        <SummaryItem label="Deliverables" value={brief.deliverables} />
      </div>
    </div>
  );
}

function DisputeDetails({ dispute, context }: { dispute: ApiDispute; context: AppContext }) {
  const agreement = context.agreementById.get(dispute.agreementId);
  const brief = agreement ? context.briefById.get(agreement.briefId) : undefined;
  const business = agreement ? context.userById.get(agreement.businessId) : undefined;
  const creator = agreement ? context.userById.get(agreement.creatorId) : undefined;
  const delivery = context.deliveryByAgreement.get(dispute.agreementId);

  return (
    <div className="agreement-card">
      <div className="summary-title">
        <StatusBadge status={dispute.status} />
        <h3>{brief?.title ?? "Disputed agreement"}</h3>
      </div>
      <p>{dispute.reason}</p>
      {agreement && (
        <div className="summary-grid">
          <SummaryItem label="Amount" value={`${agreement.grossUsdi.toFixed(2)} USDW`} />
          <SummaryItem label="Creator payout" value={`${agreement.creatorPayoutUsdi.toFixed(2)} USDW`} />
          <SummaryItem label="SME" value={displayName(business)} />
          <SummaryItem label="Creator" value={displayName(creator)} />
          <SummaryItem label="Opened" value={new Date(dispute.createdAt).toLocaleDateString()} />
        </div>
      )}
      {delivery && (
        <div className="delivery-note">
          <span>Submitted work</span>
          <a href={delivery.url} target="_blank" rel="noreferrer">
            {delivery.url}
          </a>
          <p>{delivery.note}</p>
        </div>
      )}
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
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

function StatusBadge({ status }: { status: string }) {
  return <span className={`status ${status.toLowerCase()}`}>{statusLabel(status)}</span>;
}

function buildContext(users: ApiUser[], market: ApiMarketplace): AppContext {
  return {
    ...market,
    userById: new Map(users.map((user) => [user.id, user])),
    briefById: new Map(market.briefs.map((brief) => [brief.id, brief])),
    agreementById: new Map(market.agreements.map((agreement) => [agreement.id, agreement])),
    escrowByAgreement: new Map(market.escrows.map((escrow) => [escrow.agreementId, escrow])),
    deliveryByAgreement: new Map(market.deliveries.map((delivery) => [delivery.agreementId, delivery])),
  };
}

function newestFirst<T extends { createdAt: string }>(items: T[], key: keyof T = "createdAt") {
  return [...items].sort((left, right) => {
    const leftDate = new Date(String(left[key])).getTime();
    const rightDate = new Date(String(right[key])).getTime();
    return rightDate - leftDate;
  });
}

function navFor(role: SessionRole) {
  if (role === "business") {
    return [
      { view: "overview" as const, label: "Overview", icon: LayoutDashboard },
      { view: "briefs" as const, label: "Post Brief", icon: Plus },
      { view: "applications" as const, label: "Applications", icon: Users },
      { view: "payments" as const, label: "Payments", icon: ShieldCheck },
    ];
  }

  if (role === "creator") {
    return [
      { view: "opportunities" as const, label: "Find Work", icon: Sparkles },
      { view: "workspace" as const, label: "Submit Work", icon: Upload },
      { view: "earnings" as const, label: "Earnings", icon: CircleDollarSign },
    ];
  }

  return [
    { view: "operations" as const, label: "Overview", icon: LayoutDashboard },
    { view: "support" as const, label: "Support", icon: Gavel },
    { view: "funding" as const, label: "Balances", icon: Banknote },
  ];
}

function titleFor(view: ViewKey) {
  const titles: Record<ViewKey, string> = {
    overview: "Marketplace overview",
    briefs: "Post a brief",
    applications: "Creator applications",
    payments: "Escrowed payments",
    opportunities: "Open briefs",
    workspace: "Submit completed work",
    earnings: "Earnings",
    operations: "Operations overview",
    support: "Support queue",
    funding: "Beta balances",
  };
  return titles[view];
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: "Open",
    AWARDED: "Awarded",
    PENDING: "Pending",
    SELECTED: "Selected",
    DECLINED: "Declined",
    DRAFT: "Funding needed",
    FUNDED: "In escrow",
    DELIVERED: "In review",
    RELEASED: "Paid",
    DISPUTED: "In support",
    REFUNDED: "Refunded",
    OPEN_DISPUTE: "Open",
  };
  return labels[status] ?? status.replace(/_/g, " ").toLowerCase();
}

function displayName(user?: ApiUser) {
  if (!user) return "Creator";
  if (user.email === demoAccounts.creator.email) return "Demo Creator";
  if (user.email === demoAccounts.business.email) return "Demo SME";
  if (user.email === demoAccounts.admin.email) return "Werra Admin";
  return user.email.split("@")[0];
}

function humanError(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  if (/Insufficient CKB/i.test(message)) {
    return "A test funding wallet needs more network balance before this payment can be sent.";
  }
  if (/Insufficient USDW|Insufficient coin/i.test(message)) {
    return "The SME needs more USDW before this escrow can be funded.";
  }
  if (/already bid/i.test(message)) {
    return "You have already applied to this brief.";
  }
  return message;
}

type AppContext = ApiMarketplace & {
  userById: Map<string, ApiUser>;
  briefById: Map<string, ApiBrief>;
  agreementById: Map<string, ApiAgreement>;
  escrowByAgreement: Map<string, ApiEscrow>;
  deliveryByAgreement: Map<string, ApiDelivery>;
};

type WorkspaceProps = {
  context: AppContext;
  busy: string | null;
  view: ViewKey;
  setView: (view: ViewKey) => void;
  runAction: (label: string, action: () => Promise<void>) => Promise<boolean>;
  refresh: () => Promise<void>;
};

type ActionProps = {
  context: AppContext;
  busy: string | null;
  runAction: (label: string, action: () => Promise<void>) => Promise<boolean>;
  refresh: () => Promise<void>;
};

export default App;
