"""Assemble Umbra into one self-contained page.
dist/artifact.html  page content for publishing (the host adds doctype/head/body)
dist/index.html     the same content wrapped in a minimal document for local tests
"""
import base64, os
ROOT = os.path.join(os.path.dirname(__file__), '..')
R = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()
B64 = lambda p: base64.b64encode(open(os.path.join(ROOT, p), 'rb').read()).decode()

fonts = (
  "@font-face{font-family:'Archivo Variable';font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62%% 125%%;"
  "src:url(data:font/woff2;base64,%s) format('woff2-variations'),url(data:font/woff2;base64,%s) format('woff2');}"
  "@font-face{font-family:'Geist Mono';font-style:normal;font-display:swap;font-weight:400;src:url(data:font/woff2;base64,%s) format('woff2');}"
  "@font-face{font-family:'Geist Mono';font-style:normal;font-display:swap;font-weight:500;src:url(data:font/woff2;base64,%s) format('woff2');}"
) % (
  B64('fonts/fontsource-variable-archivo-5.3.0/files/archivo-latin-wdth-normal.woff2'),
  B64('fonts/fontsource-variable-archivo-5.3.0/files/archivo-latin-wdth-normal.woff2'),
  B64('fonts/fontsource-geist-mono-5.3.0/files/geist-mono-latin-400-normal.woff2'),
  B64('fonts/fontsource-geist-mono-5.3.0/files/geist-mono-latin-500-normal.woff2'))

html = R('src/index.src.html')
page_js = '\n'.join(R('src/' + f) for f in ('astro.js', 'sky.js', 'land.js', 'scene.js', 'page.js', 'headline.js', 'picker.js', 'keepsake.js', 'sound.js'))
for k, v in {
  '/*@FONTS*/': fonts,
  '/*@ENGINE_CSS*/': R('engine/scrollcraft.css'),
  '/*@PAGE_CSS*/': R('src/page.css'),
  '/*@STARS*/': R('src/data/stars.b64'),
  '/*@NAMED*/': R('src/data/named.json'),
  '/*@MW*/': 'data:image/webp;base64,' + B64('src/data/mw.webp'),
  '/*@ENGINE_JS*/': R('engine/scrollcraft.js'),
  '/*@POSTERS*/': ".poster{background-image:url(data:image/jpeg;base64,%s)}@media (max-aspect-ratio: 9/10){.poster{background-image:url(data:image/jpeg;base64,%s)}}" % (B64('src/data/poster-wide.jpg'), B64('src/data/poster-tall.jpg')),
  '/*@PAGE_JS*/': page_js,
}.items():
  assert k in html, k
  html = html.replace(k, v)

os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
open(os.path.join(ROOT, 'dist/artifact.html'), 'w', encoding='utf-8').write(html)
shell = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
  'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>'
  '</head><body>\n' + html + '\n</body></html>')
open(os.path.join(ROOT, 'dist/index.html'), 'w', encoding='utf-8').write(shell)
print('artifact.html', len(html.encode()) // 1024, 'KB')
