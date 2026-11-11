# Design reference — the district Club Health board

What the page is built from: tokens, type, the rules that decide where colour
goes, and each region's construction. It is written **district-neutral**. The
design carries over to any district unchanged. A new district is a
`config.json` edit, not a redesign. See *Standing it up for another district*
at the end for the three strings that do not yet follow the config.

Everything here is implemented in `docs/styles.css`, `docs/app.js` and the
modules in `docs/js/`. Where this document and the stylesheet disagree, the
stylesheet is what ships. Fix whichever is wrong.

Type and colour follow the **Toastmasters International Brand Manual**. The
manual governs the brand but says nothing about status, so the board's
traffic-light reading is the one place the design keeps colours of its own.

---

## The five rules

1. **Say it once.** A section opens with one imperative line of at most twenty
   words. Caveats, definitions and provenance go behind the disclosure. Nobody
   reads a 58-word paragraph before their first control.
2. **Maroon means "you can act here."** It is the interactive colour, not
   decoration. The traffic lights carry status and nothing else.
3. **Spend colour where it decides something.** A pip, a bar, a badge, an
   urgency chip. Not on numerals, dates, arrows and icons all at once.
4. **Mono carries numbers and IDs.** Words and dates go to the sans, set with
   tabular figures. Never switch to mono partway through a sentence. A
   right-aligned two-word mono label that wraps is the worst case.
5. **Every text colour clears 4.5:1** (3:1 for large text) against the surface
   it actually sits on, in both themes, including the surface a row takes on
   hover. This outranks any value in this document.

---

## Colour

Tokens live at the top of `styles.css` in three blocks: `:root` (light), a
`prefers-color-scheme: dark` branch guarded with `:root:not([data-theme="light"])`,
and `:root[data-theme="dark"]` so an explicit choice beats the system setting.
All three carry the same token names.

### The brand palette

Four values from the Brand Manual (p.14). Everything else on the page is
derived from them.

| | | Job |
|---|---|---|
| True Maroon | `#772432` | `--maroon`, the "act here" colour |
| Loyal Blue | `#004165` | `--ink`: headings, numerals, primary text in light |
| Cool Gray | `#A9B2B1` | every neutral is a tint of it |
| Happy Yellow | `#F2DF74` | accent and, as issued, the amber status fill |

### Ground and ink

| Token | Light | Dark | Job |
|---|---|---|---|
| `--paper` | `#F6F7F7` | `#00121C` | page ground; wide-table rows |
| `--sunk` | `#F0F1F1` | `#001622` | inset surface; the pinned mobile rail |
| `--card` | `#FFFFFF` | `#001B2A` | raised surface: panels, cards, table headers |
| `--line` | `#D0D5D4` | `rgba(255,255,255,.10)` | hairline |
| `--line-soft` | `#E5E8E8` | `rgba(255,255,255,.06)` | row separators |
| `--ink` | `#004165` | `#F5F6F6` | headings, numerals, primary text |
| `--ink2` | `#3B6980` | `#BEC5C4` | body, deck, column labels |
| `--muted` | `#477085` | `#A9B2B1` | metadata, captions |
| `--ink4` | `#4D7286` | `#A9B2B1` | the quietest tier: club numbers, window names |

Light neutrals are tints of Cool Gray; the light ink tiers are Loyal Blue
lightened, not grey. The dark grounds are Loyal Blue taken almost to black, so
the two themes are the same two hues at opposite ends.

The **sunk** surface sets `--ink4`, not the page ground. It is the quietest
tier and sits in the densest place, so it has the least headroom of any ink.
`#4E7488` measured 4.684:1 on `--paper` and 5.027:1 on `--card` but failed at
**4.442:1** on `--sunk`, the current-year table's ground, where it sets 184
club numbers just under the bar. It is now
`#4D7286`: 4.811 on `--paper`, 5.164 on `--card`, 4.563 on `--sunk`. Measure
it against all three, and against the hover surface, when you retune it.

### Brand as interface

| Token | Light | Dark | Job |
|---|---|---|---|
| `--maroon` | `#772432` | `#772432` | **fill only**, always with white text |
| `--maroon-ink` | `#772432` | `#B4878E` | the brand as type: links, eyebrow, disclosure trigger, hero italic |
| `--maroon-wash` | 10% | 14% | active nav item |
| `--maroon-rule` | 45% | 50% | disclosure underline and panel edge |

**Never write `--maroon` into a `color:`.** Three places in `app.js` did and
measured 2:1. Use `--maroon-ink` when the brand has to be text.

In light, True Maroon is dark enough to be its own type colour, so
`--maroon-ink` is the brand value unchanged. Dark mode cannot use it, because on the
ink ground it is near-invisible, so it takes a light tint of the same hue.

`--accent` / `--accent-wash` carry Happy Yellow as the manual's accent. The
stylesheet defines them and spends the yellow only on the amber status fill.
A highlight that needs the accent should take these rather than introduce a
fifth value.

### Status: three values each, never one

| Status | fill | text **on** the fill | text on the page (light / dark) |
|---|---|---|---|
| 5–10 goals | `--green` `#46B583` | `--green-on` `#062015` | `#1F6E4C` / `#7FD3AB` |
| 3–4 goals | `--amber` `#F2DF74` | `--amber-on` `#1E1403` | `#7A5405` / `#F2DF74` |
| 0–2 goals | `--red` `#CA4B44` | `--red-on` `#FFFFFF` | `#A33128` / `#EE8B84` |

The **fills are identical in both themes**: one hue per status, and only
lightness moves, so the two themes read as one product. Amber never takes
white. That pairing measured near 2:1, and the table exists to prevent it.

Amber **is** Happy Yellow, as issued. It measures only 1.19:1 against a
near-white track, so on paper every status fill carries a hairline
`--fill-edge` (`rgba(0,0,0,.45)`) as an inset ring. It is barely visible on
green and red and is what gives the yellow a shape. A bounded
component satisfies WCAG 1.4.11 through its boundary: the edge measures 3.2:1
against the yellow and 3.8:1 against the track. In dark the same fills sit at
13:1 on the ink ground, so `--fill-edge` is `transparent` there.

Green and red are functional colours, not brand ones. The traffic-light
reading needs the three to stay distinct from each other and from True
Maroon.

`ink()` and `on()` in `app.js` map a fill token to its two counterparts.
Anything written into a `color:` from JS goes through one of them.

Recognition badges take their own trio (`--badge-green` `#1B6042`,
`--badge-amber` `#684704`, `--badge-neutral` `#366074`) because a badge's
colour sits in a wash over the Cool Gray ground and the on-page status inks are
tuned for the ground itself. In dark they alias back to the status inks.

Supporting: `--dead` (closed windows), `--lampoff`, `--pip-closed`,
`--pip-open`, `--red-wash` (urgency chip ground).

**Nothing in the page flow casts a shadow**, and `--shadow` is `none` in both
themes. Elevation is `--card` against `--paper` plus a hairline. The drawer and
the contact modal are the exception: each carries a large soft shadow because
it sits *above* the page rather than on it.

### Where colour is allowed

- Saturated fills: score badges, bars, pips, the urgency chip.
- Status ink: a division average, a membership delta, a change column.
- Everything else is `--ink` / `--ink2` / `--muted` / `--ink4`.

Numerals in tables stay `--ink`. A figure needing a status takes an **8px dot**
beside it (`.sdot[data-sig]`). A coloured numeral at 15px is the least legible
use of colour and the worst case for red-green colour blindness.

---

## Type

Gotham and Myriad Pro are licensed, so the board uses the manual's own free
alternates: **Montserrat** for headings and **Source Sans 3** for body, with
Arial and Segoe UI, the manual's tertiary faces, behind them in the stack.
**IBM Plex Mono** carries tabular figures and club numbers; the manual does not
govern monospace. All three are served from `docs/fonts/` (Montserrat and
Source Sans 3 as single variable files, Plex Mono in the two weights the
figures use) and declared by `@font-face` at the top of `styles.css`. A board
opened on a conference floor should not wait on a third-party handshake before
any type appears, and the files carry the Latin Extended and Vietnamese ranges
the club names need. `index.html` preloads the two the first screen is set in.

| Role | Desktop | Mobile (≤768px) |
|---|---|---|
| Hero headline | Montserrat `clamp(32px, 4.4vw, 52px)` / 1.04, 700, `-.02em` | 30px |
| Section heading | Montserrat 38px / 1.1, 700, `-.018em` | 30px |
| Sub-section heading | Montserrat 30px / 1.1, 700 | 25px |
| Instruction line | Source Sans 3 19px / 1.5, `--ink`, max 88ch | 18px |
| Deck | 18px / 1.6, `--ink2`, max 62ch | 17px |
| Body, table | 14–16px / 1.55 | 16px |
| Metadata | IBM Plex Mono 11–13px | — |
| Column label | IBM Plex Mono 11px, `.1em`, uppercase | — |

Montserrat is loaded at 500/600/700/800 and Source Sans 3 at 400–700; anything
else gets synthesised, which is visible at 33px.

**The instruction line is one sentence and holds one line.** The measure is
88ch because a 52ch cap broke every one of them in two. It still catches
anything that runs long. If a line needs two, cut it rather than let it wrap. In the `withctl` variant the line shares its row with
a toolbar, so it drops to 16px `--ink2` at 56ch.

Section and card headings are Title Case: articles, short prepositions and
conjunctions stay lowercase unless they open the heading.

---

## Metrics

```
spacing   4 · 8 · 10 · 12 · 14 · 18 · 22 · 24 · 28 · 32 · 44 · 52 · 64
radius    2 pip · 3 chip · 4 nav item · 5 area card, table shell · 6 panel, router
          · 7 scoped download · 8–9 maroon button, field · 11 drawer card
          · 12 tally, download bar · 14 board, chart card · 16 modal · 999 year pill
rows      masthead 64 · table header 40 · table row 56 · mobile row 54 · control 38
measure   instruction 88ch · withctl instruction 56ch · deck/prose 62ch · disclosure 60ch
```

Small, dense things stay tight (2–6); controls you press sit in the middle
(7–9); a surface you read *into* (a chart card, the board, the drawer, the
modal) rounds further (11–16).

Desktop renders a quarter larger as `zoom` on `.mast`, `main` and `.foot` above
768px. Never put it on `:root`, which walks the fixed drawer off the screen. The
drawer's own children take `zoom: 1.4` instead, because the box is
`position: fixed` and zooming it resolves `bottom: 0` in the scaled space.
Phones are excluded: 375px is already sized for the hand. Every value above is
pre-zoom.

---

## Regions

### Masthead

Full-bleed, 88px, `--card` ground, hairline under. Left: the Toastmasters
International mark at 56px tall (40px under 768px) plus a one-line wordmark,
the district and *Club Health*, in Montserrat 21px/700.

**The mark carries the organisation's name, so the wordmark does not.**
It used to end with TOASTMASTERS at 12px/700 uppercase beside a gavel of the
board's own drawing, which said the name twice once the real logo went in. What
is left names the district and the board, which the mark cannot.

**The bar grew to hold it.** At 64px the words inside the roundel were
texture rather than type. At 88px (110px on screen, since the desktop view is
zoomed a quarter) the lockup is close to the inch the brand manual asks for
and reads clearly. The cost is a tall sticky header.

**The artwork is never recoloured**, so it keeps its full-colour form in both
themes. The file as supplied had an opaque white background, which showed as a
white box on the dark ground. The background was flood-filled to transparent
from the border only (the white inside the wordmark bar is part of the logo)
and then cropped to its ink, so the asset is 160×133 rather than square. On the dark page the cream ring and the white wordmark bar are what
carry it; it needs no reversed variant and no white plate. It ships at 160 and
320 wide, chosen by `srcset`.

Right: **five destinations, named for the task and in page order** (*This
year*, *Areas*, *Trends*, *Clubs*, *Map*), then a utility cluster (Contact,
Change district, language, theme toggle) behind a `padding-left: 28px` rule. Nav items are
15px/600 at `7px 14px`; the active one is 700 `--ink` on `--maroon-wash`, set by
an `IntersectionObserver` that maps every section to one of the anchors.
*Who Climbed, and Who Slipped* is read against the charts beside it, so the two
share *Trends*. Utilities are 13px `--muted`.

The bar is sticky at `z-masthead`, so the destinations, the district and the
theme stay in reach down a board that runs to several screens.

At 760px and below the bar keeps one row: the wordmark, the language picker
(globe and chevron only), the theme toggle and a menu button (`#menubtn`,
`aria-expanded`, `aria-controls`). The destinations, Contact and the district
pill fold into a panel under that row, opened by the button. Choosing a link or
pressing Escape closes it, and Escape returns focus to the button. The
wrappers `.mastright` and `.mastutil` become `display: contents` there, so
every control is a flex item of the bar and `order` places it.

**One district control.** The wordmark names the district and the utilities
switch it. For a while the district word in the wordmark was itself a
`<select>` with a chevron, and *Change district* beside the utilities operated
the same select. Two controls for one choice read as two choices, so the
wordmark went back to being type.

What is left is `.distpick`: a pill that says *Change district* in words, with
a native `<select>` lying over it at `opacity: 0`, full size. The select is a
flat list in numeric order, with the lettered districts (F, U) last, and
retired districts sit in a `<optgroup>` of their own.

The pill is read and the select is operated, which gives one tab stop and the
platform's own menu. No pill has to size itself to the widest name on the list
(a select sizes itself to its widest option, here "No longer a district"). The pill is
`aria-hidden`; the select carries the name. It takes `--control-edge` like
every other control you operate, goes `--maroon-ink` on `:hover` and
`:focus-within`, and the focus ring is 2px `--maroon-ink` at `outline-offset:
2px` on the pill, since an invisible select cannot show one.

It is not a destination. The links answer *what do you need*, and the district
answers *whose board is this*, which scopes all of them.

**The theme toggle is one crescent.** It was a sun on the light page and a moon
on the dark one, so the control changed shape between themes. It is now the
same 15px crescent in both, outlined on the light page and filled on the dark
one, and the button's `aria-label` says where pressing it takes you.

Changing it navigates to `?d=<id>`. Every section, the drawer and the year
scrub all derive from the two documents, so a reload cannot leave a stale
corner behind. With JS off the select holds one option, the current district,
and does nothing.

### Hero

Two columns, `minmax(0,1fr) 400px`, gap 64px, stacking under 980px. Left: mono
eyebrow in `--maroon-ink`, headline with the second line in `<em>` (the closing
period stays outside the em in `--ink`), deck, the update note, then a legend
of three dots. Right: the router card, four rows of `64px 1fr`, each with a
tabular figure in `--maroon-ink` at 28px over a label and sub-label, and each
an anchor to the section it names.

### The update note

Under the deck, above the traffic-light legend, 14px: the cadence in
`--maroon-ink`, the *Next Update* label in `--muted`, the moment itself in
mono: **"New data every Sunday · Next Update Sun 18 Oct, 9:00 AM PDT"**. The
cadence is the second phrase in the hero to take the headline's maroon. Rule 2
holds everywhere a reader can click, and the hero is where the page is allowed
to speak rather than offer. The in-year heading says when the data was taken
(`(updated: 03-Oct-2026)`). The update note says when it moves again.

The `updates` block in `config.json` is the standing promise. `cadence` is the
sentence in the owner's words and `{day}` in it is a placeholder; `weekday`,
`time` and `timezone` are when the data is due; `next` overrides the lot with a
date, or a date and time, for a pause or a one-off, and is spent once it has
passed, so a forgotten override cannot leave the page promising a moment that
has gone.

**`time` is the promise, not the cron.** `refresh-inyear.yml` asks for 16:00
UTC Sunday and GitHub has run it at 19:22 and 19:40, because a scheduled
workflow is best-effort and queues behind everyone else's. The promise is set
late enough to cover that, and the build publishes `update_every: 7` beside the
instant so the page can carry it forward on its own. Without that repeat the
line emptied every week between the hour it named and the run that re-dated it,
and it stayed empty for a week the first Sunday it shipped.

**The reader is not where the schedule is.** 16:00 UTC Sunday is Sunday morning
in Vancouver and Monday before dawn in Sydney, so a page that says "Sunday" to
everyone gives some readers the wrong day. `next_update` therefore
travels as **one UTC instant**, and `setUpdateNote()` does every local thing
itself, from `Intl` and the browser's own zone: `{day}` becomes the reader's
weekday, and the date and time are theirs, in their locale's clock, with the
zone named. The page never asks where the reader is and looks up no address.

A date that has passed is dropped, because someone may be reading a copy the
cache kept and a promise for last Sunday is worse than none. The weekday
survives, since a weekly schedule keeps its local day either way.
An empty cadence drops the line altogether.

### Section header: the pattern for all six

```html
<div class="sechead">
  <div class="secheadrow"><h2>…</h2><span class="secchip">26–27 · open</span></div>
  <p class="instruct">One imperative sentence, ≤20 words.</p>
  <details class="howto"><summary>How to read this section</summary>
    <div class="howtobody"><p>The caveats.</p></div></details>
</div>
```

The chip is mono 12px `--muted` and is filled from the data, not the markup, so
it follows the year in view. The disclosure is a native `<details>`, so it works
with JS off, and a `beforeprint` handler opens every one for a print, closing
afterwards only the ones it opened.

The two live sections carry the snapshot date **in the heading** rather than
only in a footnote: `<span class="updated">(data as of <b>date</b>)</span>` at
17px, the date itself in mono `--red-ink`. It says *data as of* because the
date is Toastmasters', not ours. The dashboard's export carries its own `As of`
line and publishes about a day behind, so a board built on the 11th reads
`Oct 10, 2026`, which looked like a stale build under *updated*. The hero's
update note says when the page itself next moves, and the two must not be
confused. `asofText()` formats the date from `asof_iso` in the reader's
locale, like every other date on the page. It sits in the heading because the
first question about a live board is how old it is. The Current Year repeats
the same date inside its instruction line (`#cyAsof`, mono, sized to the
sentence around it) so the sentence stays true on its own.

`.sechead.withctl` is the variant that puts controls on the heading row: the
heading block left, a `flex-wrap: nowrap` toolbar right (wrapping under 1080px).

### The current-year table

Six columns, `table-layout: fixed`, widths on the header cells rather than a
`<colgroup>` so the mobile rules can override them:

| # | Column | Width | Treatment |
|---|---|---|---|
| 1 | Club | 250px | name 15px/700 clamped to two lines; number under it in mono 11px `--ink4`, with the plan flag beside it |
| 2 | Div | 56px | mono 14px, **14px left indent** — without it a wrapped name reads as touching the letter |
| 3 | Score | 96px | right; value 19px/800 **`--ink`**, `/10` in mono `--ink4` |
| 4 | Ten goals | 210px | ten 13px pips, gap 3, `padding-left: 24px` |
| 5 | Members | 128px | right; count 15px `--ink`, delta in a fixed 22px box, status ink |
| 6 | Next deadline | 1fr | right; urgency chip **only inside 30 days**, then date in mono, then window name in a 150px box |

Rows are 56px on `--paper` with the header raised on `--card`; at the old 76px a
screen held half as many clubs. No zebra striping. The whole row opens the
drawer. Column headers sort.

The toolbar carries search, a division select, and a **No Success Plan**
checkbox. The plan is a prerequisite for every recognition level, so a club
without one cannot be Distinguished whatever it scores. That makes it worth a
filter but not a column. It rides on the club line as
an amber `No Club Success Plan` flag, and only when it is missing.

Two columns are deliberately absent: **Ceiling**, which lives in the drawer,
and **Success Plan**, which the filter replaces.

The table sheds width in two steps before it reaches a phone. At **1420px** the
window name goes, because it is the widest thing in the last column and the least
load-bearing, since the date beside it already names the deadline. At **1190px**
the six fixed columns cannot fit at all, so the table drops to `table-layout:
auto` with a pinned club column while the page around it stays desktop.

Footer: pip legend left, `N of N clubs · snapshot <date>` right in mono `--ink4`.

### Area cards

`columns: 3` with `break-inside: avoid` on each card, **not** a fixed
`repeat(3, 1fr)`, which breaks its row and leaves a hole two columns wide in
every division with four or five areas.

The count follows the number of areas via `data-n` on `.areas`, because column
balancing fills greedily: four cards across three columns lands 2-2-0 and
empties the third, where two columns land 2-2 and fill both. Drops to 2 under
1024px and 1 under 640px.

Card: `--card`, hairline, radius 5, `12px 13px`, mono 10px area label with a
borderless download button pushed to its right. Each club row is a 20px circular
badge (status fill + status ink + the `--fill-edge` ring) beside the name in
`--ink`. The badge carries the colour and the name carries the ink. Clubs rank from most
goals to fewest, so the clubs needing help sit at the bottom.

Division header: name in Montserrat 22px, and on the right `N clubs · avg X ▾ Y`
with the average in status ink, the delta arrow in status ink, and the words
between them in the sans.

### Clubs the district no longer has

`live.json` carries today's roster, so a club present in the history and absent
from it has closed, merged or moved out. Its scores still stand and are still
counted. Only its name is marked:

- `.gone` strikes the name, rule in `--ink4` so it reads as a mark *over* the
  text, and steps the name back to `--ink2`. The strike is the signal, not
  colour, so it survives greyscale and colour blindness.
- In the five-year table the strike is joined by an `off roster` tag
  (`.cgone`, sans 10px/600 uppercase `.08em` in `--muted`).
- On the board these clubs **sink to the foot of their area**, whatever they
  scored. The list is read top-down for who to call, and nobody is left to
  call at a club that has gone.
- The two data files are fetched independently, so until `live.json` lands
  nothing is marked. An unmarked club makes no wrong claim, but a wrongly marked one
  would.

### Mobile: the pinned column

Both wide tables carry `.stick`. **Pin the cell, not the table:**

- `position: sticky; left: 0` on the club `th` and `td`
- an **opaque** background: `--sunk` for rows, `--card` for the header. A
  transparent sticky cell lets the scrolling figures show through it.
- `border-right: 1px solid var(--line)`, which makes it read as a fixed rail
  rather than a rendering fault.
- 220px from 1190px down, narrowing to 150px at 768px, where the name wraps to
  two lines rather than truncating and rows go to 54px
- under the name, mono 11px carrying division/area
- year columns 72px (64px under 480px), values 16px tabular

The five-year table orders its **year columns newest-first** below 768px, so the
year everyone came for is on screen before any sideways scrolling, and hides its
now-redundant Div column. The latest score takes a status dot and weight 700,
not a coloured numeral. `matchMedia` drives the order and redraws on change.

---

## What the October review changed

The design system handed back in October 2026 reads the board's own stylesheet
as its component set and marks its corrections in place. All of them are in
`styles.css` now, at the rule each belongs to.

**Reach and escape.** The masthead is sticky, so the destinations, the district
and the theme stay in reach down a page that runs several screens. One skip
link sits first in the page, ahead of a bar with a district select, five
destinations and the utilities. The club drawer is `inert` as well as
off-screen when closed, so nothing inside it is a tab stop until it opens.
Closing it hands focus back to whatever opened it, so a reader halfway down a
table lands where they left.

**A row is a row.** A `<tr>` cannot be a button without losing its table
semantics, so the club name inside the cell is the control (`.rowbtn`, a
reset declared before the components). The rest of the row still opens the
drawer through the click handler, and the name carries `translate="no"`.

**Edges that can be seen.** `--line` is a decorative hairline under 3:1, so it
no longer draws the edge of anything you operate. Text
fields, selects and the roster toggle take `--control-edge`, 3.1:1 on `--paper`
and 3.4:1 on `--card`. The reachable-goal pip is outlined in `--muted` for the
same reason, and the bar track is `--line-soft`, which reads on the card in
dark as well as light.

**A partial score makes no claim.** The running year's dot in the year-by-year
table is a hollow ring, never a band, because a colour would say the year had
settled.

**Shares, not sizes.** Realignment moved club counts a long way: District 21
counted 119 clubs in 2021–22 and 193 in 2025–26, and a column scaled by its
total reads that growth as performance. Every column in the *Five-Year
Trajectory* is full height, each year's total is printed under it, and the
caption is generated from the data. The same page serves every district, so a
fixed sentence about what the data shows cannot be true on all of them.

**Said in words.** A chevron on the wordmark was too quiet for a first-time
reader, so *Change district* sits beside the utilities in words. The
membership figures down an area card are labelled *Members*. The snapshot date
is a fact, not a warning, so it is `--ink` in the sans, not red in the mono.

---

## Language

The board is read worldwide. Toastmasters publishes its own material in six
languages, and the board carries those plus Traditional Chinese: **English,
Español, Français, Deutsch, 简体中文, 繁體中文, العربية**. The menu offers a language
only once a catalogue exists for it.

**The English is the source.** `docs/index.html` and the scripts under `docs/` hold the
English, and a catalogue in `docs/i18n/<lang>.json` is keyed by that English.
A key that goes missing therefore falls back to the words already in the
markup, not to a blank or to a label like `hero.lede.1`, and English costs no
fetch at all. Markup carries `data-i18n` (with `data-i18n-label` and
`data-i18n-ph` for the two attributes that hold copy); everything built in
script goes through `T('English', {slots})`.

**Sentences travel whole.** `{club} — {met} of 10 goals so far{why}{members}`
is one string with slots, not four fragments concatenated, because the
languages here do not agree on word order. Dates and
numbers are formatted in the chosen language too, through `LOC()`.

**Switching reloads the page**, as switching district does, for the same
reason: every section, the drawer and the year scrub are drawn from the two
documents, and a reload cannot leave a stale corner behind. It also means no
draw runs with a half-swapped catalogue.
The choice is remembered in `localStorage` beside the district and the theme,
and `lang` and `dir` are set in the head script, before the first paint.

**The language rides in the address**, as `?lang=`. A director who reads the
board in Español should be able to send that page to a club officer and have
it arrive in Español, not in whatever the recipient last chose. A language in
the address wins over the remembered one, since a link is a request, and is
then remembered itself, as `?d=` already is. A language the board has no
catalogue for is replaced in the bar with the one in use, as a stale `?d=` is,
so the address never claims something the page is not doing.

Every address the page writes for itself goes through `boardUrl()`. Before it
existed, five places assembled query strings by hand and each knew only the
parts it cared about, which is how the district switch and closing the drawer
dropped the language. The parts are ordered scope
(`d`), then how it is read (`lang`), then what is open (`c`); anything else in
the address is not the board's and does not survive a rewrite.

**Club names are never translated** and carry `translate="no"`
so a browser's own translator leaves them alone too. "District 21" is the
build's own wording rather than a registered name, so the word in front of the
number does get translated.

**Arabic mirrors the page.** The stylesheet uses logical properties
(`margin-inline-start`, `inset-inline-start`, `text-align:start`), so the
layout flips on its own, and `[dir="rtl"]` carries only what must not flip. The
five-year trace is drawn at fixed SVG coordinates, so `spark()` mirrors its own
x positions rather than leaving it running against the mirrored year columns
(flipping the SVG would mirror its digits too). The self-hosted faces
carry no Arabic, so an Arabic stack is named for that language. Copy that
names a side (*call the clubs on the right*) says the other side in Arabic,
because the panels swap.

`scripts/i18n_extract.py` collects every string the board can show, including
the goal names, window names and award levels that arrive in the data, and
reports what each catalogue is missing or still carrying. Nothing in the page
points at the catalogues, so without that check they drift unnoticed. Run it
after changing any English text; `--check` exits non-zero when a catalogue is
stale.

Every catalogue is machine-assisted and says so in its own `_about` field,
awaiting review by a District translation team.

**The workbooks stay in English**, deliberately. Sheet names, column headers
and note rows are not translated. Toastmasters' own dashboard exports are in
English, a workbook is passed between people and pasted into other
spreadsheets, and a sheet name is limited to 31 characters.

---

## Counting readers

One `<script>` before `</body>` loads Cloudflare Web Analytics, which is free.
It answers one question: how many people open the board, and roughly from
where.

It sets no cookie and stores no IP, so no consent banner is needed, which on a page read across Europe saves a
modal. The token in the tag is public by
design; it identifies the site, not the account.

**It is the only third-party request on the page** apart from the map
basemap. The fonts are self-hosted so that nothing has to be fetched from
somebody else before type appears. The analytics script sits at the end of the
body, so nothing the reader is waiting for waits for it.

It counts browsers that run JavaScript, so a club meeting on one office wifi
counts as one reader. The numbers live in the Cloudflare dashboard behind that
account, not on this site, which has no server.

---

## The contrast audit

Required before shipping any new coloured label, in **both** themes:

1. Walk every element with a text node; skip hidden and zero-size.
2. Composite the element's colour and every translucent background down to the
   nearest fully painted ancestor. Parse `color(srgb …)` as well as `rgb()` —
   a regex that misses the modern form reports false failures on every badge.
3. Require 4.5:1, or 3:1 where the text is ≥24px, or ≥18.66px and bold.
4. Repeat with `.stick tbody tr { background: var(--card) }` forced, which is
   the hover surface, and with the drawer and contact modal open.

Both themes report **zero failures** as shipped. Where a brand value cannot
clear the bar as type, it is replaced by a tint of the same hue (`--maroon-ink`
in dark) or kept to fills only. The one functional colour a shade off its
handoff is `--red`: white on `#D2564F` measures 4.08:1, and the lamps carrying
it are small bold type, not large.

Happy Yellow is the standing exception. It is never type and never a status
*text* colour in light, only a fill, and it gets its boundary contrast from
`--fill-edge`.

---

## Adding a district

Nothing. A district appears in the dashboard's own list, the next build picks
it up, and `districts.json` gains an entry. There is no per-district config and
no markup to edit. `config.json` holds only what is district-neutral, and
everything that names a district travels in `data.json` and `applySiteConfig()`.

`site.eyebrow` is the programme name alone, **"Distinguished Club Program"**.
The year span appended after it (`· 2021–22 to 2026–27`) is derived from the
data by `setEyebrow()`, the finished years plus the open one, so it is right the
morning after a year rolls. Do not write a span into the config.

**A club may have changed district.** A third of them did for 2026-27. The
drawer's year picker shows those years as chips of their own, `.dyr.away`,
dashed because they leave the page, labelled `25–26 · D121 ↗`, and with no
`aria-pressed` because they navigate rather than toggle. They sort into the
same chronological run as the district's own years, since it is one club and
one record.

**A district may no longer exist.** The 2026-2027 realignment dissolved 68 of
162 districts into the new 200-series. Their five finished years are still in
the dashboard's archive, so they stay on the board rather than going with the
roster. They sit in
a trailing `<optgroup>`, *No longer a district*, because they are not live
districts any more, and their option labels carry the last year they
were listed (`District 121 · to 25–26`).

Such a district has no open year. `#inyear` is hidden and `#gonedistrict`
takes its place, because the in-year error path tells the reader the data
failed to load, which is false. The board and everything below it are
unchanged.

**A district may have no finished years.** Thirty of the ninety-four were
created for 2026-2027 and their archives are empty. The retrospective
sections (`#board`, `#signals`, `#movement`, `#clubs`) and the masthead and
router links into them are hidden rather than drawn empty, and the deck's year
phrase comes from `yearPhrase()`, never from the markup. The in-year table is
still searchable and filterable.

**Hiding them silently is not enough.** Four sections vanishing without a word
read as a broken page, and a reader reported it as one. `#nohistory` takes their
place on those districts, using the same section pattern. It names the four
missing sections, says why the archive is empty and gives the date the first
finished year arrives. The nav's `IntersectionObserver` does not observe it.

Run `scripts/stamp_assets.py` **last** after any change under `docs/`. It
stamps `styles.css`, `app.js` and `districts.json` onto `index.html`, and writes
one hash over `app.js` and `docs/js/*.js` onto every module import. Each
district's `data.json` and `live.json` hash goes into `districts.json`, because
the data files are too many to name in the markup, so `app.js` reads their
versions from the index it has already loaded.

## Five-year trace

The trace (`spark()` in `core.js`) is the line of goals met per year, a dotted
rule at the 5-goal mark labelled `5`, and the goal count above each year's
point, so a reader sees where the club stood without hovering. The last point
takes the status colour; the numbers are muted mono type.
