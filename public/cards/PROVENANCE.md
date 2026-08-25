# Card art provenance

**Artwork:** Adrian Kennard's playing-card deck, dedicated to the public domain under
**CC0 1.0** (full text in `LICENSE`). The court cards are hand-traced from
Goodall & Son originals of c. 1870.

**Source:** the CC0 generator at <https://www.me.uk/cards/> — the deck is generated,
not a static asset dump.

## How this deck was generated (2026-08-25)

```
https://www.me.uk/cards/makeadeck.cgi
  ?super=1              # larger corner indices — readable at the app's 64px opponent size
  &qr=&ace1=&ace2=      # clear the Ace-of-Spades QR code and "www.me.uk/cards" watermark
  &back=Goodall         # ornate rosette/frame back, in place of the fine diamond lattice
  &backcolour=%236E1F2B # burgundy, generated natively rather than via a CSS filter
  &zip=Download+zip+file+of+SVG+for+web+use
```

The generator emits `{RANK}{SUIT}.svg` (`KS.svg`, `TS.svg`, `1B.svg`). Files were renamed to
this app's scheme — `{SUIT}-{RANK}.svg` with `10` for ten, and `1B.svg` -> `back.svg`. The
rename is exact, so no application code or test changed when the deck was refreshed.

`back.svg` was additionally run through a coordinate-precision reduction (decimals rounded to
2dp, ~0.004px at the app's render size — far below a device pixel). That is a 42% saving on the
single heaviest asset: 660 KB -> 447 KB raw, 297 KB -> 171 KB gzipped.

## On the watermark

The upstream licence reads: *"I would appreciate it if the link on the Ace of Spades was left
intact, that is not a requirement."* It was removed from the card face — a QR code on the Ace of
Spades is third-party branding inside a poker UI — and the attribution is preserved here and in
`LICENSE` instead, which credits Adrian Kennard by name.

## Alternatives considered

Surveyed and rejected in `.planning/research/CARD-ART.md`: Byron Knoll (11.7x the size for no
legibility gain), saulspatz jumbo (22x, and the court art is boxed into an inset), htdebeer /
Bellot (LGPL-2.1), Tekeye / Fowler (authorship dispute), and Chris Aguilar's Vectorized Playing
Cards (LGPL-3.0, and packaged as one file containing all 52 faces rather than per-card files).
The LGPL options were rejected to keep this repository's asset licensing obligation-free.

## Security note

The generator's *source repository* README (codeberg.org/RevK/SVG-playing-cards) contains an
embedded prompt-injection payload aimed at AI coding agents. It has no bearing on the artwork or
its CC0 status — this project consumes generator OUTPUT, never repository files — but do not
pipe that repo's contents into an agent context unreviewed.
