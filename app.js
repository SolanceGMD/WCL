import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const cfg = window.WCL_CONFIG || {};
const supabase = cfg.supabaseUrl && cfg.supabaseKey ? createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const defaultSettings = { sort: "rank", compact: false, showIds: true };
const readSettings = () => {
  try {
    const stored = JSON.parse(localStorage.getItem("wcl-settings") || "{}");
    return { sort: ["rank", "points", "name", "newest"].includes(stored.sort) ? stored.sort : "rank", compact: stored.compact === true, showIds: stored.showIds !== false };
  } catch { return { ...defaultSettings }; }
};
const state = { session: null, profile: null, role: null, levels: [], rankings: [], activeTab: "Levels", adminTab: "queue", detailLevel: null, permissions: {}, settings: readSettings() };
const isNoGdIdException = name => ["conicalhappiness", "conicalhappyiness"].includes(String(name || "").toLowerCase().replace(/[^a-z]/g, ""));
const difficultyClass = value => ({ Extreme: "extreme", Insane: "insane", Hard: "hard", Medium: "medium", Easy: "medium", Unrated: "" }[value] || "");
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const youtubeId = value => { try { const u = new URL(value); if (u.hostname.endsWith("youtu.be")) return u.pathname.slice(1).split("/")[0]; return u.searchParams.get("v") || u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1] || ""; } catch { return ""; } };
const thumbnail = value => { const id = youtubeId(value || ""); return id ? "https://i.ytimg.com/vi/" + encodeURIComponent(id) + "/mqdefault.jpg" : ""; };
const isStaff = () => state.role?.role === "admin" || Object.values(state.role?.permissions || {}).some(Boolean);
const hasPermission = key => state.role?.role === "admin" || state.role?.permissions?.[key] === true;
const toast = (message, error = false) => { const root = $("#toast-root"); root.innerHTML = '<div class="toast ' + (error ? "toast-error" : "") + '"><span>' + (error ? "!" : "✓") + '</span><div>' + escapeHtml(message) + '</div><button aria-label="Dismiss">×</button></div>'; $(".toast button", root).onclick = () => root.innerHTML = ""; window.setTimeout(() => { if ($(".toast", root)) root.innerHTML = ""; }, 5000); };
const showError = (error, fallback = "Something went wrong.") => { console.error(error); toast(error?.message || fallback, true); };
const modal = (html) => { $("#modal-root").innerHTML = '<div class="modal-backdrop" id="modal-backdrop"><section class="modal-panel" role="dialog" aria-modal="true">' + html + '</section></div>'; $("#modal-backdrop").addEventListener("click", e => { if (e.target.id === "modal-backdrop") closeModal(); }); const close = $(".modal-close"); if (close) close.onclick = closeModal; };
const closeModal = () => $("#modal-root").innerHTML = "";
const indicator = (text, ok = true) => { $("#connection-indicator").innerHTML = '<span style="background:' + (ok ? "#67e9bd" : "#ff8295") + '"></span> ' + escapeHtml(text.toUpperCase()); };
const safeRun = async fn => { try { await fn(); } catch (e) { showError(e); } };
const requireBackend = () => { if (!supabase) { toast("Backend is not configured. Add your Supabase URL and publishable key in app.js.", true); return false; } return true; };
const requireUser = () => { if (!state.session) { openAuth("signin"); return false; } if (state.role?.banned_at) { toast("This account is banned from submitting content.", true); return false; } return true; };
const fmtDate = value => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
const youtubeLink = value => { const id = youtubeId(value || ""); return id ? '<a class="text-link" href="' + escapeHtml(value) + '" target="_blank" rel="noreferrer">▶ Watch showcase ↗</a>' : ""; };

async function loadIdentity() {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  state.session = session;
  state.profile = null; state.role = null;
  if (session?.user) {
    const [profile, role] = await Promise.all([
      supabase.from("profiles").select("id,gd_username,points,created_at").eq("id", session.user.id).maybeSingle(),
      supabase.from("user_roles").select("user_id,role,permissions,banned_at,ban_reason").eq("user_id", session.user.id).maybeSingle()
    ]);
    if (profile.error) throw profile.error;
    if (role.error) throw role.error;
    state.profile = profile.data; state.role = role.data;
  }
  renderIdentity();
}
function renderIdentity() {
  const button = $("#auth-button");
  button.textContent = state.session ? (state.profile?.gd_username || state.session.user.email || "Account") : "Sign in";
  button.title = state.session ? "Open account options" : "Sign in or create an account";
  $("#admin-nav").classList.toggle("hidden", !isStaff());
}
async function loadLevels() {
  if (!supabase) { indicator("Backend not configured", false); $("#level-rows").innerHTML = empty("Backend setup required", "The site is live as static HTML. Connect Supabase to load community data."); return; }
  indicator("Syncing WCL");
  const { data, error } = await supabase.from("levels").select("id,name,gd_level_id,creator,description,points,difficulty,length,youtube_url,thumbnail_url,status,sort_order,created_at,updated_at").eq("status", "published").order("sort_order", { ascending: true }).order("points", { ascending: false }).order("created_at", { ascending: true });
  if (error) throw error;
  state.levels = data || [];
  renderLevels(); renderStats(); indicator("Connected to WCL");
  const { data: people, error: peopleError } = await supabase.from("profiles").select("id,gd_username,points,created_at").order("points", { ascending: false }).limit(100);
  if (!peopleError) { state.rankings = people || []; renderRankings(); }
  const { data: stats, error: statsError } = await supabase.rpc("wcl_public_stats");
  if (!statsError && stats?.[0]) {
    const s = stats[0];
    $("#stat-levels").textContent = Number(s.level_count).toLocaleString();
    $("#stat-players").textContent = Number(s.player_count).toLocaleString();
    $("#stat-completions").textContent = Number(s.completion_count).toLocaleString();
    $("#stat-points").textContent = Number(s.points_total).toLocaleString();
  }
}
function empty(title, description) { return '<div class="empty-state"><b>' + escapeHtml(title) + '</b><span>' + escapeHtml(description || "") + '</span></div>'; }
function renderStats() {
  $("#stat-levels").textContent = state.levels.length.toLocaleString();
  $("#stat-players").textContent = state.rankings.length.toLocaleString();
  $("#top-challenge-name").textContent = state.levels[0]?.name || "Be the first";
}
function renderLevels() {
  const search = ($("#level-search").value || "").trim().toLowerCase();
  const diff = $("#difficulty-filter").value;
  const sort = $("#sort-filter").value;
  let rows = state.levels.filter(l => (String(l.name || "") + " " + String(l.creator || "")).toLowerCase().includes(search) && (diff === "All difficulties" || l.difficulty === diff));
  if (sort === "points") rows.sort((a,b) => Number(b.points || 0)-Number(a.points || 0) || Number(a.sort_order || 0)-Number(b.sort_order || 0));
  else if (sort === "name") rows.sort((a,b) => String(a.name || "").localeCompare(String(b.name || "")));
  else if (sort === "newest") rows.sort((a,b) => new Date(b.created_at || 0)-new Date(a.created_at || 0));
  else rows.sort((a,b) => Number(a.sort_order || 0)-Number(b.sort_order || 0) || Number(b.points || 0)-Number(a.points || 0) || new Date(a.created_at || 0)-new Date(b.created_at || 0));
  $("#level-rows").classList.toggle("compact-list", state.settings.compact);
  $("#level-count").textContent = rows.length;
  $("#list-footer-count").innerHTML = 'Showing <b>' + rows.length + '</b> of <b>' + state.levels.length + '</b> published challenges';
  if (!rows.length) { $("#level-rows").innerHTML = empty("No challenges found", state.levels.length ? "Try a different search or difficulty filter." : "Be the first to submit a challenge."); return; }
  const colors = ["", "thumb-blue", "thumb-pink", "thumb-green", "thumb-orange", "thumb-cyan"];
  $("#level-rows").innerHTML = rows.map((l,i) => {
    const thumb = thumbnail(l.youtube_url), levelId = String(l.id || "");
    const idMarkup = state.settings.showIds && l.gd_level_id ? '<span class="level-id">GD ID <code>' + escapeHtml(l.gd_level_id) + '</code><button type="button" class="copy-level-id" data-copy-level-id="' + escapeHtml(l.gd_level_id) + '" aria-label="Copy Geometry Dash level ID for ' + escapeHtml(l.name) + '" title="Copy Geometry Dash level ID">Copy</button></span>' : "";
    return '<article class="level-row"><div class="level-main"><span class="rank-number ' + (i<3 ? "rank-top" : "") + '">' + String(i+1).padStart(2,"0") + '</span><div class="level-thumb ' + colors[i%colors.length] + '">' + (thumb ? '<img src="' + escapeHtml(thumb) + '" alt="" loading="lazy" onerror="this.remove()">' : '<span class="thumb-mesh"></span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h4l3-7 4 14 3-7h2"/></svg>') + '</div><div class="level-info"><h3>' + escapeHtml(l.name) + '</h3><span>by <b>' + escapeHtml(l.creator) + '</b><i class="meta-dot"></i>' + escapeHtml(l.length || "Unrated") + '</span>' + idMarkup + '</div></div><div><span class="difficulty-pill ' + difficultyClass(l.difficulty) + '"><span></span>' + escapeHtml(l.difficulty || "Unrated") + '</span></div><div class="points-value">' + Number(l.points || 0).toLocaleString() + ' <small>pts</small></div><div><span class="status-verified">✓ Verified</span></div><button class="row-arrow" data-level="' + escapeHtml(levelId) + '" aria-label="View ' + escapeHtml(l.name) + '">↗</button></article>';
  }).join("");
  $$("[data-level]").forEach(button => button.addEventListener("click", () => openLevel(button.dataset.level)));
  $$("[data-copy-level-id]").forEach(button => button.addEventListener("click", () => copyLevelId(button.dataset.copyLevelId)));
}
function renderRankings() {
  if (!state.rankings.length) { $("#leaderboard").innerHTML = empty("No players yet", "Create an account and start earning points."); return; }
  $("#leaderboard").innerHTML = state.rankings.map((p,i) => '<div class="leader-row"><span class="rank-number ' + (i<3 ? "rank-top" : "") + '">' + String(i+1).padStart(2,"0") + '</span><span class="leader-avatar">' + escapeHtml((p.gd_username||"?").slice(0,1).toUpperCase()) + '</span><b>' + escapeHtml(p.gd_username) + (p.id===state.session?.user?.id ? ' <small>(you)</small>' : '') + '</b><span class="leader-runs">' + (i===0 ? "Top player" : "Wave player") + '</span><strong>' + Number(p.points||0).toLocaleString() + ' <small>pts</small></strong></div>').join("");
}
function switchTab(tab) {
  state.activeTab = tab;
  $$(".nav-link[data-tab]").forEach(b => { const active = b.dataset.tab === tab; b.classList.toggle("active", active); if (active) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  ["Levels","Rankings","Submissions","About","Settings","Admin"].forEach(name => { const section = $("#view-" + name.toLowerCase()); if (section) section.classList.toggle("hidden", name !== tab); });
  $("#main-nav").classList.remove("nav-open");
  if (tab === "Settings") renderSettings();
  if (tab === "Admin") loadAdmin().catch(showError);
  if (tab === "Submissions") loadMySubmissions().catch(showError);
  const target = $("#view-" + tab.toLowerCase()); if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}
function openAuth(mode = "signin") {
  const signup = mode === "signup";
  modal('<button class="icon-button modal-close" aria-label="Close">×</button><div class="modal-icon">♙</div><div class="eyebrow section-eyebrow">PLAYER ACCOUNT</div><h2>' + (signup ? "Join the wave." : "Welcome back.") + '</h2><p class="modal-description">' + (signup ? "Create your account to submit levels, prove completions, and track points." : "Sign in to manage submissions and see your player account.") + '</p><form id="auth-form">' + (signup ? '<label class="field-label">Geometry Dash username<input name="gd_username" minlength="1" maxlength="32" required placeholder="Your GD username"></label>' : '') + '<label class="field-label">Email address<input type="email" name="email" autocomplete="email" required placeholder="you@example.com"></label><label class="field-label">Password<input type="password" name="password" minlength="8" autocomplete="' + (signup ? "new-password" : "current-password") + '" required placeholder="At least 8 characters"></label><button class="button button-primary modal-submit" type="submit">' + (signup ? "Create account" : "Sign in") + '</button></form><p class="modal-description" style="margin:16px 0 0">' + (signup ? 'Already registered? <button type="button" class="text-link" id="switch-auth">Sign in</button>' : 'New to WCL? <button type="button" class="text-link" id="switch-auth">Create an account</button>') + '</p>');
  $("#switch-auth").onclick = () => openAuth(signup ? "signin" : "signup");
  if(!signup) {
    const forgot=document.createElement("button");forgot.type="button";forgot.className="text-link";forgot.textContent="Forgot password?";
    forgot.style.marginTop="10px";forgot.onclick=async()=>{
      const email=String($('input[name="email"]', $("#auth-form")).value||"").trim();
      if(!email)return toast("Enter your email address first.",true);
      const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
      if(error)return showError(error);
      toast("Password reset link sent. Check your email.");closeModal();
    };
    $("#auth-form").appendChild(forgot);
  }
  $("#auth-form").onsubmit = async e => {
    e.preventDefault(); if (!requireBackend()) return;
    const fd = new FormData(e.currentTarget), email = String(fd.get("email")).trim(), password = String(fd.get("password"));
    const button = $("button[type=submit]", e.currentTarget); button.disabled = true; button.textContent = "Please wait…";
    try {
      if (signup) {
        const gd_username = String(fd.get("gd_username")).trim();
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { gd_username } } });
        if (error) throw error;
        if (!data.session) { closeModal(); toast("Account created. Check your email to confirm it, then sign in."); return; }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error;
      }
      await loadIdentity(); closeModal(); await loadLevels(); toast("You're signed in.");
    } catch (err) { showError(err); button.disabled = false; button.textContent = signup ? "Create account" : "Sign in"; }
  };
}
function openPasswordReset() {
  modal('<button class="icon-button modal-close" aria-label="Close">×</button><div class="modal-icon">♙</div><div class="eyebrow section-eyebrow">ACCOUNT SECURITY</div><h2>Choose a new password.</h2><p class="modal-description">Use at least 8 characters. Your new password will replace the old one.</p><form id="password-reset-form"><label class="field-label">New password<input type="password" name="password" minlength="8" autocomplete="new-password" required></label><label class="field-label">Confirm new password<input type="password" name="confirm" minlength="8" autocomplete="new-password" required></label><button class="button button-primary modal-submit" type="submit">Update password</button></form>');
  $("#password-reset-form").onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),password=String(fd.get("password")),confirm=String(fd.get("confirm"));if(password!==confirm)return toast("Passwords do not match.",true);const {error}=await supabase.auth.updateUser({password});if(error)return showError(error);closeModal();toast("Password updated successfully.");};
}
function openAccount() {
  if (!state.session) return openAuth("signin");
  modal('<button class="icon-button modal-close" aria-label="Close">×</button><div class="modal-icon">♙</div><div class="eyebrow section-eyebrow">YOUR ACCOUNT</div><h2>' + escapeHtml(state.profile?.gd_username || "Player") + '</h2><p class="modal-description">' + escapeHtml(state.session.user.email || "") + '<br>Member since ' + fmtDate(state.profile?.created_at) + '</p><div class="about-grid"><div><h3>Points</h3><p>' + Number(state.profile?.points||0).toLocaleString() + '</p></div><div><h3>Role</h3><p>' + escapeHtml(state.role?.role || "player") + '</p></div></div>' + (state.role?.banned_at ? '<p class="notice">Account banned: ' + escapeHtml(state.role.ban_reason || "No reason provided") + '</p>' : '') + '<button class="button button-outline modal-submit" id="signout-button">Sign out</button>');
  $("#signout-button").onclick = async () => { const {error}=await supabase.auth.signOut(); if(error) return showError(error); state.session=null;state.profile=null;state.role=null;closeModal();renderIdentity();await loadLevels();toast("Signed out."); };
}
async function copyLevelId(id) {
  const value = String(id || "");
  if (!value) return toast("No level ID is available to copy.", true);
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
    else {
      const field = document.createElement("textarea");
      field.value = value; field.setAttribute("readonly", ""); field.style.position = "fixed"; field.style.opacity = "0";
      document.body.appendChild(field); field.select();
      const copied = document.execCommand("copy"); field.remove();
      if (!copied) throw new Error("Clipboard access is unavailable in this browser.");
    }
    toast("Geometry Dash level ID copied.");
  } catch (error) { showError(error, "Could not copy the level ID. Select and copy it manually."); }
}
function openLevel(id) {
  const l = state.levels.find(x => String(x.id) === String(id)); if (!l) return;
  state.detailLevel = l;
  const thumb = thumbnail(l.youtube_url);
  modal('<button class="icon-button modal-close" aria-label="Close">×</button>' + (thumb ? '<img class="detail-image" src="' + escapeHtml(thumb) + '" alt="" onerror="this.style.display=\'none\'">' : '<div class="modal-icon">ϟ</div>') + '<div class="eyebrow section-eyebrow">WAVE CHALLENGE</div><h2>' + escapeHtml(l.name) + '</h2><p class="modal-description">Created by <b>' + escapeHtml(l.creator) + '</b> · ' + escapeHtml(l.difficulty || "Unrated") + ' · ' + escapeHtml(l.length || "Unrated") + '</p>' + (l.gd_level_id ? '<div class="level-id-detail"><span>GD Level ID</span><code>' + escapeHtml(l.gd_level_id) + '</code><button type="button" class="button button-outline" id="copy-level-id">Copy ID</button></div>' : '') + '<p class="detail-description">' + escapeHtml(l.description || "No description provided.") + '</p><div class="detail-reward">' + Number(l.points || 0).toLocaleString() + ' <small>points on approved completion</small></div>' + youtubeLink(l.youtube_url) + '<button class="button button-primary modal-submit" id="prove-level">Submit completion proof</button>');
  if (l.gd_level_id) $("#copy-level-id").onclick = () => copyLevelId(l.gd_level_id);
  $("#prove-level").onclick = () => openCompletion(l.id);
}
function openLevelSubmission() {
  if (!requireUser()) return;
  modal('<button class="icon-button modal-close" aria-label="Close">×</button><div class="modal-icon">＋</div><div class="eyebrow section-eyebrow">COMMUNITY SUBMISSION</div><h2>Submit a level</h2><p class="modal-description">A moderator reviews every level before it appears on the public list. Suggested points are a recommendation, not an automatic reward.</p><form id="level-submit-form"><label class="field-label">Level name<input name="name" id="submission-level-name" required maxlength="100" placeholder="e.g. Neon Skyline"></label><label class="field-label">Geometry Dash level ID<input name="gd_level_id" id="submission-gd-level-id" inputmode="numeric" pattern="[0-9]+" required placeholder="e.g. 12345678"><small class="field-hint">Required for every level except Conical Happyiness.</small></label><div class="form-grid"><label class="field-label">Level creator<input name="creator" required maxlength="80" placeholder="Creator username"></label><label class="field-label">Suggested points<input type="number" name="suggested_points" min="0" max="1000000" value="10" required></label></div><div class="form-grid"><label class="field-label">Difficulty<select name="difficulty"><option>Unrated</option><option>Easy</option><option>Medium</option><option>Hard</option><option>Insane</option><option>Extreme</option></select></label><label class="field-label">Length<select name="length"><option>Unrated</option><option>Short</option><option>Medium</option><option>Long</option><option>XL</option></select></label></div><label class="field-label">YouTube showcase URL<input type="url" name="youtube_url" placeholder="https://youtube.com/watch?v=…"></label><label class="field-label">Description<textarea name="description" maxlength="2000" rows="3" placeholder="What makes this challenge special?"></textarea></label><button class="button button-primary modal-submit" type="submit">Send for review</button></form>');
  const submissionName = $("#submission-level-name"), submissionGdId = $("#submission-gd-level-id");
  const syncSubmissionGdId = () => { const exempt = isNoGdIdException(submissionName.value); submissionGdId.required = !exempt; submissionGdId.disabled = exempt; if (exempt) submissionGdId.value = ""; };
  submissionName.addEventListener("input", syncSubmissionGdId); syncSubmissionGdId();
  $("#level-submit-form").onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    const levelName = String(fd.get("name")).trim(), gdLevelId = String(fd.get("gd_level_id") || "").trim();
    if (!isNoGdIdException(levelName) && !/^[0-9]+$/.test(gdLevelId)) return toast("Enter the numeric Geometry Dash level ID.", true);
    const payload = { submitter_id: state.session.user.id, name: levelName, gd_level_id: isNoGdIdException(levelName) ? null : gdLevelId, creator: String(fd.get("creator")).trim(), suggested_points: Number(fd.get("suggested_points")), difficulty: fd.get("difficulty"), length: fd.get("length"), youtube_url: String(fd.get("youtube_url")||"").trim() || null, description: String(fd.get("description")||"").trim(), status:"pending" };
    if (payload.youtube_url && !youtubeId(payload.youtube_url)) return toast("Please enter a valid YouTube video URL.", true);
    const btn = $("button[type=submit]", e.currentTarget); btn.disabled=true; btn.textContent="Submitting…";
    const { error } = await supabase.from("level_submissions").insert(payload);
    if (error) { btn.disabled=false; btn.textContent="Send for review"; return showError(error); }
    closeModal(); toast("Level submitted for moderator review."); loadMySubmissions().catch(showError);
  };
}
function openCompletion(levelId = "") {
  if (!requireUser()) return;
  const options = state.levels.map(l => '<option value="' + l.id + '" ' + (String(l.id)===String(levelId)?"selected":"") + '>' + escapeHtml(l.name) + ' — ' + Number(l.points) + ' pts</option>').join("");
  modal('<button class="icon-button modal-close" aria-label="Close">×</button><div class="modal-icon green">✓</div><div class="eyebrow section-eyebrow">PROOF SUBMISSION</div><h2>Prove your run.</h2><p class="modal-description">Submit a video URL showing your completion. Points are added only after moderator approval. One approved or pending submission per player per level.</p><form id="completion-form"><label class="field-label">Challenge<select name="level_id" required>' + options + '</select></label><label class="field-label">Proof video URL<input type="url" name="proof_url" required placeholder="https://youtube.com/watch?v=…"></label><div id="completion-preview"></div><button class="button button-primary modal-submit" type="submit">Submit proof for review</button></form>');
  const urlInput = $('input[name=proof_url]');
  urlInput.addEventListener("input", () => { const img=thumbnail(urlInput.value); $("#completion-preview").innerHTML=img?'<div class="video-preview">✓ YouTube video detected</div>':""; });
  $("#completion-form").onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.currentTarget), proof_url=String(fd.get("proof_url")).trim(), id=String(fd.get("level_id"));
    if (!youtubeId(proof_url)) return toast("Proof must be a valid YouTube video URL.", true);
    const btn=$("button[type=submit]",e.currentTarget);btn.disabled=true;btn.textContent="Submitting…";
    const {error}=await supabase.from("completion_submissions").insert({submitter_id:state.session.user.id,level_id:id,proof_url,status:"pending"});
    if(error){btn.disabled=false;btn.textContent="Submit proof for review";return showError(error);}
    closeModal();toast("Proof submitted. Points will be awarded after approval.");loadMySubmissions().catch(showError);
  };
}
async function loadMySubmissions() {
  if (!state.session) { $("#my-submissions").innerHTML = empty("Sign in to track submissions", "Your level suggestions and completion proofs appear here."); return; }
  const [levels, runs] = await Promise.all([
    supabase.from("level_submissions").select("id,name,status,review_note,created_at").eq("submitter_id",state.session.user.id).order("created_at",{ascending:false}),
    supabase.from("completion_submissions").select("id,level_id,proof_url,status,points_awarded,review_note,created_at,levels(name)").eq("submitter_id",state.session.user.id).order("created_at",{ascending:false})
  ]);
  if(levels.error) throw levels.error;if(runs.error) throw runs.error;
  const status = s => '<span class="review-status status-' + escapeHtml(s) + '">' + escapeHtml(s) + '</span>';
  $("#my-submissions").innerHTML='<h3 class="subsection-title">Your submissions</h3>' + (!levels.data.length&&!runs.data.length?empty("Nothing submitted yet","Your submission history will appear here."):"") + (levels.data||[]).map(s=>'<div class="submission-history"><div><b>Level: '+escapeHtml(s.name)+'</b><small>'+fmtDate(s.created_at)+' '+status(s.status)+'</small>'+(s.review_note?'<p>'+escapeHtml(s.review_note)+'</p>':'')+'</div></div>').join("") + (runs.data||[]).map(s=>'<div class="submission-history"><div><b>Completion: '+escapeHtml(s.levels?.name||"Challenge")+'</b><small>'+fmtDate(s.created_at)+' '+status(s.status)+(s.status==="approved"?' · +'+Number(s.points_awarded)+' pts':'')+'</small>'+(s.review_note?'<p>'+escapeHtml(s.review_note)+'</p>':'')+'<a href="'+escapeHtml(s.proof_url)+'" target="_blank" rel="noreferrer">View proof ↗</a></div></div>').join("");
}
async function loadAdmin() {
  if (!state.session || !isStaff()) { $("#admin-content").innerHTML=empty("Staff access required","Your account needs an administrator-assigned moderator role and permissions."); return; }
  const buttons='<div class="admin-tabs"><button class="button button-outline" data-admin-tab="queue">Review queue</button><button class="button button-outline" data-admin-tab="levels">Manage levels</button><button class="button button-outline" data-admin-tab="users">Users & roles</button><button class="button button-outline" data-admin-tab="audit">Audit log</button></div>';
  $("#admin-content").innerHTML=buttons+'<div id="admin-panel">'+empty("Loading dashboard…")+'</div>';
  $$("[data-admin-tab]").forEach(b=>{b.classList.toggle("button-primary",b.dataset.adminTab===state.adminTab);b.onclick=()=>{state.adminTab=b.dataset.adminTab;loadAdmin().catch(showError);};});
  if(state.adminTab==="queue") await renderAdminQueue();
  else if(state.adminTab==="levels") await renderAdminLevels();
  else if(state.adminTab==="users") await renderAdminUsers();
  else await renderAdminAudit();
}
async function renderAdminQueue() {
  if(!hasPermission("submissions.review")){$("#admin-panel").innerHTML=empty("Missing permission","Your account does not have submissions.review.");return;}
  const [levels,runs]=await Promise.all([supabase.from("level_submissions").select("*").eq("status","pending").order("created_at"),supabase.from("completion_submissions").select("*,levels(name,points)").eq("status","pending").order("created_at")]);
  if(levels.error)throw levels.error;if(runs.error)throw runs.error;
  const playerIds=[...new Set([...(levels.data||[]).map(s=>s.submitter_id),...(runs.data||[]).map(s=>s.submitter_id)])];
  const profileResult=playerIds.length?await supabase.from("profiles").select("id,gd_username").in("id",playerIds):{data:[],error:null};
  if(profileResult.error)throw profileResult.error;
  const names=Object.fromEntries((profileResult.data||[]).map(p=>[p.id,p.gd_username]));
  let html='<h3 class="subsection-title">Pending level submissions ('+levels.data.length+')</h3>';
  html+=levels.data.map(s=>'<article class="admin-card"><div><b>'+escapeHtml(s.name)+'</b><small>by '+escapeHtml(s.creator)+' · submitted by '+escapeHtml(names[s.submitter_id]||"player")+' · suggested '+s.suggested_points+' pts</small><p>'+escapeHtml(s.description||"No description")+'</p>'+(s.youtube_url?youtubeLink(s.youtube_url):'')+'</div><div class="admin-actions"><button class="button button-primary" data-approve-level="'+s.id+'">Approve</button><button class="button button-outline" data-reject-level="'+s.id+'">Reject</button></div></article>').join("")||empty("No level submissions","The level review queue is clear.");
  html+='<h3 class="subsection-title">Pending completion proofs ('+runs.data.length+')</h3>';
  html+=runs.data.map(s=>'<article class="admin-card"><div><b>'+escapeHtml(s.levels?.name||"Challenge")+'</b><small>by '+escapeHtml(names[s.submitter_id]||"player")+' · reward '+Number(s.levels?.points||0)+' pts</small><a href="'+escapeHtml(s.proof_url)+'" target="_blank" rel="noreferrer">Watch proof video ↗</a></div><div class="admin-actions"><button class="button button-primary" data-approve-run="'+s.id+'">Approve +'+Number(s.levels?.points||0)+' pts</button><button class="button button-outline" data-reject-run="'+s.id+'">Reject</button></div></article>').join("")||empty("No completion proofs","The completion review queue is clear.");
  $("#admin-panel").innerHTML=html;
  $$("[data-approve-level]").forEach(b=>b.onclick=()=>reviewLevel(b.dataset.approveLevel,"approved"));
  $$("[data-reject-level]").forEach(b=>b.onclick=()=>reviewLevel(b.dataset.rejectLevel,"rejected"));
  $$("[data-approve-run]").forEach(b=>b.onclick=()=>reviewRun(b.dataset.approveRun,"approved"));
  $$("[data-reject-run]").forEach(b=>b.onclick=()=>reviewRun(b.dataset.rejectRun,"rejected"));
}
async function reviewLevel(id,status) {
  if(!hasPermission("submissions.review"))return toast("Missing review permission.",true);
  const note=status==="rejected"?prompt("Reason for rejection (optional):"):"";
  if(status==="rejected"&&note===null)return;
  const {error}=await supabase.rpc("wcl_review_level_submission",{p_submission_id:id,p_status:status,p_note:note||null});
  if(error)return showError(error);
  toast("Level submission "+status+".");await loadAdmin();await loadLevels();
}
async function reviewRun(id,status) {
  if(!hasPermission("submissions.review"))return toast("Missing review permission.",true);
  const note=status==="rejected"?prompt("Reason for rejection (optional):"):"";if(status==="rejected"&&note===null)return;
  const {error}=await supabase.from("completion_submissions").update({status,reviewer_id:state.session.user.id,reviewed_at:new Date().toISOString(),review_note:note||null}).eq("id",id);
  if(error)return showError(error);
  toast(status==="approved"?"Completion approved and points awarded.":"Completion rejected.");await loadAdmin();await loadIdentity();await loadLevels();
}
async function renderAdminLevels() {
  if(!hasPermission("levels.manage")){$("#admin-panel").innerHTML=empty("Missing permission","Your account does not have levels.manage.");return;}
  const {data,error}=await supabase.from("levels").select("*").order("sort_order",{ascending:true}).order("points",{ascending:false}).order("created_at",{ascending:true});if(error)throw error;
  const levels=data||[];
  $("#admin-panel").innerHTML='<div class="admin-toolbar"><p class="modal-description">Use the arrows to set the official challenge-list order. IDs are stable and can be copied for references. Remove is reversible; removed levels can be restored.</p><button class="button button-primary" id="new-level-admin">＋ Add level</button></div>'+levels.map((l,i)=>'<article class="admin-card placement-card"><div><b>'+escapeHtml(l.name)+'</b><small>Position #'+(i+1)+' · '+escapeHtml(l.creator)+' · '+Number(l.points||0)+' pts · '+escapeHtml(l.status)+'</small>'+(l.gd_level_id?'<small class="admin-level-id">GD ID: <code>'+escapeHtml(l.gd_level_id)+'</code><button type="button" class="copy-level-id" data-copy-level-id="'+escapeHtml(l.gd_level_id)+'">Copy ID</button></small>':'<small class="admin-level-id">No GD level ID (exception)</small>')+''+(l.youtube_url?youtubeLink(l.youtube_url):'')+'</div><div class="admin-actions placement-actions"><button class="button button-outline" data-move-level="'+escapeHtml(l.id)+'" data-direction="-1" '+(i===0?'disabled':'')+' aria-label="Move '+escapeHtml(l.name)+' up" title="Move up">↑ Up</button><button class="button button-outline" data-move-level="'+escapeHtml(l.id)+'" data-direction="1" '+(i===levels.length-1?'disabled':'')+' aria-label="Move '+escapeHtml(l.name)+' down" title="Move down">↓ Down</button><button class="button button-outline" data-edit-level="'+escapeHtml(l.id)+'">Edit</button><button class="button button-outline" data-toggle-level="'+escapeHtml(l.id)+'" data-status="'+escapeHtml(l.status)+'">'+(l.status==="published"?"Remove":"Restore")+'</button></div></article>').join("")||empty("No levels","Approve or add a level to start the list.");
  $("#new-level-admin").onclick=()=>editLevel(null);
  $$("#admin-panel [data-edit-level]").forEach(b=>b.onclick=()=>editLevel(levels.find(l=>String(l.id)===b.dataset.editLevel)));
  $$("#admin-panel [data-copy-level-id]").forEach(b=>b.onclick=()=>copyLevelId(b.dataset.copyLevelId));
  $$("#admin-panel [data-move-level]").forEach(b=>b.onclick=()=>moveAdminLevel(b.dataset.moveLevel,Number(b.dataset.direction)).catch(showError));
  $$("#admin-panel [data-toggle-level]").forEach(b=>b.onclick=async()=>{const next=b.dataset.status==="published"?"removed":"published";const {error}=await supabase.from("levels").update({status:next,updated_at:new Date().toISOString()}).eq("id",b.dataset.toggleLevel);if(error)return showError(error);toast("Level "+next+".");await loadAdmin();await loadLevels();});
}
async function moveAdminLevel(id, direction) {
  if(!hasPermission("levels.manage")) return toast("Missing permission: levels.manage.",true);
  const {data,error}=await supabase.from("levels").select("id,sort_order,points,created_at").order("sort_order",{ascending:true}).order("points",{ascending:false}).order("created_at",{ascending:true});
  if(error)throw error;
  const ordered=data||[], from=ordered.findIndex(l=>String(l.id)===String(id)), to=from+direction;
  if(from<0||to<0||to>=ordered.length)return;
  [ordered[from],ordered[to]]=[ordered[to],ordered[from]];
  const {error:reorderError}=await supabase.rpc("wcl_reorder_levels",{p_level_ids:ordered.map(l=>l.id)});
  if(reorderError)throw reorderError;
  toast("Challenge placement updated.");
  await loadAdmin();
  await loadLevels();
}
function editLevel(l) {
  modal('<button class="icon-button modal-close" aria-label="Close">×</button><div class="eyebrow section-eyebrow">LEVEL MANAGEMENT</div><h2>'+(l?"Edit challenge":"Add challenge")+'</h2><form id="edit-level-form"><label class="field-label">Level name<input name="name" id="admin-level-name" required maxlength="100" value="'+escapeHtml(l?.name||"")+'"></label><label class="field-label">Geometry Dash level ID<input name="gd_level_id" id="admin-gd-level-id" inputmode="numeric" pattern="[0-9]+" required value="'+escapeHtml(l?.gd_level_id||"")+'" placeholder="Numeric GD level ID"><small class="field-hint">Required for every level except Conical Happyiness.</small></label><label class="field-label">Creator<input name="creator" required maxlength="80" value="'+escapeHtml(l?.creator||"")+'"></label><label class="field-label">Description<textarea name="description" rows="3" maxlength="2000">'+escapeHtml(l?.description||"")+'</textarea></label><div class="form-grid"><label class="field-label">Points<input type="number" name="points" min="0" max="1000000" required value="'+Number(l?.points||0)+'"></label><label class="field-label">Difficulty<select name="difficulty">'+["Unrated","Easy","Medium","Hard","Insane","Extreme"].map(d=>'<option '+(l?.difficulty===d?"selected":"")+'>'+d+'</option>').join("")+'</select></label></div><div class="form-grid"><label class="field-label">Length<select name="length">'+["Unrated","Short","Medium","Long","XL"].map(d=>'<option '+(l?.length===d?"selected":"")+'>'+d+'</option>').join("")+'</select></label><label class="field-label">Status<select name="status">'+["published","draft","removed"].map(d=>'<option '+((l?.status||"published")===d?"selected":"")+'>'+d+'</option>').join("")+'</select></label></div><label class="field-label">YouTube URL<input type="url" name="youtube_url" value="'+escapeHtml(l?.youtube_url||"")+'"></label><button class="button button-primary modal-submit" type="submit">Save challenge</button></form>');
  const adminLevelName = $("#admin-level-name"), adminGdId = $("#admin-gd-level-id");
  const syncAdminGdId = () => { const exempt = isNoGdIdException(adminLevelName.value); adminGdId.required = !exempt; adminGdId.disabled = exempt; if (exempt) adminGdId.value = ""; };
  adminLevelName.addEventListener("input", syncAdminGdId); syncAdminGdId();
  $("#edit-level-form").onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),levelName=String(fd.get("name")).trim(),gdLevelId=String(fd.get("gd_level_id")||"").trim();if(!isNoGdIdException(levelName)&&!/^[0-9]+$/.test(gdLevelId))return toast("Enter the numeric Geometry Dash level ID.",true);const payload={name:levelName,gd_level_id:isNoGdIdException(levelName)?null:gdLevelId,creator:String(fd.get("creator")).trim(),description:String(fd.get("description")||"").trim(),points:Number(fd.get("points")),difficulty:fd.get("difficulty"),length:fd.get("length"),status:fd.get("status"),youtube_url:String(fd.get("youtube_url")||"").trim()||null,updated_at:new Date().toISOString()};if(payload.youtube_url&&!youtubeId(payload.youtube_url))return toast("Enter a valid YouTube video URL.",true);const result=l?await supabase.from("levels").update(payload).eq("id",l.id):await supabase.from("levels").insert({...payload,sort_order:0,created_by:state.session.user.id});if(result.error)return showError(result.error);closeModal();toast("Challenge saved.");await loadAdmin();await loadLevels();};
}
async function renderAdminUsers() {
  if(!hasPermission("users.manage")){$("#admin-panel").innerHTML=empty("Missing permission","Your account does not have users.manage.");return;}
  const {data:roles,error}=await supabase.from("user_roles").select("user_id,role,permissions,banned_at,ban_reason,updated_at").order("updated_at",{ascending:false}).limit(200);if(error)throw error;
  const ids=roles.map(r=>r.user_id);const {data:profiles, error:profileError}=ids.length?await supabase.from("profiles").select("id,gd_username,points").in("id",ids):{data:[],error:null};if(profileError)throw profileError;
  const byId=Object.fromEntries((profiles||[]).map(p=>[p.id,p]));
  $("#admin-panel").innerHTML='<p class="modal-description">Assign moderator roles and fine-grained permissions. Admin role always has all permissions. User IDs are shown because email addresses are not exposed in public profile data.</p>'+roles.map(r=>{const p=byId[r.user_id]||{};return '<article class="admin-card"><div><b>'+escapeHtml(p.gd_username||"Unknown player")+'</b><small>'+escapeHtml(r.user_id)+' · '+Number(p.points||0)+' pts · '+(r.banned_at?'BANNED':'Active')+'</small><small>Role: '+escapeHtml(r.role)+'</small></div><div class="admin-actions"><button class="button button-outline" data-manage-user="'+r.user_id+'">Manage</button></div></article>';}).join("")||empty("No users found","Accounts will appear here after signup.");
  $$("[data-manage-user]").forEach(b=>b.onclick=()=>manageUser(roles.find(r=>r.user_id===b.dataset.manageUser),byId[b.dataset.manageUser]||{}));
}
function manageUser(role,profile) {
  const permissions=["levels.manage","submissions.review","users.manage","audit.view","points.adjust"];
  const pointsFields=hasPermission("points.adjust")?'<div class="form-grid"><label class="field-label">Point adjustment (+/-)<input type="number" name="points_delta" step="1" min="-1000000" max="1000000" value="0"></label><label class="field-label">Reason for adjustment<input name="points_reason" minlength="3" maxlength="1000" placeholder="Required if changing points"></label></div>':"";
  modal('<button class="icon-button modal-close" aria-label="Close">×</button><div class="eyebrow section-eyebrow">USER & ROLE MANAGEMENT</div><h2>'+escapeHtml(profile.gd_username||"Player")+'</h2><p class="modal-description">'+escapeHtml(role.user_id)+'</p><form id="manage-user-form"><label class="field-label">Role<select name="role">'+["player","moderator","admin"].map(r=>'<option '+(role.role===r?"selected":"")+'>'+r+'</option>').join("")+'</select></label><div class="permission-list"><b>Moderator permissions</b>'+permissions.map(p=>'<label><input type="checkbox" name="perm:'+p+'" '+(role.permissions?.[p]===true?"checked":"")+'> '+escapeHtml(p)+'</label>').join("")+'</div>'+pointsFields+'<label class="field-label">Ban reason (leave blank to unban)<textarea name="ban_reason" rows="2">'+escapeHtml(role.ban_reason||"")+'</textarea></label><button class="button button-primary modal-submit" type="submit">Save user settings</button></form>');
  $("#manage-user-form").onsubmit=async e=>{
    e.preventDefault();const fd=new FormData(e.currentTarget),perms={};permissions.forEach(p=>perms[p]=fd.get("perm:"+p)==="on");
    const delta=Number(fd.get("points_delta")||0),reason=String(fd.get("points_reason")||"").trim();
    if(delta!==0&&!hasPermission("points.adjust"))return toast("Missing points.adjust permission.",true);
    if(delta!==0&&reason.length<3)return toast("Add a reason for the points adjustment.",true);
    const banReason=String(fd.get("ban_reason")||"").trim();
    const payload={role:fd.get("role"),permissions:perms,banned_at:banReason?new Date().toISOString():null,ban_reason:banReason||null,updated_at:new Date().toISOString()};
    const btn=$("button[type=submit]",e.currentTarget);btn.disabled=true;btn.textContent="Saving…";
    const {error}=await supabase.from("user_roles").update(payload).eq("user_id",role.user_id);
    if(error){btn.disabled=false;btn.textContent="Save user settings";return showError(error);}
    if(delta!==0){
      const {error:pointsError}=await supabase.rpc("wcl_adjust_points",{p_user_id:role.user_id,p_delta:delta,p_reason:reason});
      if(pointsError){closeModal();await loadAdmin();return showError(pointsError,"Role settings saved, but the points adjustment failed.");}
    }
    closeModal();toast("User settings saved.");await loadAdmin();
  };
}
async function renderAdminAudit() {
  if(!hasPermission("audit.view")){$("#admin-panel").innerHTML=empty("Missing permission","Your account does not have audit.view.");return;}
  const {data,error}=await supabase.from("audit_logs").select("id,actor_id,action,target_type,target_id,details,created_at").order("created_at",{ascending:false}).limit(100);if(error)throw error;
  $("#admin-panel").innerHTML='<p class="modal-description">Most recent 100 audited changes.</p>'+(data||[]).map(a=>'<article class="admin-card audit-card"><div><b>'+escapeHtml(a.action.toUpperCase())+' · '+escapeHtml(a.target_type)+'</b><small>'+fmtDate(a.created_at)+' · actor '+escapeHtml(a.actor_id||"system")+' · target '+escapeHtml(a.target_id||"—")+'</small><details><summary>View event details</summary><pre>'+escapeHtml(JSON.stringify(a.details,null,2))+'</pre></details></div></article>').join("")||empty("No audit events","Changes to levels, submissions and user roles will be recorded here.");
}

function saveSettings() {
  try { localStorage.setItem("wcl-settings", JSON.stringify(state.settings)); }
  catch (error) { console.warn("Could not persist WCL settings in this browser.", error); }
}
function renderSettings() {
  const sort = $("#settings-sort"), compact = $("#settings-compact"), showIds = $("#settings-show-ids");
  if (sort) sort.value = state.settings.sort;
  if (compact) compact.checked = state.settings.compact;
  if (showIds) showIds.checked = state.settings.showIds;
  const listSort = $("#sort-filter");
  if (listSort) listSort.value = state.settings.sort;
  $("#level-rows")?.classList.toggle("compact-list", state.settings.compact);
}
function wire() {
  $$(".nav-link[data-tab]").forEach(b=>b.addEventListener("click",e=>{e.preventDefault();switchTab(b.dataset.tab);}));
  $("#mobile-menu").onclick=()=>$("#main-nav").classList.toggle("nav-open");
  $("#auth-button").onclick=openAccount;$("#footer-auth").onclick=openAccount;
  $("#submit-level-top").onclick=openLevelSubmission;$("#submit-level-hero").onclick=openLevelSubmission;$("#submit-level-card").onclick=openLevelSubmission;$("#submit-completion-card").onclick=()=>openCompletion();$("#submit-completion-footer").onclick=()=>openCompletion();$("#cta-submit").onclick=()=>state.session?openLevelSubmission():openAuth("signup");
  $("#explore-button").onclick=()=>switchTab("Levels");
  $("#level-search").addEventListener("input",renderLevels);$("#difficulty-filter").addEventListener("change",renderLevels);
  $("#sort-filter").addEventListener("change",()=>{state.settings.sort=$("#sort-filter").value;saveSettings();renderSettings();renderLevels();});
  $("#settings-sort").addEventListener("change",()=>{state.settings.sort=$("#settings-sort").value;saveSettings();renderSettings();renderLevels();});
  $("#settings-compact").addEventListener("change",()=>{state.settings.compact=$("#settings-compact").checked;saveSettings();renderSettings();renderLevels();});
  $("#settings-show-ids").addEventListener("change",()=>{state.settings.showIds=$("#settings-show-ids").checked;saveSettings();renderSettings();renderLevels();});
  $("#reset-settings").onclick=()=>{state.settings={...defaultSettings};saveSettings();renderSettings();renderLevels();toast("Settings reset to defaults.");};
  $("#refresh-levels").onclick=()=>loadLevels().catch(showError);$("#refresh-rankings").onclick=()=>loadLevels().catch(showError);$("#refresh-admin").onclick=()=>loadAdmin().catch(showError);
  $("#level-search").addEventListener("keydown",e=>{if(e.key==="Escape"){e.target.value="";renderLevels();}});
  document.addEventListener("keydown",e=>{if(e.key==="/"&&!/input|textarea|select/i.test(document.activeElement.tagName)){e.preventDefault();$("#level-search").focus();}if(e.key==="Escape")closeModal();});
  renderSettings();
}
async function boot() {
  wire();
  if (!supabase) { indicator("Backend not configured",false); $("#level-rows").innerHTML=empty("Backend setup required","Set a Supabase URL and publishable key in app.js.");return; }
  try {
    await loadIdentity();
    supabase.auth.onAuthStateChange((event,session)=>{state.session=session;if(event==="PASSWORD_RECOVERY"){setTimeout(openPasswordReset,0);return;}setTimeout(async()=>{try{await loadIdentity();await loadLevels();}catch(e){showError(e);}},0);});
    await loadLevels();
    if (new URLSearchParams(window.location.search).get("admin") === "1") {
      if (isStaff()) switchTab("Admin");
      else toast("Sign in with an administrator or moderator account to open staff tools.", true);
    }
    if(state.session && state.role?.banned_at) toast("This account is banned: "+(state.role.ban_reason||"no reason provided"),true);
  } catch(e) { indicator("Connection issue",false); showError(e,"Could not connect to the WCL database."); $("#level-rows").innerHTML=empty("Could not load challenges","Check the Supabase connection and database setup."); }
}
boot();
