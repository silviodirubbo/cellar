# Builds the five self-contained Rhône chapter feed slides (1080x1350).
# Fonts and bottle cutouts are embedded as base64 so nothing loads over the
# network. Tasting titles and wine data are read from _data/tastings.yml via
# wines.py, never retyped here.
# Fonts come from the @fontsource npm packages
# (npm i @fontsource/cormorant-garamond @fontsource/dm-mono), found via
# FONTSOURCE_DIR or ./node_modules/@fontsource/.
import base64, os, sys, html
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0,HERE)
import wines
from key import bottle_name
FS=os.environ.get('FONTSOURCE_DIR','node_modules/@fontsource').rstrip('/')+'/'
def b64(p): return base64.b64encode(open(p,'rb').read()).decode()
def esc(s): return html.escape(str(s),quote=True)
def face(fam,path,w,st):
    return f"@font-face{{font-family:'{fam}';src:url(data:font/woff2;base64,{b64(FS+path)}) format('woff2');font-weight:{w};font-style:{st};}}"
FONTS='\n'.join([
    face('Cormorant Garamond',f'cormorant-garamond/files/cormorant-garamond-latin-{w}-{s}.woff2',w,s)
    for w in (300,400,500) for s in ('normal','italic')]+[
    face('DM Mono',f'dm-mono/files/dm-mono-latin-{w}-normal.woff2',w,'normal') for w in (300,400)])

GREEN='#2C4A3E'
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
.slide--green{background:#2C4A3E;color:var(--warm-white);}
.slide--green .eyebrow{color:rgba(253,252,250,.55);}
"""

def mark(on_green):
    # Nav geometry (three r13 circles at cx 16/48/80). On the green slides the
    # green middle circle would vanish, so it takes the warm-white fill the
    # story styles use for the active dot on green (main.css .story--green).
    if on_green:
        stroke,mid,text='rgba(253,252,250,.45)','rgba(253,252,250,.55)','#FDFCFA'
    else:
        stroke,mid,text='#1A1814','#2C4A3E','#1A1814'
    return f"""<div class="mark">
  <svg width="48" height="16" viewBox="0 0 96 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="16" cy="16" r="13" stroke="{stroke}" stroke-width="1.4"/>
    <circle cx="48" cy="16" r="13" fill="{mid}"/>
    <circle cx="80" cy="16" r="13" stroke="{stroke}" stroke-width="1.4"/>
  </svg>
  <span style="color:{text}">Cellar.</span>
</div>"""

def page(title, css, body):
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>{esc(title)}</title>
<style>
{FONTS}
{BASE}
{css}
</style></head><body>
{body}
</body></html>
"""

T=wines.load()
BY_SLUG={t['slug']:t for t in T}
CHAPTER_NUMERAL='I'  # _chapters/rhone.md numeral

# SLIDE 1: cover. Proportions from assets/Pilot/slide-1-cover.png: one
# centred italic wordmark with a small mono line under it.
S1_CSS="""
.cover{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.cover h1{font-style:italic;font-weight:300;font-size:176px;line-height:1;letter-spacing:-.005em;}
.cover .eyebrow{margin-top:44px;font-size:17px;letter-spacing:.32em;}
"""
S1=f"""<div class="slide slide--green">
{mark(True)}
<div class="cover">
  <h1>Rhône</h1>
  <div class="eyebrow">Chapter {CHAPTER_NUMERAL}</div>
</div>
</div>"""

# SLIDES 2 and 3: section dividers.
DIV_CSS="""
.section{position:absolute;left:76px;right:76px;top:50%;transform:translateY(-50%);}
.section .eyebrow{display:flex;align-items:center;gap:22px;}
.section .eyebrow::after{content:'';width:88px;height:1px;background:rgba(253,252,250,.28);}
.section ol{list-style:none;margin-top:48px;border-top:1px solid rgba(253,252,250,.18);}
.section li{font-weight:300;font-size:60px;line-height:1.1;padding:30px 0;
  border-bottom:1px solid rgba(253,252,250,.18);}
"""
def divider(eyebrow, slugs):
    items=''.join(f'<li>{esc(BY_SLUG[s]["title"])}</li>' for s in slugs)
    return f"""<div class="slide slide--green">
{mark(True)}
<div class="section">
  <div class="eyebrow">{esc(eyebrow)}</div>
  <ol>{items}</ol>
</div>
</div>"""
NORTH=['northern-rhone-syrahs','northern-rhone-whites','cote-rotie-horizontal','condrieu-horizontal']
SOUTH=['southern-rhone-overview','chateauneuf-du-pape-the-whites','chateauneuf-du-pape-the-reds']
for s in NORTH: assert BY_SLUG[s]['region']=='Northern Rhône', s
for s in SOUTH: assert BY_SLUG[s]['region']=='Southern Rhône', s

# SLIDE 4: every bottle from all eight tastings, chapter order, 7 columns.
# Label floor: DM Mono 12px producer and Cormorant 20px name. Cells never
# shrink type below that; long names wrap to a second line instead.
ALL=[w for t in T for w in t['wines']]
COLS=7
S4_CSS=f"""
.slide{{background:var(--off-white);color:var(--ink);}}
.top{{position:absolute;top:76px;right:76px;height:16px;display:flex;align-items:center;}}
.top .eyebrow{{font-size:13px;color:var(--ink-light);}}
.grid{{position:absolute;left:56px;right:56px;top:140px;bottom:52px;
  display:grid;grid-template-columns:repeat({COLS},1fr);grid-auto-rows:1fr;column-gap:8px;row-gap:14px;
  justify-content:center;}}
.cell{{display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0;}}
.cell .b{{flex:1 1 auto;min-height:0;width:100%;display:flex;align-items:flex-end;justify-content:center;
  border-bottom:1px solid var(--rule);padding-bottom:0;}}
.cell img{{display:block;height:100%;max-height:156px;width:auto;max-width:92%;object-fit:contain;
  filter:drop-shadow(0 4px 8px rgba(26,24,20,.10));}}
.cell .p{{font-family:var(--mono);font-size:12px;letter-spacing:.08em;line-height:1.3;text-transform:uppercase;
  color:var(--ink-light);margin-top:10px;min-height:31px;display:flex;align-items:flex-start;justify-content:center;}}
.cell .n{{font-weight:400;font-size:20px;line-height:1.05;margin-top:4px;min-height:42px;}}
.cell .v{{font-family:var(--mono);font-size:12px;letter-spacing:.08em;color:var(--ink-light);margin-top:2px;}}
"""
def short_app(a): return a.replace(' AOC','').replace(' DOC','').replace(' DOCG','')
def vintage_line(w):
    # Two wines share producer, name and vintage (Mordorée's La Plume du
    # Peintre, Lirac and Tavel), so the appellation is added only where the
    # label would otherwise repeat.
    twins=[x for x in ALL if (x['producer'],x['name'],x['vintage'])==(w['producer'],w['name'],w['vintage'])]
    return f"{w['vintage']} · {short_app(w['appellation']).upper()}" if len(twins)>1 else str(w['vintage'])
cells=[]
for i,w in enumerate(ALL):
    img=b64(os.path.join(HERE,'bottles',bottle_name(w['image'])))
    # centre the short last row
    rem=len(ALL)%COLS; start=len(ALL)-rem
    style=''
    if rem and i==start: style=f' style="grid-column-start:{(COLS-rem)//2+1}"'
    cells.append(f'<div class="cell"{style}><div class="b"><img src="data:image/png;base64,{img}" alt="{esc(w["producer"])} {esc(w["name"])}"></div>'
                 f'<div class="p">{esc(w["producer"])}</div><div class="n">{esc(w["name"])}</div><div class="v">{esc(vintage_line(w))}</div></div>')
S4=f"""<div class="slide">
{mark(False)}
<div class="top"><span class="eyebrow">Rhône · {len(T)} tastings · {len(ALL)} wines</span></div>
<div class="grid">{''.join(cells)}</div>
</div>"""

# SLIDE 5: closing, same layout as the Fiano Horizontal closing slide.
S5_CSS="""
.body{position:absolute;left:76px;right:76px;top:50%;transform:translateY(-46%);}
.body h2{font-weight:300;font-style:italic;font-size:76px;line-height:1.12;letter-spacing:-.005em;
  margin-top:40px;max-width:880px;}
.body .rule{width:88px;height:1px;background:rgba(253,252,250,.28);margin:56px 0 40px;}
.body a{font-family:var(--mono);font-weight:400;font-size:18px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--warm-white);text-decoration:underline;text-decoration-thickness:1px;
  text-underline-offset:10px;text-decoration-color:rgba(253,252,250,.6);}
"""
NUM={8:'Eight'}[len(T)]
S5=f"""<div class="slide slide--green">
{mark(True)}
<div class="body">
  <div class="eyebrow">Rhône · Chapter {CHAPTER_NUMERAL} complete</div>
  <h2>{NUM} tastings across the valley, north to south.</h2>
  <div class="rule"></div>
  <a>silviodirubbo.github.io/cellar</a>
</div>
</div>"""

SLIDES=[('slide-1-cover','Rhône, cover',S1_CSS,S1),
        ('slide-2-northern-rhone','Rhône, Northern Rhône',DIV_CSS,divider('Northern Rhône',NORTH)),
        ('slide-3-southern-rhone','Rhône, Southern Rhône',DIV_CSS,divider('Southern Rhône',SOUTH)),
        ('slide-4-all-bottles','Rhône, all bottles',S4_CSS,S4),
        ('slide-5-closing','Rhône, closing',S5_CSS,S5)]
if __name__=='__main__':
    for name,title,css,body in SLIDES:
        open(os.path.join(HERE,name+'.html'),'w',encoding='utf-8').write(page(title,css,body))
        print('wrote',name)
