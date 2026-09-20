# Project charter

The constraints the project is built under. Code, data and interface follow from
them. Changing section 1 requires written agreement from the Ethereum Foundation
and an amendment committed here.

## 1. No composite scoring

The project publishes no risk score, rating, index or ranking of its own.

None of the following may ever ship:

- a number, letter or grade computed from more than one feed's value;
- an average, median or weighted sum across feeds presented as a property of a
  protocol;
- a "reconciled" column that picks which feed is right;
- a default sort order that reads as a risk ranking;
- our own commentary in place of a feed's words.

What is allowed, because it is not the same thing:

- **Measured quantities** — TVL, incident counts. Facts published by their
  source, not verdicts about risk.
- **Facts about our own coverage** — whether a feed publishes anything about a
  protocol, when we last read it. These describe this project, not the protocol.

Stated once: _arithmetic across feeds is forbidden; carrying one feed's own
published value is not._

## 2. Verbatim, with a link and a date

Every value is stored as the feed published it, as a string, with the URL we
read and the date the feed gave. The protocol page also shows the raw record
behind each card, so nothing is hidden behind our choice of what to display.

## 3. Gaps are data, and the dashboard says no more than it knows

The dashboard shows one thing per cell: whether that feed publishes data about
that protocol. It shows no value there, because feeds assess different objects —
one grades a protocol, another the vaults inside it — and putting their values in
one table would invite a comparison none of them supports.

A feed that covers nothing and a pipeline failure are stored as different states
(`none` and `error`). A failed refresh keeps the previous value rather than
emptying a cell.

## 4. Open by construction

AGPL-3.0, public repository. Data is plain JSON in the repository, so every
change to every cell is in the git history — including changes a feed later makes
to its own page. Corrections arrive as pull requests.

## 5. Neutrality

The maintainers hold no undisclosed commercial relationship with any listed
protocol or feed provider. The architecture is the structural guarantee:
computing no score of our own leaves nothing to tilt.

## 6. Amending this charter

Sections 2 to 5 may be strengthened by ordinary pull request. Section 1 may not
be relaxed without written agreement from the Ethereum Foundation, recorded here
with the date and the text of that agreement.
