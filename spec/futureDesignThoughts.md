# Future Design Thoughts

## Star Field — Emissive Halo Bloom

**Status:** Parked — worth revisiting

**Idea:** Give each star a soft glow disc beyond its physical radius to mimic an emissive/bloom look. Instead of the gradient fitting inside the star's own pixel radius, extend it to `pr * N` and let it bleed outward.

**What was tried:**
- Current code (Renderer.js `_drawStarField`, line ~123) already has a radial gradient per star with a white-boosted core and a steep falloff near the edge — this replaced the original flat filled circles + 1.2px blur composite.
- A `pr * 3` halo was tested but caused very large stars (the rare outliers with `gr` up to 3.4 game units) to blow out into huge glowing blobs.

**The problem to solve:** Most stars are 0.5–2px on screen — too small for an internal gradient to read visually. The gradient only becomes apparent on the larger outlier stars, which then overdo it at 3× scale.

**Promising directions:**
1. Separate the glow from the dot — tiny solid dot at `pr`, plus a second soft disc at `pr * 1.8` with a hard cap on max pixel size (e.g. `Math.min(pr * 1.8, 6)`), so outliers don't blow out.
2. Shift the size distribution up — more stars in the 1–3px range so the gradient has room to read, while capping the rare large ones.
3. Combine gradient with a light blur (0.5–0.7px instead of the original 1.2px) to soften hard edges without losing the emissive character.
