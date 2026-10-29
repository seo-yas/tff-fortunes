# Freckled Fork Fortunes

A phone page for The Freckled Fork's Halloween pop-up (Fri 30 Oct 2026, Kerhonkson Halloween Pet Parade, Starlite Motel). Guests scan a QR code, say what they ate and when they were born, and pull a card.

Brief: `01-System-Brain/handoffs/for-cowork/fortunes-project-intake-2026-10-28.md` in the Haque Brain vault. `reference/jess-build/` is Jess's earlier single-page build (menu data and the 19-card line bank; the photo cutouts were left out).

## Card title boxes

The painted numeral and title box of every cat card is measured per card into `page/cards/cats/boxes.json` by `scripts/measure-boxes.py` (cream-band detection on the 480x720 AVIFs). The page and the share image place and fit the lettering from it. `scripts/ingest-cats.mjs` re-runs the measurement after each ingest, so the file stays in step with the art. The proof render is `reference/cards-fitted-proof-2026-10-29.jpg` (all 24 titles centred inside their box). The gate is `tests/cards-fitted.spec.mjs`.

## Reading text and card picks

The reading text is `engine/readings.json`: Jess's words, one `tagline` and `text` per cat card, plus her 12 pantry omens. Five cards she did not write (the-hierophant, death, the-tower, the-pet-parade, the-pass) carry `_cowork_draft: true` and ship as written until she replaces them. The card picks are pinned by `tests/fixtures/draws-r1.json`.
