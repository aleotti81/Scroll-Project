import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.connect_over_cdp('http://localhost:29229')
        c=await b.new_context(viewport={'width':1440,'height':900});pg=await c.new_page();errs=[]
        pg.on('pageerror',lambda e: errs.append(str(e)));pg.on('response',lambda r: errs.append(f'{r.status} {r.url}') if r.status>=400 else None)
        await pg.goto('http://localhost:8084/',wait_until='networkidle');await pg.wait_for_timeout(800)
        await pg.screenshot(path='shots/1_toscana.jpg',quality=80)
        await pg.click('#legb');await pg.click('#leg li[data-t=arezzo-verna-anghiari-cortona]');await pg.wait_for_timeout(2500)
        await pg.screenshot(path='shots/2_tour.jpg',quality=80)
        await pg.click('aside .x');await pg.click('#legb');await pg.wait_for_timeout(1500);await pg.click('#zin');await pg.wait_for_timeout(5000)
        await pg.screenshot(path='shots/3_casa.jpg',quality=80)
        print('errori',errs);await c.close()
asyncio.run(main())
