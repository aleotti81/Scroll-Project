import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.connect_over_cdp('http://localhost:29229')
        ctx=await b.new_context(viewport={'width':1440,'height':900});pg=await ctx.new_page();errs=[]
        pg.on('pageerror',lambda e: errs.append(str(e)));pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8082/',wait_until='networkidle')
        print(await pg.evaluate("try{prop();'ok'}catch(e){e.message}"));await pg.wait_for_timeout(1800)
        print(await pg.evaluate("document.getElementById('map').getAttribute('viewBox')"), await pg.evaluate("[...document.querySelectorAll('.pin')].map(p=>p.dataset.id+':'+p.classList.contains('off')).join(' ')"))
        print(errs);await ctx.close()
asyncio.run(main())
