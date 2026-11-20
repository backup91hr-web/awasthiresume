# Awasthi Resume

Resume vich mobile number te email ID lukaun wala free tool.

| Resume vich | Masked |
|---|---|
| `98765 43210` | `XXXXX XXX10` |
| `rahul.sharma92@gmail.com` | `XXXXXXXXXX.com` |

PDF, Word (.docx), scanned PDF te photo (JPG/PNG) sab chalde ne.
Saara kamm visitor de browser vich hunda hai. Resume kise server te upload nahi hunde.

## Folder
- `index.html` + `lib/`: website (GitHub Pages / Netlify te seedha chalda hai)
- `python/`: Python version (Flask app + command line). Dekho `python/requirements.txt`

## Python version chalao
```
cd python
pip install -r requirements.txt   # scanned resume layi Tesseract OCR vi install karo
python app.py                     # http://localhost:5000
```

## Candidate list (Supabase) setup

Candidate list sirf login kitti hoyi team nu dikhdi hai. Asli mobile number te email list vich save nahi hunde, oh aap `X` ban jaande ne.

1. **supabase.com** te **New project** banao, naam `awasthi-resume` rakho. Region **Mumbai (ap-south-1)** chuno.
2. **SQL Editor → New query** kholo, `supabase/setup.sql` di saari file paste karo, te **Run** dabao.
3. **Authentication → Sign In / Providers → Email** vich **"Allow new users to sign up"** band kar deo, taan ki koi bahar wala apna account na bana sake.
4. **Authentication → Users → Add user → Create new user** naal team de har bande da email te password banao.
5. **Project Settings → API** ton **Project URL** te **anon / publishable key** copy karke `config.js` vich pao.
   `service_role` key kade vi `config.js` vich na pao.
6. Website kholo. Thalle **Candidate list** aayegi, ethe login karo.

`config.js` khaali hove taan candidate list lukki rehndi hai, par resume masking kamm kardi rehndi hai.
