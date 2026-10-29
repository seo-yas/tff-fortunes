import json, glob, os
from PIL import Image
import numpy as np
out={}
for f in sorted(glob.glob('cats/*.avif')):
    id=os.path.basename(f)[:-5]
    a=np.asarray(Image.open(f).convert('RGB')).astype(int)
    H,W,_=a.shape
    # cream mask: light, low saturation
    r,g,b=a[...,0],a[...,1],a[...,2]
    cream=(r>205)&(g>185)&(b>140)&((r-b)<90)&((r-b)>5)
    def band(rows):
        # rows: slice of row indices; find rows where cream fraction across middle 70% > .6
        x0,x1=int(W*.15),int(W*.85)
        frac=cream[rows,x0:x1].mean(axis=1)
        idx=np.where(frac>0.6)[0]
        if len(idx)==0: return None
        # take the largest contiguous run
        runs=np.split(idx, np.where(np.diff(idx)>1)[0]+1)
        run=max(runs,key=len)
        y0,y1=rows.start+run[0], rows.start+run[-1]+1
        # horizontal extent: columns where cream frac over the band rows > .6
        colfrac=cream[y0:y1,:].mean(axis=0); cidx=np.where(colfrac>0.6)[0]
        cruns=np.split(cidx, np.where(np.diff(cidx)>1)[0]+1); crun=max(cruns,key=len)
        return dict(x=round(crun[0]/W,4), y=round(y0/H,4), w=round((crun[-1]+1-crun[0])/W,4), h=round((y1-y0)/H,4))
    out[id]={'num':band(slice(0,int(H*.12))), 'title':band(slice(int(H*.80),H))}
json.dump(out,open('boxes.json','w'),indent=1)
for k,v in out.items(): print(f"{k:20s} num={v['num']}  title={v['title']}")
