# White-background keying for the Fiano bottle product shots.
# Background = near-white pixels connected to the image border (so white
# labels and capsules inside the bottle survive). A 2px band around that
# region gets a soft alpha estimated from distance to white, then colour is
# un-premultiplied against white to kill the halo.
import os, numpy as np
from PIL import Image
from scipy import ndimage as ndi
HERE=os.path.dirname(os.path.abspath(__file__))
REPO=os.path.abspath(os.path.join(HERE,'..','..','..','..'))
def symmetric_fill(fg):
    # The Clelia shot has a white label and capsule that merge with the
    # white backdrop on one side. The bottle is symmetric, so rebuild each
    # row's span around the vertical axis using whichever side survived.
    H,W=fg.shape
    left=np.full(H,-1); right=np.full(H,-1)
    for y in range(H):
        xs=np.where(fg[y])[0]
        if len(xs): left[y]=xs.min(); right[y]=xs.max()
    body=[y for y in range(int(H*.3),int(H*.45)) if left[y]>=0]
    c=np.mean([(left[y]+right[y])/2 for y in body])
    hw=np.where(left>=0,np.maximum(c-left,right-c),0)
    hw=ndi.median_filter(hw,size=9)-3  # trim the bright JPEG rim
    xx=np.arange(W)[None,:]
    return np.abs(xx-c)<=hw[:,None]
def key_image(path, symmetric=False, trim_bottom=0):
    """Return an RGBA uint8 array of the bottle keyed off its white backdrop,
    cropped to the bottle's bounding box."""
    a=np.array(Image.open(path).convert('RGB')).astype(float)
    mn=a.min(2); mx=a.max(2)
    near=(mn>=238)&((mx-mn)<=12)
    lab,_=ndi.label(near)
    edge=np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]]))
    edge=edge[edge>0]
    bg=np.isin(lab,edge)
    fg=~bg
    fg=ndi.binary_fill_holes(fg)
    # keep the largest foreground blob (the bottle)
    l2,n=ndi.label(fg)
    if n>1:
        sizes=ndi.sum(fg,l2,range(1,n+1)); fg=l2==(np.argmax(sizes)+1)
    if symmetric:
        fg=symmetric_fill(fg)
    band=ndi.binary_dilation(fg,iterations=2)&~ndi.binary_erosion(fg,iterations=2)
    alpha=fg.astype(float)
    est=np.clip((255-mn)/40.0,0,1)
    alpha[band]=np.maximum(est[band], 0) * (ndi.binary_dilation(fg,iterations=1)[band])
    alpha=ndi.gaussian_filter(alpha,0.6)
    alpha[~ndi.binary_dilation(fg,iterations=3)]=0
    alpha[ndi.binary_erosion(fg,iterations=3)]=1
    A=np.clip(alpha,0,1)[...,None]
    rgb=np.where(A>0.02,(a-(1-A)*255)/np.maximum(A,1e-3),0)
    rgb=np.clip(rgb,0,255)
    out=np.dstack([rgb,A[...,0]*255]).astype(np.uint8)
    ys,xs=np.where(A[...,0]>0.05)
    out=out[ys.min():ys.max()+1, xs.min():xs.max()+1]
    if trim_bottom:
        out=out[:-trim_bottom]
    return out

# Fiano Horizontal bottles: key -> (source file, symmetric, trim_bottom).
# Clelia is rebuilt symmetrically and loses a 3px white row at the base.
FIANO={'picariello':('picariello_bttle.jpg',False,0),
       'diamante':('diamante_bttle.jpg',False,0),
       'clelia':('clelia_bttle.jpg',True,3),
       'isatoli':('isatoli.jpg',False,0)}

if __name__=='__main__':
    src=os.path.join(REPO,'assets','tastings','fiano-horizontal')
    os.makedirs(os.path.join(HERE,'bottles'),exist_ok=True)
    for key,(f,sym,trim) in FIANO.items():
        out=key_image(os.path.join(src,f),sym,trim)
        Image.fromarray(out,'RGBA').save(os.path.join(HERE,'bottles',key+'.png'))
        print(key,out.shape)
