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


def open_page(browser, url, problems):
    """A page with third parties blocked, collecting anything that goes wrong."""
    page = browser.new_page()
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
                      test_club_drawer, test_language, test_district_paths):
                print(t.__name__)
                t(browser, base)
            browser.close()
    finally:
        server.shutdown()
    print("FAILED" if FAILED else "all passed")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
