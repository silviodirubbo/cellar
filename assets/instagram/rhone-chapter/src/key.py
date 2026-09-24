# Bottle cutouts for the Rhône bottle grid. Adapted from
# assets/instagram/fiano-horizontal/src/key.py with two additions:
#  - images that already carry transparency are only cropped to the bottle;
#  - opaque images are keyed against their own backdrop colour (sampled from
#    the border) rather than assuming pure white, since the Clusel-Roch shot
#    sits on beige.
# Background = backdrop-coloured pixels connected to the image border, so
# white labels and capsules inside the bottle survive. A 2px band around the
# bottle gets a soft alpha, and colour is un-premultiplied against the
# backdrop to remove the halo.
import os, sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0,HERE)
import wines

def crop_to_alpha(out, thresh=0.05):
    ys,xs=np.where(out[...,3]>thresh*255)
    return out[ys.min():ys.max()+1, xs.min():xs.max()+1]

def key_image(path):
    im=Image.open(path).convert('RGBA')
    rgba=np.array(im)
    border=np.concatenate([rgba[0],rgba[-1],rgba[:,0],rgba[:,-1]])
    if (border[:,3]<250).mean()>0.5:
        return crop_to_alpha(rgba), 'alpha'
    a=rgba[...,:3].astype(float)
    bgc=np.median(border[:,:3].astype(float),axis=0)
    dist=np.abs(a-bgc).max(2)
    near=dist<=14
    lab,_=ndi.label(near)
    edge=np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]]))
    edge=edge[edge>0]
    fg=~np.isin(lab,edge)
    fg=ndi.binary_fill_holes(fg)
    # keep the largest foreground blob (the bottle)
    l2,n=ndi.label(fg)
    if n>1:
        sizes=ndi.sum(fg,l2,range(1,n+1)); fg=l2==(np.argmax(sizes)+1)
    band=ndi.binary_dilation(fg,iterations=2)&~ndi.binary_erosion(fg,iterations=2)
    alpha=fg.astype(float)
    est=np.clip(dist/40.0,0,1)
    alpha[band]=est[band]*(ndi.binary_dilation(fg,iterations=1)[band])
    alpha=ndi.gaussian_filter(alpha,0.6)
    alpha[~ndi.binary_dilation(fg,iterations=3)]=0
    alpha[ndi.binary_erosion(fg,iterations=3)]=1
    A=np.clip(alpha,0,1)[...,None]
    rgb=np.where(A>0.02,(a-(1-A)*bgc)/np.maximum(A,1e-3),0)
    rgb=np.clip(rgb,0,255)
    out=np.dstack([rgb,A[...,0]*255]).astype(np.uint8)
    return crop_to_alpha(out), 'keyed on #%02X%02X%02X'%tuple(int(v) for v in bgc)

def bottle_name(path):
    # assets/tastings/<slug>/<file> -> <slug>__<file stem without extensions>
    slug=os.path.basename(os.path.dirname(path))
    stem=os.path.basename(path).split('.')[0]
    return f'{slug}__{stem}.png'

if __name__=='__main__':
    os.makedirs(os.path.join(HERE,'bottles'),exist_ok=True)
    done=set()
    for t in wines.load():
        for w in t['wines']:
            if w['image'] in done: continue
            done.add(w['image'])
            out,how=key_image(w['image'])
            Image.fromarray(out,'RGBA').save(os.path.join(HERE,'bottles',bottle_name(w['image'])))
            print(bottle_name(w['image']),out.shape,how)
