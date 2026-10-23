import { useMemo, useState } from "react";
import {
  Activity, ArrowDownUp, ArrowRight, BadgeCheck, BarChart3, Check,
  ChevronDown, CircleHelp, Clock3, Flame, Gauge, Github, LogIn, Menu,
  Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Trophy, UserRound,
  Users, X, Youtube, Zap,
} from "lucide-react";

type Level = {
  id: number; name: string; creator: string; difficulty: string; points: number;
  rank: number; video: string; color: string; status: "Verified" | "New";
  length: string; description: string;
};

const initialLevels: Level[] = [
  { id: 1, name: "Wavebreaker", creator: "Krynt", difficulty: "Extreme", points: 120, rank: 1, video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", color: "violet", status: "Verified", length: "Long", description: "A precise, high-speed wave gauntlet built around tight transitions." },
  { id: 2, name: "Neon Skyline", creator: "lumi", difficulty: "Insane", points: 95, rank: 2, video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", color: "blue", status: "Verified", length: "Long", description: "Neon corridors and demanding rhythm changes." },
  { id: 3, name: "Glass Ceiling", creator: "xern", difficulty: "Extreme", points: 82, rank: 3, video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", color: "pink", status: "Verified", length: "Medium", description: "A compact challenge with unforgiving ship-to-wave transitions." },
  { id: 4, name: "Static Bloom", creator: "mori", difficulty: "Hard", points: 64, rank: 4, video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", color: "green", status: "New", length: "Medium", description: "A flowing warm-up with a few surprisingly sharp timings." },
  { id: 5, name: "Void Circuit", creator: "Nyx", difficulty: "Insane", points: 53, rank: 5, video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", color: "orange", status: "Verified", length: "Short", description: "Short, dense and all about consistent control." },
  { id: 6, name: "Pixelstorm", creator: "Aster", difficulty: "Medium", points: 38, rank: 6, video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", color: "cyan", status: "New", length: "Short", description: "A friendly entry point for players learning wave precision." },
];

type ModalKind = "login" | "submit" | "completion" | null;
type Toast = { text: string; kind?: "success" | "error" } | null;

function getYoutubeId(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1);
    return parsed.searchParams.get("v") || "";
  } catch { return ""; }
}

export default function App() {
  const [levels, setLevels] = useState(initialLevels);
  const [activeTab, setActiveTab] = useState("Levels");
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("All difficulties");
  const [sort, setSort] = useState("Rank");
  const [modal, setModal] = useState<ModalKind>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [profileName, setProfileName] = useState("");
  const [draft, setDraft] = useState({ name: "", creator: "", description: "", points: "10", video: "" });
  const [completion, setCompletion] = useState({ level: "Wavebreaker", video: "" });

  const filteredLevels = useMemo(() => {
    const result = levels.filter((level) => {
      const matchesSearch = (level.name + " " + level.creator).toLowerCase().includes(search.toLowerCase());
      return matchesSearch && (difficulty === "All difficulties" || level.difficulty === difficulty);
    });
    return result.sort((a, b) => sort === "Points" ? b.points - a.points : sort === "Name" ? a.name.localeCompare(b.name) : a.rank - b.rank);
  }, [levels, search, difficulty, sort]);

  function notify(text: string, kind: "success" | "error" = "success") {
    setToast({ text, kind });
    window.setTimeout(() => setToast(null), 3200);
  }

  function submitLevel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim() || !draft.creator.trim()) return;
    const level: Level = {
      id: Date.now(), name: draft.name.trim(), creator: draft.creator.trim(),
      difficulty: "Unrated", points: Math.max(0, Number(draft.points) || 0),
      rank: levels.length + 1, video: draft.video, color: "violet", status: "New",
      length: "Unrated", description: draft.description.trim() || "Community-submitted challenge awaiting review.",
    };
    setLevels((current) => [...current, level]);
    setDraft({ name: "", creator: "", description: "", points: "10", video: "" });
    setModal(null);
    setActiveTab("Levels");
    notify("Submission added to this preview. Connect Supabase to persist and moderate it.");
  }

  function submitCompletion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completion.video.trim()) return;
    setModal(null);
    setCompletion({ level: "Wavebreaker", video: "" });
    notify("Completion proof captured in this preview. Supabase approval workflow is not connected yet.");
  }

  const navItems = ["Levels", "Rankings", "Submissions", "About"];

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="WCL home">
          <span className="brand-mark"><Activity size={22} strokeWidth={2.7} /></span>
          <span className="brand-copy">WCL<span className="brand-period">.</span><small>WAVE CHALLENGE LIST</small></span>
        </a>
        <nav className={menuOpen ? "main-nav nav-open" : "main-nav"} aria-label="Main navigation">
          {navItems.map((item) => <button key={item} className={activeTab === item ? "nav-link active" : "nav-link"} onClick={() => { setActiveTab(item); setMenuOpen(false); }}>{item}</button>)}
        </nav>
        <div className="top-actions">
          <button className="button button-ghost login-button" onClick={() => setModal("login")}><UserRound size={16} /> {profileName || "Sign in"}</button>
          <button className="button button-primary header-submit" onClick={() => setModal("submit")}><Plus size={17} /> Submit level</button>
          <button className="icon-button mobile-menu" aria-label="Toggle menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="live-dot" /> THE COMMUNITY-DRIVEN WAVE RANKING</div>
            <h1>Push your limits.<br /><span>Own the wave.</span></h1>
            <p className="hero-description">Your home for Geometry Dash wave challenges. Find your next wall, track your progress, and climb the rankings.</p>
            <div className="hero-actions">
              <button className="button button-primary button-large" onClick={() => { setActiveTab("Levels"); document.getElementById("challenge-list")?.scrollIntoView({ behavior: "smooth" }); }}>Explore challenges <ArrowRight size={17} /></button>
              <button className="button button-outline button-large" onClick={() => setModal("submit")}><Plus size={17} /> Submit a challenge</button>
            </div>
            <div className="hero-social-proof"><div className="avatar-stack"><span>W</span><span>G</span><span>D</span><span>+</span></div><span><b>Built by players, for players.</b><br />Every run counts.</span></div>
          </div>
          <div className="hero-art" aria-label="Abstract neon wave artwork">
            <div className="art-grid" />
            <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
            <div className="wave-line wave-line-back" />
            <div className="wave-core"><Zap size={74} fill="currentColor" strokeWidth={1.4} /></div>
            <div className="art-tag tag-top"><span className="tag-icon"><Flame size={15} /></span><span><small>TOP CHALLENGE</small><b>Wavebreaker</b></span></div>
            <div className="art-tag tag-bottom"><Trophy size={17} /><span><small>LEADERBOARD</small><b>Climb the ranks</b></span><ArrowRight size={16} /></div>
            <div className="art-spark spark-one">✳</div><div className="art-spark spark-two">✦</div>
          </div>
        </section>

        <section className="stats-grid" aria-label="Community statistics">
          <Stat icon={<Gauge size={18} />} label="CHALLENGES LISTED" value={String(levels.length).padStart(2, "0")} foot="And growing every week" />
          <Stat icon={<Users size={18} />} label="COMMUNITY PLAYERS" value="1.2k+" foot="Wave players worldwide" />
          <Stat icon={<Trophy size={18} />} label="POINTS AVAILABLE" value={String(levels.reduce((sum, level) => sum + level.points, 0))} foot="Earned through verified runs" />
          <Stat icon={<ShieldCheck size={18} />} label="VERIFIED RUNS" value="842" foot="Proof checked by moderators" />
        </section>

        {activeTab === "Levels" && <section className="challenge-section" id="challenge-list">
          <div className="section-heading">
            <div><div className="eyebrow section-eyebrow">FIND YOUR NEXT WALL</div><h2>The challenge list<span className="heading-count">{String(levels.length).padStart(2, "0")}</span></h2><p>From warm-up runs to pixel-perfect precision.</p></div>
            <button className="text-link" onClick={() => setActiveTab("Rankings")}>View rankings <ArrowRight size={16} /></button>
          </div>
          <div className="list-toolbar">
            <div className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search challenges or creators..." aria-label="Search challenges" /><kbd>⌘ K</kbd></div>
            <div className="toolbar-filters"><label className="select-wrap"><SlidersHorizontal size={15} /><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} aria-label="Filter difficulty"><option>All difficulties</option><option>Medium</option><option>Hard</option><option>Insane</option><option>Extreme</option><option>Unrated</option></select><ChevronDown size={14} /></label><label className="select-wrap"><ArrowDownUp size={15} /><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort challenges"><option>Rank</option><option>Points</option><option>Name</option></select><ChevronDown size={14} /></label></div>
          </div>
          <div className="level-table-wrap">
            <div className="level-table-head"><span>RANK / CHALLENGE</span><span>DIFFICULTY</span><span>POINTS</span><span>STATUS</span><span /></div>
            {filteredLevels.map((level) => <article className="level-row" key={level.id}>
              <div className="level-main"><span className={"rank-number " + (level.rank <= 3 ? "rank-top" : "")}>{String(level.rank).padStart(2, "0")}</span><div className={"level-thumb thumb-" + level.color}><div className="thumb-mesh" /><Zap size={21} /></div><div className="level-info"><h3>{level.name}</h3><span>by <b>{level.creator}</b><i className="meta-dot" />{level.length}</span></div></div>
              <div><span className={"difficulty-pill " + level.difficulty.toLowerCase()}><span />{level.difficulty}</span></div>
              <div className="points-value">{level.points}<small> pts</small></div>
              <div>{level.status === "Verified" ? <span className="status-verified"><BadgeCheck size={15} /> Verified</span> : <span className="status-new"><Sparkles size={14} /> New</span>}</div>
              <button className="row-arrow" aria-label={"View " + level.name} onClick={() => { setCompletion({ level: level.name, video: "" }); setModal("completion"); }}><ArrowRight size={17} /></button>
            </article>)}
            {filteredLevels.length === 0 && <div className="empty-state"><Search size={25} /><b>No challenges found</b><span>Try a different search or difficulty filter.</span><button className="text-link" onClick={() => { setSearch(""); setDifficulty("All difficulties"); }}>Clear filters</button></div>}
          </div>
          <div className="list-footer"><span>Showing <b>{filteredLevels.length}</b> of <b>{levels.length}</b> challenges</span><button className="button button-outline" onClick={() => setActiveTab("Submissions")}>View submissions <ArrowRight size={15} /></button></div>
        </section>}

        {activeTab === "Rankings" && <section className="challenge-section alternate-section"><div className="section-heading"><div><div className="eyebrow section-eyebrow">THE ONES TO BEAT</div><h2>Player rankings</h2><p>Community leaderboard preview.</p></div><Trophy className="section-watermark" size={52} /></div><div className="leaderboard">{[["01","wave.exe","2,480","42"],["02","Krynt","2,105","37"],["03","lumi","1,890","31"],["04","xern","1,640","28"],["05","mori","1,225","22"]].map((p) => <div className="leader-row" key={p[0]}><span className={Number(p[0]) <= 3 ? "rank-number rank-top" : "rank-number"}>{p[0]}</span><span className="leader-avatar">{p[1].slice(0,1).toUpperCase()}</span><b>{p[1]}</b><span className="leader-runs">{p[3]} verified runs</span><strong>{p[2]} <small>pts</small></strong></div>)}</div><p className="notice"><CircleHelp size={16} /> Rankings are sample data until the Supabase database is connected.</p></section>}

        {activeTab === "Submissions" && <section className="challenge-section alternate-section"><div className="section-heading"><div><div className="eyebrow section-eyebrow">HELP THE LIST GROW</div><h2>Community submissions</h2><p>Send in a challenge or submit proof of your clear.</p></div></div><div className="submission-cards"><button className="submission-card" onClick={() => setModal("submit")}><span className="submission-icon purple"><Plus size={22} /></span><h3>Submit a level</h3><p>Suggest a wave challenge for the list. Include the creator, details, and a showcase video.</p><span className="text-link">Start a submission <ArrowRight size={16} /></span></button><button className="submission-card" onClick={() => setModal("completion")}><span className="submission-icon green"><Check size={22} /></span><h3>Submit a completion</h3><p>Share your proof video for a completed challenge and earn points after review.</p><span className="text-link">Submit your proof <ArrowRight size={16} /></span></button></div><p className="notice"><Clock3 size={16} /> Submissions created here are preview-only until database access is configured.</p></section>}

        {activeTab === "About" && <section className="challenge-section alternate-section"><div className="section-heading"><div><div className="eyebrow section-eyebrow">ABOUT THE PROJECT</div><h2>Made for the wave community.</h2><p>WCL is a community-driven home for Geometry Dash wave challenges.</p></div></div><div className="about-grid"><div><ShieldCheck size={22} /><h3>Fair & transparent</h3><p>Proof-based completion reviews, moderation history, and clearly defined points.</p></div><div><BarChart3 size={22} /><h3>Progress that matters</h3><p>Track your challenge progress and compete with players across the community.</p></div><div><Github size={22} /><h3>Community built</h3><p>Open project foundation designed to grow with player and moderator feedback.</p></div></div></section>}

        <section className="bottom-cta"><div className="cta-orb"><Zap size={26} /></div><div><h2>Ready to take on the list?</h2><p>Your next hardest is waiting. Jump in and make it count.</p></div><button className="button button-primary" onClick={() => { setActiveTab("Levels"); document.getElementById("challenge-list")?.scrollIntoView({ behavior: "smooth" }); }}>Browse challenges <ArrowRight size={16} /></button></section>
      </main>

      <footer className="footer"><a className="brand footer-brand" href="#top"><span className="brand-mark"><Activity size={19} /></span><span className="brand-copy">WCL<span className="brand-period">.</span><small>WAVE CHALLENGE LIST</small></span></a><span>Not affiliated with RobTop Games. Geometry Dash is a trademark of its respective owner.</span><div className="footer-links"><button onClick={() => setActiveTab("About")}>About</button><a href="https://github.com/SolanceGMD/WCL" target="_blank" rel="noreferrer">GitHub <ArrowRight size={12} /></a></div></footer>

      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close icon-button" onClick={() => setModal(null)} aria-label="Close dialog"><X size={19} /></button>
        {modal === "login" && <><span className="modal-icon"><UserRound size={23} /></span><div className="eyebrow section-eyebrow">PLAYER ACCOUNT</div><h2 id="modal-title">Welcome to WCL</h2><p className="modal-description">Enter a display name for this local preview. Real accounts and Geometry Dash username verification need Supabase Auth configuration.</p><form onSubmit={(event) => { event.preventDefault(); if (profileName.trim()) { setProfileName(profileName.trim()); setModal(null); notify("Preview profile set. Connect authentication for a real account."); } }}><label className="field-label">Display name<input required value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Your Geometry Dash username" maxLength={32} /></label><button className="button button-primary modal-submit" type="submit"><LogIn size={16} /> Continue in preview</button></form></>}
        {modal === "submit" && <><span className="modal-icon"><Plus size={23} /></span><div className="eyebrow section-eyebrow">COMMUNITY SUBMISSION</div><h2 id="modal-title">Submit a challenge</h2><p className="modal-description">Share the details. In this preview, the level is added locally and is not sent to moderators.</p><form onSubmit={submitLevel}><div className="form-grid"><label className="field-label">Level name *<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Challenge name" maxLength={90} /></label><label className="field-label">Creator *<input required value={draft.creator} onChange={(event) => setDraft({ ...draft, creator: event.target.value })} placeholder="Creator username" maxLength={60} /></label></div><label className="field-label">Showcase YouTube URL<input type="url" value={draft.video} onChange={(event) => setDraft({ ...draft, video: event.target.value })} placeholder="https://youtube.com/watch?v=..." /></label>{getYoutubeId(draft.video) && <div className="video-preview"><Youtube size={17} /> YouTube video detected · thumbnail will be available when connected</div>}<label className="field-label">Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What makes this challenge stand out?" rows={3} maxLength={500} /></label><label className="field-label">Suggested points<input type="number" min="0" max="10000" value={draft.points} onChange={(event) => setDraft({ ...draft, points: event.target.value })} /></label><button className="button button-primary modal-submit" type="submit"><Plus size={16} /> Add to preview list</button></form></>}
        {modal === "completion" && <><span className="modal-icon green"><Check size={23} /></span><div className="eyebrow section-eyebrow">COMPLETION PROOF</div><h2 id="modal-title">Submit your clear</h2><p className="modal-description">Share a proof video for moderator review. Points should only be awarded after a trusted moderator approves the run.</p><form onSubmit={submitCompletion}><label className="field-label">Challenge<select value={completion.level} onChange={(event) => setCompletion({ ...completion, level: event.target.value })}>{levels.map((level) => <option key={level.id}>{level.name}</option>)}</select></label><label className="field-label">Proof video URL *<input required type="url" value={completion.video} onChange={(event) => setCompletion({ ...completion, video: event.target.value })} placeholder="https://youtube.com/watch?v=..." /></label><button className="button button-primary modal-submit" type="submit"><Youtube size={16} /> Submit proof for review</button></form></>}
      </section></div>}
      {toast && <div className={"toast " + (toast.kind === "error" ? "toast-error" : "")}><Check size={17} />{toast.text}<button onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={15} /></button></div>}
      <div className="demo-indicator"><span /> PREVIEW BUILD</div>
    </div>
  );
}

function Stat({ icon, label, value, foot }: { icon: React.ReactNode; label: string; value: string; foot: string }) {
  return <div className="stat-card"><div className="stat-top"><span className="stat-icon">{icon}</span><span>{label}</span></div><div className="stat-value">{value}</div><div className="stat-foot"><span />{foot}</div></div>;
}
