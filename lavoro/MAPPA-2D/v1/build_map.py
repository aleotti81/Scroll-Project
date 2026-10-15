# Genera index.html (mappa 2D illustrata SVG) da OSM + classificazione satellitare. Costo: 0.
import math, io, json, random, urllib.request, xml.etree.ElementTree as ET, os
from PIL import Image
HERE=os.path.dirname(os.path.abspath(__file__))
OSM=os.path.expanduser('~/analisi/osm_map.xml')
S,N,Wl,E=43.2550,43.2632,11.6955,11.7080
W=1600; MX=111320*math.cos(math.radians((S+N)/2)); MY=111320
H=round(W*(N-S)*MY/((E-Wl)*MX)); PXM=W/((E-Wl)*MX)
def P(lat,lon): return ((lon-Wl)/(E-Wl)*W,(N-lat)/(N-S)*H)
HOUSE=(43.259656,11.703186); HX,HY=P(*HOUSE)
def rel(e,n): return (HX+e*PXM,HY-n*PXM)
random.seed(7)
# --- satellite (Esri World Imagery z17) per classificare bosco / uliveto
def tile(lat,lon,z):
    n=2**z;return (lon+180)/360*n,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n
Z=17;x0,y0=tile(N,Wl,Z);x1,y1=tile(S,E,Z)
cache=os.path.expanduser('~/analisi/sat_bbox_z17.png')
tx0,ty0,tx1,ty1=int(x0),int(y0),int(x1),int(y1)
if os.path.exists(cache): sat=Image.open(cache).convert('RGB')
else:
    sat=Image.new('RGB',((tx1-tx0+1)*256,(ty1-ty0+1)*256))
    for tx in range(tx0,tx1+1):
        for ty in range(ty0,ty1+1):
            b=urllib.request.urlopen(urllib.request.Request(f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{Z}/{ty}/{tx}",headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read()
            sat.paste(Image.open(io.BytesIO(b)).convert('RGB'),((tx-tx0)*256,(ty-ty0)*256))
    sat.save(cache)
def satpx(lat,lon):
    x,y=tile(lat,lon,Z);return (x-tx0)*256,(y-ty0)*256
def block(lat,lon,r=4):
    cx,cy=satpx(lat,lon);px=[sat.getpixel((int(cx)+i,int(cy)+j)) for i in range(-r,r+1,2) for j in range(-r,r+1,2)]
    L=[(p[0]+p[1]+p[2])/3 for p in px];m=sum(L)/len(L);sd=(sum((l-m)**2 for l in L)/len(L))**.5
    R=sum(p[0] for p in px)/len(px);G=sum(p[1] for p in px)/len(px);return m,sd,R,G
# --- OSM
root=ET.parse(OSM).getroot()
nodes={n.get('id'):(float(n.get('lat')),float(n.get('lon'))) for n in root.iter('node')}
ways=[]
for w in root.iter('way'):
    t={x.get('k'):x.get('v') for x in w.iter('tag')}
    pts=[nodes[x.get('ref')] for x in w.iter('nd') if x.get('ref') in nodes]
    if len(pts)>1: ways.append((w.get('id'),t,pts))
def d(pts,close=False): return 'M'+' L'.join(f'{x:.1f},{y:.1f}' for x,y in (P(*p) for p in pts))+(' Z' if close else '')
resid=[pts for _,t,pts in ways if t.get('landuse') in('residential','industrial','railway')]
def inpoly(pt,poly):
    x,y=pt;c=False
    for i in range(len(poly)):
        (a,b),(c2,d2)=poly[i],poly[i-1]
        if (b>y)!=(d2>y) and x<(c2-a)*(y-b)/(d2-b)+a: c=not c
    return c
roadpts=[P(*p) for _,t,pts in ways if t.get('highway') in('residential','primary','trunk','tertiary','service','track') for p in pts]
def nearroad(x,y,r=9): return any(abs(x-a)<r and abs(y-b)<r for a,b in roadpts)
# --- vegetazione
shadow=[];forest=[];olive=[]
step=13
lat=N
while lat>S:
    lon=Wl
    while lon<E:
        la=lat+random.uniform(-3,3)/MY;lo=lon+random.uniform(-3,3)/MX
        x,y=P(la,lo)
        if not any(inpoly((la,lo),r) for r in resid) and math.hypot(x-HX,y-HY)>34:
            m,sd,R,G=block(la,lo)
            if m<78 and G>=R-4:
                rr=random.uniform(11,15);forest.append((x,y,rr,random.choice(['#4c672b','#56722f','#5f7d36','#46612a'])))
            elif m>92 and sd>14 and not nearroad(x,y):
                for k in range(2):
                    ox,oy=x+random.uniform(-4,4)+k*6.5-3,y+random.uniform(-4,4)
                    olive.append((ox,oy,random.uniform(2.6,3.4)))
        lon+=step/MX
    lat-=step/MY
veg=''.join(f'<ellipse cx="{x+3:.0f}" cy="{y+4:.0f}" rx="{r:.0f}" ry="{r*.7:.0f}"/>' for x,y,r,_ in forest)
vegshadow=f'<g fill="#2f3d1a" opacity=".25">{veg}</g>'
forestsvg='<g>'+''.join(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="{c}"/>' for x,y,r,c in forest)+'</g>'
olivesvg='<g fill="#8f9c62" stroke="#6f7c46" stroke-width=".8">'+''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}"/>' for x,y,r in olive)+'</g>'
# --- strade, ferrovia, acqua, edifici
st={'trunk':(13,'#e3cf96','#a8915a'),'primary':(9,'#f7ecc9','#b39f70'),'tertiary':(7,'#f7ecc9','#b39f70'),'residential':(6,'#f4e8c8','#b8a578'),'service':(4,'#f4e8c8','#b8a578'),'pedestrian':(5,'#efe4c4','#b8a578')}
cas=[];fil=[];trk=[];rail=[];water=[];bld=[];croce=None
for wid,t,pts in ways:
    h=t.get('highway')
    if h in st:
        w_,f_,c_=st[h];cas.append(f'<path d="{d(pts)}" stroke="{c_}" stroke-width="{w_+3}"/>');fil.append(f'<path d="{d(pts)}" stroke="{f_}" stroke-width="{w_}"/>')
        if t.get('name')=='Via della Croce': croce=pts
    elif h in('track','path','footway'): trk.append(f'<path d="{d(pts)}"/>')
    elif t.get('railway')=='rail': rail.append(d(pts))
    elif t.get('waterway') in('stream','drain'): water.append(f'<path d="{d(pts)}" stroke-width="{2.5 if t["waterway"]=="stream" else 1.5}"/>')
    elif t.get('natural')=='water': water.append(f'<path d="{d(pts,True)}" fill="#9cc6d6" stroke-width="1"/>')
    elif 'building' in t:
        cls='hb' if wid in('714331973','714331969') else 'b'
        bld.append(f'<path class="{cls}" d="{d(pts,True)}"/>')
croce_d=d(croce) if croce else ''
for wid,t,pts in ways:
    if t.get('highway')=='trunk': trunk_d=d(pts)
# --- proprieta' (posizioni indicative, metri rispetto alla casa: est, nord)
prop={'piscina':(20,-24),'jacuzzi':(10,-11),'terrazza':(-15,-3),'barbecue':(-17,9),'ingresso':(26,6),'musica':(-6,-14)}
px,py=rel(*prop['piscina']);jx,jy=rel(*prop['jacuzzi'])
propsvg=f'''<g id="prop">
<path d="M{HX-28:.1f},{HY+2:.1f} q-6,-14 12,-26 q22,-10 40,4 q14,22 4,44 q-26,14 -48,2 z" fill="#d8c79a" opacity=".55"/>
<rect x="{px-11:.1f}" y="{py-7:.1f}" width="22" height="14" rx="1.5" fill="#b07a45"/>
<rect x="{px-8:.1f}" y="{py-4.5:.1f}" width="16" height="9" rx="1" fill="#3fb8d8" stroke="#e9f7fb" stroke-width=".8"/>
<circle cx="{jx:.1f}" cy="{jy:.1f}" r="2.6" fill="#7fd0e6" stroke="#fff" stroke-width=".8"/>
<rect x="{rel(*prop['terrazza'])[0]-6:.1f}" y="{rel(*prop['terrazza'])[1]-5:.1f}" width="12" height="10" fill="#c56f45" opacity=".8"/>
<path d="M{rel(*prop['ingresso'])[0]:.1f},{rel(*prop['ingresso'])[1]:.1f} Q{HX+14:.1f},{HY+2:.1f} {HX+6:.1f},{HY:.1f}" stroke="#cfc6b0" stroke-width="3" fill="none" stroke-dasharray="2 1.4"/>
</g>'''
# --- citta' lontane: frecce sul bordo
def hav(a,b):
    p1,p2=math.radians(a[0]),math.radians(b[0]);dl=math.radians(b[1]-a[1]);dp=p2-p1
    return 6371*2*math.asin(math.sqrt(math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2))
towns={'Siena':(43.3186,11.3306),'Sinalunga':(43.2131,11.7372),'Montepulciano':(43.0987,11.7869),'Cortona':(43.2752,11.9855),'Lago Trasimeno':(43.1265,12.0510)}
arrows=''
for nm,c in towns.items():
    dx=(c[1]-HOUSE[1])*MX;dy=-(c[0]-HOUSE[0])*MY;L=math.hypot(dx,dy);ux,uy=dx/L,dy/L
    m=60;ts=[t for t in [((W-m)-HX)/ux if ux>0 else (m-HX)/ux if ux<0 else 1e9,((H-m)-HY)/uy if uy>0 else (m-HY)/uy if uy<0 else 1e9] if t>0]
    t=min(ts);ax,ay=HX+ux*t,HY+uy*t;ang=math.degrees(math.atan2(uy,ux))
    arrows+=f'<g class="town" transform="translate({ax:.0f},{ay:.0f})"><g transform="rotate({ang:.0f})"><path d="M-8,-9 L10,0 L-8,9 L-3,0 Z" fill="#758d15"/></g><text y="{-16 if uy<0 else 26}" text-anchor="{"end" if ax>W-250 else "start" if ax<250 else "middle"}">{nm} · {hav(HOUSE,c):.0f} km</text></g>'
def dist(a): return hav(HOUSE,a)*1000
borgo=(43.262155,11.6965032);staz=(43.2568675,11.7065294)
# --- punti cliccabili
pins=[
 dict(id='casa',lvl='o',xy=(HX,HY),ic='fa',g='\\f015',t='Happy Tuscany',zoom=1),
 dict(id='borgo',lvl='o',xy=P(*borgo),ic='td',g='\\e0a2',t='Borgo di Rigomagno'),
 dict(id='stazione',lvl='o',xy=P(*staz),ic='fa',g='\\f238',t='Stazione di Rigomagno'),
 dict(id='vista',lvl='o',xy=(HX+120,HY+60),ic='fa',g='\\f06e',t='Vista sulla Valdichiana'),
 dict(id='piscina',lvl='p',xy=rel(*prop['piscina']),ic='td',g='\\e109',t='Piscina panoramica',video=1),
 dict(id='jacuzzi',lvl='p',xy=rel(*prop['jacuzzi']),ic='fa',g='\\f043',t='Idromassaggio con vista'),
 dict(id='terrazza',lvl='p',xy=rel(*prop['terrazza']),ic='td',g='\\e0ab',t='Terrazza e amaca'),
 dict(id='barbecue',lvl='p',xy=rel(*prop['barbecue']),ic='td',g='\\e063',t='Barbecue e asado'),
 dict(id='musica',lvl='p',xy=rel(*prop['musica']),ic='fa',g='\\f001',t='Musica e karaoke'),
 dict(id='ingresso',lvl='p',xy=rel(*prop['ingresso']),ic='fa',g='\\f1b9',t='Ingresso e parcheggio'),
 dict(id='interni',lvl='p',xy=(HX-1,HY-1),ic='fa',g='\\f015',t='La casa'),
]
INFO={
 'casa':dict(txt='Casa vacanze in collina, Via della Croce 200, Rigomagno (SI). Tocca "Entra nella proprietà" per vedere piscina, terrazza e servizi.',imgs=['si2','Bordo-piscina','WhatsApp-Image-2025-06-06-at-15.11.05']),
 'borgo':dict(txt=f'Il borgo di Rigomagno, a circa {dist(borgo):.0f} m in linea d\'aria dalla casa, lungo Via della Croce.',imgs=[]),
 'stazione':dict(txt=f'Stazione di Rigomagno, linea Siena–Chiusi: circa {dist(staz):.0f} m in linea d\'aria. Accanto passa il raccordo Siena–Bettolle.',imgs=[]),
 'vista':dict(txt='In posizione collinare, la casa offre una vista mozzafiato unica sul paesaggio toscano della Valdichiana.',imgs=['WhatsApp-Image-2025-05-09-at-00.14.06-5','si2']),
 'piscina':dict(txt='Piscina privata immersa tra gli ulivi, con deck in legno e vista aperta sulla campagna toscana.',imgs=['Bordo-piscina','si2']),
 'jacuzzi':dict(txt='Concediti un momento di puro relax nell\'idromassaggio all\'aperto, immerso nel verde e affacciato sulle dolci colline toscane.',imgs=['b0a43d67-86dc-4e6f-a48c-304c055224b2']),
 'terrazza':dict(txt='Terrazza attrezzata con vista mozzafiato, amaca e una grande zona dedicata a cene all\'aperto.',imgs=['WhatsApp-Image-2025-06-06-at-15.11.05-1','WhatsApp-Image-2025-06-18-at-14.19.38','WhatsApp-Image-2025-06-06-at-15.11.05']),
 'barbecue':dict(txt='Barbecue in muratura e asado alla brace per grigliate conviviali.',imgs=['Cruz','WhatsApp-Image-2025-06-21-at-07.19.31-3','WhatsApp-Image-2025-06-21-at-07.19.31-4']),
 'musica':dict(txt='Musica, videoproiezioni e karaoke per le serate all\'aperto.',imgs=['WhatsApp-Image-2025-06-21-at-07.19.30-3','WhatsApp-Image-2025-06-21-at-07.19.31-1']),
 'ingresso':dict(txt='Vialetto in pietra illuminato e spazio per parcheggiare davanti alla casa.',imgs=['WhatsApp-Image-2025-06-06-at-15.11.04-1','WhatsApp-Image-2025-06-21-at-07.19.30-1']),
 'interni':dict(txt='Tre camere: due matrimoniali con bagno privato e aria condizionata, di cui una con splendida vista panoramica; la terza con letti singoli unibili. Salone per oltre 30 persone.',imgs=['Tavolone','WhatsApp-Image-2025-06-06-at-15.11.05-3','Stufa-2','WhatsApp-Image-2025-05-09-at-00.14.05-4']),
}
for p in pins: p.update(INFO[p['id']])
pinsvg=''.join(f'<g class="pin {p["lvl"]}" data-id="{p["id"]}" data-x="{p["xy"][0]:.1f}" data-y="{p["xy"][1]:.1f}"><g class="s"><circle class="pulse" r="21"/><circle class="c" r="21"/><circle class="ring" r="17"/><text class="ic {p["ic"]}" dy="7">&#x{p["g"][1:]};</text><text class="lb" y="42">{p["t"]}</text></g></g>' for p in pins)
PROPBOX=[HX-95,HY-62,190,124]
tpl=open(os.path.join(HERE,'template.html'),encoding='utf-8').read()
out=(tpl.replace('%W%',str(W)).replace('%H%',str(H))
 .replace('%VEGSHADOW%',vegshadow).replace('%FOREST%',forestsvg).replace('%OLIVE%',olivesvg)
 .replace('%WATER%',''.join(water)).replace('%TRACKS%',''.join(trk)).replace('%CASING%',''.join(cas)).replace('%FILL%',''.join(fil))
 .replace('%RAIL%',''.join(f'<path d="{r}" class="r1"/><path d="{r}" class="r2"/>' for r in rail))
 .replace('%BLD%',''.join(bld)).replace('%PROP%',propsvg).replace('%CROCE%',croce_d).replace('%TRUNK%',trunk_d)
 .replace('%ARROWS%',arrows).replace('%PINS%',pinsvg)
 .replace('%LBORGO%','{:.0f},{:.0f}'.format(*P(*borgo))).replace('%PROPBOX%',json.dumps(PROPBOX))
 .replace('%DATA%',json.dumps({p['id']:dict(t=p['t'],txt=p['txt'],imgs=p['imgs'],video=p.get('video',0),zoom=p.get('zoom',0)) for p in pins},ensure_ascii=False)))
open(os.path.join(HERE,'index.html'),'w',encoding='utf-8').write(out)
print('W,H',W,H,'house',round(HX),round(HY),'forest',len(forest),'olive',len(olive),'bld',len(bld),'KB',len(out)//1024)
