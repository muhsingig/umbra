# umbra

A scroll-driven website for **Umbra**, a concept dark-sky lodge on the Changthang plateau, Ladakh. Scrolling carries you through one real new-moon night (10–11 October 2026), dusk to dawn.

- The headline assembles from stars and dissolves back into real star positions as you scroll.
- The sky is real: 5,044 catalogued stars and the Milky Way, placed for 32.8° N, 79.0° E, with the sun's actual altitude driving dusk and dawn.
- Your scrolling is a camera shutter: a four-hour star-trail exposure around Polaris, reversible, timed against your own scroll, with a meteor caught at 00:47.
- Tap any star: the telescope in the scene slews to it and a card tells you when the light reaching you left it.
- Dawn ends on a planner of the next six real new moons and a request form (concept only; nothing is sent).

## Run it

`index.html` is the complete, self-contained site. Open it in a browser, or serve the folder:

```bash
npx serve .
```

To publish on GitHub Pages: Settings → Pages → deploy from the `main` branch, root folder.

## Project layout

| Path | What it is |
|---|---|
| `index.html` | Built site, one file (fonts, data and scripts inlined) |
| `dist/` | Build outputs: `index.html` (full document) and `artifact.html` (body content only) |
| `src/` | Source: markup template, page CSS, and scripts (`sky.js` WebGL sky, `land.js` landscape planes, `scene.js` timeline and camera, `headline.js`, `picker.js`, `keepsake.js`, `sound.js`, `page.js`, `astro.js`) |
| `src/data/` | Baked data: star catalogue, Milky Way map, named stars, fallback posters |
| `engine/` | The scrollcraft engine (MIT, Nate Herk), used unmodified |
| `tools/` | `prep.py` and `prep_named.py` bake the data; `build.py` assembles the page |
| `lab/` | Playwright scripts used to screenshot and test the page |
| `BRIEF.md` | Creative brief, feeling curve and verification notes |

## Build

```bash
python3 tools/build.py        # writes dist/index.html and dist/artifact.html
cp dist/index.html index.html
```

Rebaking the data (`tools/prep.py`, `tools/prep_named.py`) needs Python with Pillow and NumPy, plus the source catalogues in `~/work/data` (see the scripts).

## Credits

- Star positions and Milky Way outline: [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf Frohn (BSD 3-Clause).
- Star names and distances: [HYG Database](https://github.com/astronexus/HYG-Database) v4.1 (CC BY-SA 4.0).
- Scroll engine: [scroll-craft](https://github.com/nateherkai/scroll-craft) by Nate Herk (MIT), see `engine/LICENSE-scrollcraft`.
- Fonts: Archivo and Geist Mono via Fontsource (SIL Open Font License), see `fonts/`.
- Skyglow figure: Falchi et al., *Science Advances*, 2016.

Umbra is a concept. The lodge does not exist; the sky does.
