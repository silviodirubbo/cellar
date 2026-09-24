# Builds the two self-contained Fiano Horizontal feed slides (1080x1350).
# Fonts and bottle cutouts are embedded as base64 so nothing loads over network.
# Run from any directory; fonts come from the @fontsource npm packages
# (npm i @fontsource/cormorant-garamond @fontsource/dm-mono), found via
# FONTSOURCE_DIR or ./node_modules/@fontsource/.
import base64, os
HERE=os.path.dirname(os.path.abspath(__file__))
OUT=HERE+'/'
FS=os.environ.get('FONTSOURCE_DIR','node_modules/@fontsource').rstrip('/')+'/'
def b64(p): return base64.b64encode(open(p,'rb').read()).decode()
def face(fam,path,w,st):
    return f"@font-face{{font-family:'{fam}';src:url(data:font/woff2;base64,{b64(FS+path)}) format('woff2');font-weight:{w};font-style:{st};}}"
FONTS='\n'.join([
    face('Cormorant Garamond',f'cormorant-garamond/files/cormorant-garamond-latin-{w}-{s}.woff2',w,s)
    for w in (300,400,500) for s in ('normal','italic')]+[
    face('DM Mono',f'dm-mono/files/dm-mono-latin-{w}-normal.woff2',w,'normal') for w in (300,400)])

BASE="""
:root{--warm-white:#FDFCFA;--off-white:#F7F5F0;--ink:#1A1814;--ink-mid:#4A4640;
--ink-light:#8A8480;--green:#2C4A3E;--gold:#8B6914;--rule:#E2DED8;
--serif:'Cormorant Garamond',Georgia,serif;--mono:'DM Mono',ui-monospace,monospace;}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:1080px;height:1350px;overflow:hidden;}
.slide{position:relative;width:1080px;height:1350px;overflow:hidden;font-family:var(--serif);
  -webkit-font-smoothing:antialiased;}
.mark{position:absolute;top:76px;left:76px;display:flex;align-items:center;gap:14px;}
.mark svg{display:block;}
.mark span{font-family:var(--serif);font-style:italic;font-weight:400;font-size:28px;line-height:1;}
.eyebrow{font-family:var(--mono);font-weight:400;font-size:15px;letter-spacing:.2em;text-transform:uppercase;}
"""

def mark(stroke, text_color):
    return f"""<div class="mark">
  <svg width="48" height="16" viewBox="0 0 96 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="16" cy="16" r="13" stroke="{stroke}" stroke-width="1.4"/>
    <circle cx="48" cy="16" r="13" fill="#2C4A3E"/>
    <circle cx="80" cy="16" r="13" stroke="{stroke}" stroke-width="1.4"/>
  </svg>
  <span style="color:{text_color}">Cellar.</span>
</div>"""

def page(title, css, body):
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>{title}</title>
<style>
{FONTS}
{BASE}
{css}
</style></head><body>
{body}
</body></html>
"""

# Wine data mirrors _data/tastings.yml (fiano-horizontal), in tasting order.
WINES=[('Ciro 906','Ciro Picariello','Summonte','picariello'),
       ('La Congregazione','Villa Diamante','Montefredane','diamante'),
       ('Clelia','Colli di Lapio','Lapio','clelia'),
       ('Più Alto','i Satoli','Montefredane','isatoli')]

A_CSS="""
.slide{background:var(--off-white);color:var(--ink);}
.head{position:absolute;top:168px;left:76px;right:76px;}
.head .eyebrow{color:var(--ink-light);display:flex;align-items:center;gap:22px;}
.head .eyebrow::after{content:'';width:88px;height:1px;background:var(--rule);}
.head h1{font-weight:300;font-size:84px;line-height:1;letter-spacing:-.01em;margin-top:30px;}
.head p{font-style:italic;font-weight:300;font-size:28px;color:var(--ink-mid);margin-top:18px;}
.shelf{position:absolute;left:76px;right:76px;top:470px;height:560px;
  display:grid;grid-template-columns:repeat(4,1fr);align-items:end;}
.shelf img{display:block;justify-self:center;height:560px;width:auto;
  filter:drop-shadow(0 10px 18px rgba(26,24,20,.10));}
.baseline{position:absolute;left:76px;right:76px;top:1030px;height:1px;background:var(--rule);}
.labels{position:absolute;left:76px;right:76px;top:1062px;
  display:grid;grid-template-columns:repeat(4,1fr);text-align:center;}
.labels .eyebrow{font-size:13px;letter-spacing:.22em;color:var(--ink-light);}
.labels .name{font-weight:400;font-size:30px;line-height:1.15;margin-top:12px;}
.foot{position:absolute;left:76px;right:76px;bottom:84px;display:flex;justify-content:space-between;
  align-items:baseline;border-top:1px solid var(--rule);padding-top:22px;}
.foot .eyebrow{font-size:13px;color:var(--ink-light);}
"""
bottles=''.join(f'<img src="data:image/png;base64,{b64(os.path.join(HERE,"bottles",k+".png"))}" alt="{n}">' for n,_,_,k in WINES)
labels=''.join(f'<div><div class="eyebrow">{c}</div><div class="name">{n}</div></div>' for n,_,c,_ in WINES)
A_BODY=f"""<div class="slide">
{mark('#1A1814','#1A1814')}
<div class="head">
  <div class="eyebrow">Grape Studies · Irpinia · 23 August 2026</div>
  <h1>Fiano Horizontal</h1>
  <p>Four Fiano di Avellino, three communes, one grape.</p>
</div>
<div class="shelf">{bottles}</div>
<div class="baseline"></div>
<div class="labels">{labels}</div>
<div class="foot"><span class="eyebrow">Fiano di Avellino DOCG</span><span class="eyebrow">100% Fiano</span></div>
</div>"""

B_CSS="""
.slide{background:#3B1A2E;color:var(--warm-white);}
.body{position:absolute;left:76px;right:76px;top:50%;transform:translateY(-46%);}
.body .eyebrow{color:rgba(253,252,250,.55);}
.body h2{font-weight:300;font-style:italic;font-size:76px;line-height:1.12;letter-spacing:-.005em;
  margin-top:40px;max-width:880px;}
.body .rule{width:88px;height:1px;background:rgba(253,252,250,.28);margin:56px 0 40px;}
.body a{font-family:var(--mono);font-weight:400;font-size:18px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--warm-white);text-decoration:underline;text-decoration-thickness:1px;
  text-underline-offset:10px;text-decoration-color:rgba(253,252,250,.6);}
"""
B_BODY=f"""<div class="slide">
{mark('rgba(253,252,250,.45)','#FDFCFA')}
<div class="body">
  <div class="eyebrow">Grape Studies · Standing aside the curriculum</div>
  <h2>One of the one-offs that run alongside the main chapters.</h2>
  <div class="rule"></div>
  <a>silviodirubbo.github.io/cellar</a>
</div>
</div>"""

open(OUT+'slide-a-four-bottles.html','w').write(page('Fiano Horizontal, four bottles',A_CSS,A_BODY))
open(OUT+'slide-b-closing.html','w').write(page('Fiano Horizontal, closing',B_CSS,B_BODY))
print('ok')
