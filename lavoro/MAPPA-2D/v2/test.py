import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.connect_over_cdp('http://localhost:29229')
        ctx=await b.new_context(viewport={'width':1440,'height':900})
        pg=await ctx.new_page();errs=[]
        pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
        pg.on('response',lambda r: errs.append(f'{r.status} {r.url}') if r.status>=400 else None)
        await pg.goto('http://localhost:8083/',wait_until='networkidle');await pg.wait_for_timeout(800)
        await pg.screenshot(path='shots/1_generale.jpg',quality=80)
        await pg.click('.pin[data-id=casa] rect',force=True);await pg.wait_for_timeout(900)
        await pg.screenshot(path='shots/2_casa.jpg',quality=80)
        await pg.click('.pin[data-id=piscina] rect',force=True);await pg.wait_for_timeout(900)
        await pg.screenshot(path='shots/4_piscina.jpg',quality=80)
        await pg.click('#pb .btn',timeout=5000);await pg.wait_for_timeout(2500)
        await pg.evaluate("document.getElementById('sc').scrollTop=document.getElementById('sc').scrollHeight*0.45");await pg.wait_for_timeout(1500)
        t=await pg.evaluate("document.getElementById('v').currentTime")
        await pg.screenshot(path='shots/5_scena.jpg',quality=80)
        m=await b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        mp=await m.new_page();await mp.goto('http://localhost:8083/',wait_until='networkidle');await mp.wait_for_timeout(800)
        await mp.screenshot(path='shots/6_mobile.jpg',quality=80)
        print('video t',t,'errori',errs)
        await ctx.close();await m.close()
asyncio.run(main())
