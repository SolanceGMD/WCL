import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const cfg = window.WCL_CONFIG || {};
const supabase = cfg.supabaseUrl && cfg.supabaseKey ? createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { session: null, profile: null, role: null, levels: [], rankings: [], activeTab: "Levels", adminTab: "queue", detailLevel: null, permissions: {} };
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
  const { data, error } = await supabase.from("levels").select("id,name,creator,description,points,difficulty,length,youtube_url,thumbnail_url,status,created_at,updated_at").eq("status", "published").order("points", { ascending: false });
  if (error) throw error;
  state.levels = data || [];
  renderLevels(); renderStats(); indicator("Connected to WCL");
  const { data: people, error: peopleError } = await supabase.from("profiles").select("id,gd_username,points,created_at").order("points", { ascending: false }).limit(100);
  if (!peopleError) { state.rankings = people || []; renderRankings(); }
  const { count: completions } = await supabase.from("completion_submissions").select("id", { count: "exact", head: true }).eq("status", "approved");
  const totalPoints = state.rankings.reduce((n,p) => n + Number(p.points || 0), 0);
  $("#stat-completions").textContent = completions ?? "—";
  $("#stat-points").textContent = totalPoints.toLocaleString();
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
  let rows = state.levels.filter(l => (l.name + " " + l.creator).toLowerCase().includes(search) && (diff === "All difficulties" || l.difficulty === diff));
  if (sort === "points") rows.sort((a,b) => b.points-a.points);
  else if (sort === "name") rows.sort((a,b) => a.name.localeCompare(b.name));
  else if (sort === "newest") rows.sort((a,b) => new Date(b.created_at)-new Date(a.created_at));
  else rows.sort((a,b) => b.points-a.points);
  $("#level-count").textContent = rows.length;
  $("#list-footer-count").innerHTML = 'Showing <b>' + rows.length + '</b> of <b>' + state.levels.length + '</b> published challenges';
  if (!rows.length) { $("#level-rows").innerHTML = empty("No challenges found", state.levels.length ? "Try a different search or difficulty filter." : "Be the first to submit a challenge."); return; }
  $("#level-rows").innerHTML = rows.map((l,i) => {
    const thumb = thumbnail(l.youtube_url);
    const colors = ["", "thumb-blue", "thumb-pink", "thumb-green", "thumb-orange", "thumb-cyan"];
    return '<article class="level-row"><div class="level-main"><span class="rank-number ' + (i<3 ? "rank-top" : "") + '">' + String(i+1).padStart(2,"0") + '</span><div class="level-thumb ' + colors[i%colors.length] + '">' + (thumb ? '<img src="' + escapeHtml(thumb) + '" alt="" loading="lazy" onerror="this.remove()">' : '<span class="thumb-mesh"></span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h4l3-7 4 14 3-7h2"/></svg>') + '</div><div class="level-info"><h3>' + escapeHtml(l.name) + '</h3><span>by <b>' + escapeHtml(l.creator) + '</b><i class="meta-dot"></i>' + escapeHtml(l.length || "Unrated") + '</span></div></div><div><span class="difficulty-pill ' + difficultyClass(l.difficulty) + '"><span></span>' + escapeHtml(l.difficulty) + '</span></div><div class="points-value">' + Number(l.points).toLocaleString() + ' <small>pts</small></div><div><span class="status-verified">✓ Verified</span></div><button class="row-arrow" data-level="' + l.id + '" aria-label="View ' + escapeHtml(l.name) + '">↗</button></article>';
  }).join("");
  $$("[data-level]").forEach(button => button.addEventListener("click", () => openLevel(button.dataset.level)));
}
function renderRankings() {
  if (!state.rankings.length) { $("#leaderboard").innerHTML = empty("No players yet", "Create an account and start earning points."); return; }
  $("#leaderboard").innerHTML = state.rankings.map((p,i) => '<div class="leader-row"><span class="rank-number ' + (i<3 ? "rank-top" : "") + '">' + String(i+1).padStart(2,"0") + '</span><span class="leader-avatar">' + escapeHtml((p.gd_username||"?").slice(0,1).toUpperCase()) + '</span><b>' + escapeHtml(p.gd_username) + (p.id===state.session?.user?.id ? ' <small>(you)</small>' : '') + '</b><span class="leader-runs">' + (i===0 ? "Top player" : "Wave player") + '</span><strong>' + Number(p.points||0).toLocaleString() + ' <small>pts</small></strong></div>').join("");
}
function switchTab(tab) {
  state.activeTab = tab;
  $$(".nav-link[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  ["Levels","Rankings","Submissions","About","Admin"].forEach(name => $("#view-" + name.toLowerCase()).classList.toggle("hidden", name !== tab));
  $("#main-nav").classList.remove("nav-open");
  if (tab === "Admin") loadAdmin().catch(showError);
  if (tab === "Submissions") loadMySubmissions().catch(showError);
}
function openAuth(mode = "signin") {
  const signup = mode === "signup";
  modal('<button class="icon-button modal-close" aria-label="Close">×</button><div class="modal-icon">♙</div><div class="eyebrow section-eyebrow">PLAYER ACCOUNT</div><h2>' + (signup ? "Join the wave." : "Welcome back.") + '</h2><p class="modal-description">' + (signup ? "Create your account to submit levels, prove completions, and track points." : "Sign in to manage submissions and see your player account.") + '</p><form id="auth-form">' + (signup ? '<label class="field-label">Geometry Dash username<input name="gd_username" minlength="1" maxlength="32" required placeholder="Your GD username"></label>' : '') + '<label class="field-label">Email address<input type="email" name="email" autocomplete="email" required placeholder="you@example.com"></label><label class="field-label">Password<input type="password" name="password" minlength="8" autocomplete="' + (signup ? "new-password" : "current-password") + '" required placeholder="At least 8 characters"></label><button class="button button-primary modal-submit" type="submit">' + (signup ? "Create account" : "Sign in") + '</button></form><p class="modal-description" style="margin:16px 0 0">' + (signup ? 'Already registered? <button type="button" class="text-link" id="switch-auth">Sign in</button>' : 'New to WCL? <button type="button" class="text-link" id="switch-auth">Create an account</button>') + '</p>');
  $("#switch-auth").onclick = () => openAuth(signup ? "signin" : "signup");
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
function openAccount() {
  if (!state.session) return openAuth("signin");
  modal('<button class="icon-button modal-close" aria-label="Close">×</button><div class="modal-icon">♙</div><div class="eyebrow section-eyebrow">YOUR ACCOUNT</div><h2>' + escapeHtml(state.profile?.gd_username || "Player") + '</h2><p class="modal-description">' + escapeHtml(state.session.user.email || "") + '<br>Member since ' + fmtDate(state.profile?.created_at) + '</p><div class="about-grid"><div><h3>Points</h3><p>' + Number(state.profile?.points||0).toLocaleString() + '</p></div><div><h3>Role</h3><p>' + escapeHtml(state.role?.role || "player") + '</p></div></div>' + (state.role?.banned_at ? '<p class="notice">Account banned: ' + escapeHtml(state.role.ban_reason || "No reason provided") + '</p>' : '') + '<button class="button button-outline modal-submit" id="signout-button">Sign out</button>');
  $("#signout-button").onclick = async () => { const {error}=await supabase.auth.signOut(); if(error) return showError(error); state.session=null;state.profile=null;state.role=null;closeModal();renderIdentity();await loadLevels();toast("Signed out."); };
}
function openLevel(id) {
  const l = state.levels.find(x => x.id === id); if (!l) return;
  state.detailLevel = l;
  const thumb = thumbnail(l.youtube_url);
  modal('<button class="icon-button modal-close" aria-label="Close">×</button>' + (thumb ? '<img class="detail-image" src="' + escapeHtml(thumb) + '" alt="" onerror="this.style.display=\'none\'">' : '<div class="modal-icon">ϟ</div>') + '<div class="eyebrow section-eyebrow">WAVE CHALLENGE</div><h2>' + escapeHtml(l.name) + '</h2><p class="modal-description">Created by <b>' + escapeHtml(l.creator) + '</b> · ' + escapeHtml(l.difficulty) + ' · ' + escapeHtml(l.length || "Unrated") + '</p><p class="detail-description">' + escapeHtml(l.description || "No description provided.") + '</p><div class="detail-reward">' + Number(l.points).toLocaleString() + ' <small>points on approved completion</small></div>' + youtubeLink(l.youtube_url) + '<button class="button button-primary modal-submit" id="prove-level">Submit completion proof</button>');
  $("#prove-level").onclick = () => openCompletion(l.id);
}
function openLevelSubmission() {
  if (!requireUser()) return;
  modal('<button class="icon-button modal-close" aria-label="Close">×</button><div class="modal-icon">＋</div><div class="eyebrow section-eyebrow">COMMUNITY SUBMISSION</div><h2>Submit a level</h2><p class="modal-description">A moderator reviews every level before it appears on the public list. Suggested points are a recommendation, not an automatic reward.</p><form id="level-submit-form"><label class="field-label">Level name<input name="name" required maxlength="100" placeholder="e.g. Neon Skyline"></label><div class="form-grid"><label class="field-label">Level creator<input name="creator" required maxlength="80" placeholder="Creator username"></label><label class="field-label">Suggested points<input type="number" name="suggested_points" min="0" max="1000000" value="10" required></label></div><div class="form-grid"><label class="field-label">Difficulty<select name="difficulty"><option>Unrated</option><option>Easy</option><option>Medium</option><option>Hard</option><option>Insane</option><option>Extreme</option></select></label><label class="field-label">Length<select name="length"><option>Unrated</option><option>Short</option><option>Medium</option><option>Long</option><option>XL</option></select></label></div><label class="field-label">YouTube showcase URL<input type="url" name="youtube_url" placeholder="https://youtube.com/watch?v=…"></label><label class="field-label">Description<textarea name="description" maxlength="2000" rows="3" placeholder="What makes this challenge special?"></textarea></label><button class="button button-primary modal-submit" type="submit">Send for review</button></form>');
  $("#level-submit-form").onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    const payload = { submitter_id: state.session.user.id, name: String(fd.get("name")).trim(), creator: String(fd.get("creator")).trim(), suggested_points: Number(fd.get("suggested_points")), difficulty: fd.get("difficulty"), length: fd.get("length"), youtube_url: String(fd.get("youtube_url")||"").trim() || null, description: String(fd.get("description")||"").trim(), status:"pending" };
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
  const [levels,runs]=await Promise.all([supabase.from("level_submissions").select("*,profiles:submitter_id(gd_username)").eq("status","pending").order("created_at"),supabase.from("completion_submissions").select("*,levels(name,points),profiles:submitter_id(gd_username)").eq("status","pending").order("created_at")]);
  if(levels.error)throw levels.error;if(runs.error)throw runs.error;
  let html='<h3 class="subsection-title">Pending level submissions ('+levels.data.length+')</h3>';
  html+=levels.data.map(s=>'<article class="admin-card"><div><b>'+escapeHtml(s.name)+'</b><small>by '+escapeHtml(s.creator)+' · submitted by '+escapeHtml(s.profiles?.gd_username||"player")+' · suggested '+s.suggested_points+' pts</small><p>'+escapeHtml(s.description||"No description")+'</p>'+(s.youtube_url?youtubeLink(s.youtube_url):'')+'</div><div class="admin-actions"><button class="button button-primary" data-approve-level="'+s.id+'">Approve</button><button class="button button-outline" data-reject-level="'+s.id+'">Reject</button></div></article>').join("")||empty("No level submissions","The level review queue is clear.");
  html+='<h3 class="subsection-title">Pending completion proofs ('+runs.data.length+')</h3>';
  html+=runs.data.map(s=>'<article class="admin-card"><div><b>'+escapeHtml(s.levels?.name||"Challenge")+'</b><small>by '+escapeHtml(s.profiles?.gd_username||"player")+' · reward '+Number(s.levels?.points||0)+' pts</small><a href="'+escapeHtml(s.proof_url)+'" target="_blank" rel="noreferrer">Watch proof video ↗</a></div><div class="admin-actions"><button class="button button-primary" data-approve-run="'+s.id+'">Approve +'+Number(s.levels?.points||0)+' pts</button><button class="button button-outline" data-reject-run="'+s.id+'">Reject</button></div></article>').join("")||empty("No completion proofs","The completion review queue is clear.");
  $("#admin-panel").innerHTML=html;
  $$("[data-approve-level]").forEach(b=>b.onclick=()=>reviewLevel(b.dataset.approveLevel,"approved"));
  $$("[data-reject-level]").forEach(b=>b.onclick=()=>reviewLevel(b.dataset.rejectLevel,"rejected"));
  $$("[data-approve-run]").forEach(b=>b.onclick=()=>reviewRun(b.dataset.approveRun,"approved"));
  $$("[data-reject-run]").forEach(b=>b.onclick=()=>reviewRun(b.dataset.rejectRun,"rejected"));
}
async function reviewLevel(id,status) {
  if(!hasPermission("submissions.review"))return toast("Missing review permission.",true);
  const note = status==="rejected" ? prompt("Reason for rejection (optional):") : "";
  if(status==="rejected"&&note===null)return;
  const {data:s,error}=await supabase.from("level_submissions").select("*").eq("id",id).single();if(error)return showError(error);
  if(status==="approved") {
    const {error:insertError}=await supabase.from("levels").insert({name:s.name,creator:s.creator,description:s.description,points:s.suggested_points,difficulty:s.difficulty,length:s.length,youtube_url:s.youtube_url,status:"published",created_by:s.submitter_id});
    if(insertError)return showError(insertError);
  }
  const {error:updateError}=await supabase.from("level_submissions").update({status,reviewer_id:state.session.user.id,reviewed_at:new Date().toISOString(),review_note:note||null}).eq("id",id);
  if(updateError)return showError(updateError);
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
  const {data,error}=await supabase.from("levels").select("*").order("created_at",{ascending:false});if(error)throw error;
  $("#admin-panel").innerHTML='<div class="admin-toolbar"><p class="modal-description">Edit point rewards, difficulty and YouTube links. Remove is reversible; removed levels can be restored.</p><button class="button button-primary" id="new-level-admin">＋ Add level</button></div>'+data.map(l=>'<article class="admin-card"><div><b>'+escapeHtml(l.name)+'</b><small>'+escapeHtml(l.creator)+' · '+Number(l.points)+' pts · '+escapeHtml(l.status)+'</small>'+(l.youtube_url?youtubeLink(l.youtube_url):'')+'</div><div class="admin-actions"><button class="button button-outline" data-edit-level="'+l.id+'">Edit</button><button class="button button-outline" data-toggle-level="'+l.id+'" data-status="'+l.status+'">'+(l.status==="published"?"Remove":"Restore")+'</button></div></article>').join("")||empty("No levels","Approved or add a level to start the list.");
  $("#new-level-admin").onclick=()=>editLevel(null);
  $$("[data-edit-level]").forEach(b=>b.onclick=()=>editLevel(data.find(l=>l.id===b.dataset.editLevel)));
  $$("[data-toggle-level]").forEach(b=>b.onclick=async()=>{const next=b.dataset.status==="published"?"removed":"published";const {error}=await supabase.from("levels").update({status:next,updated_at:new Date().toISOString()}).eq("id",b.dataset.toggleLevel);if(error)return showError(error);toast("Level "+next+".");await loadAdmin();await loadLevels();});
}
function editLevel(l) {
  modal('<button class="icon-button modal-close" aria-label="Close">×</button><div class="eyebrow section-eyebrow">LEVEL MANAGEMENT</div><h2>'+(l?"Edit challenge":"Add challenge")+'</h2><form id="edit-level-form"><label class="field-label">Level name<input name="name" required maxlength="100" value="'+escapeHtml(l?.name||"")+'"></label><label class="field-label">Creator<input name="creator" required maxlength="80" value="'+escapeHtml(l?.creator||"")+'"></label><label class="field-label">Description<textarea name="description" rows="3" maxlength="2000">'+escapeHtml(l?.description||"")+'</textarea></label><div class="form-grid"><label class="field-label">Points<input type="number" name="points" min="0" max="1000000" required value="'+Number(l?.points||0)+'"></label><label class="field-label">Difficulty<select name="difficulty">'+["Unrated","Easy","Medium","Hard","Insane","Extreme"].map(d=>'<option '+(l?.difficulty===d?"selected":"")+'>'+d+'</option>').join("")+'</select></label></div><div class="form-grid"><label class="field-label">Length<select name="length">'+["Unrated","Short","Medium","Long","XL"].map(d=>'<option '+(l?.length===d?"selected":"")+'>'+d+'</option>').join("")+'</select></label><label class="field-label">Status<select name="status">'+["published","draft","removed"].map(d=>'<option '+((l?.status||"published")===d?"selected":"")+'>'+d+'</option>').join("")+'</select></label></div><label class="field-label">YouTube URL<input type="url" name="youtube_url" value="'+escapeHtml(l?.youtube_url||"")+'"></label><button class="button button-primary modal-submit" type="submit">Save challenge</button></form>');
  $("#edit-level-form").onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),payload={name:String(fd.get("name")).trim(),creator:String(fd.get("creator")).trim(),description:String(fd.get("description")||"").trim(),points:Number(fd.get("points")),difficulty:fd.get("difficulty"),length:fd.get("length"),status:fd.get("status"),youtube_url:String(fd.get("youtube_url")||"").trim()||null,updated_at:new Date().toISOString()};if(payload.youtube_url&&!youtubeId(payload.youtube_url))return toast("Enter a valid YouTube video URL.",true);const result=l?await supabase.from("levels").update(payload).eq("id",l.id):await supabase.from("levels").insert({...payload,created_by:state.session.user.id});if(result.error)return showError(result.error);closeModal();toast("Challenge saved.");await loadAdmin();await loadLevels();};
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
  modal('<button class="icon-button modal-close" aria-label="Close">×</button><div class="eyebrow section-eyebrow">USER & ROLE MANAGEMENT</div><h2>'+escapeHtml(profile.gd_username||"Player")+'</h2><p class="modal-description">'+escapeHtml(role.user_id)+'</p><form id="manage-user-form"><label class="field-label">Role<select name="role">'+["player","moderator","admin"].map(r=>'<option '+(role.role===r?"selected":"")+'>'+r+'</option>').join("")+'</select></label><div class="permission-list"><b>Moderator permissions</b>'+permissions.map(p=>'<label><input type="checkbox" name="perm:'+p+'" '+(role.permissions?.[p]===true?"checked":"")+'> '+escapeHtml(p)+'</label>').join("")+'</div><label class="field-label">Ban reason (leave blank to unban)<textarea name="ban_reason" rows="2">'+escapeHtml(role.ban_reason||"")+'</textarea></label><button class="button button-primary modal-submit" type="submit">Save permissions</button></form>');
  $("#manage-user-form").onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),perms={};permissions.forEach(p=>perms[p]=fd.get("perm:"+p)==="on");const banReason=String(fd.get("ban_reason")||"").trim();const payload={role:fd.get("role"),permissions:perms,banned_at:banReason?new Date().toISOString():null,ban_reason:banReason||null,updated_at:new Date().toISOString()};const {error}=await supabase.from("user_roles").update(payload).eq("user_id",role.user_id);if(error)return showError(error);closeModal();toast("User permissions saved.");await loadAdmin();};
}
async function renderAdminAudit() {
  if(!hasPermission("audit.view")){$("#admin-panel").innerHTML=empty("Missing permission","Your account does not have audit.view.");return;}
  const {data,error}=await supabase.from("audit_logs").select("id,actor_id,action,target_type,target_id,details,created_at").order("created_at",{ascending:false}).limit(100);if(error)throw error;
  $("#admin-panel").innerHTML='<p class="modal-description">Most recent 100 audited changes.</p>'+(data||[]).map(a=>'<article class="admin-card audit-card"><div><b>'+escapeHtml(a.action.toUpperCase())+' · '+escapeHtml(a.target_type)+'</b><small>'+fmtDate(a.created_at)+' · actor '+escapeHtml(a.actor_id||"system")+' · target '+escapeHtml(a.target_id||"—")+'</small><details><summary>View event details</summary><pre>'+escapeHtml(JSON.stringify(a.details,null,2))+'</pre></details></div></article>').join("")||empty("No audit events","Changes to levels, submissions and user roles will be recorded here.");
}

function wire() {
  $$(".nav-link[data-tab]").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  $("#mobile-menu").onclick=()=>$("#main-nav").classList.toggle("nav-open");
  $("#auth-button").onclick=openAccount;$("#footer-auth").onclick=openAccount;
  $("#submit-level-top").onclick=openLevelSubmission;$("#submit-level-hero").onclick=openLevelSubmission;$("#submit-level-card").onclick=openLevelSubmission;$("#submit-completion-card").onclick=()=>openCompletion();$("#submit-completion-footer").onclick=()=>openCompletion();$("#cta-submit").onclick=()=>state.session?openLevelSubmission():openAuth("signup");
  $("#explore-button").onclick=()=>{$("#view-levels").scrollIntoView({behavior:"smooth"});switchTab("Levels");};
  $("#level-search").addEventListener("input",renderLevels);$("#difficulty-filter").addEventListener("change",renderLevels);$("#sort-filter").addEventListener("change",renderLevels);
  $("#refresh-levels").onclick=()=>loadLevels().catch(showError);$("#refresh-rankings").onclick=()=>loadLevels().catch(showError);$("#refresh-admin").onclick=()=>loadAdmin().catch(showError);
  $("#level-search").addEventListener("keydown",e=>{if(e.key==="Escape"){e.target.value="";renderLevels();}});
  document.addEventListener("keydown",e=>{if(e.key==="/"&&!/input|textarea|select/i.test(document.activeElement.tagName)){e.preventDefault();$("#level-search").focus();}if(e.key==="Escape")closeModal();});
}
async function boot() {
  wire();
  if (!supabase) { indicator("Backend not configured",false); $("#level-rows").innerHTML=empty("Backend setup required","Set a Supabase URL and publishable key in app.js.");return; }
  try {
    await loadIdentity();
    supabase.auth.onAuthStateChange((_event,session)=>{state.session=session;setTimeout(async()=>{try{await loadIdentity();await loadLevels();}catch(e){showError(e);}},0);});
    await loadLevels();
    if(state.session && state.role?.banned_at) toast("This account is banned: "+(state.role.ban_reason||"no reason provided"),true);
  } catch(e) { indicator("Connection issue",false); showError(e,"Could not connect to the WCL database."); $("#level-rows").innerHTML=empty("Could not load challenges","Check the Supabase connection and database setup."); }
}
boot();
