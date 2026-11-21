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
    t.textContent = showing ? "Show" : "Hide";
    t.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  });
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const lm = $("login-msg"), btn = $("login-btn");
    let id = $("login-user").value.trim().toLowerCase();
    const pass = $("login-pass").value;
    if (!id || !pass) { lm.textContent = "Enter both your user ID and password."; return; }
    if (!id.includes("@")) id = `${id}@${LOGIN_DOMAIN}`; // short user IDs like "rahul"
    lm.textContent = ""; btn.disabled = true; btn.textContent = "Logging in...";
    const { error } = await sb.auth.signInWithPassword({ email: id, password: pass });
    btn.disabled = false; btn.textContent = "Login";
    if (error) {
      lm.textContent = /fetch|network/i.test(error.message || "")
        ? "Could not connect to the internet. Please try again in a moment."
        : "Wrong user ID or password.";
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

  const fmtDate = (d) => { if (!d) return ""; const x = new Date(d.length === 10 ? d + "T00:00:00" : d); return isNaN(x) ? d : x.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }); };

  // ------------------------------------------------------------ payment due date and delay
  const PAY_DAYS = Number(cfg.paymentDays ?? 60);
  const DAY = 86400000;
  const dateOnly = (d) => { const x = new Date(d); return new Date(x.getFullYear(), x.getMonth(), x.getDate()); };
  const parseDay = (s) => (s ? dateOnly(s.length === 10 ? s + "T00:00:00" : s) : null);
  const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // { due, status: "Paid" | "Overdue" | "Not due", delay (days late, 0 if none), left (days to due) }
  function payment(r) {
    const doj = parseDay(r.doj);
    if (!doj) return null;
    const due = new Date(doj.getTime() + PAY_DAYS * DAY);
    const paid = parseDay(r.payment_date);
    const today = dateOnly(new Date());
    if (paid) return { due, status: "Paid", delay: Math.max(0, Math.round((paid - due) / DAY)), left: 0, paid };
    const late = Math.round((today - due) / DAY);
    return late > 0 ? { due, status: "Overdue", delay: late, left: 0 } : { due, status: "Not due", delay: 0, left: -late };
  }
  const delayText = (p) => !p ? "" : p.status === "Paid" ? (p.delay ? `Paid ${p.delay} day${p.delay === 1 ? "" : "s"} late` : "Paid on time")
    : p.status === "Overdue" ? `${p.delay} day${p.delay === 1 ? "" : "s"} late` : `Due in ${p.left} day${p.left === 1 ? "" : "s"}`;
  function recalcPayment() {
    const p = payment({ doj: $("f-doj").value, payment_date: $("f-payment_date").value });
    $("f-due_date").value = p ? fmtDate(isoDay(p.due)) : "";
    $("f-delay").value = delayText(p);
    $("f-delay").closest(".delay-box").classList.toggle("is-late", !!p && p.delay > 0);
  }
  document.querySelectorAll(".pay-days").forEach((e) => { e.textContent = PAY_DAYS; });
  $("f-doj").addEventListener("input", recalcPayment);
  $("f-payment_date").addEventListener("input", recalcPayment);

  // ------------------------------------------------------------ reports (the rows on screen)
  // column: [heading, value(row, index), Excel width, kind] - kind "num" = rupees (summed), "int" = whole number
  const REPORT_COLS = [
    ["S.No", (r, i) => i + 1, 6], ["Name", (r) => r.name, 22], ["Mobile", (r) => r.mobile, 16], ["Email", (r) => r.email, 28],
    ["Post", (r) => r.post, 20], ["City", (r) => r.city, 14], ["Exp (yrs)", (r) => r.experience_years, 9, "int"], ["Status", (r) => r.status, 13],
    ["Company", (r) => r.company, 22], ["HR Name", (r) => r.hr_name, 18], ["DOJ", (r) => fmtDate(r.doj), 12],
    ["Monthly salary", (r) => r.monthly_salary, 14, "num"], ["Annual salary", (r) => r.annual_salary, 14, "num"],
    ["Bill amount", (r) => r.bill_amount, 13, "num"], ["GST", (r) => r.gst_amount, 11, "num"], ["Total bill", (r) => r.total_bill, 13, "num"],
    ["Bill No", (r) => r.bill_no, 14], ["Added on", (r) => fmtDate(r.created_at), 12], ["Notes", (r) => r.notes, 30],
  ];
  const PAY_COLS = [
    ["S.No", (r, i) => i + 1, 6], ["Bill No", (r) => r.bill_no, 16], ["Candidate", (r) => r.name, 22], ["Company", (r) => r.company, 24],
    ["HR Name", (r) => r.hr_name, 18], ["DOJ", (r) => fmtDate(r.doj), 12], ["Payment due", (r) => r._p ? fmtDate(isoDay(r._p.due)) : "", 13],
    ["Total bill", (r) => r.total_bill, 14, "num"], ["Payment status", (r) => r._p ? r._p.status : "", 15],
    ["Received on", (r) => fmtDate(r.payment_date), 13], ["Delay (days)", (r) => r._p ? r._p.delay : "", 12, "int"],
    ["Pending amount", (r) => r._p && r._p.status !== "Paid" ? r.total_bill : null, 15, "num"],
  ];
  const stamp = () => new Date().toISOString().slice(0, 10);
  const filterLabel = () => {
    const q = $("c-search").value.trim(), st = $("c-filter").value;
    return [st ? `Status: ${st}` : "", q ? `Search: "${q}"` : ""].filter(Boolean).join(" · ") || "All candidates";
  };
  const saveFile = (name, blob) => (window.AwasthiSave ? window.AwasthiSave(name, blob) : null);
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const billRows = () => rows.filter((r) => r.bill_no)
    .map((r) => ({ ...r, _p: payment(r) }))
    .sort((a, b) => ((b._p ? b._p.delay : -1) - (a._p ? a._p.delay : -1)) || String(a.bill_no).localeCompare(String(b.bill_no)));

  async function makeXlsx(sheetName, cols, data) {
    const x = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
    const colName = (n) => { let s = ""; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
    const cell = (ci, ri, v, style) => {
      const ref = colName(ci) + ri, st = style ? ` s="${style}"` : "";
      if (v === null || v === undefined || v === "") return `<c r="${ref}"${st}/>`;
      if (typeof v === "number") return `<c r="${ref}"${st}><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${x(v)}</t></is></c>`;
    };
    const head = `<row r="1">${cols.map(([h], ci) => cell(ci, 1, h, 1)).join("")}</row>`;
    const body = data.map((r, i) => `<row r="${i + 2}">${cols.map(([, f, , kind], ci) => {
      let v = f(r, i); if (kind && v !== null && v !== undefined && v !== "") v = Number(v);
      return cell(ci, i + 2, v, kind === "num" ? 2 : 0);
    }).join("")}</row>`).join("");
    const tr = data.length + 2;
    const totals = `<row r="${tr}">${cols.map(([, , , kind], ci) => {
      const ref = colName(ci) + tr;
      if (ci === 1) return `<c r="${ref}" t="inlineStr" s="3"><is><t>Total</t></is></c>`;
      if (kind === "num") return `<c r="${ref}" s="4"><f>SUM(${colName(ci)}2:${colName(ci)}${tr - 1})</f></c>`;
      return `<c r="${ref}" s="3"/>`;
    }).join("")}</row>`;
    const last = colName(cols.length - 1) + (data.length + 1);
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols.map(([, , w], i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${head}${body}${totals}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;
    const zip = new JSZip();
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
    zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    const abs = last.replace(/^([A-Z]+)(\d+)$/, "$$$1$$$2");
    zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${x(sheetName)}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${x(sheetName)}'!$A$1:${abs}</definedName></definedNames></workbook>`);
    zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    zip.file("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="[$₹-4009]#,##,##0.00"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F2A4A"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/></cellXfs></styleSheet>`);
    zip.file("xl/worksheets/sheet1.xml", sheet);
    return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  function makePdf(title, subtitle, cols, data) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight();
    const footer = (window.AWASTHI_CONFIG && window.AWASTHI_CONFIG.footerText) || "";
    const rs = (n) => (n === null || n === undefined || n === "") ? "" : "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.setTextColor(15, 42, 74);
    pdf.text(title, 36, 40);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(90, 100, 115);
    pdf.text(subtitle, 36, 56);
    const values = data.map((r, i) => cols.map(([, f, , kind]) => { const v = f(r, i); return kind === "num" ? rs(v) : (v === null || v === undefined ? "" : String(v)); }));
    const sums = cols.map(([, f, , kind], ci) => ci === 1 ? "Total" : kind === "num" ? rs(data.reduce((t, r, i) => t + (Number(f(r, i)) || 0), 0)) : "");
    pdf.autoTable({
      startY: 68, margin: { left: 36, right: 36, bottom: 40 },
      head: [cols.map(([h]) => h)], body: values, foot: [sums], showFoot: "lastPage",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 4, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: [15, 42, 74], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [228, 244, 236], textColor: [24, 121, 78], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [244, 246, 249] },
      columnStyles: Object.fromEntries(cols.map(([, , , kind], i) => [i, i === 0 ? { cellWidth: 26 } : kind ? { halign: "right" } : {}])),
      didParseCell: (h) => { if (h.section === "body" && cols[h.column.index][0] === "Payment status" && h.cell.raw === "Overdue") { h.cell.styles.textColor = [208, 0, 0]; h.cell.styles.fontStyle = "bold"; } },
      didDrawPage: () => {
        pdf.setFontSize(8); pdf.setTextColor(120);
        pdf.text(`Page ${pdf.internal.getNumberOfPages()}`, W - 36, H - 18, { align: "right" });
        if (footer) { pdf.setTextColor(208, 0, 0); pdf.setFont("helvetica", "bold"); pdf.text(footer, W / 2, H - 18, { align: "center" }); pdf.setFont("helvetica", "normal"); }
      },
    });
    return pdf.output("blob");
  }

  async function excelReport() {
    if (!rows.length) { msg("There are no candidates in the list to export.", true); return; }
    await saveFile(`Candidate_Tracker_${stamp()}.xlsx`, await makeXlsx("Candidate Tracker", REPORT_COLS, rows));
    msg(`Excel report with ${plural(rows.length, "candidate")} downloaded.`);
  }
  async function pdfReport() {
    if (!rows.length) { msg("There are no candidates in the list to export.", true); return; }
    const keep = ["S.No", "Name", "Mobile", "Post", "City", "Status", "Company", "DOJ", "Monthly salary", "Annual salary", "Bill amount", "GST", "Total bill"];
    const sub = `Awasthi HR Associates  ·  ${filterLabel()}  ·  ${plural(rows.length, "candidate")}  ·  Generated ${fmtDate(new Date().toISOString())}`;
    await saveFile(`Candidate_Tracker_${stamp()}.pdf`, makePdf("Candidate Tracker", sub, REPORT_COLS.filter(([h]) => keep.includes(h)), rows));
    msg(`PDF report with ${plural(rows.length, "candidate")} downloaded.`);
  }
  function paySummary(data) {
    const overdue = data.filter((r) => r._p && r._p.status === "Overdue");
    const pending = data.filter((r) => r._p && r._p.status !== "Paid").reduce((t, r) => t + (Number(r.total_bill) || 0), 0);
    return `${plural(data.length, "bill")}  ·  ${overdue.length} overdue  ·  Pending Rs ${pending.toLocaleString("en-IN", { maximumFractionDigits: 2 })}  ·  Due ${PAY_DAYS} days after DOJ`;
  }
  async function paymentExcel() {
    const data = billRows();
    if (!data.length) { msg("No candidates with a bill number in the list. Add the bill number for selected candidates first.", true); return; }
    await saveFile(`Payment_Report_${stamp()}.xlsx`, await makeXlsx("Payment Report", PAY_COLS, data));
    msg(`Payment report (Excel) with ${plural(data.length, "bill")} downloaded.`);
  }
  async function paymentPdf() {
    const data = billRows();
    if (!data.length) { msg("No candidates with a bill number in the list. Add the bill number for selected candidates first.", true); return; }
    const sub = `Awasthi HR Associates  ·  ${paySummary(data)}  ·  Generated ${fmtDate(new Date().toISOString())}`;
    await saveFile(`Payment_Report_${stamp()}.pdf`, makePdf("Payment Report (bill-wise)", sub, PAY_COLS, data));
    msg(`Payment report (PDF) with ${plural(data.length, "bill")} downloaded.`);
  }
  $("r-xlsx").addEventListener("click", excelReport);
  $("r-pdf").addEventListener("click", pdfReport);
  $("p-xlsx").addEventListener("click", paymentExcel);
  $("p-pdf").addEventListener("click", paymentPdf);

  // ------------------------------------------------------------ list
  async function load() {
    const q = $("c-search").value.trim().replace(/[%,()]/g, " ");
    const st = $("c-filter").value;
    let req = sb.from("candidates").select("*").order("created_at", { ascending: false }).limit(500);
    if (q) req = req.or(["name", "mobile", "email", "skills", "city", "post", "company", "hr_name"].map((c) => `${c}.ilike.%${q}%`).join(","));
    if (st) req = req.eq("status", st);
    const { data, error } = await req;
    if (error) { msg(columnHint(error) || "Could not load the list: " + error.message, true); return; }
    rows = data;
    render();
  }
  const td = (text, cls) => { const c = document.createElement("td"); c.textContent = text == null ? "" : text; if (cls) c.className = cls; return c; };
  function render() {
    $("c-count").textContent = `${rows.length} candidate${rows.length === 1 ? "" : "s"}`;
    tbody.replaceChildren(...rows.map((r) => {
      const tr = document.createElement("tr");
      const status = td(""); const chip = document.createElement("span");
      chip.className = "chip st-" + r.status.toLowerCase().replace(/\s+/g, "-"); chip.textContent = r.status; status.append(chip);
      if (r.doj) status.append(Object.assign(document.createElement("span"), { className: "doj", textContent: "DOJ " + fmtDate(r.doj) }));
      if (r.total_bill) status.append(Object.assign(document.createElement("span"), { className: "bill", textContent: "Bill " + money(r.total_bill) }));
      const pay = r.status === "Selected" ? payment(r) : null;
      if (pay && pay.status === "Overdue") status.append(Object.assign(document.createElement("span"), { className: "late", textContent: `Payment ${pay.delay} day${pay.delay === 1 ? "" : "s"} late` }));
      else if (pay && pay.status === "Paid") status.append(Object.assign(document.createElement("span"), { className: "doj", textContent: "Payment received" }));
      const act = td("");
      const edit = Object.assign(document.createElement("button"), { type: "button", className: "ghost small icon", textContent: "✎", title: "Edit", ariaLabel: "Edit " + r.name });
      edit.onclick = () => startEdit(r);
      const del = Object.assign(document.createElement("button"), { type: "button", className: "ghost small danger icon", textContent: "🗑", title: "Delete", ariaLabel: "Delete " + r.name });
      del.onclick = async () => {
        if (del.dataset.armed !== "1") { del.dataset.armed = "1"; del.textContent = "Sure?"; setTimeout(() => { del.dataset.armed = ""; del.textContent = "🗑"; }, 4000); return; }
        const { error } = await sb.from("candidates").delete().eq("id", r.id);
        if (error) msg("Could not delete: " + error.message, true); else { msg(`${r.name} deleted.`); load(); }
      };
      act.append(edit, del);
      tr.append(td(r.name, "strong"), td(r.mobile, "mono"), Object.assign(td(r.email, "mono small"), { title: r.email || "" }), td(r.post, "cell-wrap"), td(r.city),
        td(r.experience_years != null ? r.experience_years + " yrs" : ""), status, td(r.company, "cell-wrap"), td(r.hr_name, "cell-wrap"),
        td(new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "2-digit" })), act);
      return tr;
    }));
    $("c-empty").hidden = rows.length > 0;
  }
  $("c-search").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(load, 300); });
  $("c-filter").addEventListener("change", load);

  // ------------------------------------------------------------ add / edit
  const fields = ["name", "mobile", "email", "post", "skills", "city", "experience_years", "status", "doj", "monthly_salary", "annual_salary", "bill_amount", "gst_amount", "total_bill", "bill_no", "payment_date", "company", "hr_name", "resume_file", "notes"];
  // DOJ only matters once a candidate is selected
  const toggleJoined = () => { document.querySelectorAll(".joined").forEach((el) => { el.hidden = $("f-status").value !== "Selected"; }); };
  $("f-status").addEventListener("change", toggleJoined);

  // billing: annual = monthly x 12, bill = fee% of annual, GST = gst% of bill, total = bill + GST
  const FEE = Number(cfg.feePercent ?? 7.5), GST = Number(cfg.gstPercent ?? 18);
  document.querySelectorAll(".fee-pct").forEach((e) => { e.textContent = FEE; });
  document.querySelectorAll(".gst-pct").forEach((e) => { e.textContent = GST; });
  const r2 = (n) => Math.round(n * 100) / 100;
  const money = (n) => (n === null || n === undefined || n === "") ? "" : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  function calcBill(monthly) {
    const m = Number(monthly);
    if (monthly === "" || monthly === null || monthly === undefined || !(m >= 0)) return { annual_salary: null, bill_amount: null, gst_amount: null, total_bill: null };
    const annual = r2(m * 12), bill = r2(annual * FEE / 100), gst = r2(bill * GST / 100);
    return { annual_salary: annual, bill_amount: bill, gst_amount: gst, total_bill: r2(bill + gst) };
  }
  function recalc() {
    const c = calcBill($("f-monthly_salary").value.trim());
    for (const k of Object.keys(c)) $("f-" + k).value = c[k] === null ? "" : money(c[k]);
  }
  $("f-monthly_salary").addEventListener("input", recalc);
  // the mobile/email columns come from supabase/002_add_mobile_email.sql
  const columnHint = (err) => /mobile|email|company|hr_name|doj|salary|bill|gst|payment/i.test(err && err.message || "") && /column|schema/i.test(err.message)
    ? "Some columns are missing in Supabase. Run the SQL files in the supabase folder (002 to 006) once." : "";
  function startEdit(r) {
    editingId = r.id;
    fields.forEach((f) => { $("f-" + f).value = r[f] == null ? "" : r[f]; });
    toggleJoined(); recalc(); recalcPayment();
    syncPost();
    $("c-save").textContent = "Save changes";
    $("c-cancel").hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    $("f-name").focus();
  }
  function resetForm() {
    editingId = null; form.reset(); $("f-status").value = "New"; toggleJoined(); recalcPayment();
    $("c-save").textContent = "Add candidate"; $("c-cancel").hidden = true;
  }
  $("c-cancel").addEventListener("click", resetForm);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rec = {};
    fields.forEach((f) => { const v = $("f-" + f).value.trim(); rec[f] = v === "" ? null : v; });
    if (rec.experience_years != null) rec.experience_years = Number(rec.experience_years);
    // money: work it out again from the monthly salary (the boxes show formatted ₹ text)
    rec.monthly_salary = rec.monthly_salary === null ? null : Number(rec.monthly_salary);
    Object.assign(rec, calcBill(rec.monthly_salary === null ? "" : rec.monthly_salary));
    if (!rec.name) { msg("Candidate name is required.", true); return; }
    $("c-save").disabled = true;
    const res = editingId
      ? await sb.from("candidates").update(rec).eq("id", editingId)
      : await sb.from("candidates").insert(rec);
    $("c-save").disabled = false;
    if (res.error) { msg(columnHint(res.error) || "Could not save: " + res.error.message, true); return; }
    msg(editingId ? `${rec.name} updated.` : `${rec.name} added to the list.`);
    resetForm();
    $("f-company").value = rec.company || ""; $("f-hr_name").value = rec.hr_name || "";
    load();
  });

  // fill the form from a masked resume (Download / Send buttons, or "Add to candidate list")
  // the email / WhatsApp buttons read the form, so the team's corrections are used
  window.AwasthiCurrentDetails = () => Object.fromEntries(["name", "mobile", "email", "post", "city", "experience_years", "skills", "resume_file"].map((f) => [f, $("f-" + f).value.trim()]));

  // Skills shows the designation: keep it in step when the team edits the post
  let lastPost = "";
  $("f-post").addEventListener("input", () => {
    const sk = $("f-skills");
    if (!sk.value.trim() || sk.value.trim() === lastPost) sk.value = $("f-post").value.trim();
    lastPost = $("f-post").value.trim();
  });
  const syncPost = () => { lastPost = $("f-post").value.trim(); };

  function prefill(d, scroll) {
    if (!user || !d) return;
    // this resume is already in the form (maybe corrected by hand): keep it
    if (!scroll && d.resume_file && $("f-resume_file").value === d.resume_file) return;
    if (editingId) { msg("Save or cancel the edit in progress first, then the resume details can be filled in.", true); return; }
    const keepCompany = $("f-company").value, keepHr = $("f-hr_name").value;
    resetForm();
    $("f-company").value = keepCompany; $("f-hr_name").value = keepHr;
    ["name", "mobile", "email", "post", "city", "skills", "resume_file"].forEach((f) => { if (d[f]) $("f-" + f).value = d[f]; });
    if (d.experience_years != null) $("f-experience_years").value = d.experience_years;
    syncPost();
    msg(`Details for ${d.name || "the candidate"} were filled in from the resume. Check them, then press "Add candidate".`);
    if (scroll) { form.scrollIntoView({ behavior: "smooth", block: "start" }); $("f-name").focus(); }
  }
  document.addEventListener("resume-prefill", (e) => prefill(e.detail.details, e.detail.scroll));
  document.addEventListener("resume-masked", (e) => {
    const { card, details } = e.detail;
    const head = card.querySelector(".file-head");
    const b = Object.assign(document.createElement("button"), { type: "button", className: "ghost to-candidates", textContent: "Add to candidate list" });
    b.hidden = !user;
    b.onclick = () => prefill(details, true);
    head.append(b);
  });

  // session expired or logged out in another tab -> back to the login page
  // (never call supabase inside this callback directly; defer it)
  sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") setTimeout(refreshAuth, 0); });
  refreshAuth();
})();
