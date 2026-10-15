import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.connect_over_cdp('http://localhost:29229')
        c=await b.new_context(viewport={'width':1440,'height':900});pg=await c.new_page();errs=[]
        pg.on('pageerror',lambda e: errs.append(str(e)));pg.on('response',lambda r: errs.append(f'{r.status} {r.url}') if r.status>=400 else None)
        await pg.goto('http://localhost:8084/',wait_until='networkidle');await pg.wait_for_timeout(800)
        await pg.screenshot(path='shots/1_toscana.jpg',quality=80)
        await pg.hover('#leg li[data-t=assisi-eremo-delle-carceri-perugia]');await pg.wait_for_timeout(400)
        await pg.click('#leg li[data-t=assisi-eremo-delle-carceri-perugia]');await pg.wait_for_timeout(800)
        await pg.screenshot(path='shots/2_tour.jpg',quality=80)
        await pg.click('aside .x');await pg.mouse.move(720,450)
        for i in range(8): await pg.mouse.wheel(0,-150);await pg.wait_for_timeout(120)
        await pg.wait_for_timeout(2500);await pg.screenshot(path='shots/3_casa.jpg',quality=80)
        for i in range(8): await pg.mouse.wheel(0,150);await pg.wait_for_timeout(120)
        await pg.wait_for_timeout(2500);op=await pg.evaluate("getComputedStyle(document.getElementById('innerL')).opacity")
        m=await b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);mp=await m.new_page();await mp.goto('http://localhost:8084/',wait_until='networkidle');await mp.wait_for_timeout(800);await mp.screenshot(path='shots/4_mobile.jpg',quality=80)
        print('inner opacity dopo zoom out',op,'errori',errs);await c.close();await m.close()
asyncio.run(main())
