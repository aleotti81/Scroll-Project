import os,sys,math,random,json,re
sys.path.insert(0,'.')
import inner3 as I
random.seed(3)
W,H=1600,1000;CX,CY=820,430;HO=(43.2597,11.7032);K=30
def P(lat,lon):
    dx=(lon-HO[1])*111.32*math.cos(math.radians(43.26));dy=(HO[0]-lat)*111.32
    r=math.hypot(dx,dy)
    if r<1e-6:return (CX,CY)
    rc=K*r**0.55/(1+max(0,r-60)/200);x,y=CX+rc*dx/r,CY+rc*dy/r;y=CY+(y-CY)*(.75 if y<CY else 1.0);x=CX+(x-CX)*(1+(y-CY)/1800);return (x,y)
C={'Firenze':(43.769,11.256,'duomo'),'Pisa':(43.723,10.396,'pisa'),'Siena':(43.318,11.331,'torre'),'San Gimignano':(43.468,11.043,'torri'),'Certaldo':(43.548,11.041,'dot'),
'Montepulciano':(43.093,11.781,'torre'),'Pienza':(43.076,11.679,'dot'),"Val d'Orcia":(43.058,11.605,'cipressi'),'Arezzo':(43.463,11.879,'torre'),'La Verna':(43.707,11.931,'dot'),
'Anghiari':(43.541,12.055,'dot'),'Cortona':(43.275,11.985,'torre'),'Perugia':(43.111,12.389,'torre'),'Assisi':(43.071,12.615,'torre'),'S. Maria degli Angeli':(43.058,12.580,'dot'),
'Eremo delle Carceri':(43.067,12.640,'dot'),'Roma':(41.902,12.496,'colosseo'),'Rapolano Terme':(43.289,11.604,'dot')}
XY={k:P(a,b) for k,(a,b,_) in C.items()};XY['HT']=(CX,CY)
def _mv(k,b,dx,dy): XY[k]=(XY[b][0]+dx,XY[b][1]+dy)
_mv('S. Maria degli Angeli','Perugia',60,14);_mv('Assisi','Perugia',115,-6);_mv('Eremo delle Carceri','Perugia',170,-42)
_mv('Pienza','Montepulciano',-72,18);_mv("Val d'Orcia",'Montepulciano',-145,34)
B='https://www.happytuscany.it/tours/'
TOURS=[('siena-s-gimignano-certaldo-val-delsa','Siena · San Gimignano · Certaldo','1 giorno · da 80 €',['Siena','San Gimignano','Certaldo'],'#1d8db0'),
('firenze','Firenze','1 giorno · da 80 €',['Firenze'],'#e94b3c'),('pisa','Pisa','1 giorno · da 80 €',['Pisa'],'#8e44ad'),('roma','Roma','1 giorno · da 80 €',['Roma'],'#333333'),
('montepulciano-val-dorcia-pienza',"Montepulciano · Val d'Orcia · Pienza",'1 giorno · da 80 €',['Montepulciano','Pienza',"Val d'Orcia"],'#f39200'),
('assisi-eremo-delle-carceri-perugia','Perugia · Assisi · Eremo delle Carceri','1 giorno · da 80 €',['Perugia','S. Maria degli Angeli','Assisi','Eremo delle Carceri'],'#16a085'),
('arezzo-verna-anghiari-cortona','Arezzo · La Verna · Anghiari · Cortona','1 giorno · da 80 €',['Arezzo','La Verna','Anghiari','Cortona'],'#c0392b'),
('wine-tour-montepulciano','Wine Tour Montepulciano','½ giornata · da 40 €',['Montepulciano'],'#8f3a5a'),('a-15-minuti-dalle-terme-di-rapolano','Terme di Rapolano','½ giornata · da 30 €',['Rapolano Terme'],'#4a9a3a')]
DESC={'siena-s-gimignano-certaldo-val-delsa':"Siena e Piazza del Campo, le torri di San Gimignano e il borgo medievale di Certaldo in Val d'Elsa.",
'firenze':"Duomo, Ponte Vecchio e Uffizi: il centro si gira a piedi. Conviene parcheggiare fuori dalla ZTL.",
'pisa':"Piazza dei Miracoli con la Torre pendente, il Duomo e il Battistero, poi una passeggiata sui lungarni.",
'roma':"Giornata lunga: Colosseo, Fori Imperiali e centro storico. Partenza presto consigliata.",
'montepulciano-val-dorcia-pienza':"Montepulciano e il Vino Nobile, Pienza città ideale del Rinascimento e i cipressi della Val d'Orcia.",
'assisi-eremo-delle-carceri-perugia':"Perugia, la Basilica di Santa Maria degli Angeli, Assisi e San Francesco, l'Eremo delle Carceri sul Subasio.",
'arezzo-verna-anghiari-cortona':"Arezzo e Piazza Grande, il santuario della Verna, il borgo di Anghiari e Cortona sulla Valdichiana.",
'wine-tour-montepulciano':"Mezza giornata tra le cantine storiche di Montepulciano.",
'a-15-minuti-dalle-terme-di-rapolano':"Le terme di Rapolano a pochi minuti da casa: mezza giornata di relax."}
GAL=json.load(open('tours/gallery.json'))
def hav(a,b):
    p1,p2=math.radians(a[0]),math.radians(b[0]);dl=math.radians(b[1]-a[1]);dp=p2-p1
    return 2*6371*math.asin(math.sqrt(math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2))
def arc(a,b):
    L=math.hypot(b[0]-a[0],b[1]-a[1]);nx,ny=-(b[1]-a[1])/L,(b[0]-a[0])/L
    if ny>0 or (abs(ny)<.2 and nx>0):nx,ny=-nx,-ny
    h=(.3+.22*min(1,max(0,L-200)/300))*L;return ((a[0]+b[0])/2+nx*h,(a[1]+b[1])/2+ny*h)
def curve(pts):
    d=f'M{pts[0][0]:.0f},{pts[0][1]:.0f}';al=list(pts)
    for a,c in zip(pts,pts[1:]):
        q=arc(a,c);al.append(q);d+=f' Q{q[0]:.0f},{q[1]:.0f} {c[0]:.0f},{c[1]:.0f}'
    return d,al
def samp(pts,n=60):
    p=[pts[0]]+pts+[pts[-1]];o=[]
    for i in range(1,len(p)-2):
        a,b,c,e=p[i-1],p[i],p[i+1],p[i+2];o+=I.bez(b,(b[0]+(c[0]-a[0])/6,b[1]+(c[1]-a[1])/6),(c[0]-(e[0]-b[0])/6,c[1]-(e[1]-b[1])/6),c,n)[:-1]
    return o+[pts[-1]]
def river(P2,w0,w1,cls='rvw'):
    L=[];R=[];n=len(P2)
    for i,(x,y) in enumerate(P2):
        a,c=P2[max(0,i-1)],P2[min(n-1,i+1)];dx,dy=c[0]-a[0],c[1]-a[1];l=math.hypot(dx,dy) or 1;w=(w0+(w1-w0)*i/(n-1))/2
        L.append((x-dy/l*w,y+dx/l*w));R.append((x+dy/l*w,y-dx/l*w))
    poly=' '.join(f'{x:.1f},{y:.1f}' for x,y in L+R[::-1]);mid=' '.join(f'{x:.1f},{y:.1f}' for x,y in P2[n//8:-n//8])
    return f'<polygon points="{poly}" class="{cls}"/><polyline points="{mid}" class="rvh"/>'
def curve_old(pts):
    if len(pts)==2:
        (x0,y0),(x1,y1)=pts;L=math.hypot(x1-x0,y1-y0);nx,ny=-(y1-y0)/L,(x1-x0)/L;b=min(60,L*.18)
        pts=[pts[0],((x0+x1)/2+nx*b,(y0+y1)/2+ny*b),pts[1]]
    p=[pts[0]]+pts+[pts[-1]];d=f'M{p[1][0]:.0f},{p[1][1]:.0f}'
    for i in range(1,len(p)-2):
        a,b,c,e=p[i-1],p[i],p[i+1],p[i+2]
        d+=f' C{b[0]+(c[0]-a[0])/6:.0f},{b[1]+(c[1]-a[1])/6:.0f} {c[0]-(e[0]-b[0])/6:.0f},{c[1]-(e[1]-b[1])/6:.0f} {c[0]:.0f},{c[1]:.0f}'
    return d,pts
routes='';legend='';TD={};rpts=[]
for i,(s,t,du,st,col) in enumerate(TOURS):
    pts=[XY['HT']]+[XY[k] for k in st];d,al=curve(pts)
    ll=[HO]+[C[k][:2] for k in st];legs=[];kms=[];tot=0
    for a,c,k in zip(ll,ll[1:],st):
        km=hav(a,c)*1.3;tot+=km;legs.append(f'{k} {km:.0f} km');kms.append(km)
    tot+=hav(ll[-1],HO)*1.3;hrs=tot/65
    when='Fattibile in mezza giornata' if tot<90 else ('Fattibile in giornata' if tot<480 else 'Meglio in 2 giorni')
    xs=[p[0] for p in al];ys=[p[1] for p in al]
    tl=''
    for (a,c),kmv in zip(zip(pts,pts[1:]),kms):
        q=arc(a,c);mx,my=.25*a[0]+.5*q[0]+.25*c[0],.25*a[1]+.5*q[1]+.25*c[1];m=max(10,round(kmv/65*6)*10)
        lab=f"{m}'" if m<60 else (f"{m//60}h" if m%60==0 else f"{m//60}h{m%60:02d}");w=8*len(lab)+14
        tl+=f'<g class="tl" transform="translate({mx:.0f},{my:.0f})"><rect x="{-w/2:.0f}" y="-10" width="{w}" height="20" rx="10" fill="#fff" stroke="{col}" stroke-width="1.5"/><text y="5" text-anchor="middle">{lab}</text></g>'
    routes+=f'<g class="rt" data-t="{s}"><path d="{d}" class="hit"/><path id="r{i}" d="{d}" class="ln" stroke="{col}"/>{tl}</g>'
    legend+=f'<li data-t="{s}"><i style="background:{col}"></i>{t}<small>{tot:.0f} km</small></li>'
    TD[s]={'t':t,'desc':DESC[s],'legs':legs,'tot':round(tot/5)*5,'h':round(hrs*2)/2,'when':when,'st':st,'imgs':GAL.get(s) or ['tours/'+s+'.webp'],'bb':[min(xs),min(ys),max(xs),max(ys)]}
COAST=[(44.10,9.83),(43.87,10.25),(43.55,10.31),(43.25,10.50),(42.93,10.53),(42.80,10.74),(42.70,10.98),(42.40,11.15),(42.09,11.79),(41.77,12.23),(41.45,12.62),(41.2,13.0)]
cp=[P(a,b) for a,b in COAST]
land=[(cp[0][0],-50)]+cp+[(cp[-1][0],1100),(1700,1100),(1700,-50)]
def inland(x,y):
    c=False;n=len(land)
    for i in range(n):
        (x1,y1),(x2,y2)=land[i],land[i-1]
        if (y1>y)!=(y2>y) and x<(x2-x1)*(y-y1)/(y2-y1)+x1:c=not c
    return c
landd=curve(cp)[0];landd=f'M{cp[0][0]:.0f},-50 L'+landd[1:]+f' L{cp[-1][0]:.0f},1100 L1700,1100 L1700,-50Z'
LT=P(43.13,12.10);el=P(42.78,10.27)
ARNO=[(43.62,11.88),(43.70,11.55),(43.77,11.25),(43.70,10.95),(43.68,10.40),(43.68,10.28)];TEV=[(43.57,12.14),(43.30,12.30),(43.07,12.42),(42.70,12.43),(42.46,12.39),(42.10,12.55),(41.90,12.47),(41.75,12.25)]
riv=''
for R,w0,w1 in ((ARNO,4,11),(TEV,4,13)):
    riv+=river(samp([P(a,b) for a,b in R],30),w0,w1)
def icon(x,y,k):
    g={'duomo':'<rect x="-16" y="-20" width="32" height="20" fill="#f4e3c1"/><path d="M-12,-20 A12,12 0 0 1 12,-20Z" fill="#c9573a"/><rect x="18" y="-34" width="8" height="34" fill="#efe2c8"/><path d="M-2,-32 h4 v-6 h-4z" fill="#f4e3c1"/>',
    'pisa':'<g transform="rotate(8)"><rect x="-7" y="-40" width="14" height="40" fill="#f6f1e4" stroke="#cdbf9e"/><path d="M-7,-30 h14 M-7,-20 h14 M-7,-10 h14" stroke="#cdbf9e"/></g>',
    'colosseo':'<path d="M-24,0 v-22 q24,-10 48,0 v22z" fill="#e3c08f"/><path d="M-18,-4 v-8 m9,9 v-9 m9,9 v-9 m9,9 v-9 m9,9 v-9" stroke="#9a6a3a" stroke-width="3"/>',
    'torre':'<rect x="-14" y="-16" width="20" height="16" fill="#f4e3c1"/><path d="M-16,-16 L-4,-24 L8,-16Z" fill="#c9573a"/><rect x="8" y="-34" width="8" height="34" fill="#efe2c8"/><path d="M7,-34 L12,-40 L17,-34Z" fill="#b44a33"/>',
    'torri':''.join(f'<rect x="{dx}" y="-{h}" width="7" height="{h}" fill="#efe2c8" stroke="#cdbf9e"/>' for dx,h in [(-14,26),(-5,36),(4,30),(12,22)]),
    'cipressi':''.join(f'<path d="M{dx},0 q-5,-14 0,-30 q5,16 0,30" fill="#3f8f4a"/>' for dx in (-12,0,12)),
    'dot':'<circle r="6" cy="-6" fill="#fff" stroke="#6b5a3a" stroke-width="3"/>'}[k]
    return f'<g class="city" transform="translate({x:.0f},{y:.0f}) scale({1+(y-CY)/1400:.2f})"><g class="b"><ellipse rx="18" ry="5" fill="#000" opacity=".1"/>{g}</g></g>'
cities=''
for k,(a,b,t) in C.items():
    x,y=XY[k];small=t=='dot';cities+=f'<g class="cw" data-n="{k}">'+icon(x,y,t)
    lx,ly={'Certaldo':(14,4),'Pisa':(-16,-2),'S. Maria degli Angeli':(0,26),'Rapolano Terme':(-10,24),'Assisi':(0,24)}.get(k,(0,24 if not small else 24))
    cities+=f'<text x="{x+lx:.0f}" y="{y+ly:.0f}" text-anchor="{"start" if k=="Certaldo" else ("end" if k=="Pisa" else "middle")}" class="{"cl s" if small else "cl"}">{k}</text></g>'
dec=[]
def near(x,y,d): return any((x-a)**2+(y-b)**2<d*d for a,b in list(XY.values())) or ((x-LT[0])/80)**2+((y-LT[1])/50)**2<1
for _ in range(1400):
    x,y=random.uniform(0,1600),random.uniform(0,1000)
    if not inland(x,y) or near(x,y,45): continue
    r=random.random()
    if r<.08: dec.append((y,f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{random.uniform(40,90):.0f}" ry="{random.uniform(14,26):.0f}" fill="#bdd68c" opacity=".7"/>',0))
    elif r<.5: dec.append((y,f'<path transform="translate({x:.0f},{y:.0f})" d="M0,0 q-4,-10 0,-22 q4,12 0,22" fill="{random.choice(["#3f8f4a","#4f9e52"])}"/>',1))
    elif r<.62: dec.append((y,f'<g transform="translate({x:.0f},{y:.0f})"><rect x="-1.5" y="-7" width="3" height="7" fill="#8f6a3e"/><circle cy="-12" r="7" fill="#5fa043"/><path d="M0,-19 A7,7 0 0 1 0,-5Z" fill="#7fbf4f"/></g>',1))
dec.sort(key=lambda t:(t[2],t[0]))
_p=list(XY.values())+[LT];x0=min(p[0] for p in _p)-120;x1=max(p[0] for p in _p)+90;y0=min(p[1] for p in _p)-90;y1=max(p[1] for p in _p)+90
_w,_h=x1-x0,y1-y0
if _w/_h<1.6:x0-=(_h*1.6-_w)/2;_w=_h*1.6
else:y0-=(_w/1.6-_h)/2;_h=_w/1.6
VB=[round(x0),round(y0),round(_w),round(_h)];MT=P(43.0,10.5)
house=I.house(CX,CY-4,.42)
outer=f'''<svg id="outer" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice"><rect width="{W}" height="{H}" fill="#bfe6f5"/><g id="og">
<g class="sea">{''.join(f'<path d="M{x},{y} q8,-6 16,0 t16,0" />' for x,y in [(120,700),(260,820),(90,900),(300,560),(180,480),(420,950),(60,620)])}</g>
<path d="{landd}" fill="#cde39c" stroke="#b5cf86" stroke-width="6"/><ellipse cx="{el[0]:.0f}" cy="{el[1]:.0f}" rx="34" ry="16" fill="#cde39c" stroke="#b5cf86" stroke-width="4"/>
<g class="deco">{''.join(t for _,t,_ in dec)}</g>{riv}
<ellipse cx="{LT[0]:.0f}" cy="{LT[1]:.0f}" rx="62" ry="38" fill="#7fd0ea" stroke="#fff" stroke-width="4"/><path class="lw" d="M{LT[0]-30:.0f},{LT[1]:.0f} q8,-5 16,0 t16,0 t16,0" />
<text x="{LT[0]:.0f}" y="{LT[1]+62:.0f}" text-anchor="middle" class="cl s">Lago Trasimeno</text><text x="{MT[0]:.0f}" y="{MT[1]:.0f}" text-anchor="middle" class="sl">Mar Tirreno</text>
{routes}{cities}
<g id="car2" style="display:none"><rect x="-10" y="-6" width="20" height="8" rx="3" fill="#e94b3c"/><rect x="-5" y="-11" width="10" height="6" rx="2" fill="#e94b3c"/><animateMotion dur="16s" repeatCount="indefinite" rotate="auto"><mpath href="#r1"/></animateMotion></g>
<g id="ht" class="pin"><circle cx="{CX}" cy="{CY}" r="34" class="pulse"/>{house}<g transform="translate({CX},{CY+44})"><path d="M-62,0 h124 l-8,12 l8,12 h-124 l8,-12Z" fill="#f39200"/><text y="18" text-anchor="middle" class="ban s">HAPPY TUSCANY</text></g></g>
</g></svg>'''
inner=I.svg.replace('<svg id="map"','<svg id="inner"').replace(I.car,'')
rd='M'+' L'.join(f'{x:.0f},{y:.0f}' for x,y in I.road)
anim=f'''<path id="rdp" d="{rd}" fill="none"/><g><g transform="translate(0,-10)"><rect x="-22" y="-14" width="44" height="14" rx="5" fill="#e94b3c"/><rect x="-12" y="-24" width="24" height="12" rx="4" fill="#e94b3c"/><rect x="-9" y="-22" width="18" height="8" fill="#bfe6f5"/><circle cx="-12" cy="1" r="5" fill="#333"/><circle cx="12" cy="1" r="5" fill="#333"/></g><animateMotion dur="22s" repeatCount="indefinite" rotate="auto"><mpath href="#rdp"/></animateMotion></g>
<g><g class="sq"><ellipse rx="8" ry="5" fill="#b8642d"/><circle cx="8" cy="-5" r="4.5" fill="#b8642d"/><path d="M-6,-2 q-14,-6 -7,-18 q7,4 3,14" fill="#d0803f"/><circle cx="9.5" cy="-6" r="1.1" fill="#000"/></g><animateMotion dur="16s" repeatCount="indefinite" rotate="auto" path="M240,780 C300,720 360,740 420,700 S520,640 470,610 S330,660 260,700 S200,820 240,780"/></g>
<g><g class="sq"><ellipse rx="8" ry="5" fill="#b8642d"/><circle cx="8" cy="-5" r="4.5" fill="#b8642d"/><path d="M-6,-2 q-14,-6 -7,-18 q7,4 3,14" fill="#d0803f"/><circle cx="9.5" cy="-6" r="1.1" fill="#000"/></g><animateMotion dur="20s" repeatCount="indefinite" rotate="auto" path="M1150,330 C1220,280 1300,300 1330,360 S1250,460 1180,430 S1100,370 1150,330"/></g>
<path d="M200,900 C300,850 380,880 470,830 S600,800 640,760" class="rvf" style="stroke-width:5"/>'''
def CAR(c,d,l): return f'<g><rect x="-11" y="-4" width="25" height="13" rx="4" fill="#000" opacity=".18"/><rect x="-12" y="-6.5" width="24" height="13" rx="4" fill="{d}"/><rect x="-12" y="-6.5" width="24" height="10" rx="4" fill="{c}"/><rect x="-5" y="-5" width="10" height="8" rx="2" fill="{l}"/><rect x="5" y="-4.5" width="3.5" height="7" rx="1" fill="#2c3e50"/><rect x="-8.5" y="-4.5" width="3" height="7" rx="1" fill="#2c3e50"/><circle cx="11.3" cy="-4" r="1.2" fill="#fff6c4"/><circle cx="11.3" cy="2" r="1.2" fill="#fff6c4"/></g>'
anim=f'<path id="rdp" d="{rd}" fill="none"/>'
for (c,d,l),dur,rev,beg,off in ((('#e94b3c','#a8322a','#f07a6e'),26,0,0,-5),(('#f4f4f4','#b9b9b9','#ffffff'),30,1,-9,5),(('#2e86c1','#1f5f8b','#5dade2'),34,0,-17,-5)):
    anim+=f'<g class="car" data-v="{30+dur%7}" data-dir="{-1 if rev else 1}" data-s="{-beg*40}">{CAR(c,d,l)}</g>'
anim+='<g id="sqL"></g>'
TREES=[[int(m.group(1)),int(m.group(2))] for _,t in I.items for m in [re.search(r'translate\((\d+),(\d+)\)',t)] if m and ('#5fa043' in t or '#3f8f4a' in t)]
RIV=river(I.bez((640,760),(600,800),(560,780),(470,830),20)[:-1]+I.bez((470,830),(380,880),(300,850),(200,900),20),4,15)
inner=inner.replace('<path d="M200,900 C300,850 380,880 470,830 S600,800 640,760" stroke="#7fd0ea" stroke-width="10" fill="none" stroke-linecap="round"/>',RIV)
inner=inner.replace('<!--RIV-->','')
inner=inner.replace('<g class="pin"',anim+'<g class="pin"',1).replace('<path d="M70,2 q10,-5','<path class="wave" d="M70,2 q10,-5')
tpl=open('tpl3.html',encoding='utf-8').read()
html=tpl.replace('%FACES%','\n'.join(I.faces)).replace('%FA%',I.FA).replace('%OUTER%',outer).replace('%INNER%',inner).replace('%LEG%',legend).replace('%DATA%',json.dumps(I.D,ensure_ascii=False)).replace('%TOURS%',json.dumps(TD,ensure_ascii=False)).replace('%TREES%',json.dumps(TREES)).replace('%VB%',json.dumps(VB)).replace('%HX%',str(CX)).replace('%HY%',str(CY))
open('index.html','w',encoding='utf-8').write(html);print('ok',len(html)//1024,'KB',{k:(round(x),round(y)) for k,(x,y) in XY.items()})
