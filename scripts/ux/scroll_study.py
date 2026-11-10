"""Scroll study: taps through every Plant Finder interaction and checks where the page lands.

Runs Safari's engine (WebKit) on an iPhone 15 and Chromium on a desktop, both for the
standalone site and for the full-directory embed on a host page. Writes a pass/fail
report to scripts/ux/scroll_study.md.

  python3 -m http.server 8765 --directory site   # in another shell
  python3 scripts/ux/scroll_study.py [base_url]

Needs: pip install playwright && python3 -m playwright install webkit chromium
"""
import asyncio, sys, pathlib, datetime
from playwright.async_api import async_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/").rstrip("/") + "/"
HOST = f"""<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<body style="margin:0;font:16px sans-serif"><div style="height:600px;background:#d1ccbd;padding:20px">Host page header (trlibrary.com stand-in)</div>
<trpl-plant-finder></trpl-plant-finder><div style="height:500px;background:#d1ccbd">Host footer</div>
<script type="module" src="{BASE}embed.js"></script></body>"""

# Where an element sits in the visible page, in px from the top of the screen.
POS = """(sel) => { const el = document.querySelector(sel); if (!el) return null;
  return el.getBoundingClientRect().top; }"""

class Rig:
    def __init__(self, page, embed):
        self.p, self.embed = page, embed
    @property
    def app(self):  # the frame the Plant Finder runs in
        return self.p.frames[1] if self.embed else self.p.main_frame
    async def wait(self, ms=900): await self.p.wait_for_timeout(ms)
    async def go(self, hash_):
        if self.embed:
            await self.app.evaluate(f"location.hash = {hash_!r}")
        else:
            await self.p.goto(BASE + hash_)
        await self.wait(1500)
    async def y(self): return await self.p.evaluate("scrollY")
    async def vh(self): return await self.p.evaluate("innerHeight")
    async def top_of(self, sel):
        """Screen position of an element inside the app, in the outer page's viewport."""
        t = await self.app.evaluate(POS, sel)
        if t is None: return None
        if self.embed:
            t += await self.p.evaluate("document.querySelector('iframe').getBoundingClientRect().top")
        return t
    async def scroll_to(self, sel, offset=0):
        """Scroll the outer page so an app element is at `offset` px from the top, as a user would."""
        t = await self.top_of(sel)
        await self.p.evaluate(f"window.scrollBy(0, {t - offset})")
        await self.wait(300)
    async def click(self, sel, nth=0):
        await self.app.evaluate(f"document.querySelectorAll({sel!r})[{nth}].click()")
        await self.wait()
    async def app_top(self):
        """Top of the app on screen: 0 standalone, the iframe's top when embedded."""
        return await self.top_of("#main") if not self.embed else await self.p.evaluate(
            "document.querySelector('iframe').getBoundingClientRect().top")

def near_top(t, vh): return t is not None and -40 <= t <= 140
def on_screen(t, vh): return t is not None and -10 <= t <= vh * 0.75

async def study(rig, label):
    out = []
    async def check(step, expect, ok, detail):
        out.append((label, step, expect, "PASS" if ok else "FAIL", detail))
    vh = await rig.vh()

    # 1. Open a plant from deep in the list
    await rig.go("#/")
    await rig.scroll_to("#grid a.card:nth-of-type(13)", vh // 2)
    slug = await rig.app.evaluate("document.querySelectorAll('#grid a.card')[12].getAttribute('href')")
    await rig.click("#grid a.card", 12)
    t = await rig.app_top()
    await check("Tap a plant card far down the list", "Plant page opens at the top", near_top(t, vh), f"app top at {t:.0f}px")

    # 2. Back to the list
    if rig.embed:
        await rig.click("a.back")
    else:
        await rig.p.go_back(); await rig.wait(1200)
    t = await rig.top_of(f'#grid a[href="{slug}"]')
    await check("Back to results", "Returns to the card you tapped", on_screen(t, vh), f"card at {t if t is None else round(t)}px")

    # 2b. Card photos: swipe and arrows change the photo without opening the plant
    await rig.go("#/")
    h0 = await rig.app.evaluate("location.hash")
    moved = await rig.app.evaluate("""() => { const t = document.querySelector('#grid .pic.swipe .track'); if (!t) return null;
      t.scrollLeft = t.clientWidth; return t.scrollLeft; }""")
    await rig.wait(400)
    dot = await rig.app.evaluate("[...document.querySelector('#grid .pic.swipe .dots').children].findIndex(d => d.classList.contains('on'))")
    h1 = await rig.app.evaluate("location.hash")
    await check("Swipe a card's photo", "Next photo shows, dots follow, plant does not open", bool(moved) and dot == 1 and h1 == h0, f"dot {dot}, page {h1 or '#/'}")
    await rig.click("#grid .pic.swipe .cnav.next")
    h2 = await rig.app.evaluate("location.hash")
    await check("Tap the photo arrow", "Changes photo without opening the plant", h2 == h0, f"page {h2 or '#/'}")
    await rig.click("#grid a.card")
    await check("Tap the card", "Opens the plant", "plant/" in await rig.app.evaluate("location.hash"), "")

    # 3. Filter while scrolled to the filters
    await rig.go("#/")
    await rig.app.evaluate("document.querySelector('.filters')?.classList.remove('collapsed')")
    await rig.scroll_to("[data-type]", 120)
    before = await rig.top_of("[data-type]")
    await rig.click("[data-type]", 1)
    after = await rig.top_of("[data-type]")
    await check("Tap a Type filter", "Filters stay on screen; results update below", on_screen(after, vh), f"filter moved {after - before:+.0f}px (list got shorter)" if abs(after - before) >= 40 else f"filter moved {after - before:+.0f}px")
    await rig.click("[data-type]", 1)  # undo

    # 4. Main nav (standalone only; the embed hides it)
    if not rig.embed:
        await rig.scroll_to("#grid a.card:nth-of-type(9)", 200)
        await rig.p.evaluate("document.querySelector('nav.tabs a[href=\"#/bloom\"]').click()"); await rig.wait()
        t = await rig.y()
        await check("Tap Bloom Clock in the nav while scrolled", "New page opens at the top", t <= 5, f"scrollY {t}")

    # 5. Bloom clock: month chip
    await rig.go("#/bloom/6")
    await rig.scroll_to(".month-tabs", 80)
    await rig.click('.month-tabs a[href="#/bloom/7"]')
    t = await rig.top_of(".bloom-results")
    await check("Bloom clock: tap a month", "Shows that month's plant list", on_screen(t, vh), f"list heading at {t if t is None else round(t)}px")

    # 6. Bloom clock: wheel wedge
    await rig.scroll_to(".wheel", 40)
    await rig.app.evaluate("document.querySelector('.wedge[data-m=\"8\"] path').dispatchEvent(new MouseEvent('click',{bubbles:true}))")
    await rig.wait()
    t = await rig.top_of(".bloom-results")
    await check("Bloom clock: tap a slice of the wheel", "Shows that month's plant list", on_screen(t, vh), f"list heading at {t if t is None else round(t)}px")

    # 7. Bloom clock list -> plant
    await rig.click(".bloom-results ~ .grid a.card")
    t = await rig.app_top()
    await check("Bloom clock: tap a plant in the list", "Plant page opens at the top", near_top(t, vh), f"app top at {t:.0f}px")

    # 8. Places -> one place
    await rig.go("#/places")
    await rig.scroll_to("a.place:last-of-type", vh // 2)
    await rig.click("a.place", -1 if False else 8)
    t = await rig.app_top()
    await check("Where they grow: tap a planting area", "Area page opens at the top", near_top(t, vh), f"app top at {t:.0f}px")

    # 9. Identify: answer a question, then finish
    await rig.go("#/identify")
    await rig.scroll_to(".id-card", 20)
    await rig.click('.id-opt[data-v="wildflower"]')
    t = await rig.top_of(".id-card")
    await check("What is this?: answer a question", "Question card stays in view for the next question", on_screen(t, vh), f"card at {t if t is None else round(t)}px")
    for _ in range(3): await rig.click("#id-skip")
    await rig.wait(900)
    t = await rig.top_of("#k-count")
    await check("What is this?: tap Done", "Scrolls to the matching plants", on_screen(t, vh), f"results at {t if t is None else round(t)}px")
    return out

async def main():
    rows = []
    async with async_playwright() as pw:
        for engine, label_dev, kwargs in [
            ("webkit", "iPhone Safari (WebKit)", pw.devices["iPhone 15"]),
            ("chromium", "Desktop Chrome", {"viewport": {"width": 1280, "height": 900}}),
        ]:
            b = await getattr(pw, engine).launch()
            for embed in (False, True):
                ctx = await b.new_context(**kwargs); page = await ctx.new_page()
                if embed:
                    await page.route(BASE + "__host_test.html", lambda r: r.fulfill(body=HOST, content_type="text/html"))
                    await page.goto(BASE + "__host_test.html")
                    await page.evaluate("window.scrollTo(0, 500)"); await page.wait_for_timeout(4000)
                rig = Rig(page, embed)
                label = f"{label_dev}, {'embedded' if embed else 'standalone'}"
                try:
                    rows += await study(rig, label)
                except Exception as e:
                    rows.append((label, "study run", "completes", "FAIL", repr(e)[:160]))
                await ctx.close()
            await b.close()
    fails = sum(r[3] == "FAIL" for r in rows)
    md = [f"# Scroll study\n\nRun {datetime.datetime.now():%Y-%m-%d %H:%M} against {BASE}. "
          f"{len(rows) - fails} of {len(rows)} checks pass.\n",
          "| Setup | Action | Should | Result | Detail |", "|---|---|---|---|---|"]
    md += [f"| {a} | {b} | {c} | {'✅' if d == 'PASS' else '❌'} | {e} |" for a, b, c, d, e in rows]
    out = pathlib.Path(__file__).with_name("scroll_study.md"); out.write_text("\n".join(md) + "\n")
    print("\n".join(md))

asyncio.run(main())
