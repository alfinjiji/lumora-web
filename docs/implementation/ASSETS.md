# Design assets and font provenance

The two user-supplied, approved design archives are retained under design-reference. The storefront uses their editorial images under apps/web/public/images/design and the supplied Auraflare design direction. These are design assets, not seeded product records or a claim that these candles are currently offered for sale. Product photographs are uploaded through the owner catalogue workflow.

The source archives do not establish an independently verified stock-photography licence. Confirm commercial usage rights for the supplied editorial assets, or replace them with owned/licensed photographs, before launch. No new generated candle images were introduced during this rebuild.

Approved typefaces are self-hosted DM Sans and Cormorant Garamond, including italic. Public fonts/SOURCES.json records upstream sources, original hashes, subset hashes and SIL OFL notices. scripts/subset-fonts.py with scripts/requirements-fonts.txt reproduces the Latin/currency/UI-symbol subsets. Variable axes, original glyph outlines and layout features are retained; full faces are loaded only for their remaining supported character ranges. This reduces initial font transfer without changing the approved letterforms.
