# Rhône chapter wine list for the bottle grid. Titles, names, producers and
# vintages must match _data/tastings.yml exactly; image paths come from each
# tasting's deck in _tastings/<slug>.html.
import os, yaml
HERE=os.path.dirname(os.path.abspath(__file__))
REPO=os.path.abspath(os.path.join(HERE,'..','..','..','..'))

# (slug, wine name, producer, vintage) -> bottle image under assets/tastings/<slug>/
IMAGES={
 ('syrah-rhone-cortona','Syrah','Stefano Amerighi',2022):'bottle_amerighi.png.png',
 ('syrah-rhone-cortona','Saint-Joseph Le Ponts','Domaine Les Alexandrins',2022):'bottle_alexandrins.png.png',
 ('syrah-rhone-cortona','Châteauneuf-du-Pape','Le Vieux Donjon',2022):'bottle_vieux_donjon.png.png',
 ('northern-rhone-syrahs','Les Eygats Cornas','Domaine Courbis',2022):'bottle1.png',
 ('northern-rhone-syrahs','Les Schistes','Clusel-Roch',2020):'bottle2.png',
 ('northern-rhone-syrahs','Le Vignon','J.M.B. Sorrel',2019):'bottle3.png',
 ('northern-rhone-whites','Les Chaillets','Yves Cuilleron',2023):'bottle1.png.png',
 ('northern-rhone-whites','Pur Blanc','Domaine du Tunnel',2023):'bottle2.png.png',
 ('northern-rhone-whites','Chante-Alouette','M. Chapoutier',2021):'bottle3.png.png',
 ('cote-rotie-horizontal','Ampodium','Domaine René Rostaing',2022):'bottle_rostaing.png.png',
 ('cote-rotie-horizontal','Blonde du Seigneur','Domaine Georges Vernay',2022):'bottle_vernay.png.png',
 ('cote-rotie-horizontal','La Viallière','Yves Cuilleron',2022):'bottle_cuilleron.png.png',
 ('condrieu-horizontal',"Les Terrasses de l'Empire",'Domaine Georges Vernay',2023):'bottle_vernay_terrasses.png.png',
 ('condrieu-horizontal',"Les Chaillées de l'Enfer",'Domaine Georges Vernay',2023):'bottle_vernay_chaillees.png.png',
 ('condrieu-horizontal','Villa Pontciana','François Villard',2020):'bottle_villard.png.png',
 ('southern-rhone-overview','La Plume du Peintre','Domaine de la Mordorée',2023,'Lirac AOC'):'bottle_lirac_mordoree.png',
 ('southern-rhone-overview','La Plume du Peintre','Domaine de la Mordorée',2023,'Tavel AOC'):'bottle_tavel_mordoree.png',
 ('southern-rhone-overview','Les Hautes Garrigues','Domaine Santa Duc',2022):'bottle_les_hautes_garrigues.png',
 ('southern-rhone-overview','IGP Vaucluse','Domaine Gourt de Mautens',2012):'bottle_gourt_de_mautens.png',
 ('chateauneuf-du-pape-the-whites','Clos La Roquète','Domaine du Vieux Télégraphe',2021):'bottle_vieux-telegraphe.png',
 ('chateauneuf-du-pape-the-whites','Châteauneuf-du-Pape Blanc','Clos des Papes',2021):'bottle_clos-des-papes.png',
 ('chateauneuf-du-pape-the-whites','Châteauneuf-du-Pape Blanc','Famille Isabel Ferrando',2021):'bottle_ferrando.png',
 # Same cuvée as the 2021, and the deck deliberately reuses the one image.
 ('chateauneuf-du-pape-the-whites','Châteauneuf-du-Pape Blanc','Clos des Papes',2014):'bottle_clos-des-papes.png',
 ('chateauneuf-du-pape-the-reds','La Crau','Domaine du Vieux Télégraphe',2023):'bottle_vieux-telegraphe.png',
 ('chateauneuf-du-pape-the-reds','Châteauneuf-du-Pape','Clos des Papes',2021):'bottle_clos-des-papes.png',
 ('chateauneuf-du-pape-the-reds','Châteauneuf-du-Pape','Château de Beaucastel',2017):'bottle_beaucastel.png',
}

def load():
    """Rhône tastings from tastings.yml in chapter order, each wine joined to
    its bottle image. Raises if any wine has no image or any image key is
    unused, so the grid cannot drift from the data."""
    data=yaml.safe_load(open(os.path.join(REPO,'_data','tastings.yml'),encoding='utf-8'))
    tastings=sorted([t for t in data if t.get('chapter')=='rhone'],key=lambda t:t['chapter_order'])
    used=set(); out=[]
    for t in tastings:
        wines=[]
        for w in t['wines']:
            k=(t['slug'],w['name'],w['producer'],w['vintage'])
            if k not in IMAGES: k=k+(w['appellation'],)
            img=IMAGES[k]; used.add(k)
            wines.append(dict(w,image=os.path.join(REPO,'assets','tastings',t['slug'],img),key=k))
        out.append(dict(t,wines=wines))
    unused=set(IMAGES)-used
    if unused: raise SystemExit(f'unused image keys: {unused}')
    return out

if __name__=='__main__':
    for t in load():
        print(t['chapter_order'],t['title'],'|',t['region'])
        for w in t['wines']: print('   ',w['producer'],'|',w['name'],w['vintage'],'->',os.path.relpath(w['image'],REPO))
