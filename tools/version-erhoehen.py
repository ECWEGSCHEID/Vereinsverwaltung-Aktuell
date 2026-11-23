#!/usr/bin/env python3
"""Neue Version der Vereinsverwaltung setzen.

Aktualisiert an allen Stellen denselben Versionsstand, damit Handys und
Browser die neue Version erkennen und neu laden:
  - version.json (Update-Check der Smartphone-Seiten)
  - ecw-site-base.js (angezeigte Version)
  - index.html (Versionsanzeige und Cache-Parameter)
  - alle Einbindungen von ecw-site-base.js?v=...

Aufruf:  python3 tools/version-erhoehen.py 3.1.57.241126 "Kurzbeschreibung der Änderung"
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PATTERN = re.compile(r'^\d+\.\d+\.\d+\.\d{6}$')


def main():
    if len(sys.argv) < 3 or not PATTERN.match(sys.argv[1]):
        sys.exit('Aufruf: version-erhoehen.py X.Y.Z.TTMMJJ "Beschreibung"')
    new, release = sys.argv[1], sys.argv[2]
    path = os.path.join(ROOT, 'version.json')
    data = json.load(open(path, encoding='utf-8'))
    old = data['version']
    data.update(version=new, release=release)
    open(path, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False) + '\n')

    base = os.path.join(ROOT, 'ecw-site-base.js')
    text = open(base, encoding='utf-8').read()
    text = re.sub(r"window\.ECW_APP_VERSION = '[^']*';", f"window.ECW_APP_VERSION = '{new}';", text, count=1)
    open(base, 'w', encoding='utf-8').write(text)

    changed = []
    for d, ds, fs in os.walk(ROOT):
        ds[:] = [x for x in ds if x != '.git']
        for f in fs:
            if not f.endswith('.html'):
                continue
            p = os.path.join(d, f)
            t = open(p, encoding='utf-8').read()
            n = re.sub(r'ecw-site-base\.js\?v=[^"\']+', 'ecw-site-base.js?v=' + new, t)
            if f == 'index.html' and os.path.dirname(p) == ROOT:
                n = n.replace(old, new)
            if n != t:
                open(p, 'w', encoding='utf-8').write(n)
                changed.append(os.path.relpath(p, ROOT))
    print(f'Version {old} -> {new}')
    print('Geändert: version.json, ecw-site-base.js, ' + ', '.join(sorted(changed)))


if __name__ == '__main__':
    main()
