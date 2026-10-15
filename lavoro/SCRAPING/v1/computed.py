import asyncio,json,sys
from playwright.async_api import async_playwright
JS=r'''() => {
 const props=['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textTransform','color','backgroundColor','backgroundImage','padding','margin','borderRadius','border','textAlign','boxShadow'];
 const out=[];const seen=new Set();
 const sel='h1,h2,h3,h4,h5,h6,p,a,button,.btn,li,span,header,nav,footer,section,.vc_row,.vc_column-text,i,input,textarea,img';
 document.querySelectorAll(sel).forEach(el=>{
   const r=el.getBoundingClientRect(); if(r.width<2||r.height<2) return;
   const cs=getComputedStyle(el); const o={tag:el.tagName.toLowerCase(),cls:(el.className&&el.className.baseVal===undefined?el.className:'').toString().slice(0,80),text:(el.innerText||el.alt||'').trim().slice(0,60),y:Math.round(r.top+scrollY),w:Math.round(r.width),h:Math.round(r.height)};
   props.forEach(p=>o[p]=cs[p]); if(el.tagName==='IMG') o.src=el.currentSrc;
   const k=JSON.stringify([o.tag,o.cls,o.text]); if(seen.has(k))return; seen.add(k); out.push(o);});
 const fonts=[...document.fonts].map(f=>({family:f.family,weight:f.weight,style:f.style,status:f.status}));
 const cssvars={};for(const s of document.styleSheets){try{for(const r of s.cssRules){if(r.selectorText===':root'){for(const n of r.style){if(n.startsWith('--'))cssvars[n]=r.style.getPropertyValue(n)}}}}catch(e){}}
 const icons=[...document.querySelectorAll('i[class],span[class*=icon],svg')].slice(0,80).map(e=>({tag:e.tagName,cls:(e.getAttribute('class')||''),before:getComputedStyle(e,'::before').content,ff:getComputedStyle(e,'::before').fontFamily,parentText:(e.parentElement.innerText||'').trim().slice(0,40)}));
 return {title:document.title,url:location.href,docH:document.documentElement.scrollHeight,fonts,cssvars,icons,els:out};}'''
async def main():
    async with async_playwright() as p:
        b=await p.chromium.connect_over_cdp('http://localhost:29229'); ctx=b.contexts[0]
        for name,url in [('home','https://www.happytuscany.it/'),('servizi','https://www.happytuscany.it/servizi/')]:
            for vw,tag in [((1440,900),'desktop'),((390,844),'mobile')]:
                pg=await ctx.new_page(); await pg.set_viewport_size({'width':vw[0],'height':vw[1]})
                await pg.goto(url,wait_until='networkidle',timeout=90000)
                for y in range(0,20000,600): await pg.evaluate(f'scrollTo(0,{y})'); await pg.wait_for_timeout(120)
                await pg.evaluate('scrollTo(0,0)'); await pg.wait_for_timeout(800)
                d=await pg.evaluate(JS); json.dump(d,open(f'computed_{name}_{tag}.json','w'),indent=1,ensure_ascii=False)
                await pg.screenshot(path=f'orig_{name}_{tag}.jpg',type='jpeg',quality=60,full_page=True)
                print(name,tag,len(d['els']),d['docH']); await pg.close()
asyncio.run(main())
