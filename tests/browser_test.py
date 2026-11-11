"""Browser tests: the built site, in a real Chromium, against the committed data.

Serves docs/ on a free local port and drives it with Playwright. These check
what only a browser can: that the page draws, that the Content-Security-Policy
blocks nothing the page needs, and that the dialog, language and live-region
behaviour work. Run with:  uv run tests/browser_test.py

First time on a machine: uv run playwright install chromium
"""
import os, sys, threading, functools, http.server
from playwright.sync_api import sync_playwright

DOCS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs")
FAILED = []


def check(label, got, want):
    if got == want:
        print(f"  pass  {label}")
    else:
        FAILED.append(label)
        print(f"  FAIL  {label}\n          got  {got}\n          want {want}")


def serve():
    """docs/ on a free port, quietly. Returns (server, base url)."""
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    handler = functools.partial(Quiet, directory=DOCS)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_port}"


def open_page(browser, url, problems, **opts):
    """A page with third parties blocked, collecting anything that goes wrong."""
    page = browser.new_page(**opts)
    page.route("**/cloudflareinsights.com/**", lambda r: r.abort())
    page.route("**/static.cloudflareinsights.com/**", lambda r: r.abort())
    page.route("**/basemaps.cartocdn.com/**", lambda r: r.abort())
    page.on("pageerror", lambda e: problems.append(f"pageerror: {e}"))
    page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text
            and problems.append(f"console: {m.text}"))
    page.goto(url)
    page.wait_for_selector(".clubrow")
    return page


def test_loads_clean(browser, base):
    problems = []
    page = open_page(browser, f"{base}/?d=21", problems)
    check("district 21 draws its clubs", page.locator(".clubrow").count() > 100, True)
    check("no page errors or CSP violations", problems, [])
    check("the wordmark names the district",
          "21" in page.locator("#districtPick").evaluate("e => e.options[e.selectedIndex].text"), True)
    page.close()


def test_live_region(browser, base):
    page = open_page(browser, f"{base}/?d=21&lang=en", [])
    status = page.locator("#srStatus")
    check("silent on load", status.inner_text(), "")
    page.locator("#q").fill("a")
    check("a search announces a count", status.inner_text().endswith("clubs shown"), True)
    page.locator("#q").fill("zzzzzzzz")
    check("an empty result is announced", status.inner_text(), "No clubs match.")
    page.close()


def test_contact_dialog(browser, base):
    page = open_page(browser, f"{base}/?d=21", [])
    page.locator("#contactbtn").focus()
    page.keyboard.press("Enter")
    # Past the last control focus may rest on <body> (the browser's own UI) but
    # must never land on anything in the page behind the dialog.
    behind = []
    for _ in range(14):
        behind.append(page.evaluate("""(() => {
            const a = document.activeElement;
            return a !== document.body && !document.getElementById('contactModal').contains(a);
        })()"""))
        page.keyboard.press("Tab")
    check("Tab never reaches the page behind the dialog", any(behind), False)
    page.keyboard.press("Escape")
    check("Escape closes it", page.locator("#contactModal").is_hidden(), True)
    check("focus returns to the button", page.evaluate("document.activeElement.id"), "contactbtn")
    check("the club drawer is still inert", page.evaluate("document.getElementById('detail').inert"), True)
    check("the page is usable again", page.evaluate("document.querySelector('main').inert"), False)
    page.close()


def test_club_drawer(browser, base):
    page = open_page(browser, f"{base}/?d=21", [])
    drawer = page.locator("#detail")
    check("the drawer starts closed and inert", page.evaluate("document.getElementById('detail').inert"), True)
    row = page.locator(".clubrow").first
    row.focus()
    page.keyboard.press("Enter")
    page.wait_for_selector("#detail.open")
    check("opening moves focus to the close button", page.evaluate("document.activeElement.id"), "dclose")
    check("the drawer is named by the club", len(page.locator("#dname").inner_text()) > 0, True)
    page.keyboard.press("Escape")
    check("Escape closes it", page.evaluate("document.getElementById('detail').classList.contains('open')"), False)
    check("it is inert again", page.evaluate("document.getElementById('detail').inert"), True)
    check("focus returns to the club that opened it", page.evaluate("document.activeElement.classList.contains('clubrow')"), True)
    page.close()


def test_year_scrub(browser, base):
    page = open_page(browser, f"{base}/?d=21", [])
    open_year = page.locator(".clubrow").count()
    page.locator("#scrub button", has_text="2023-2024").click()
    check("the chosen year is marked pressed",
          page.locator("#scrub button[aria-pressed=true]").inner_text(), "2023-2024")
    page.wait_for_function(f"document.querySelectorAll('.clubrow').length !== {open_year}")
    closed_year = page.locator(".clubrow").count()
    check("a finished year draws its own roster", 0 < closed_year < open_year, True)
    page.close()


def test_sort(browser, base):
    page = open_page(browser, f"{base}/?d=21", [])
    score = page.locator("#lvth th[data-k=met]")
    check("the table starts sorted by score, high to low", score.get_attribute("aria-sort"), "descending")
    score.click()
    check("clicking the header reverses it", page.locator("#lvth th[data-k=met]").get_attribute("aria-sort"), "ascending")
    page.locator("#lvth th[data-k=name]").click()
    check("sorting by name moves the marker",
          [page.locator("#lvth th[aria-sort]").count(),
           page.locator("#lvth th[data-k=name]").get_attribute("aria-sort")], [1, "ascending"])
    page.close()


def test_map(browser, base):
    page = open_page(browser, f"{base}/?d=21", [])
    page.wait_for_selector(".leaflet-marker-icon")
    check("the map draws pins or clusters",
          page.locator(".leaflet-marker-icon").count() > 0, True)
    check("the line under it says how many clubs have no address",
          "published an address" in page.locator("main").inner_text(), True)
    div = page.locator("#mpDiv button", has_text="Division A")
    div.click()
    check("a division filter is marked pressed", div.get_attribute("aria-pressed"), "true")
    check("the map still has pins after filtering",
          page.locator(".leaflet-marker-icon").count() > 0, True)
    page.close()


def test_map_layering(browser, base):
    """Leaflet dresses and stacks its own furniture, and both fights are ours.

    Its stylesheet paints the popup white in a rule no more specific than the
    board's, so load order decides whether a dark board gets a white popup with
    white text in it. Its panes sit at 400 and its controls at 1000, which clear
    the club drawer at 40 unless the map is a stacking context of its own.
    """
    # In light mode the board's card is white and so is Leaflet's popup, so the
    # two are indistinguishable and the bug hides. Dark is where it shows.
    page = open_page(browser, f"{base}/?d=21", [], color_scheme="dark")
    page.wait_for_selector(".leaflet-marker-icon")
    card = page.evaluate("getComputedStyle(document.querySelector('.mast')).backgroundColor")
    check("the popup wears the board's card, not Leaflet's white",
          page.evaluate("""(() => {
            const probe = document.createElement('div');
            probe.className = 'leaflet-popup-content-wrapper';
            document.body.appendChild(probe);
            const bg = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return bg;
          })()"""), card)
    # Hit-testing cannot see this one: Leaflet's tile pane takes no pointer
    # events, so it paints over the drawer while elementFromPoint still reports
    # the drawer underneath. What has to hold is the stacking itself — the map
    # is a context of its own, sitting below the drawer as a single layer.
    check("the map is one stacking context, under the drawer rather than through it",
          page.evaluate("""(() => {
            const mz = getComputedStyle(document.querySelector('.mapwrap')).zIndex;
            const dz = getComputedStyle(document.getElementById('detail')).zIndex;
            return mz !== 'auto' && parseInt(mz, 10) < parseInt(dz, 10);
          })()"""), True)
    page.close()


def test_phone_menu(browser, base):
    page = open_page(browser, f"{base}/?d=21", [], viewport={"width": 390, "height": 800})
    btn = page.locator("#menubtn")
    check("the menu button shows on a phone", btn.is_visible(), True)
    check("the links start folded away", page.locator("#mastnav").is_visible(), False)
    check("the district pill is folded away too", page.locator(".distpick").is_visible(), False)
    check("theme toggle stays beside the button", page.locator("#themetoggle").is_visible(), True)
    btn.click()
    check("the button reports it is open", btn.get_attribute("aria-expanded"), "true")
    check("the links show", page.locator("#mastnav a").first.is_visible(), True)
    page.keyboard.press("Escape")
    check("Escape folds it and returns focus", [page.locator("#mastnav").is_visible(),
          page.evaluate("document.activeElement.id")], [False, "menubtn"])
    btn.click()
    page.locator("#mastnav a", has_text="Clubs").click()
    check("choosing a link folds the menu", page.locator("#mastnav").is_visible(), False)
    page.close()

    page = open_page(browser, f"{base}/?d=21", [])
    check("no menu button on a wide screen", page.locator("#menubtn").is_visible(), False)
    check("the links are in the bar", page.locator("#mastnav").is_visible(), True)
    page.close()


def test_language(browser, base):
    page = open_page(browser, f"{base}/?d=21&lang=es", [])
    check("Spanish sets the document language", page.evaluate("document.documentElement.lang"), "es")
    check("the skip link is translated", page.locator(".skip").inner_text(), "Saltar al panel")
    page.close()


def test_district_paths(browser, base):
    problems = []
    page = open_page(browser, f"{base}/?d=999", problems)
    check("an unknown district falls back to a real one", page.evaluate("new URL(location).searchParams.get('d')") != "999", True)
    page.close()

    page = browser.new_page()
    page.route("**/cloudflareinsights.com/**", lambda r: r.abort())
    page.route("**/static.cloudflareinsights.com/**", lambda r: r.abort())
    page.goto(f"{base}/?d=01")
    page.wait_for_selector("#gonedistrict:not([hidden])")
    check("a dissolved district says so, not 'failed to load'",
          "could not load" in page.locator("main").inner_text().lower(), False)
    page.close()


def main():
    server, base = serve()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for t in (test_loads_clean, test_live_region, test_contact_dialog,
                      test_club_drawer, test_year_scrub, test_sort, test_map, test_map_layering,
                      test_phone_menu, test_language, test_district_paths):
                print(t.__name__)
                t(browser, base)
            browser.close()
    finally:
        server.shutdown()
    print("FAILED" if FAILED else "all passed")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
