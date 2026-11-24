"""Browser tests: the built site, in a real Chromium, against the committed data.

Serves docs/ on a free local port and drives it with Playwright. These check
what only a browser can: that the page draws, that the Content-Security-Policy
blocks nothing the page needs, and that the dialog, language and live-region
behaviour work. Run with:  uv run tests/browser_test.py

First time on a machine: uv run playwright install chromium
"""
import os, re, sys, time, math, json, glob, threading, functools, http.server
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
        # HTTP/1.1 for keep-alive. The board asks for fifteen ES modules at
        # once, and on 1.0 each is its own connection: the server resets some
        # of them under the burst, so live.js never runs, live.json is never
        # fetched and the club table never draws. That failed about one run in
        # three here, as a thirty-second wait for .clubrow with no other sign.
        protocol_version = "HTTP/1.1"

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
    # attached, not the default visible: clubs now draw inside a division's
    # own <details>, closed by default, so "the board has drawn" and "a club
    # row is on screen" are no longer the same thing. Tests that need one
    # open check for that themselves.
    page.wait_for_selector(".clubrow", state="attached")
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
    # #q was the standalone "Every Club, Year by Year" table's own search box;
    # the table merge renamed it to #lq when that table folded into this one.
    page.locator("#lq").fill("a")
    check("a search announces a count", status.inner_text().endswith("clubs shown"), True)
    page.locator("#lq").fill("zzzzzzzz")
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
    wait_until(lambda: page.locator(".clubrow").count() != open_year)
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


def wait_until(predicate, timeout=15.0):
    """Poll from here rather than in the page.

    The board's Content-Security-Policy has no 'unsafe-eval', and Playwright's
    wait_for_function evaluates its predicate as a string — which the policy
    blocks the moment the condition is not already true on the first look. It
    therefore passes or fails on timing. Locator counts run through the
    selector engine and need no eval.
    """
    end = time.time() + timeout
    while time.time() < end:
        if predicate():
            return True
        time.sleep(0.1)
    return False


def map_count(page):
    """How many clubs the section says it is showing.

    Counting `.leaflet-marker-icon` would count clusters as clubs, and a
    filter changes how the survivors cluster, so the chip is the only honest
    count on the page.
    """
    return int(re.match(r"\d+", page.locator("#mpChip").inner_text()).group())


def tile_zoom(page):
    """The zoom level currently rendered, read from a loaded tile's own URL.

    Nothing exposes Leaflet's map object to a test — S is module-scoped on
    purpose, the same as everywhere else on this page — so the zoom level
    is read the way a tile server would see it. Returns None mid-transition,
    while tiles from two zoom levels are both still on screen.
    """
    zs = page.evaluate(r"""() => [...new Set([...document.querySelectorAll('.leaflet-tile')]
        .map(t => { const m = t.src.match(/\/(\d+)\/\d+\/\d+/); return m ? +m[1] : null; })
        .filter(z => z !== null))]""")
    return zs[0] if len(zs) == 1 else None


def settled_tile_zoom(page, timeout=8.0):
    """tile_zoom(), but waited until it stops changing.

    flyToBounds eases continuously through several zoom levels on the way to
    the one it lands on, and tile_zoom can catch a single stray level mid
    flight as readily as the final one — this only accepts a reading once it
    holds for long enough that it has to be the settled view, not a frame of
    the animation passing through.
    """
    end = time.time() + timeout
    last, stable_since = None, None
    while time.time() < end:
        z = tile_zoom(page)
        if z is not None and z == last:
            if stable_since is None:
                stable_since = time.time()
            elif time.time() - stable_since >= 0.4:
                return z
        else:
            stable_since = None
        last = z
        time.sleep(0.1)
    return last


def club_lat(did, no):
    """A club's own published latitude, read from the committed geo.json
    rather than assumed, so the test still works after the monthly refresh."""
    with open(os.path.join(DOCS, "d", did, "geo.json"), encoding="utf-8") as fh:
        clubs = (json.load(fh) or {}).get("clubs") or []
    return next(c["lat"] for c in clubs if c["n"] == no)


def view_width_km(lat_deg, zoom, pixels):
    """Ground distance a run of pixels covers in Web Mercator, at this
    latitude and zoom — the same projection Leaflet and the tile server use."""
    meters_per_pixel = 156543.03392 * math.cos(math.radians(lat_deg)) / (2 ** zoom)
    return pixels * meters_per_pixel / 1000


def test_map_filters(browser, base):
    page = open_page(browser, f"{base}/?d=21", [])
    page.wait_for_selector(".leaflet-marker-icon")
    total = map_count(page)

    page.locator("#mpRestrict button", has_text="Restricted").click()
    restricted = map_count(page)
    check("restricting narrows the map", 0 < restricted < total, True)
    check("the chip reports itself pressed",
          page.locator("#mpRestrict button[aria-pressed=true]").inner_text(), "Restricted")

    page.locator("#mpRestrict button", has_text="Open to anyone").click()
    opened = map_count(page)
    check("only one membership chip is pressed at a time",
          page.locator("#mpRestrict button[aria-pressed=true]").count(), 1)
    # The two halves are the whole district: a club either restricts who may
    # join or it does not, so anything else means one of them is dropping clubs.
    check("open and restricted partition the district", restricted + opened, total)

    page.locator("#mpOnline button").click()
    check("online stacks with membership rather than replacing it",
          page.locator("#mpRestrict button[aria-pressed=true]").inner_text(), "Open to anyone")
    check("and narrows it further", map_count(page) <= opened, True)
    page.close()


def district_without_restriction_data():
    """A district whose geo.json still predates the restriction flag.

    Naming one would rot: the monthly pass replaces every district's geo.json,
    so whichever is stale today has the flag tomorrow. This asks the data
    instead, and when none is left the case has stopped being reachable.
    """
    for path in sorted(glob.glob(os.path.join(DOCS, "d", "*", "geo.json"))):
        with open(path, encoding="utf-8") as fh:
            clubs = (json.load(fh) or {}).get("clubs") or []
        if clubs and not any(c.get("r") for c in clubs):
            return os.path.basename(os.path.dirname(path))
    return None


def test_map_filters_without_restriction_data(browser, base):
    """A district whose geo.json predates the flag has it on no club at all."""
    did = district_without_restriction_data()
    if did is None:
        print("  skip  every district now carries restriction data")
        return
    problems = []
    page = open_page(browser, f"{base}/?d={did}", problems)
    page.wait_for_selector(".leaflet-marker-icon")
    page.locator("#mpRestrict button", has_text="Restricted").click()
    check("no restriction data means no restricted clubs", map_count(page), 0)
    page.locator("#mpRestrict button", has_text="Open to anyone").click()
    check("and every club counts as open", map_count(page) > 0, True)
    check("nothing threw", problems, [])
    page.close()


def test_map_list(browser, base):
    page = open_page(browser, f"{base}/?d=21", [])
    page.wait_for_selector("#mpList .maprow")
    names = page.locator("#mpList .maprow .maprow-name").all_inner_texts()
    check("the list is alphabetical", names, sorted(names, key=str.casefold))
    # text_content, not inner_text: the heading is uppercased in CSS and
    # inner_text would be asserting the stylesheet rather than the count.
    check("the count matches the rows",
          page.locator("#mpListCount").text_content(), f"{len(names)} clubs in view")
    # A club inside a collapsed cluster is still in view, so the list is
    # longer than the pins drawn individually.
    check("clustered clubs are listed too",
          len(names) > page.locator("#mpCanvas .mappin").count(), True)

    # Opening a club comes before the zoom, because zooming can empty the list
    # and there would be no row left to click.
    row = page.locator("#mpList .maprow").first
    club_no = row.get_attribute("data-club")
    club_name = row.locator(".maprow-name").inner_text()
    row.click()

    # A row is a name on a list; clicking it should feel the same as clicking
    # the pin itself — the map's own popup, not a jump straight to the full
    # drawer, which stays one more deliberate click away. The one case it
    # cannot show the club on its own: it still shares a cluster with a
    # neighbour even at the fly's own 6km, two real clubs too close together
    # for any view that wide to tell their pins apart. A short list by name
    # stands in for the pin then, naming this one among the rest.
    page.wait_for_selector(".leaflet-popup")
    popup_name = page.locator(".mappop-name").inner_text()
    if popup_name == club_name:
        check("a row opens that club's popup on the map", popup_name, club_name)
        open_btn = page.locator(".mappop-open[data-club]")
    else:
        check("a club still sharing a cluster is named in a short list instead",
              page.locator(f'.mappop-open[data-club="{club_no}"]').count(), 1)
        open_btn = page.locator(f'.mappop-open[data-club="{club_no}"]')
    check("the full drawer does not open on its own",
          page.evaluate("document.getElementById('detail').classList.contains('open')"), False)

    # fitBounds never shows less than the box it was given, only more if the
    # canvas isn't square — so the narrower of the two sides is the one to
    # check; the wider one is free to show further than the 6km minimum.
    canvas = page.locator("#mpCanvas").bounding_box()
    km = view_width_km(club_lat("21", club_no), settled_tile_zoom(page),
                        min(canvas["width"], canvas["height"]))
    check("opening a club zooms to show at least 6km around it", km >= 5.9, True)
    # Showing "at least 6km" is also true of the world view the map starts
    # on — nothing moving would pass the check above just as well. 40km rules
    # that out without pinning the exact figure discrete zoom levels land on.
    check("and actually zoomed in, not left at the starting view", km <= 40, True)

    open_btn.click()
    page.wait_for_selector("#detail.open")
    check("the popup's own button still opens the full drawer",
          len(page.locator("#dname").inner_text()) > 0, True)
    page.keyboard.press("Escape")

    # One zoom step is not guaranteed to move any club out of view, so this
    # zooms until the list changes rather than assuming a fixed number of
    # steps. How far it has to go depends on where the district sits.
    before = len(names)
    rows = lambda: page.locator("#mpList .maprow").count()
    for _ in range(6):
        page.locator(".leaflet-control-zoom-in").click()
        if wait_until(lambda: rows() != before, timeout=2.0):
            break
    check("zooming in drops the clubs that left the view", rows() < before, True)
    page.close()


def test_map_list_edges(browser, base):
    page = open_page(browser, f"{base}/?d=21", [])
    page.wait_for_selector("#mpList .maprow")

    page.locator("#mpq").fill("zzzznotaclub")
    page.wait_for_selector("#mpList .mapempty")
    check("nothing matching says so rather than going blank",
          page.locator("#mpList .mapempty").is_visible(), True)
    check("and the count agrees", page.locator("#mpListCount").text_content(),
          "0 clubs in view")
    check("no stale rows are left behind", page.locator("#mpList .maprow").count(), 0)

    # A dissolved district has no geo.json, so the whole section stands down.
    page.goto(f"{base}/?d=01")
    page.wait_for_selector("#gonedistrict:not([hidden])")
    check("a district with no map leaves no list behind",
          page.locator("#mpList").is_visible(), False)

    page.goto(f"{base}/?d=61")
    page.wait_for_selector("#mpList .maprow")
    other = page.locator("#mpList .maprow .maprow-name").all_inner_texts()
    check("another district brings its own clubs", other[:5] == [], False)
    page.goto(f"{base}/?d=21")
    page.wait_for_selector("#mpList .maprow")
    d21 = page.locator("#mpList .maprow .maprow-name").all_inner_texts()
    check("and they are not the district we came from", other[:5] == d21[:5], False)
    page.close()


def test_map_stands_down_completely(browser, base):
    """standDownMap hides by setting the hidden attribute, which an author
    display rule silently beats. A map that cannot draw would otherwise leave
    an empty 620px column and two dead filter groups beside the fallback."""
    page = open_page(browser, f"{base}/?d=21", [])
    page.wait_for_selector("#mpList .maprow")
    shown = page.evaluate("""(() => {
      const stuck = [];
      for (const id of ['mpCanvas', 'mpq', 'mpList', 'mpRestrict', 'mpOnline']) {
        const el = document.getElementById(id);
        el.hidden = true;
        if (getComputedStyle(el).display !== 'none') stuck.push(id);
        el.hidden = false;
      }
      return stuck;
    })()""")
    check("everything the map stands down actually hides", shown, [])
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


def test_nav_collapses_before_phone_width(browser, base):
    """Between the full links and the phone menu, the five destinations fold
    into one Sections pill instead of wrapping the bar onto a second line."""
    page = open_page(browser, f"{base}/?d=21", [], viewport={"width": 1100, "height": 800})
    check("the links fold away in the narrow band",
          page.locator("#mastnav").is_visible(), False)
    check("the Sections pill takes their place",
          page.locator("#navpick").is_visible(), True)
    check("the utilities stay on the row, unlike at phone width",
          page.locator("#contactbtn").is_visible(), True)
    # Rows, not a height number: the row's own box has enough padding that a
    # clean single line and a genuine wrap differ by very little in height,
    # which measuring a threshold against got wrong once already. Same top as
    # the brand mark is what "one line" actually means.
    brand_top = page.locator(".brandmark").bounding_box()["y"]
    pick_top = page.locator("#navpick").bounding_box()["y"]
    check("the bar stays one line", abs(brand_top - pick_top) < 20, True)

    page.locator("#navsel").select_option("#map")
    check("choosing a destination navigates to it", page.evaluate("location.hash"), "#map")
    page.close()


def test_phone_menu(browser, base):
    page = open_page(browser, f"{base}/?d=21", [], viewport={"width": 390, "height": 800})
    btn = page.locator("#menubtn")
    check("the menu button shows on a phone", btn.is_visible(), True)
    check("the links start folded away", page.locator("#mastnav").is_visible(), False)
    check("the district pill stays on the bar, not folded into the menu",
          page.locator(".distpick").is_visible(), True)
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

    # Explicit, not Playwright's own default viewport: 1280 sits inside the
    # band where the five links fold into the Sections pill, and a "wide
    # screen" case should mean a width that never does that, not whatever a
    # default happens to be today.
    page = open_page(browser, f"{base}/?d=21", [], viewport={"width": 1400, "height": 800})
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
                      test_club_drawer, test_year_scrub, test_sort, test_map, test_map_filters, test_map_filters_without_restriction_data,
                      test_map_list, test_map_list_edges, test_map_stands_down_completely,
                      test_map_layering,
                      test_nav_collapses_before_phone_width,
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
