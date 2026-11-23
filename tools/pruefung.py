#!/usr/bin/env python3
"""EC Wegscheid – automatische Prüfung vor dem Online-Gang.

Prüft das Repository auf
  FEHLER  (Prüfung schlägt fehl):
    - eingebundene Dateien, die nicht existieren (src/href in HTML, url() in CSS,
      Pfade in JavaScript wie src="…", href="…", new URL('…'))
    - neue Dateien über 1 MB, die nicht in tools/pruefung-ausnahmen.txt stehen
    - beschädigte Bilder (PNG mit falscher Prüfsumme, JPEG ohne Anfang/Ende),
      auch in eingebetteten data:image-Bildern
    - JavaScript-Dateien mit Syntaxfehlern (wenn node vorhanden ist)
    - ungültige JSON-Dateien
  HINWEIS (Prüfung läuft weiter):
    - Dateien mit identischem Inhalt
    - große eingebettete Bilder (data:image über 100 KB)

Aufruf:  python3 tools/pruefung.py [Ordner]
"""
import base64
import hashlib
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import zlib
from urllib.parse import unquote, urlsplit

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..'))
MAX_DATEI = 1_000_000
MAX_EINGEBETTET = 100_000
TEXT = ('.html', '.htm', '.css', '.js', '.mjs')
BILD = ('.png', '.jpg', '.jpeg')
UEBERSPRINGEN = {'.git', 'node_modules'}

fehler, hinweise = [], []


def rel(p):
    return os.path.relpath(p, ROOT).replace(os.sep, '/')


def alle_dateien():
    for d, ds, fs in os.walk(ROOT):
        ds[:] = [x for x in ds if x not in UEBERSPRINGEN]
        for f in fs:
            yield os.path.join(d, f)


def ausnahmen():
    p = os.path.join(ROOT, 'tools', 'pruefung-ausnahmen.txt')
    if not os.path.exists(p):
        return set()
    return {z.split('#')[0].strip() for z in open(p, encoding='utf-8') if z.split('#')[0].strip()}


# ---------- Bilder ----------
def png_ok(b):
    if not b.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'keine PNG-Signatur'
    i = 8
    while i < len(b):
        if i + 8 > len(b):
            return 'Datei abgeschnitten'
        n, typ = struct.unpack('>I4s', b[i:i + 8])
        daten = b[i + 8:i + 8 + n]
        if i + 12 + n > len(b):
            return 'Datei abgeschnitten'
        crc = struct.unpack('>I', b[i + 8 + n:i + 12 + n])[0]
        if zlib.crc32(typ + daten) & 0xffffffff != crc:
            return 'Prüfsumme falsch im Block ' + typ.decode('latin1')
        if typ == b'IEND':
            return None
        i += 12 + n
    return 'Ende (IEND) fehlt'


def jpg_ok(b):
    if not b.startswith(b'\xff\xd8'):
        return 'keine JPEG-Signatur'
    if b'\xff\xd9' not in b[-1024:]:
        return 'Ende fehlt (abgeschnitten?)'
    return None


def bild_ok(b, art):
    return png_ok(b) if art == 'png' else jpg_ok(b) if art in ('jpg', 'jpeg') else None


# ---------- Verweise ----------
ATTR = re.compile(r'''\b(?:src|href|data-src|poster)\s*=\s*(["'])([^"'<>]*?)\1''', re.I)
CSSURL = re.compile(r'''url\(\s*(["']?)([^"')]+?)\1\s*\)''', re.I)
NEWURL = re.compile(r'''new\s+URL\(\s*(["'])([^"']+)\1\s*,''')
ENDUNGEN = 'html|htm|js|mjs|css|png|jpe?g|svg|webp|gif|ico|json|webmanifest|pdf|skmr'
PFAD = re.compile(r'^(?:\./)?[\w%() .\-]+(?:/[\w%() .\-]+)*\.(?:' + ENDUNGEN + r')(?:\?[^#\s]*)?(?:#\S*)?$', re.I)
EINGEBETTET = re.compile(r'data:image/(png|jpe?g);base64,([A-Za-z0-9+/=]{200,})')


def zielpfad(quelle, url):
    url = url.strip()
    if not url or url.startswith(('#', 'data:', 'blob:', 'mailto:', 'tel:', 'javascript:', 'about:', '//')):
        return None
    if re.match(r'^[a-z][a-z0-9+.-]*:', url, re.I):
        return None
    if any(z in url for z in ('${', '{{', "'+", '"+', '+\'', '+"', '`')):
        return None  # dynamisch zusammengesetzt
    if not PFAD.match(url):
        return None  # kein eindeutiger Dateipfad (z. B. Variable oder Ausdruck)
    pfad = unquote(urlsplit(url).path)
    if not pfad or pfad.endswith('/'):
        return None
    if '.' not in os.path.basename(pfad):
        return None
    if pfad.startswith('/'):
        # absoluter Pfad auf GitHub Pages: /Repositoryname/…
        teile = pfad.lstrip('/').split('/', 1)
        if len(teile) < 2:
            return None
        return os.path.normpath(os.path.join(ROOT, teile[1]))
    return os.path.normpath(os.path.join(os.path.dirname(quelle), pfad))


def pruefe_verweise(p, text):
    endung = os.path.splitext(p)[1].lower()
    funde = []
    if endung in ('.html', '.htm'):
        funde += [m.group(2) for m in ATTR.finditer(text)]
        funde += [m.group(2) for m in CSSURL.finditer(text)]
    elif endung == '.css':
        funde += [m.group(2) for m in CSSURL.finditer(text)]
    else:  # JavaScript: nur eindeutige Pfadangaben
        funde += [m.group(2) for m in ATTR.finditer(text)]
        funde += [m.group(2) for m in CSSURL.finditer(text)]
        funde += [m.group(2) for m in NEWURL.finditer(text)]
    for url in sorted(set(funde)):
        ziel = zielpfad(p, url)
        if ziel and not os.path.exists(ziel) and endung in ('.js', '.mjs'):
            # Pfade in Skripten gelten relativ zur Seite, die das Skript lädt (meist Hauptordner)
            ersatz = zielpfad(os.path.join(ROOT, 'seite.html'), url)
            if ersatz and os.path.exists(ersatz):
                continue
        if ziel and not os.path.exists(ziel):
            fehler.append(f'{rel(p)}: verweist auf fehlende Datei "{url}"')


def main():
    erlaubt_gross = ausnahmen()
    hashes = {}
    js = []
    for p in alle_dateien():
        r = rel(p)
        endung = os.path.splitext(p)[1].lower()
        groesse = os.path.getsize(p)
        if groesse > MAX_DATEI and r not in erlaubt_gross:
            fehler.append(f'{r}: {groesse / 1e6:.1f} MB – größer als 1 MB '
                          '(Bild verkleinern oder in tools/pruefung-ausnahmen.txt eintragen)')
        b = open(p, 'rb').read()
        if groesse > 0:
            hashes.setdefault(hashlib.md5(b).hexdigest(), []).append(r)
        if endung in BILD:
            problem = bild_ok(b, endung[1:])
            if problem:
                fehler.append(f'{r}: Bild beschädigt ({problem})')
        if endung == '.json' or r.endswith('.webmanifest'):
            try:
                json.loads(b.decode('utf-8-sig'))
            except Exception as e:
                fehler.append(f'{r}: ungültiges JSON ({e})')
        if endung in TEXT:
            text = b.decode('utf-8', errors='replace')
            pruefe_verweise(p, text)
            for m in EINGEBETTET.finditer(text):
                try:
                    daten = base64.b64decode(m.group(2))
                except Exception:
                    fehler.append(f'{r}: eingebettetes Bild ist kein gültiges Base64')
                    continue
                problem = bild_ok(daten, m.group(1))
                if problem:
                    fehler.append(f'{r}: eingebettetes {m.group(1).upper()}-Bild beschädigt ({problem})')
                elif len(daten) > MAX_EINGEBETTET:
                    hinweise.append(f'{r}: eingebettetes Bild mit {len(daten) // 1000} KB – besser als Datei einbinden')
        if endung in ('.js', '.mjs') and not r.endswith('.min.js'):
            js.append(p)

    if shutil.which('node'):
        for p in js:
            e = subprocess.run(['node', '--check', p], capture_output=True, text=True)
            if e.returncode:
                zeile = (e.stderr.strip().splitlines() or ['?'])[0]
                fehler.append(f'{rel(p)}: JavaScript-Syntaxfehler – {zeile}')
    else:
        hinweise.append('node nicht gefunden – JavaScript-Syntax nicht geprüft')

    # Versionsstand: version.json und ecw-site-base.js müssen übereinstimmen,
    # sonst zeigen Handys eine falsche Version bzw. laden Änderungen nicht neu.
    try:
        vj = json.load(open(os.path.join(ROOT, 'version.json'), encoding='utf-8')).get('version')
        sb = re.search(r"window\.ECW_APP_VERSION = '([^']*)'", open(os.path.join(ROOT, 'ecw-site-base.js'), encoding='utf-8').read())
        if sb and vj and sb.group(1) != vj:
            fehler.append(f'Versionsstand uneinheitlich: version.json {vj}, ecw-site-base.js {sb.group(1)} '
                          '(tools/version-erhoehen.py verwenden)')
    except FileNotFoundError:
        pass

    for gruppe in hashes.values():
        if len(gruppe) > 1:
            hinweise.append('gleicher Inhalt: ' + ', '.join(sorted(gruppe)))

    for h in hinweise:
        print('HINWEIS ', h)
    for f in fehler:
        print('FEHLER  ', f)
    print(f'\n{len(fehler)} Fehler, {len(hinweise)} Hinweise.')
    return 1 if fehler else 0


if __name__ == '__main__':
    sys.exit(main())
