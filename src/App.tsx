import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Bell,
  Bookmark,
  Bug,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  ExternalLink,
  Flag,
  Gift,
  Heart,
  HelpCircle,
  ImagePlus,
  LayoutGrid,
  Leaf,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Rocket,
  Search,
  Send,
  Settings2,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trophy,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  Avatar,
  Brand,
  Dialog,
  Empty,
  Preview,
  ProductLogo,
} from "./components/UI";
import { isLive, repository, supabase } from "./lib/repository";
import {
  CATEGORIES,
  safeUrl,
  sortProducts,
  utcDay,
  type AppData,
  type FeedbackKind,
  type Product,
  type ProductInput,
  type View,
} from "./lib/types";
const EMPTY: AppData = {
  products: [],
  feedback: [],
  votes: [],
  saved: [],
  claims: [],
  profile: null,
  notices: [],
};
const NAV: { name: View; icon: typeof Compass }[] = [
  { name: "Discover", icon: Compass },
  { name: "Leaderboard", icon: Trophy },
  { name: "Explore", icon: LayoutGrid },
  { name: "Saved products", icon: Bookmark },
  { name: "Maker studio", icon: Rocket },
  { name: "Notifications", icon: Bell },
];
export default function App() {
  const [data, setData] = useState<AppData>(EMPTY),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [view, setView] = useState<View>("Discover"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All products"),
    [feedTab, setFeedTab] = useState("Trending"),
    [day, setDay] = useState(utcDay()),
    [tick, setTick] = useState(Date.now());
  const [selected, setSelected] = useState<string | null>(null),
    [modal, setModal] = useState<
      "auth" | "launch" | "guide" | "profile" | null
    >(null),
    [detailTab, setDetailTab] = useState<FeedbackKind | "overview">("overview"),
    [toast, setToast] = useState(""),
    [pending, setPending] = useState(false),
    [reportProduct, setReportProduct] = useState<string | null>(null),
    [reportReason, setReportReason] = useState(""),
    [trialProduct, setTrialProduct] = useState<Product | null>(null);
  const [authName, setAuthName] = useState(""),
    [authEmail, setAuthEmail] = useState(""),
    [authSent, setAuthSent] = useState(false),
    [body, setBody] = useState(""),
    [rating, setRating] = useState(0),
    [replyTo, setReplyTo] = useState<string | undefined>(),
    [attachment, setAttachment] = useState<
      { url: string; name: string } | undefined
    >();
  const [editing, setEditing] = useState<string | null>(null);
  const [launch, setLaunch] = useState<ProductInput>({
    name: "",
    tagline: "",
    description: "",
    category: "Productivity",
    tags: [],
    website: "",
    trial_label: "",
    trial_limit: 100,
    screenshot_url: "",
    resource_url: "",
    resource_name: "",
  });
  const refresh = useCallback(async () => {
    try {
      setData(await repository.load(view === "Leaderboard" ? day : utcDay()));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [day, view]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const onHash = () => {
      const id = new URLSearchParams(location.hash.slice(1)).get("product");
      if (id) setSelected(id);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (utcDay(new Date(tick)) !== day && view !== "Leaderboard")
      setDay(utcDay(new Date(tick)));
  }, [tick, day, refresh, view]);
  useEffect(() => {
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    return () => clearInterval(poll);
  }, [refresh]);
  useEffect(() => {
    if (!supabase) return;
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => void refresh(), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const action = async (fn: () => Promise<void>, message?: string) => {
    if (pending) return;
    setPending(true);
    try {
      await fn();
      await refresh();
      if (message) setToast(message);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  const auth = () => {
    setAuthSent(false);
    setModal("auth");
  };
  const member = (fn: () => void) => {
    if (!data.profile) {
      auth();
      return;
    }
    fn();
  };
  const openProduct = (p: Product, tab: typeof detailTab = "overview") => {
    setSelected(p.id);
    setDetailTab(tab);
    setBody("");
    setRating(0);
    setAttachment(undefined);
    setReplyTo(undefined);
    history.replaceState(null, "", `#product=${encodeURIComponent(p.id)}`);
  };
  const closeProduct = () => {
    setSelected(null);
    history.replaceState(null, "", location.pathname);
  };
  const navigate = (target: View) => {
    setView(target);
    setQuery("");
    setCategory("All products");
    setDay(utcDay());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const vote = (p: Product) =>
    member(() => {
      if (view === "Leaderboard" && day !== utcDay()) {
        setToast("Past battles are closed. Vote in today’s battle.");
        return;
      }
      void action(
        () => repository.vote(p.id, !data.votes.includes(p.id)),
        data.votes.includes(p.id)
          ? "Your vote was removed."
          : `You’re cheering for ${p.name}.`,
      );
    });
  const save = (p: Product) =>
    member(
      () =>
        void action(
          () => repository.save(p.id, !data.saved.includes(p.id)),
          data.saved.includes(p.id)
            ? "Removed from your collection."
            : "Saved to your collection.",
        ),
    );
  const share = async (p: Product) => {
    const url = new URL(location.href);
    url.hash = `product=${encodeURIComponent(p.id)}`;
    try {
      await navigator.clipboard.writeText(url.href);
      setToast("Product link copied.");
    } catch {
      setToast("Select and copy the product URL from your address bar.");
      openProduct(p);
    }
  };
  const ranked = sortProducts(data.products),
    product = data.products.find((p) => p.id === selected);
  let filtered = data.products.filter(
    (p) =>
      (category === "All products" || p.category === category) &&
      `${p.name} ${p.tagline} ${p.category} ${p.tags.join(" ")} ${p.maker_name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  if (view === "Saved products")
    filtered = filtered.filter((p) => data.saved.includes(p.id));
  if (view === "Maker studio")
    filtered = filtered.filter((p) => p.maker_id === data.profile?.id);
  if (feedTab === "Free to try" && view === "Discover")
    filtered = filtered.filter(
      (p) => p.trial_label && p.claim_count < p.trial_limit,
    );
  filtered =
    feedTab === "Newest" && view === "Discover"
      ? [...filtered].sort((a, b) => b.created_at.localeCompare(a.created_at))
      : sortProducts(filtered);
  const countdown = Math.max(
    0,
    Math.ceil(
      (new Date(`${utcDay(new Date(tick))}T00:00:00Z`).getTime() +
        86400000 -
        tick) /
        1000,
    ),
  );
  const time = [
    Math.floor(countdown / 3600),
    Math.floor(countdown / 60) % 60,
    countdown % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  const feedback = data.feedback.filter((f) => f.product_id === selected);
  const submitFeedback = (e: FormEvent) => {
    e.preventDefault();
    member(
      () =>
        void action(async () => {
          await repository.feedback(
            product!.id,
            detailTab as FeedbackKind,
            body.trim(),
            detailTab === "review" ? rating : null,
            attachment,
            replyTo,
          );
          setBody("");
          setRating(0);
          setAttachment(undefined);
          setReplyTo(undefined);
        }, "Thanks for sharing your experience."),
    );
  };
  const upload = async (
    file: File | undefined,
    target: "screenshot" | "resource" | "feedback",
  ) => {
    if (!file) return;
    if (
      target === "screenshot" &&
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    ) {
      setToast("Use a PNG, JPG, or WebP image.");
      return;
    }
    setPending(true);
    try {
      const asset = await repository.upload(file);
      if (target === "feedback") setAttachment(asset);
      else
        setLaunch((l) => ({
          ...l,
          ...(target === "screenshot"
            ? { screenshot_url: asset.url }
            : { resource_url: asset.url, resource_name: asset.name }),
        }));
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  const submitLaunch = (e: FormEvent) => {
    e.preventDefault();
    if (!safeUrl(launch.website)) {
      setToast("Enter a complete http:// or https:// product URL.");
      return;
    }
    void action(
      async () => {
        const input = {
          ...launch,
          website: safeUrl(launch.website),
          tags: launch.tags.map((t) => t.trim()).filter(Boolean),
        };
        const id = editing
          ? (await repository.update(editing, input), editing)
          : await repository.create(input);
        setEditing(null);
        setModal(null);
        navigate("Maker studio");
        setSelected(id);
        setDetailTab("overview");
        setLaunch({
          name: "",
          tagline: "",
          description: "",
          category: "Productivity",
          tags: [],
          website: "",
          trial_label: "",
          trial_limit: 100,
          screenshot_url: "",
          resource_url: "",
          resource_name: "",
        });
      },
      editing
        ? "Your product has been updated."
        : "Your product is live. Let the discovery begin.",
    );
  };
  const launchButton = () =>
    member(() => {
      setEditing(null);
      setLaunch({
        name: "",
        tagline: "",
        description: "",
        category: "Productivity",
        tags: [],
        website: "",
        trial_label: "",
        trial_limit: 100,
        screenshot_url: "",
        resource_url: "",
        resource_name: "",
      });
      setModal("launch");
    });
  const editProduct = (p: Product) => {
    setEditing(p.id);
    const {
      name,
      tagline,
      description,
      category,
      tags,
      website,
      trial_label,
      trial_limit,
      screenshot_url,
      resource_url,
      resource_name,
    } = p;
    setLaunch({
      name,
      tagline,
      description,
      category,
      tags,
      website,
      trial_label,
      trial_limit,
      screenshot_url,
      resource_url,
      resource_name,
    });
    setModal("launch");
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-label">A LITTLE DISCOVERY. EVERY DAY.</div>
        <nav aria-label="Main navigation">
          {NAV.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${view === name ? "active" : ""}`}
              onClick={() => navigate(name)}
            >
              <Icon size={21} strokeWidth={view === name ? 2.1 : 1.7} />
              <span>{name}</span>
              {name === "Notifications" && data.notices.length > 0 && (
                <span className="nav-count">{data.notices.length}</span>
              )}
            </button>
          ))}
        </nav>
        <button className="primary launch-button" onClick={launchButton}>
          <Plus size={18} />
          Launch a product
        </button>
        <div className="sidebar-note">
          <div className="sidebar-note-icon">
            <Leaf size={21} />
          </div>
          <strong>
            Small teams.
            <br />
            Big possibilities.
          </strong>
          <p>
            Good products deserve
            <br />a fighting chance.
          </p>
          <button onClick={() => setModal("guide")}>
            Meet the battlefield <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button className="community-link" onClick={() => setModal("guide")}>
            <HelpCircle size={17} />
            How it works
            <ArrowUpRight size={14} />
          </button>
          <button
            className="profile-button"
            onClick={() => (data.profile ? setModal("profile") : auth())}
          >
            <Avatar name={data.profile?.name || "New Explorer"} />
            <span>
              <strong>{data.profile?.name || "Hey, explorer"}</strong>
              <small>
                {data.profile
                  ? `@${data.profile.handle}`
                  : "Join the community"}
              </small>
            </span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="mobile-brand">
              <Brand small />
            </span>
            <h1>{view}</h1>
            <span className="beta-pill">BETA</span>
          </div>
          <div className="top-actions">
            <span className="mode-label">
              <span />
              {isLive ? "Community live" : "Demo workspace"}
            </span>
            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() => navigate("Notifications")}
            >
              <Bell size={20} />
              {data.notices.length > 0 && <i className="notification-dot" />}
            </button>
            <button
              className="top-avatar"
              aria-label="Your account"
              onClick={() => (data.profile ? setModal("profile") : auth())}
            >
              <Avatar
                name={data.profile?.name || "New Explorer"}
                size="small"
              />
            </button>
          </div>
        </header>
        <div className="content-grid">
          <main id="main-content">
            {view === "Discover" && (
              <section className="hero">
                <div>
                  <span className="eyebrow">
                    <span /> WHERE GOOD IDEAS GET DISCOVERED
                  </span>
                  <h2>
                    The next big thing
                    <br />
                    starts right here<span>.</span>
                  </h2>
                  <p>
                    Discover products. Meet their makers. Find your next
                    favorite.
                  </p>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <span className="hero-spark">
                    <Sparkles size={38} />
                  </span>
                  <span className="floating-logo one">f</span>
                  <span className="floating-logo two">◒</span>
                  <span className="floating-logo three">✳</span>
                  <span className="little-star">✦</span>
                </div>
              </section>
            )}
            {view === "Leaderboard" && (
              <section className="page-intro">
                <span className="eyebrow">
                  <Trophy size={14} /> THE DAILY BATTLE
                </span>
                <h2>Great products. Real support.</h2>
                <p>Every product gets a fresh start at midnight UTC.</p>
                <div className="leader-controls">
                  <input
                    aria-label="Leaderboard date"
                    type="date"
                    value={day}
                    max={utcDay()}
                    onChange={(e) => e.target.value && setDay(e.target.value)}
                  />
                  <span>
                    <Clock3 size={14} />
                    {day === utcDay()
                      ? `${time} left in today’s battle`
                      : "Completed battle · historical votes"}
                  </span>
                  <button
                    className="text-button"
                    onClick={() => setModal("guide")}
                  >
                    How rankings work <HelpCircle size={14} />
                  </button>
                </div>
              </section>
            )}
            {view === "Explore" && (
              <section className="page-intro">
                <span className="eyebrow">
                  <Compass size={14} /> FOLLOW YOUR CURIOSITY
                </span>
                <h2>A whole world of possibility.</h2>
                <p>From everyday essentials to your next unfair advantage.</p>
                <div className="category-grid">
                  {CATEGORIES.slice(1).map((c, i) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={category === c ? "selected" : ""}
                    >
                      <span>
                        {
                          [
                            <Sparkles />,
                            <Zap />,
                            <Heart />,
                            <Settings2 />,
                            <Leaf />,
                            <LayoutGrid />,
                          ][i]
                        }
                      </span>
                      <strong>{c}</strong>
                      <small>
                        {data.products.filter((p) => p.category === c).length}{" "}
                        products <ArrowUpRight size={12} />
                      </small>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {view === "Saved products" && (
              <section className="page-intro">
                <span className="eyebrow">
                  <Bookmark size={14} /> YOUR LITTLE COLLECTION
                </span>
                <h2>Keep the good ones close.</h2>
                <p>Products you want to come back to. All in one place.</p>
              </section>
            )}
            {view === "Maker studio" && (
              <section className="page-intro">
                <span className="eyebrow">
                  <Rocket size={14} /> BUILT BY YOU
                </span>
                <h2>Your ideas, out in the world.</h2>
                <p>See the support, listen to feedback, and keep building.</p>
                {data.profile && (
                  <div className="stats-grid">
                    {[
                      ["Products", filtered.length],
                      [
                        "Today’s votes",
                        filtered.reduce((s, p) => s + p.votes_today, 0),
                      ],
                      [
                        "Trial claims",
                        filtered.reduce((s, p) => s + p.claim_count, 0),
                      ],
                      [
                        "Open bugs",
                        data.feedback.filter(
                          (f) =>
                            f.kind === "bug" &&
                            f.status === "open" &&
                            filtered.some((p) => p.id === f.product_id),
                        ).length,
                      ],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <strong>{value}</strong>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
            {view === "Notifications" && (
              <section className="page-intro">
                <span className="eyebrow">
                  <Bell size={14} /> A LITTLE GOOD NEWS
                </span>
                <h2>You’re part of the story.</h2>
                <p>Your recent activity and updates.</p>
              </section>
            )}
            {view !== "Notifications" && (
              <>
                <div className="feed-toolbar">
                  <div
                    className="feed-tabs"
                    role="tablist"
                    aria-label="Feed ordering"
                  >
                    {(view === "Discover"
                      ? ["Trending", "Newest", "Free to try"]
                      : ["All products"]
                    ).map((t) => (
                      <button
                        role="tab"
                        aria-selected={feedTab === t || view !== "Discover"}
                        key={t}
                        className={
                          feedTab === t || view !== "Discover" ? "active" : ""
                        }
                        onClick={() => setFeedTab(t)}
                      >
                        {t === "Trending" && <Zap size={15} />} {t}
                      </button>
                    ))}
                  </div>
                  <span className="feed-date">
                    {view === "Leaderboard"
                      ? new Date(day + "T12:00:00Z").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" },
                        )
                      : "Today"}
                    <span className="live-dot" />
                  </span>
                </div>
                <div className="filter-row">
                  <div className="search-input">
                    <Search size={17} />
                    <input
                      aria-label="Search products"
                      placeholder="Find your next favorite…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        className="icon-button"
                        aria-label="Clear search"
                        onClick={() => setQuery("")}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  <label className="category-select">
                    <SlidersHorizontal size={15} />
                    <select
                      aria-label="Filter by category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} />
                  </label>
                </div>
                <div className="results-label">
                  <span>
                    {query
                      ? `${filtered.length} results for “${query}”`
                      : view === "Saved products"
                        ? `${filtered.length} saved products`
                        : view === "Maker studio"
                          ? `${filtered.length} products by you`
                          : category !== "All products"
                            ? category
                            : "Good things, made by real people"}
                  </span>
                  {!isLive && (
                    <span className="sample-label">Sample products</span>
                  )}
                </div>
              </>
            )}
            {error && (
              <div className="error-panel">
                <strong>We couldn’t load this workspace.</strong>
                <p>{error}</p>
                <button className="secondary" onClick={() => void refresh()}>
                  Try again
                </button>
              </div>
            )}
            {loading ? (
              <div className="loading">
                <Loader2 className="spin" /> Finding good things…
              </div>
            ) : view === "Notifications" ? (
              data.notices.length ? (
                <div className="notice-list">
                  {data.notices.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        const p = data.products.find(
                          (p) => p.id === n.product_id,
                        );
                        if (p) openProduct(p);
                      }}
                    >
                      <span>
                        <CheckCircle2 size={20} />
                      </span>
                      <div>
                        <p>{n.text}</p>
                        <small>{new Date(n.created_at).toLocaleString()}</small>
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={<Bell size={28} />}
                  heading="All caught up."
                  body={
                    isLive
                      ? "Your trial claims and product feedback appear on product pages."
                      : "Vote, launch, or share feedback to see your activity here."
                  }
                />
              )
            ) : !filtered.length ? (
              <Empty
                icon={
                  view === "Saved products" ? (
                    <Bookmark size={28} />
                  ) : view === "Maker studio" ? (
                    <Rocket size={28} />
                  ) : (
                    <Search size={28} />
                  )
                }
                heading={
                  view === "Saved products"
                    ? "Your collection starts here."
                    : view === "Maker studio"
                      ? "Your next idea belongs here."
                      : "Nothing here just yet."
                }
                body={
                  view === "Saved products"
                    ? "Tap the bookmark on a product to save it for later."
                    : view === "Maker studio"
                      ? "Launch your first product and invite the community to try it."
                      : "Try another category or search. Past rankings include only products available on that day."
                }
                action={
                  <button
                    className="primary"
                    onClick={
                      view === "Maker studio"
                        ? launchButton
                        : () => {
                            navigate("Discover");
                            setFeedTab("Trending");
                          }
                    }
                  >
                    {view === "Maker studio"
                      ? "Launch a product"
                      : "Discover products"}
                    <ArrowRight size={15} />
                  </button>
                }
              />
            ) : view === "Leaderboard" ? (
              <div className="leaderboard-full">
                {filtered.map((p, i) => (
                  <div className="leader-row" key={p.id}>
                    <span className={`rank-number ${i < 3 ? "top" : ""}`}>
                      {i === 0 ? (
                        <Trophy size={21} />
                      ) : (
                        String(i + 1).padStart(2, "0")
                      )}
                    </span>
                    <button
                      className="leader-product"
                      onClick={() => openProduct(p)}
                    >
                      <ProductLogo product={p} />
                      <div>
                        <strong>
                          {p.name}
                          {i === 0 && p.votes_today > 0 && (
                            <span className="leading-pill">
                              {day === utcDay()
                                ? "Leading today"
                                : "Day winner"}
                            </span>
                          )}
                        </strong>
                        <p>{p.tagline}</p>
                        <small>
                          {p.category} · {p.reviews_count} reviews
                        </small>
                      </div>
                    </button>
                    <button
                      disabled={pending || day !== utcDay()}
                      className={`vote-button ${data.votes.includes(p.id) ? "voted" : ""}`}
                      onClick={() => vote(p)}
                      aria-label={`Vote for ${p.name}`}
                      aria-pressed={data.votes.includes(p.id)}
                    >
                      <ArrowUp size={16} />
                      <strong>{p.votes_today}</strong>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="product-feed">
                {filtered.map((p) => (
                  <article className="product-card" key={p.id}>
                    <div className="maker-line">
                      <Avatar name={p.maker_name} size="small" />
                      <div>
                        <strong>{p.maker_name}</strong>
                        <span>@{p.maker_handle}</span>
                        <span>·</span>
                        <span>
                          {p.launch_date === utcDay()
                            ? "launched today"
                            : new Date(
                                p.launch_date + "T12:00:00Z",
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                        </span>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`Report ${p.name}`}
                        onClick={() => member(() => setReportProduct(p.id))}
                      >
                        <MoreHorizontal size={20} />
                      </button>
                    </div>
                    <div className="product-summary">
                      <button
                        onClick={() => openProduct(p)}
                        className="product-title"
                      >
                        <ProductLogo product={p} />
                        <span>
                          <strong>
                            {p.name}
                            <ArrowUpRight size={15} />
                          </strong>
                          <span>{p.tagline}</span>
                        </span>
                      </button>
                      <button
                        disabled={pending}
                        className={`vote-button ${data.votes.includes(p.id) ? "voted" : ""}`}
                        aria-label={`Vote for ${p.name}`}
                        aria-pressed={data.votes.includes(p.id)}
                        onClick={() => vote(p)}
                      >
                        <ArrowUp size={16} />
                        <strong>{p.votes_today}</strong>
                      </button>
                    </div>
                    <p className="product-description">{p.description}</p>
                    <button
                      className="preview-button"
                      onClick={() => openProduct(p)}
                      aria-label={`Explore ${p.name}`}
                    >
                      <Preview product={p} />
                    </button>
                    <div className="product-meta">
                      <div className="product-tags">
                        <span>
                          {p.category === "AI & machine learning"
                            ? "AI & ML"
                            : p.category}
                        </span>
                        {p.tags.slice(0, 1).map((t) => (
                          <span key={t}>{t}</span>
                        ))}
                      </div>
                      {p.trial_label && (
                        <button
                          className="trial-label"
                          onClick={() => openProduct(p)}
                        >
                          <Gift size={13} />
                          {p.trial_label}
                        </button>
                      )}
                    </div>
                    <div className="card-actions">
                      <button onClick={() => openProduct(p, "comment")}>
                        <MessageCircle size={16} />
                        <span>{p.comments_count}</span>
                      </button>
                      <button
                        className="rating-action"
                        onClick={() => openProduct(p, "review")}
                      >
                        <Star size={15} />
                        <span>{p.rating ? p.rating.toFixed(1) : "New"}</span>
                        <span className="review-total">
                          ({p.reviews_count})
                        </span>
                      </button>
                      <div className="action-spacer" />
                      <button
                        aria-label={`Save ${p.name}`}
                        aria-pressed={data.saved.includes(p.id)}
                        className={data.saved.includes(p.id) ? "is-saved" : ""}
                        onClick={() => save(p)}
                      >
                        <Bookmark
                          size={17}
                          fill={
                            data.saved.includes(p.id) ? "currentColor" : "none"
                          }
                        />
                      </button>
                      <button
                        aria-label={`Share ${p.name}`}
                        onClick={() => void share(p)}
                      >
                        <Share2 size={16} />
                      </button>
                      <button
                        className="try-button"
                        onClick={() => openProduct(p)}
                      >
                        Meet {p.name} <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <footer className="main-footer">
              <Brand small />
              <span>You’ve got good taste. Keep exploring.</span>
              <span>Made for makers & the curious.</span>
            </footer>
          </main>
          <aside className="right-rail">
            <div className="daily-card">
              <div className="rail-heading">
                <h3>
                  <Trophy size={17} />
                  {view === "Leaderboard" && day !== utcDay()
                    ? "Battle archive"
                    : "Today’s leaderboard"}
                </h3>
                <span className="live-badge">
                  <i />
                  LIVE
                </span>
              </div>
              <p className="rail-subtitle">
                {view === "Leaderboard" && day !== utcDay()
                  ? `Results for ${day}`
                  : "A fresh battle. Every single day."}
              </p>
              <div className="compact-leaders">
                {ranked.slice(0, 5).map((p, i) => (
                  <button key={p.id} onClick={() => openProduct(p)}>
                    <span className={`compact-rank rank-${i}`}>{i + 1}</span>
                    <ProductLogo product={p} small />
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {p.category === "AI & machine learning"
                          ? "AI & ML"
                          : p.category}
                      </small>
                    </div>
                    <span className="compact-votes">
                      <ArrowUp size={12} />
                      {p.votes_today}
                    </span>
                  </button>
                ))}
              </div>
              <button
                className="rail-link"
                onClick={() => navigate("Leaderboard")}
              >
                See the full leaderboard <ArrowRight size={15} />
              </button>
              <div className="countdown">
                <Clock3 size={14} />
                <span>Next battle in</span>
                <strong>{time}</strong>
              </div>
            </div>
            <div className="trial-card">
              <span className="gift-icon">
                <Gift size={22} />
              </span>
              <span className="eyebrow">TRY SOMETHING NEW</span>
              <h3>
                Your next favorite,
                <br />
                on the house.
              </h3>
              <p>
                Free credits and trials from makers
                <br />
                who want you to give it a go.
              </p>
              <button
                onClick={() => {
                  navigate("Discover");
                  setFeedTab("Free to try");
                }}
              >
                Explore free trials <ArrowUpRight size={15} />
              </button>
              <div className="trial-decoration" aria-hidden="true">
                ✧
              </div>
            </div>
            <div className="makers-card">
              <div className="rail-heading">
                <h3>Made by humans.</h3>
                <Users size={16} />
              </div>
              <p>
                Behind every product is someone
                <br />
                who took a chance on an idea.
              </p>
              <div className="avatar-stack">
                {[
                  "Maya Chen",
                  "Alex Rivera",
                  "Sofia Patel",
                  "Sam Okafor",
                  "Emma Wilson",
                ].map((n) => (
                  <Avatar name={n} key={n} size="small" />
                ))}
              </div>
              <span className="maker-count">
                Meet a new maker. Find a new favorite.
              </span>
              <button className="text-button" onClick={launchButton}>
                Building something? Launch it here <ArrowUpRight size={13} />
              </button>
            </div>
            <div className="rail-footer">
              <button onClick={() => setModal("guide")}>About</button>
              <button onClick={() => setModal("guide")}>
                Community guidelines
              </button>
              <button onClick={() => setModal("guide")}>
                How rankings work
              </button>
              <span>© {new Date().getFullYear()} Battlefield</span>
              <span>
                Good things are worth discovering. <Leaf size={12} />
              </span>
            </div>
          </aside>
        </div>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {NAV.slice(0, 4).map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={view === name ? "active" : ""}
            onClick={() => navigate(name)}
          >
            <Icon size={21} />
            <span>{name === "Saved products" ? "Saved" : name}</span>
          </button>
        ))}
        <button onClick={launchButton}>
          <Plus size={23} />
          <span>Launch</span>
        </button>
      </nav>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal === "auth" && (
        <Dialog
          title={
            isLive ? "Welcome to the battlefield." : "Make yourself at home."
          }
          onClose={() => setModal(null)}
        >
          <div className="auth-content">
            <Brand />
            <p>
              {isLive
                ? "Sign in with a secure link sent to your email."
                : "Join this local demo to vote, try products, share feedback, and launch something of your own."}
            </p>
            {authSent ? (
              <div className="success-panel">
                <CheckCircle2 />
                <h3>Check your inbox.</h3>
                <p>Open the sign-in link to join the community.</p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    await repository.login(authName, authEmail);
                    if (isLive) setAuthSent(true);
                    else setModal(null);
                  });
                }}
              >
                {isLive && (
                  <label>
                    Your name
                    <input
                      required
                      minLength={2}
                      maxLength={60}
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="e.g. Jordan Lee"
                      autoComplete="name"
                    />
                  </label>
                )}
                <label>
                  {isLive ? "Email address" : "Your name"}
                  <input
                    required
                    type={isLive ? "email" : "text"}
                    maxLength={60}
                    autoComplete={isLive ? "email" : "name"}
                    value={isLive ? authEmail : authName}
                    onChange={(e) =>
                      isLive
                        ? setAuthEmail(e.target.value)
                        : setAuthName(e.target.value)
                    }
                    placeholder={isLive ? "you@example.com" : "e.g. Jordan Lee"}
                    minLength={2}
                  />
                </label>
                <button
                  disabled={pending || (!isLive && !authName.trim())}
                  className="primary full-width"
                >
                  {pending ? (
                    <Loader2 className="spin" size={17} />
                  ) : (
                    <ArrowRight size={17} />
                  )}{" "}
                  {isLive ? "Send me a sign-in link" : "Join the community"}
                </button>
                <small>
                  {isLive
                    ? "Your email stays private."
                    : "Demo activity is saved in this browser. Sample credits cannot be redeemed with real products."}
                </small>
              </form>
            )}
          </div>
        </Dialog>
      )}
      {modal === "profile" && (
        <Dialog title="Your little corner." onClose={() => setModal(null)}>
          <div className="profile-dialog">
            <Avatar name={data.profile?.name || "Explorer"} />
            <h3>{data.profile?.name}</h3>
            <p>@{data.profile?.handle}</p>
            <div className="stats-grid">
              <div>
                <strong>{data.saved.length}</strong>
                <span>Saved products</span>
              </div>
              <div>
                <strong>{data.claims.length}</strong>
                <span>Trials claimed</span>
              </div>
            </div>
            <h4>Your trial wallet</h4>
            {!data.claims.length ? (
              <p>No trials yet. Discover something new.</p>
            ) : (
              data.claims.map((c) => (
                <div className="wallet-row" key={c.product_id}>
                  <strong>
                    {data.products.find((p) => p.id === c.product_id)?.name ||
                      "Product trial"}
                  </strong>
                  <code>{c.code}</code>
                </div>
              ))
            )}
            <button
              className="secondary full-width"
              onClick={() =>
                void action(async () => {
                  await repository.logout();
                  setModal(null);
                  navigate("Discover");
                }, "You’ve signed out.")
              }
            >
              Sign out
            </button>
          </div>
        </Dialog>
      )}
      {modal === "launch" && (
        <Dialog
          title={
            editing
              ? "Make your product even better."
              : "Give your idea a fighting chance."
          }
          onClose={() => setModal(null)}
          wide
        >
          <form className="launch-form" onSubmit={submitLaunch}>
            <p>
              A few details, a little personality, and you’re ready for the
              battlefield.
            </p>
            <div className="form-grid">
              <label>
                Product name
                <input
                  required
                  maxLength={40}
                  value={launch.name}
                  onChange={(e) =>
                    setLaunch({ ...launch, name: e.target.value })
                  }
                  placeholder="Something worth discovering"
                />
              </label>
              <label>
                Category
                <select
                  value={launch.category}
                  onChange={(e) =>
                    setLaunch({ ...launch, category: e.target.value })
                  }
                >
                  {CATEGORIES.slice(1).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              One-line pitch <small>{launch.tagline.length}/100</small>
              <input
                required
                maxLength={100}
                value={launch.tagline}
                onChange={(e) =>
                  setLaunch({ ...launch, tagline: e.target.value })
                }
                placeholder="What does it do, in plain words?"
              />
            </label>
            <label>
              The story behind your product
              <textarea
                required
                minLength={20}
                maxLength={1200}
                rows={4}
                value={launch.description}
                onChange={(e) =>
                  setLaunch({ ...launch, description: e.target.value })
                }
                placeholder="Who’s it for? What problem does it solve? What makes it useful?"
              />
            </label>
            <div className="form-grid">
              <label>
                Product website
                <input
                  required
                  type="url"
                  maxLength={500}
                  value={launch.website}
                  onChange={(e) =>
                    setLaunch({ ...launch, website: e.target.value })
                  }
                  placeholder="https://yourproduct.com"
                />
              </label>
              <label>
                Tags <small>Up to 3, separated by commas</small>
                <input
                  maxLength={120}
                  value={launch.tags.join(",")}
                  onChange={(e) =>
                    setLaunch({
                      ...launch,
                      tags: e.target.value.split(",").slice(0, 3),
                    })
                  }
                  placeholder="No-code, Collaboration"
                />
              </label>
            </div>
            <div className="upload-grid">
              <label className="upload-zone">
                <ImagePlus size={23} />
                <strong>
                  {launch.screenshot_url
                    ? "Screenshot attached"
                    : "Show it in action"}
                </strong>
                <span>PNG, JPG or WebP · up to 3 MB</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={pending}
                  onChange={(e) =>
                    void upload(e.target.files?.[0], "screenshot")
                  }
                />
              </label>
              <label className="upload-zone">
                <Upload size={23} />
                <strong>
                  {launch.resource_name || "Add a downloadable resource"}
                </strong>
                <span>Guide, sample or starter pack · up to 3 MB</span>
                <input
                  type="file"
                  accept=".pdf,.txt,.csv,.zip,.json,.png,.jpg,.webp"
                  disabled={pending}
                  onChange={(e) => void upload(e.target.files?.[0], "resource")}
                />
              </label>
            </div>
            <div className="offer-form">
              <div>
                <Gift size={18} />
                <strong>A little something on the house?</strong>
              </div>
              <p>
                Optional. Offer a trial or free credits. Votes are never
                required.
              </p>
              <div className="form-grid">
                <label>
                  Trial offer
                  <input
                    maxLength={80}
                    value={launch.trial_label}
                    onChange={(e) =>
                      setLaunch({ ...launch, trial_label: e.target.value })
                    }
                    placeholder="e.g. 100 free credits"
                  />
                </label>
                <label>
                  Available spots
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={launch.trial_limit}
                    onChange={(e) =>
                      setLaunch({
                        ...launch,
                        trial_limit: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <small>
                Trial claims generate a unique code. Honor the code on your
                website; automatic redemption requires a maker integration.
              </small>
            </div>
            <div className="form-footer">
              <span>
                <CheckCircle2 size={15} />
                Live today. Discoverable every day.
              </span>
              <button
                className="primary"
                disabled={
                  pending ||
                  !launch.name.trim() ||
                  !launch.tagline.trim() ||
                  launch.description.trim().length < 20
                }
              >
                {pending ? (
                  <Loader2 className="spin" size={17} />
                ) : (
                  <Rocket size={17} />
                )}{" "}
                {editing ? "Save changes" : "Launch product"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "guide" && (
        <Dialog
          title="Good ideas deserve a fair shot."
          onClose={() => setModal(null)}
        >
          <div className="guide-content">
            <p>
              Battlefield is a place to discover products, try something new,
              and help independent makers build better.
            </p>
            {[
              [
                <Compass />,
                "Discover across categories",
                "Explore AI, design, productivity, developer tools, finance, and everyday life.",
              ],
              [
                <Trophy />,
                "A fresh battle every day",
                "All available products compete each UTC day. One vote per member per product. Votes reset at midnight UTC; past results stay in the archive. Ties go to the earlier product, then its ID.",
              ],
              [
                <Gift />,
                "Try first. Decide for yourself.",
                "Trial offers are optional and never depend on voting or leaving a positive review. Claim a code, then redeem it with the maker.",
              ],
              [
                <MessageCircle />,
                "Make feedback useful",
                "Share your experience, ask a question, or report a bug with steps to reproduce it. Star ratings and comments never change leaderboard points.",
              ],
              [
                <Heart />,
                "Keep it human",
                "No spam, fake reviews, vote trading, or harassment. Report suspicious products so they can be reviewed.",
              ],
            ].map(([icon, title, description], i) => (
              <div className="guide-step" key={i}>
                <span>{icon}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </div>
            ))}
            {!isLive && (
              <div className="demo-note">
                <strong>This is a local demo.</strong>
                <p>
                  Products and existing activity are fictional. Your changes
                  persist in this browser. Trial codes illustrate the
                  experience; they have no monetary value. Cross-user data and
                  authentication become available when Supabase is configured.
                </p>
              </div>
            )}
          </div>
        </Dialog>
      )}
      {product && !modal && !reportProduct && !trialProduct && (
        <Dialog title="Meet your next favorite." onClose={closeProduct} wide>
          <div className="product-detail">
            <div className="detail-header">
              <ProductLogo product={product} />
              <div>
                <h2>{product.name}</h2>
                <p>{product.tagline}</p>
              </div>
              <button
                disabled={
                  pending || (view === "Leaderboard" && day !== utcDay())
                }
                className={`vote-button ${data.votes.includes(product.id) ? "voted" : ""}`}
                onClick={() => vote(product)}
                aria-label={`Vote for ${product.name}`}
                aria-pressed={data.votes.includes(product.id)}
              >
                <ArrowUp size={17} />
                <strong>{product.votes_today}</strong>
              </button>
            </div>
            <div className="detail-maker">
              <Avatar name={product.maker_name} size="small" />
              <span>
                Made by <strong>{product.maker_name}</strong>
              </span>
              <span className="product-tags">
                <span>{product.category}</span>
              </span>
              <button
                className="icon-button"
                aria-label="Save product"
                onClick={() => save(product)}
              >
                <Bookmark
                  size={18}
                  fill={
                    data.saved.includes(product.id) ? "currentColor" : "none"
                  }
                />
              </button>
              <button
                className="icon-button"
                aria-label="Share product"
                onClick={() => void share(product)}
              >
                <Share2 size={17} />
              </button>
            </div>
            <div className="detail-tabs" role="tablist">
              {(["overview", "comment", "review", "bug"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={detailTab === t}
                  className={detailTab === t ? "active" : ""}
                  onClick={() => {
                    setDetailTab(t);
                    setReplyTo(undefined);
                    setBody("");
                    setAttachment(undefined);
                  }}
                >
                  {t === "overview"
                    ? "Overview"
                    : t === "comment"
                      ? "Discussion"
                      : t === "review"
                        ? "Reviews"
                        : "Bug reports"}
                  {t !== "overview" && (
                    <span>{feedback.filter((f) => f.kind === t).length}</span>
                  )}
                </button>
              ))}
            </div>
            {detailTab === "overview" ? (
              <>
                <Preview product={product} large />
                <h3>A little about {product.name}</h3>
                <p className="detail-description">{product.description}</p>
                <div className="detail-metrics">
                  <span>
                    <Star size={17} />
                    <strong>
                      {product.rating ? product.rating.toFixed(1) : "New"}
                    </strong>
                    {product.reviews_count} reviews
                  </span>
                  <span>
                    <MessageCircle size={17} />
                    {product.comments_count} conversations
                  </span>
                </div>
                {product.trial_label && (
                  <div className="detail-offer">
                    <Gift size={25} />
                    <div>
                      <strong>{product.trial_label}</strong>
                      <p>
                        {Math.max(0, product.trial_limit - product.claim_count)}{" "}
                        spots available · No vote required
                      </p>
                      {data.claims.find((c) => c.product_id === product.id) && (
                        <code>
                          {
                            data.claims.find(
                              (c) => c.product_id === product.id,
                            )!.code
                          }
                        </code>
                      )}
                    </div>
                    <button
                      disabled={
                        pending ||
                        (!data.claims.some(
                          (c) => c.product_id === product.id,
                        ) &&
                          product.claim_count >= product.trial_limit)
                      }
                      className="primary"
                      onClick={() =>
                        member(
                          () =>
                            void action(async () => {
                              const code = await repository.claim(product.id);
                              setToast(
                                product.demo
                                  ? `Sample trial claimed: ${code}`
                                  : `Your trial code: ${code}`,
                              );
                            }),
                        )
                      }
                    >
                      {data.claims.some((c) => c.product_id === product.id)
                        ? "Claimed ✓"
                        : "Claim trial"}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}
                {product.demo && (
                  <p className="sample-disclaimer">
                    Fictional product · Sample trial offers and activity
                  </p>
                )}
                <div className="detail-bottom">
                  {product.maker_id === data.profile?.id && (
                    <button
                      className="secondary"
                      onClick={() => editProduct(product)}
                    >
                      <Settings2 size={15} />
                      Edit product
                    </button>
                  )}
                  {safeUrl(product.website) ? (
                    <a
                      className="primary"
                      href={safeUrl(product.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Visit product <ExternalLink size={16} />
                    </a>
                  ) : (
                    <button
                      className="primary"
                      onClick={() => setTrialProduct(product)}
                    >
                      Try the sample preview <ArrowUpRight size={16} />
                    </button>
                  )}
                  {product.resource_url && (
                    <a
                      className="secondary"
                      href={product.resource_url}
                      download={product.resource_name}
                      target={isLive ? "_blank" : undefined}
                      rel="noopener noreferrer"
                    >
                      <ArrowDownToLine size={16} />
                      Download resource
                    </a>
                  )}
                  <button
                    className="text-button"
                    onClick={() => setDetailTab("review")}
                  >
                    Share your experience <MessageCircle size={15} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="feedback-intro">
                  <h3>
                    {detailTab === "review"
                      ? "What’s it like to use?"
                      : detailTab === "bug"
                        ? "Let’s make it better."
                        : "A good product starts a conversation."}
                  </h3>
                  <p>
                    {detailTab === "review"
                      ? "Honest experiences help everyone. One review per member."
                      : detailTab === "bug"
                        ? "Include what happened, what you expected, and steps to reproduce it."
                        : "Ask a question, share an idea, or say hello to the maker."}
                  </p>
                </div>
                {feedback
                  .filter((f) => f.kind === detailTab)
                  .map((f) => (
                    <div
                      className={`feedback-item ${f.parent_id ? "reply" : ""}`}
                      key={f.id}
                    >
                      <Avatar name={f.author_name} size="small" />
                      <div>
                        <div className="feedback-author">
                          <strong>{f.author_name}</strong>
                          {f.user_id === product.maker_id && (
                            <span className="maker-badge">Maker</span>
                          )}
                          <small>
                            {new Date(f.created_at).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" },
                            )}
                          </small>
                        </div>
                        {f.kind === "review" && (
                          <div className="stars">
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star
                                size={12}
                                fill={
                                  i < (f.rating || 0) ? "currentColor" : "none"
                                }
                                key={i}
                              />
                            ))}
                          </div>
                        )}
                        <p>{f.body}</p>
                        {f.parent_id && (
                          <small className="reply-label">
                            Reply to{" "}
                            {feedback.find((x) => x.id === f.parent_id)
                              ?.author_name || "a community member"}
                          </small>
                        )}
                        {f.attachment_url && (
                          <a
                            className="attachment-link"
                            href={f.attachment_url}
                            download={f.attachment_name}
                            target={isLive ? "_blank" : undefined}
                            rel="noopener noreferrer"
                          >
                            <ArrowDownToLine size={13} />
                            {f.attachment_name}
                          </a>
                        )}
                        <div className="feedback-actions">
                          {f.kind === "bug" && (
                            <span className={`bug-state ${f.status}`}>
                              <Bug size={12} />
                              {f.status === "resolved" ? "Resolved" : "Open"}
                            </span>
                          )}
                          {f.kind === "bug" &&
                            f.status === "open" &&
                            product.maker_id === data.profile?.id && (
                              <button
                                onClick={() =>
                                  void action(
                                    () => repository.resolve(f.id),
                                    "Bug marked as resolved.",
                                  )
                                }
                                disabled={pending}
                              >
                                Mark resolved <Check size={12} />
                              </button>
                            )}
                          {detailTab === "comment" && (
                            <button
                              onClick={() =>
                                member(() => {
                                  setReplyTo(f.id);
                                  setBody("");
                                })
                              }
                            >
                              Reply
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                {!feedback.some((f) => f.kind === detailTab) && (
                  <p className="first-feedback">
                    Be the first to share something useful.
                  </p>
                )}
                <form className="feedback-form" onSubmit={submitFeedback}>
                  {replyTo && (
                    <div className="reply-target">
                      Replying to{" "}
                      {feedback.find((f) => f.id === replyTo)?.author_name}
                      <button
                        type="button"
                        onClick={() => setReplyTo(undefined)}
                        aria-label="Cancel reply"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                  {detailTab === "review" && (
                    <div className="star-picker" aria-label="Choose a rating">
                      {Array.from({ length: 5 }, (_, i) => (
                        <button
                          aria-label={`${i + 1} star rating`}
                          aria-pressed={rating === i + 1}
                          type="button"
                          key={i}
                          onClick={() => setRating(i + 1)}
                        >
                          <Star
                            size={23}
                            fill={i < rating ? "currentColor" : "none"}
                          />
                        </button>
                      ))}
                      <span>
                        {rating
                          ? [
                              "",
                              "Not for me",
                              "Needs work",
                              "Pretty good",
                              "Really good",
                              "Love it",
                            ][rating]
                          : "Your honest rating"}
                      </span>
                    </div>
                  )}
                  <textarea
                    required
                    minLength={detailTab === "review" ? 20 : 5}
                    maxLength={2000}
                    rows={3}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={
                      !data.profile
                        ? "Join the community to share your experience…"
                        : detailTab === "bug"
                          ? "Steps to reproduce, expected result, actual result…"
                          : "What’s on your mind?"
                    }
                    aria-label="Feedback"
                  />
                  <div className="feedback-form-footer">
                    <label className="attach-button">
                      <ImagePlus size={17} />
                      <span>
                        {attachment ? attachment.name : "Attach a file"}
                      </span>
                      <input
                        type="file"
                        accept=".png,.jpg,.webp,.pdf,.txt,.csv,.json"
                        disabled={pending || !data.profile}
                        onChange={(e) =>
                          void upload(e.target.files?.[0], "feedback")
                        }
                      />
                    </label>
                    <button
                      className="primary"
                      disabled={
                        pending ||
                        !body.trim() ||
                        (detailTab === "review" && rating === 0)
                      }
                    >
                      <Send size={14} />
                      {detailTab === "review"
                        ? "Post review"
                        : detailTab === "bug"
                          ? "Report bug"
                          : "Post comment"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </Dialog>
      )}
      {reportProduct && (
        <Dialog
          title="Help keep the battlefield fair."
          onClose={() => setReportProduct(null)}
        >
          <form
            className="report-form"
            onSubmit={(e) => {
              e.preventDefault();
              void action(
                async () => {
                  await repository.report(reportProduct, reportReason.trim());
                  setReportProduct(null);
                  setReportReason("");
                },
                isLive
                  ? "Report submitted for review."
                  : "Report saved in this demo workspace.",
              );
            }}
          >
            <p>
              Tell us about spam, misleading claims, or something that needs a
              closer look.
            </p>
            <label>
              What should we know?
              <textarea
                required
                minLength={10}
                maxLength={1000}
                rows={4}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              />
            </label>
            <button
              className="primary"
              disabled={pending || reportReason.trim().length < 10}
            >
              <Flag size={16} />
              Submit report
            </button>
          </form>
        </Dialog>
      )}
      {trialProduct && (
        <Dialog
          title={`${trialProduct.name} · Sample playground`}
          onClose={() => setTrialProduct(null)}
        >
          <SamplePlayground product={trialProduct} />
        </Dialog>
      )}
    </div>
  );
}
function SamplePlayground({ product }: { product: Product }) {
  const [answer, setAnswer] = useState(""),
    [complete, setComplete] = useState(false);
  return (
    <div className="playground">
      <div className="demo-note">
        This is an interactive concept preview for a fictional product.
      </div>
      <ProductLogo product={product} />
      <h3>
        {product.name === "formly"
          ? "What are you building next?"
          : "What would you like to create?"}
      </h3>
      <p>A small idea is a great place to start.</p>
      {complete ? (
        <div className="success-panel">
          <CheckCircle2 />
          <h3>Your idea is in good company.</h3>
          <p>“{answer}”</p>
          <button
            className="secondary"
            onClick={() => {
              setComplete(false);
              setAnswer("");
            }}
          >
            Try another idea
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setComplete(true);
          }}
        >
          <label>
            Your idea
            <input
              required
              maxLength={160}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="A calmer way to get things done…"
            />
          </label>
          <button className="primary">
            Let’s explore it <ArrowRight size={16} />
          </button>
        </form>
      )}
    </div>
  );
}
