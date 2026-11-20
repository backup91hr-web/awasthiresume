"""
Resume Masker - web app.
Run:  python app.py   then open  http://localhost:5000
"""
import io
import os
import uuid
import zipfile

from flask import Flask, abort, render_template_string, request, send_file

from masker import SUPPORTED, mask_file

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024  # 100 MB per upload

# masked files are kept in memory only (nothing is saved to disk)
RESULTS = {}

PAGE = """
<!doctype html>
<html lang="pa">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Resume Masker</title>
<style>
  :root { --bg:#f5f6f8; --card:#fff; --text:#1d2330; --muted:#667085; --accent:#2b59c3; --ok:#1a7f45; --err:#b42318; --line:#e4e7ec; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:var(--bg); color:var(--text); }
  main { max-width:860px; margin:0 auto; padding:32px 16px; }
  h1 { margin:0 0 4px; font-size:26px; }
  p.sub { margin:0 0 24px; color:var(--muted); }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:24px; margin-bottom:20px; }
  .drop { display:block; border:2px dashed var(--line); border-radius:10px; padding:32px; text-align:center; cursor:pointer; }
  .drop:hover, .drop.over { border-color:var(--accent); background:#f0f4ff; }
  .drop input { display:none; }
  #names { margin-top:10px; color:var(--muted); font-size:14px; word-break:break-all; }
  button, a.btn { background:var(--accent); color:#fff; border:0; border-radius:8px; padding:11px 20px; font-size:15px; cursor:pointer; text-decoration:none; display:inline-block; }
  button { margin-top:16px; width:100%; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  td, th { text-align:left; padding:8px 6px; border-bottom:1px solid var(--line); vertical-align:top; }
  .file { font-weight:600; margin:0 0 8px; display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center; }
  .tag { font-size:12px; padding:2px 8px; border-radius:20px; background:#eef2ff; color:var(--accent); margin-left:6px; }
  .err { color:var(--err); }
  .none { color:var(--muted); }
  code { font-family:ui-monospace,Menlo,monospace; }
  .masked { color:var(--ok); }
  #wait { display:none; margin-top:12px; color:var(--muted); text-align:center; }
</style>
</head>
<body>
<main>
  <h1>Resume Masker</h1>
  <p class="sub">Resume upload karo. Mobile number de pehle 8 digit te email ID <code>XXXXXXXX</code> ban jaange.<br>
  PDF, Word (.docx), scanned PDF te photo (JPG/PNG) sab chalde ne.</p>

  <form class="card" method="post" enctype="multipart/form-data" onsubmit="document.getElementById('wait').style.display='block'">
    <label class="drop" id="drop">
      <input type="file" name="files" id="files" multiple accept="{{ accept }}" required>
      <strong>Resume ethe chuno ja kheench ke chhado</strong><br>
      <span class="none">Ikko vaari kai files chun sakde ho</span>
      <div id="names"></div>
    </label>
    <button type="submit">Mask karo</button>
    <div id="wait">Kamm chal reha hai... scanned resume nu thoda zyada time lagda hai.</div>
  </form>

  {% if results %}
  <div class="card">
    {% if batch %}<p style="margin-top:0"><a class="btn" href="/download/{{ batch }}">Saariyan files ZIP vich download karo</a></p>{% endif %}
    {% for r in results %}
      <div style="margin-bottom:22px">
        <div class="file">
          <span>{{ r.name }}{% if r.ocr %}<span class="tag">Scanned (OCR)</span>{% endif %}</span>
          {% if r.id %}<a class="btn" href="/download/{{ r.id }}">Download</a>{% endif %}
        </div>
        {% if r.error %}
          <div class="err">{{ r.error }}</div>
        {% elif not r.changes %}
          <div class="none">Koi mobile number ja email nahi labhya. Ehnu ikk vaari khud vi check kar lo.</div>
        {% else %}
          <table>
            <tr><th>Pehlan</th><th>Hun</th></tr>
            {% for o, m in r.changes %}<tr><td><code>{{ o }}</code></td><td class="masked"><code>{{ m }}</code></td></tr>{% endfor %}
          </table>
        {% endif %}
      </div>
    {% endfor %}
  </div>
  {% endif %}
</main>
<script>
  const input = document.getElementById('files'), drop = document.getElementById('drop'), names = document.getElementById('names');
  const show = () => names.textContent = [...input.files].map(f => f.name).join(', ');
  input.addEventListener('change', show);
  ['dragover','dragenter'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
  ['dragleave','drop'].forEach(e => drop.addEventListener(e, () => drop.classList.remove('over')));
  drop.addEventListener('drop', ev => { ev.preventDefault(); input.files = ev.dataTransfer.files; show(); });
</script>
</body>
</html>
"""


def masked_name(name):
    base, ext = os.path.splitext(os.path.basename(name))
    return f"{base}_masked{ext}"


@app.route("/", methods=["GET", "POST"])
def index():
    accept = ",".join(sorted(SUPPORTED))
    if request.method == "GET":
        return render_template_string(PAGE, accept=accept, results=None)

    results, done = [], []
    for f in request.files.getlist("files"):
        if not f.filename:
            continue
        r = {"name": f.filename, "changes": [], "ocr": False, "id": None, "error": None}
        try:
            out, changes, ocr = mask_file(f.filename, f.read())
            fid = uuid.uuid4().hex
            RESULTS[fid] = (masked_name(f.filename), out)
            r.update(changes=changes, ocr=ocr, id=fid)
            done.append(fid)
        except Exception as e:  # show the problem instead of crashing
            r["error"] = f"Eh file process nahi ho saki: {e}"
        results.append(r)

    batch = None
    if len(done) > 1:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            for fid in done:
                name, data = RESULTS[fid]
                z.writestr(name, data)
        batch = uuid.uuid4().hex
        RESULTS[batch] = ("masked_resumes.zip", buf.getvalue())

    return render_template_string(PAGE, accept=accept, results=results, batch=batch)


@app.route("/download/<fid>")
def download(fid):
    if fid not in RESULTS:
        abort(404)
    name, data = RESULTS[fid]
    return send_file(io.BytesIO(data), as_attachment=True, download_name=name)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
