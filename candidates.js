// Awasthi Resume: candidate list (Supabase). Team login required.
(() => {
  "use strict";
  const cfg = window.AWASTHI_CONFIG || {};
  const section = document.getElementById("candidates");
  if (!section) return;
  const msg = (t, bad) => { const m = document.getElementById("c-msg"); m.textContent = t; m.classList.toggle("err", !!bad); };

  const $ = (id) => document.getElementById(id);
  const boot = $("boot"), loginScreen = $("login-screen"), app = $("app");
  const show = (which) => {
    boot.hidden = which !== "boot";
    loginScreen.hidden = which !== "login";
    app.hidden = which !== "app";
  };

  // No Supabase settings: no login, just the masking tool.
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) {
    section.hidden = true;
    show("app");
    return;
  }
  section.hidden = false;
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const LOGIN_DOMAIN = cfg.loginDomain || "awasthiresume.com";

  const form = $("c-form"), tbody = $("c-rows");
  let editingId = null, rows = [], searchTimer = null, user = null;

  // ------------------------------------------------------------ auth
  async function refreshAuth() {
    const { data } = await sb.auth.getSession();
    user = data.session ? data.session.user : null;
    if (!user) { show("login"); setTimeout(() => $("login-user").focus(), 0); return; }
    $("c-who").textContent = user.email;
    $("who-box").hidden = false;
    show("app");
    document.querySelectorAll(".to-candidates").forEach((b) => { b.hidden = false; });
    load();
  }
  $("pass-toggle").addEventListener("click", () => {
    const i = $("login-pass"), t = $("pass-toggle");
    const showing = i.type === "text";
    i.type = showing ? "password" : "text";
    t.textContent = showing ? "Dikhao" : "Lukao";
    t.setAttribute("aria-label", showing ? "Password dikhao" : "Password lukao");
  });
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const lm = $("login-msg"), btn = $("login-btn");
    let id = $("login-user").value.trim().toLowerCase();
    const pass = $("login-pass").value;
    if (!id || !pass) { lm.textContent = "User ID te password dovein bharo."; return; }
    if (!id.includes("@")) id = `${id}@${LOGIN_DOMAIN}`; // short user IDs like "rahul"
    lm.textContent = ""; btn.disabled = true; btn.textContent = "Login ho reha hai...";
    const { error } = await sb.auth.signInWithPassword({ email: id, password: pass });
    btn.disabled = false; btn.textContent = "Login";
    if (error) {
      lm.textContent = /fetch|network/i.test(error.message || "")
        ? "Internet naal judan vich dikkat hai. Thodi der baad try karo."
        : "User ID ja password galat hai.";
      return;
    }
    $("login-pass").value = "";
    refreshAuth();
  });
  $("c-logout").addEventListener("click", async () => {
    await sb.auth.signOut();
    rows = []; tbody.replaceChildren();
    $("who-box").hidden = true;
    refreshAuth();
  });

  // ------------------------------------------------------------ list
  async function load() {
    const q = $("c-search").value.trim().replace(/[%,()]/g, " ");
    const st = $("c-filter").value;
    let req = sb.from("candidates").select("*").order("created_at", { ascending: false }).limit(500);
    if (q) req = req.or(["name", "mobile", "email", "skills", "city", "post"].map((c) => `${c}.ilike.%${q}%`).join(","));
    if (st) req = req.eq("status", st);
    const { data, error } = await req;
    if (error) { msg(columnHint(error) || "List load nahi hoi: " + error.message, true); return; }
    rows = data;
    render();
  }
  const td = (text, cls) => { const c = document.createElement("td"); c.textContent = text == null ? "" : text; if (cls) c.className = cls; return c; };
  function render() {
    $("c-count").textContent = `${rows.length} candidate`;
    tbody.replaceChildren(...rows.map((r) => {
      const tr = document.createElement("tr");
      const status = td(""); const chip = document.createElement("span");
      chip.className = "chip st-" + r.status.toLowerCase().replace(/\s+/g, "-"); chip.textContent = r.status; status.append(chip);
      const act = td("");
      const edit = Object.assign(document.createElement("button"), { type: "button", className: "ghost small", textContent: "Edit" });
      edit.onclick = () => startEdit(r);
      const del = Object.assign(document.createElement("button"), { type: "button", className: "ghost small danger", textContent: "Delete" });
      del.onclick = async () => {
        if (del.dataset.armed !== "1") { del.dataset.armed = "1"; del.textContent = "Pakka?"; setTimeout(() => { del.dataset.armed = ""; del.textContent = "Delete"; }, 4000); return; }
        const { error } = await sb.from("candidates").delete().eq("id", r.id);
        if (error) msg("Delete nahi hoya: " + error.message, true); else { msg(`${r.name} hata ditta.`); load(); }
      };
      act.append(edit, del);
      tr.append(td(r.name, "strong"), td(r.mobile, "mono"), td(r.email, "mono small"), td(r.post), td(r.skills, "wrap"), td(r.city),
        td(r.experience_years != null ? r.experience_years + " saal" : ""), status, td(r.resume_file, "mono small"),
        td(new Date(r.created_at).toLocaleDateString("en-IN")), act);
      return tr;
    }));
    $("c-empty").hidden = rows.length > 0;
  }
  $("c-search").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(load, 300); });
  $("c-filter").addEventListener("change", load);

  // ------------------------------------------------------------ add / edit
  const fields = ["name", "mobile", "email", "post", "skills", "city", "experience_years", "status", "resume_file", "notes"];
  // the mobile/email columns come from supabase/002_add_mobile_email.sql
  const columnHint = (err) => /mobile|email/i.test(err && err.message || "") && /column|schema/i.test(err.message)
    ? "Supabase vich Mobile/Email de khaane hune nahi bane. supabase/002_add_mobile_email.sql wala SQL ikk vaari Run karo." : "";
  function startEdit(r) {
    editingId = r.id;
    fields.forEach((f) => { $("f-" + f).value = r[f] == null ? "" : r[f]; });
    $("c-save").textContent = "Badlav save karo";
    $("c-cancel").hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    $("f-name").focus();
  }
  function resetForm() {
    editingId = null; form.reset(); $("f-status").value = "New";
    $("c-save").textContent = "Candidate add karo"; $("c-cancel").hidden = true;
  }
  $("c-cancel").addEventListener("click", resetForm);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rec = {};
    fields.forEach((f) => { const v = $("f-" + f).value.trim(); rec[f] = v === "" ? null : v; });
    if (rec.experience_years != null) rec.experience_years = Number(rec.experience_years);
    if (!rec.name) { msg("Candidate da naam zaroori hai.", true); return; }
    $("c-save").disabled = true;
    const res = editingId
      ? await sb.from("candidates").update(rec).eq("id", editingId)
      : await sb.from("candidates").insert(rec);
    $("c-save").disabled = false;
    if (res.error) { msg(columnHint(res.error) || "Save nahi hoya: " + res.error.message, true); return; }
    msg(editingId ? `${rec.name} update ho gaya.` : `${rec.name} list vich add ho gaya.`);
    resetForm();
    load();
  });

  // fill the form from a masked resume (Download button, or "Candidate list vich pao")
  function prefill(d, scroll) {
    if (!user || !d) return;
    if (editingId) { msg("Pehlan chal rahi edit save ja cancel karo, phir resume di details bharangiyan.", true); return; }
    resetForm();
    ["name", "mobile", "email", "post", "city", "skills", "resume_file"].forEach((f) => { if (d[f]) $("f-" + f).value = d[f]; });
    if (d.experience_years != null) $("f-experience_years").value = d.experience_years;
    msg(`${d.name || "Candidate"} di details resume vichon bhar ditti. Ikk vaari check karke "Candidate add karo" dabao.`);
    if (scroll) { form.scrollIntoView({ behavior: "smooth", block: "start" }); $("f-name").focus(); }
  }
  document.addEventListener("resume-prefill", (e) => prefill(e.detail.details, e.detail.scroll));
  document.addEventListener("resume-masked", (e) => {
    const { card, details } = e.detail;
    const head = card.querySelector(".file-head");
    const b = Object.assign(document.createElement("button"), { type: "button", className: "ghost to-candidates", textContent: "Candidate list vich pao" });
    b.hidden = !user;
    b.onclick = () => prefill(details, true);
    head.append(b);
  });

  // session expired or logged out in another tab -> back to the login page
  // (never call supabase inside this callback directly; defer it)
  sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") setTimeout(refreshAuth, 0); });
  refreshAuth();
})();
