import re,json,random,math
random.seed(7)
v1=open('../v1/index.html',encoding='utf-8').read()
i=v1.index('const D=')+8;D,_=json.JSONDecoder().raw_decode(v1,i)
faces=re.findall(r'@font-face\s*\{[^}]*\}',v1)
fa=[f for f in faces if 'fontawesome' in f.lower()][0];FA=re.search(r"font-family:\s*['\"]?([^;'\"]+)",fa).group(1)
W,H=1600,1000
def bez(p0,p1,p2,p3,n=40):
    return [tuple((1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d for a,b,c,d in zip(p0,p1,p2,p3)) for t in [k/n for k in range(n+1)]]
R1=[(150,215),(380,250),(430,640),(760,790)];R2=[(760,790),(1050,890),(1250,740),(1520,900)]
def near(x,y,pts,d): return any((x-a)**2+(y-b)**2<d*d for a,b in pts)
items=[]
def rtree(x,y,s):
    return f'<g transform="translate({x:.0f},{y:.0f}) scale({s:.2f})"><ellipse cx="3" cy="2" rx="16" ry="5" fill="#000" opacity=".12"/><rect x="-3" y="-22" width="6" height="24" fill="#8f6a3e"/><circle cx="0" cy="-38" r="20" fill="#5fa043"/><path d="M0,-58 A20,20 0 0 1 0,-18 Z" fill="#7fbf4f"/></g>'
def ctree(x,y,s):
    return f'<g transform="translate({x:.0f},{y:.0f}) scale({s:.2f})"><ellipse cx="3" cy="2" rx="13" ry="4" fill="#000" opacity=".12"/><rect x="-2.5" y="-10" width="5" height="12" fill="#7a5a34"/><path d="M0,-78 L-15,-8 L0,-8 Z" fill="#3f8f4a"/><path d="M0,-78 L15,-8 L0,-8 Z" fill="#5fb05a"/></g>'
def otree(x,y,s):
    return f'<g transform="translate({x:.0f},{y:.0f}) scale({s:.2f})"><ellipse cx="2" cy="2" rx="11" ry="3.5" fill="#000" opacity=".12"/><path d="M0,0 L0,-12 M0,-8 L-4,-14" stroke="#8a7a5a" stroke-width="3"/><ellipse cx="0" cy="-20" rx="13" ry="10" fill="#8fa66a"/><ellipse cx="4" cy="-22" rx="7" ry="6" fill="#a9bd84"/></g>'
vine=''.join(f'<path d="M{1060+k*22},{620+k*6} l120,-40" stroke="#6f9a3c" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 9"/>' for k in range(6))
def house(x,y,s,roof='#c9573a',side='#dcc49a',front='#f4e3c1'):
    return f'''<g transform="translate({x},{y}) scale({s})"><ellipse cx="5" cy="42" rx="80" ry="12" fill="#000" opacity=".12"/>
<rect x="-60" y="-10" width="80" height="50" fill="{front}"/><path d="M20,-10 L60,-25 L60,25 L20,40Z" fill="{side}"/>
<path d="M-68,-8 L28,-8 L14,-38 L-46,-38Z" fill="{roof}"/><path d="M28,-8 L68,-23 L52,-50 L14,-38Z" fill="#a8432f"/><path d="M-46,-38 L14,-38 L52,-50 L-8,-50Z" fill="#b44a33"/>
<rect x="-50" y="2" width="10" height="12" fill="#5b4330"/><rect x="-54" y="2" width="4" height="12" fill="#758d15"/><rect x="-40" y="2" width="4" height="12" fill="#758d15"/>
<rect x="-2" y="2" width="10" height="12" fill="#5b4330"/><rect x="-6" y="2" width="4" height="12" fill="#758d15"/><rect x="8" y="2" width="4" height="12" fill="#758d15"/>
<path d="M-28,40 L-28,22 A7,7 0 0 1 -14,22 L-14,40Z" fill="#7a4e2c"/><path d="M32,0 L48,-6 L48,8 L32,14Z" fill="#5b4330"/></g>'''
def small(x,y,s): return house(x,y,s,roof='#d06a45',side='#d9c6a2',front='#efe2c8')
pool='''<g transform="translate(960,640)"><path d="M0,0 L150,-40 L215,0 L65,40Z" fill="#c08a55" stroke="#9a6a3a" stroke-width="2"/><path d="M28,0 L148,-30 L188,0 L68,30Z" fill="#4fc6ea" stroke="#fff" stroke-width="4"/><path d="M70,2 q10,-5 20,0 t20,0 M110,-10 q10,-5 20,0 t20,0" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/><path d="M180,22 l22,-6 l8,5 l-22,6Z M160,30 l22,-6 l8,5 l-22,6Z" fill="#fff"/></g>
<g transform="translate(1150,700)"><ellipse rx="26" ry="13" fill="#9aa3a8"/><ellipse rx="20" ry="9" cy="-2" fill="#4fc6ea"/><circle cx="-6" cy="-4" r="2" fill="#fff"/><circle cx="6" cy="-2" r="2" fill="#fff"/></g>'''
terr='''<g transform="translate(640,600)"><path d="M-70,10 L40,-20 L90,5 L-20,35Z" fill="#d98b5f"/><g stroke="#8f6a3e" stroke-width="4"><path d="M-60,10 v-45 M35,-18 v-45 M80,5 v-45 M-15,32 v-45"/><path d="M-62,-35 L35,-63 L82,-40 L-15,-13Z" fill="none"/></g><path d="M-40,0 q25,22 60,-10" stroke="#e85d75" stroke-width="5" fill="none"/></g>
<g transform="translate(590,700)"><rect x="-14" y="-18" width="28" height="20" fill="#9b6b4a"/><rect x="-16" y="-22" width="32" height="5" fill="#555"/><circle cx="-4" cy="-32" r="5" fill="#ddd" opacity=".8"/><circle cx="4" cy="-44" r="7" fill="#ddd" opacity=".6"/></g>
<g transform="translate(930,730)"><path d="M-30,0 L30,-15 L45,-5 L-15,10Z" fill="#c9a87a"/><rect x="-8" y="-24" width="12" height="18" fill="#333"/><circle cx="-2" cy="-17" r="4" fill="#888"/><path d="M14,-34 l4,-12 l6,3" stroke="#333" stroke-width="2" fill="none"/></g>'''
gate='<g transform="translate(880,795)"><rect x="-22" y="-26" width="5" height="28" fill="#6b4a2b"/><rect x="17" y="-26" width="5" height="28" fill="#6b4a2b"/><path d="M-22,-24 h44" stroke="#6b4a2b" stroke-width="4"/></g>'
car='<g transform="translate(1080,858) rotate(-8)"><rect x="-22" y="-14" width="44" height="14" rx="5" fill="#e94b3c"/><rect x="-12" y="-24" width="24" height="12" rx="4" fill="#e94b3c"/><rect x="-9" y="-22" width="18" height="8" fill="#bfe6f5"/><circle cx="-12" cy="1" r="5" fill="#333"/><circle cx="12" cy="1" r="5" fill="#333"/></g>'
bench='<g transform="translate(1260,560)"><path d="M-18,0 h36 M-14,0 v8 M14,0 v8 M-18,-8 h36" stroke="#8f6a3e" stroke-width="4"/></g>'
pts=lambda P:' '.join(f'{x:.0f},{y:.0f}' for x,y in P)
ICON={'casa':'f015','piscina':'f043','jacuzzi':'f2cd','terrazza':'f185','barbecue':'f06d','musica':'f001','ingresso':'f1b9','vista':'f06e','borgo':'f19c','stazione':'f238','interni':'f236'}
POS={'casa':(800,470),'interni':(705,500),'piscina':(1040,610),'jacuzzi':(1150,690),'terrazza':(640,560),'barbecue':(590,690),'musica':(925,715),'ingresso':(880,780),'vista':(1260,555),'borgo':(225,140),'stazione':(1390,790)}
car=''
for k in ('borgo','stazione'): POS.pop(k,None)
def cr(pts,n=14):
    p=[pts[0]]+pts+[pts[-1]];o=[]
    for i in range(1,len(p)-2):
        a,b,c,e=p[i-1],p[i],p[i+1],p[i+2];o+=bez(b,(b[0]+(c[0]-a[0])/6,b[1]+(c[1]-a[1])/6),(c[0]-(e[0]-b[0])/6,c[1]-(e[1]-b[1])/6),c,n)[:-1]
    return o+[pts[-1]]
road=cr([(840,1010),(960,965),(1070,935),(1105,908),(1050,886),(820,874),(670,858),(632,832),(690,810),(840,800),(1010,790),(1200,755),(1330,650),(1400,480),(1440,240)])
drive=bez((880,800),(860,720),(900,640),(830,575),20)
rivs=[]
VX,VY,VW,VH=260,240,1180,760
def free(x,y): return ((x-840)/350)**2+((y-605)/205)**2>1 and not near(x,y,road+drive,46) and not near(x,y,rivs,26) and not(1050<x<1320 and 540<y<700) and not near(x,y,list(POS.values()),45)
for _ in range(3000):
    x,y=random.uniform(VX-30,VX+VW+30),random.uniform(VY+20,VY+VH+60)
    if not free(x,y) or random.random()<.2: continue
    s=random.uniform(.85,1.15)*(.6+.65*(y-VY)/VH)
    items.append((y,(ctree if random.random()<.45 else rtree)(x,y,s)))
pins=''.join(f'<g class="pin" data-id="{k}" transform="translate({x},{y})"><title>{D[k]["t"]}</title><ellipse rx="10" ry="4" fill="#000" opacity=".2"/><g class="b"><rect x="-20" y="-64" width="40" height="40" rx="8" fill="#1d8db0" stroke="#fff" stroke-width="3"/><path d="M-8,-25 L8,-25 L0,-10Z" fill="#1d8db0"/><text y="-37" text-anchor="middle" class="ic">&#x{ICON[k]};</text></g></g>' for k,(x,y) in POS.items() if k in D)
items.sort()
_b={}
for y,t in items:_b.setdefault(int(y//30),[]).append(t)
BANDS=''.join(f'<g class="zl" data-y="{k*30}">{"".join(v)}</g>' for k,v in sorted(_b.items()))
svg=f'''<svg id="map" viewBox="{VX} {VY} {VW} {VH}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="gnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9d18f"/><stop offset=".3" stop-color="#c6dd96"/><stop offset="1" stop-color="#d3e8a4"/></linearGradient><linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
<rect x="{VX-400}" y="{VY-200}" width="{VW+800}" height="{VH+400}" fill="url(#gnd)"/>
<path d="M{VX-50},{VY+90} C500,250 700,300 900,265 C1100,230 1300,300 {VX+VW+50},{VY+70} L{VX+VW+50},{VY-50} L{VX-50},{VY-50}Z" fill="#a9c47f" opacity=".8"/>
<ellipse cx="840" cy="610" rx="350" ry="205" fill="#dfebb6"/><!--RIV-->
<polyline points="{pts(road)}" fill="none" stroke="#e8c77e" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/><polyline points="{pts(road)}" fill="none" stroke="#fee0a0" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/><polyline points="{pts(road)}" fill="none" stroke="#a08355" stroke-width="2" stroke-dasharray="8 8"/>
<polyline points="{pts(drive)}" fill="none" stroke="#cfcabd" stroke-width="20" stroke-linecap="round"/><polyline points="{pts(drive)}" fill="none" stroke="#f7f5ef" stroke-width="16" stroke-linecap="round"/><polyline points="{pts(drive)}" fill="none" stroke="#e0dbcf" stroke-width="9" stroke-dasharray="4 5" stroke-linecap="round"/>
{vine}{BANDS}
{terr}{house(820,560,1.6)}{pool}{gate}{bench}
<g transform="translate(820,650)"><path d="M-110,0 h220 l-12,22 l12,22 h-220 l12,-22Z" fill="#f39200"/><text y="32" text-anchor="middle" class="ban">HAPPY TUSCANY</text></g>
<rect x="{VX-50}" y="{VY}" width="{VW+100}" height="170" fill="url(#haze)" pointer-events="none"/>
<text x="1160" y="850" class="lab">Via della Croce</text><text x="1400" y="290" text-anchor="end" class="lab">↑ Rigomagno</text><text x="820" y="988" text-anchor="end" class="lab">Rigomagno Scalo ↓</text>
{pins}</svg>'''
