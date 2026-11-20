import warnings; warnings.filterwarnings("ignore", category=FutureWarning)
"""
Resume Masker - core logic.

Masks mobile numbers and email IDs in resumes:
  - Mobile : 9876543210            -> XXXXXXXX10
             +91 98765-43210       -> +91 XXXXX-XXX10
  - Email  : ashok.kumar@gmail.com -> XXXXXXXXXX.com

Supported inputs:
  - Text PDF      (text is removed for real, not just covered with a box)
  - Scanned PDF   (OCR with Tesseract, pixels under the number are wiped)
  - Image         (JPG / PNG / etc. via OCR)
  - Word (.docx)  (formatting kept; hyperlinks, headers, footers, text boxes too)
"""

import io
import os
import re
import zipfile

import fitz  # PyMuPDF
import pytesseract
from lxml import etree
from PIL import Image, ImageDraw, ImageFont

# ----------------------------------------------------------------------------
# Settings
# ----------------------------------------------------------------------------
PHONE_VISIBLE_DIGITS = 2      # how many last digits of the mobile stay visible
EMAIL_MASK = "XXXXXXXXXX"     # what replaces the email before the ending (.com)
OCR_DPI = 300                 # scan resolution used for OCR
OCR_LANG = "eng"

# ----------------------------------------------------------------------------
# Patterns
# ----------------------------------------------------------------------------
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+\s?@\s?[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}")
# a run of digits with the usual separators: +91 98765 43210, (098) 765-43210 ...
PHONE_RE = re.compile(r"(?<![\w@])\+?\(?\d[\d \-().]{8,20}\d(?![\w@])")


def mask_email(email: str) -> str:
    email = email.replace(" ", "")
    tld = email.rsplit(".", 1)[-1]
    return f"{EMAIL_MASK}.{tld}"


def mask_phone(phone: str):
    """Return masked phone, or None if this is not a mobile number."""
    digits = [c for c in phone if c.isdigit()]
    if not 10 <= len(digits) <= 13:
        return None
    # the last 10 digits are the mobile number; anything before is +91 / 0
    to_mask = 10 - PHONE_VISIBLE_DIGITS
    start = len(digits) - 10
    out, seen = [], 0
    for c in phone:
        if c.isdigit():
            out.append("X" if start <= seen < start + to_mask else c)
            seen += 1
        else:
            out.append(c)
    return "".join(out)


def find_matches(text: str):
    """Yield (start, end, original, masked) for every email/phone in text."""
    found = []
    for m in EMAIL_RE.finditer(text):
        found.append((m.start(), m.end(), m.group(), mask_email(m.group())))
    for m in PHONE_RE.finditer(text):
        s, e = m.start(), m.end()
        if any(s < fe and e > fs for fs, fe, *_ in found):
            continue  # part of an email
        raw = m.group()
        # trim trailing/leading separators that the regex may pick up
        lead = len(raw) - len(raw.lstrip(" -.("))
        raw2 = raw.strip(" -.(")
        masked = mask_phone(raw2)
        if masked:
            s += lead
            found.append((s, s + len(raw2), raw2, masked))
    return sorted(found)


def mask_text(text: str):
    """Plain-text masking. Returns (new_text, list_of_changes)."""
    changes = []
    out, last = [], 0
    for s, e, orig, masked in find_matches(text):
        out.append(text[last:s])
        out.append(masked)
        last = e
        changes.append((orig, masked))
    out.append(text[last:])
    return "".join(out), changes


# ----------------------------------------------------------------------------
# PDF
# ----------------------------------------------------------------------------
def _fit_fontsize(text, rect, base):
    size = max(base, 4)
    while size > 4 and fitz.get_text_length(text, "helv", size) > rect.width:
        size -= 0.5
    return size


def _color(c):
    return ((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255)


def _pdf_text_hits(page):
    """Find hits on a page that has a real text layer."""
    hits = []
    raw = page.get_text("rawdict", flags=fitz.TEXT_PRESERVE_WHITESPACE)
    for block in raw["blocks"]:
        for line in block.get("lines", []):
            chars, text = [], []
            for span in line["spans"]:
                for ch in span["chars"]:
                    chars.append((fitz.Rect(ch["bbox"]), span))
                    text.append(ch["c"])
            text = "".join(text)
            for s, e, orig, masked in find_matches(text):
                rect = fitz.Rect()
                for r, _ in chars[s:e]:
                    rect |= r
                span = chars[s][1]
                hits.append(dict(rect=rect, orig=orig, masked=masked,
                                 size=span["size"], color=_color(span["color"])))
    return hits


def _ocr_lines(img: Image.Image):
    """OCR an image. Returns list of (line_text, [(char_start, char_end, box)])."""
    data = pytesseract.image_to_data(img, lang=OCR_LANG, output_type=pytesseract.Output.DICT)
    lines = {}
    for i, word in enumerate(data["text"]):
        word = word.strip()
        if not word:
            continue
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        box = (data["left"][i], data["top"][i],
               data["left"][i] + data["width"][i], data["top"][i] + data["height"][i])
        lines.setdefault(key, []).append((word, box))
    result = []
    for words in lines.values():
        text, spans = "", []
        for word, box in words:
            if text:
                text += " "
            spans.append((len(text), len(text) + len(word), box))
            text += word
        result.append((text, spans))
    return result


def _ocr_hits(img: Image.Image):
    """Find hits in an image. Boxes are in image pixels."""
    hits = []
    for text, spans in _ocr_lines(img):
        for s, e, orig, masked in find_matches(text):
            x0 = y0 = 10 ** 9
            x1 = y1 = -1
            for ws, we, (bx0, by0, bx1, by1) in spans:
                if we <= s or ws >= e:
                    continue
                # only part of this word may be the match: cut it proportionally
                n = max(we - ws, 1)
                cs, ce = max(s, ws) - ws, min(e, we) - ws
                w = bx1 - bx0
                x0 = min(x0, bx0 + w * cs / n)
                x1 = max(x1, bx0 + w * ce / n)
                y0, y1 = min(y0, by0), max(y1, by1)
            if x1 > 0:
                hits.append(dict(box=(x0, y0, x1, y1), orig=orig, masked=masked))
    return hits


def _is_scanned(page) -> bool:
    return len(page.get_text().strip()) < 20 and len(page.get_images()) > 0


def mask_pdf(data: bytes):
    doc = fitz.open(stream=data, filetype="pdf")
    changes, used_ocr = [], False

    for page in doc:
        if _is_scanned(page):
            used_ocr = True
            pix = page.get_pixmap(dpi=OCR_DPI)
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            scale = page.rect.width / pix.width
            hits = []
            for h in _ocr_hits(img):
                x0, y0, x1, y1 = h["box"]
                r = fitz.Rect(x0 * scale, y0 * scale, x1 * scale, y1 * scale)
                # grow the box a little so no edge pixels of the old digits survive
                g = r.height * 0.25
                r = fitz.Rect(r.x0 - g, r.y0 - g, r.x1 + g, r.y1 + g)
                hits.append(dict(rect=r, orig=h["orig"], masked=h["masked"], pad=0,
                                 size=r.height * 0.8, color=(0, 0, 0)))
        else:
            hits = _pdf_text_hits(page)

        if not hits:
            continue

        # remove clickable mailto:/tel: links that would leak the real value
        for link in page.get_links():
            uri = link.get("uri", "") or ""
            if uri.lower().startswith(("mailto:", "tel:")) or EMAIL_RE.search(uri):
                page.delete_link(link)

        for h in hits:
            r = h["rect"]
            # shrink slightly vertically so lines above/below are not touched
            pad = r.height * h.get("pad", 0.15)
            page.add_redact_annot(fitz.Rect(r.x0, r.y0 + pad, r.x1, r.y1 - pad), fill=(1, 1, 1))
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_PIXELS,
                              graphics=fitz.PDF_REDACT_LINE_ART_NONE)

        for h in hits:
            r = h["rect"]
            size = _fit_fontsize(h["masked"], r, h["size"])
            baseline = fitz.Point(r.x0, (r.y0 + r.y1) / 2 + size * 0.35)
            page.insert_text(baseline, h["masked"], fontsize=size, fontname="helv", color=h["color"])
            changes.append((h["orig"], h["masked"]))

    # scrub metadata too (author email etc.)
    meta = {k: (mask_text(v)[0] if isinstance(v, str) else v) for k, v in doc.metadata.items()}
    doc.set_metadata(meta)

    out = doc.tobytes(garbage=4, deflate=True)
    return out, changes, used_ocr


# ----------------------------------------------------------------------------
# Image (JPG / PNG ...)
# ----------------------------------------------------------------------------
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def _font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except OSError:
        return ImageFont.load_default()


def mask_image(data: bytes, ext: str):
    img = Image.open(io.BytesIO(data))
    fmt = img.format or "PNG"
    img = img.convert("RGB")
    draw = ImageDraw.Draw(img)
    changes = []
    for h in _ocr_hits(img):
        x0, y0, x1, y1 = h["box"]
        g = (y1 - y0) * 0.25
        draw.rectangle([x0 - g, y0 - g, x1 + g, y1 + g], fill="white")
        size = max(int((y1 - y0) * 1.15), 8)
        font = _font(size)
        while size > 8 and draw.textlength(h["masked"], font=font) > (x1 - x0):
            size -= 1
            font = _font(size)
        draw.text((x0, (y0 + y1) / 2), h["masked"], fill="black", font=font, anchor="lm")
        changes.append((h["orig"], h["masked"]))
    buf = io.BytesIO()
    img.save(buf, format=fmt if fmt != "MPO" else "JPEG", quality=95)
    return buf.getvalue(), changes, True


# ----------------------------------------------------------------------------
# Word (.docx)
# ----------------------------------------------------------------------------
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
P_TAG, T_TAG = f"{{{W}}}p", f"{{{W}}}t"


def _mask_paragraph(p, changes):
    # only w:t elements whose closest paragraph is this one (skip nested text boxes)
    ts = [t for t in p.iter(T_TAG) if next(t.iterancestors(P_TAG)) is p]
    if not ts:
        return
    owner, text = [], []
    for i, t in enumerate(ts):
        s = t.text or ""
        text.append(s)
        owner.extend([(i, j) for j in range(len(s))])
    full = "".join(text)
    matches = find_matches(full)
    if not matches:
        return
    pieces = [list(s) for s in text]
    for s, e, orig, masked in reversed(matches):
        first_t, first_j = owner[s]
        # blank out every char of the match, then put the masked text in the first char
        for k in range(s, e):
            ti, j = owner[k]
            pieces[ti][j] = ""
        pieces[first_t][first_j] = masked
        changes.append((orig, masked))
    for t, chars in zip(ts, pieces):
        t.text = "".join(chars)
        t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")


def mask_docx(data: bytes):
    zin = zipfile.ZipFile(io.BytesIO(data))
    buf = io.BytesIO()
    changes = []
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            content = zin.read(item.filename)
            name = item.filename
            if name.startswith("word/") and name.endswith(".xml"):
                root = etree.fromstring(content)
                for p in root.iter(P_TAG):
                    _mask_paragraph(p, changes)
                content = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)
            elif name.endswith(".rels") or name.startswith("docProps/"):
                # hyperlink targets (mailto:/tel:) and document properties
                s = content.decode("utf-8", "ignore")
                s = re.sub(r'Target="(mailto|tel):[^"]*"', 'Target="#"', s, flags=re.I)
                s = mask_text(s)[0]
                content = s.encode("utf-8")
            zout.writestr(item, content)
    return buf.getvalue(), changes, False


# ----------------------------------------------------------------------------
# Entry point
# ----------------------------------------------------------------------------
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}
SUPPORTED = {".pdf", ".docx"} | IMAGE_EXT


def mask_file(filename: str, data: bytes):
    """Returns (masked_bytes, changes, used_ocr)."""
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        return mask_pdf(data)
    if ext == ".docx":
        return mask_docx(data)
    if ext in IMAGE_EXT:
        return mask_image(data, ext)
    raise ValueError(f"File type '{ext}' supported nahi hai. PDF, DOCX ja image (JPG/PNG) upload karo.")


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Use: python masker.py resume.pdf [more files...]")
        sys.exit(1)
    for path in sys.argv[1:]:
        with open(path, "rb") as f:
            out, changes, ocr = mask_file(path, f.read())
        base, ext = os.path.splitext(path)
        out_path = f"{base}_masked{ext}"
        with open(out_path, "wb") as f:
            f.write(out)
        print(f"{path} -> {out_path}  ({'OCR' if ocr else 'text'})")
        for o, m in changes:
            print(f"   {o}  ->  {m}")
