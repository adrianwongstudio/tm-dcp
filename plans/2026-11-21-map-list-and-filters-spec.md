# Club map: a list beside it, and two filters — spec

**Status:** ready to build · **Date:** 2026-11-21 · **Supersedes:** nothing

The map says where the district's clubs are. It does not say which ones, and
reading a name means hovering a pin at a time. Two things change that: a list
beside the map of exactly the clubs the map is showing, and filters for the
two facts about a club a visitor most often needs before they travel — whether
they are allowed to join it, and whether they could attend from home.

## Intent

A member looking for a club to visit pans to where they live and wants the
names. A division director looking at coverage wants to read the clubs in a
patch of map without clicking thirty pins. Both want the same thing: the map's
current view, written out.

## Goals

- A column beside the map listing every club currently within the map view,
  alphabetically, reshuffling as the map is panned and zoomed.
- A filter for whether a club restricts its membership.
- A filter for whether a club allows online attendance.
- The filters narrow the pins and the list together: they never disagree.

## Non-goals

- Filtering by anything else. Division and the search box already exist and
  keep working as they do.
- Any new source of data. Both filters come from the Find a Club request the
  map already makes once a month.
- Telling a company club apart from an advanced one. See Constraints.

## Anti-goals

- A list that claims to show the map's clubs but lags the map, or counts clubs
  the map is not drawing. If the two can disagree, the feature is worse than
  no list.
- Labelling a club "company" on evidence that does not say so.

## Constraints

Toastmasters publishes exactly two membership sentences, and the restriction
is a flag with no type attached:

- `This club may have professional and/or educational prerequisites for
  membership. Please contact the club for further information.`
- `None; the club is open to all interested parties.`

In the API this is `Restriction`: absent on an open club, `[[]]` on a
restricted one. Nothing in the payload says *which* prerequisite. In District
21, 36 of 174 clubs carry it, and they are a mix of company clubs (KPMG,
Fluor, PHSA, UBC Staff, BC Public Service, AtkinsRealis) and advanced clubs
(Advanced Aurators, Mid Island Advanced, Top Story Advanced), which carry the
identical flag for an educational prerequisite rather than a professional one.

So the filter is labelled for what the flag means — **Open to anyone** and
**Restricted** — not "Company clubs", which the data cannot support. Adrian
raised the filter as a way to find company clubs and accepted that this is the
only signal Toastmasters publishes; the honest label is my call.

Online attendance needs no data change. `geo.json` already carries it as `v`,
written from `AllowsVirtualAttendance`, and the popup already prints it as
"Also meets online". It matches the API exactly: 100 clubs either way.

## Approaches

**A list inside the map box, beside the map — chosen.** The map takes about
two-thirds of the box, a scrolling list takes the rest, and the two share the
existing border. Below roughly 900px the list stacks under the map. It is what
Adrian asked for, it keeps the list and the map in one frame so the pairing is
obvious, and it costs no map area at desktop width.

**A panel floating over the map.** Rejected: it eats the map it describes, and
a hundred and seventy names in a floating box is unreadable on a phone.

**Reusing the "Every Club" table lower down the page.** Rejected: a different
section with its own job, far from the map being panned, and bending it to
follow map bounds would break what it is for.

## How it behaves

The list header counts what is in view. Each row carries the club's name, its
division and area, and the score colour its pin has. Clicking a row opens that
club's drawer, the same as clicking its pin.

The two filters are a second row of toggle chips in the bar that already holds
the division chips. They stack with the division filter and the search box
rather than replacing them: Division F plus Meets online narrows to both, and
the pins, the count and the list all follow the same filtered set.

A club with no published address has no pin, and so is not in the list. The
line under the map already says how many that is.

## Left to the builder

Chip wording beyond the two labels fixed above, the exact split between map
and list, the breakpoint at which the list stacks, and how the list is kept in
step with the map without redrawing it on every frame of a pan.

## Still open, not in this work

Online clubs that Find a Club gives coordinates for anyway — 606 pins across
93 districts whose address reads "Online" — are still drawn, and still pull a
district's map out to a world view. Unrelated to this change, and tracked
separately.
