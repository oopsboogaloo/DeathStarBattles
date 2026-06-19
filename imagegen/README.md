# imagegen

An HTML5 sandbox for experimenting with procedural / "advanced" image
generation. First experiment: a randomly generated **starfield + nebula**.

Pure HTML + Canvas 2D, no dependencies, no build step — open `index.html` (or
serve the folder) and it runs.

## Run

```powershell
# from the imagegen folder, any static server works, e.g.:
python -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html` directly in a browser.

## How it works

Everything is **seeded** (mulberry32 PRNG + value-noise), so any image can be
reproduced from its seed or re-rolled.

### Nebula
1. **fBm** — fractal Brownian motion (summed octaves of value noise) for a
   base cloud-density field.
2. **Domain warping** — noise sampled at coordinates that are themselves warped
   by noise (Inigo Quilez technique). This is what turns blobby clouds into the
   swirling, filamentary structure real nebulae have.
3. **Multi-colour mapping** — a 4-colour palette mixed by the intermediate warp
   fields, mimicking different emission gases (Hα, OIII, …).
4. **Dust / dark patches** — a *separate* noise field thresholded into an
   opacity mask that carves voids and dark lanes.
5. **Composition envelope + tone curve** — keeps the nebula concentrated with
   bright cores falling to black, rather than a flat haze.

### Starfield
- Seeded scatter with a power-law brightness distribution (most faint, few
  brilliant), blackbody colour tints, glow halos + diffraction spikes on the
  brightest stars, and attenuation inside thick dust so dark lanes read as
  being in front of the stars.

## Controls
Seed, palette, detail (octaves), warp strength, dust amount, star density,
plus **Generate** and **Save PNG**.

## Ideas / next steps
- Port the nebula to a **WebGL fragment shader** for real-time re-rolls and
  animation.
- Bloom / glow post-process pass on the bright emission.
- Simplex/Perlin gradient noise instead of value noise for smoother gradients.
- Star clustering along a Milky-Way density band.
