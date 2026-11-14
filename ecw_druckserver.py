#!/usr/bin/env python3
"""EC Wegscheid Firestore PDF / CUPS bridge.

Safe default: --pdf-test ID only downloads and validates an existing PDF.
--once --dry-run checks waiting queue without writes or printing.
--once --print processes eligible jobs. Use only after validating Firebase rules and client.
"""
import argparse
import base64
import binascii
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, '/home/administrator')
import ecw_temperatur_sender as fb

BASE = f'https://firestore.googleapis.com/v1/projects/{fb.PROJECT}/databases/(default)/documents'
PATH = Path.home() / '.local' / 'share' / 'ecw-druckserver'
MAX_PDF = 8 * 1024 * 1024
ID_PATTERN = re.compile(r'^[a-z0-9]{8,40}$')
JOB_PATTERN = re.compile(r'^[A-Za-z0-9]{20}$')


def auth_token():
    credentials_file = fb.CREDENTIALS
    if not credentials_file.is_file() or credentials_file.stat().st_mode & 0o077:
        raise RuntimeError('Firebase-Token-Datei fehlt oder hat unsichere Dateirechte')
    credentials = json.loads(credentials_file.read_text(encoding='utf-8'))
    if credentials.get('uid') != fb.EXPECTED_UID:
        raise RuntimeError('Firebase-UID stimmt nicht')
    refresh = fb.request_json('https://securetoken.googleapis.com/v1/token?key=' + fb.API_KEY,
                              {'grant_type': 'refresh_token', 'refresh_token': credentials['refresh_token']}, form=True)
    if refresh.get('user_id') != fb.EXPECTED_UID or not refresh.get('id_token'):
        raise RuntimeError('Firebase-Token ungültig')
    if refresh.get('refresh_token') and refresh['refresh_token'] != credentials['refresh_token']:
        fb.safe_save({'uid': fb.EXPECTED_UID, 'refresh_token': refresh['refresh_token']})
    return refresh['id_token']


def rest(method, path, token, payload=None):
    data = None if payload is None else json.dumps(payload).encode('utf-8')
    url = BASE + (path if path.startswith(':') else '/' + path)
    req = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def field(v):
    if 'stringValue' in v: return v['stringValue']
    if 'integerValue' in v: return int(v['integerValue'])
    if 'doubleValue' in v: return float(v['doubleValue'])
    if 'booleanValue' in v: return v['booleanValue']
    if 'arrayValue' in v: return [field(x) for x in v['arrayValue'].get('values', [])]
    if 'mapValue' in v: return {k: field(x) for k,x in v['mapValue'].get('fields', {}).items()}
    return None


def doc(path, token):
    return rest('GET', urllib.parse.quote(path, safe='/'), token)


def metadata(token):
    d = doc('appSettings/druckdokumente', token)
    return {k: field(v) for k,v in d.get('fields', {}).items()}


def get_pdf(token, pdf_id):
    if not ID_PATTERN.fullmatch(pdf_id): raise ValueError('Ungültige PDF-ID')
    files = metadata(token).get('files', [])
    f = next((item for item in files if item.get('id') == pdf_id), None)
    if f is None: raise ValueError('PDF nicht in freigegebener Dateiliste')
    parts, size = f.get('parts'), f.get('size')
    if type(parts) is not int or not 1 <= parts <= 50: raise ValueError('Ungültige Blockanzahl')
    if type(size) is not int or not 10 <= size <= MAX_PDF: raise ValueError('Ungültige PDF-Größe')
    data = []
    for i in range(parts):
        part = doc(f'appSettings/druckpdf_{pdf_id}_{i}', token)
        block = field(part.get('fields', {}).get('data', {}))
        if not isinstance(block, str) or len(block) > 360000:
            raise ValueError(f'PDF-Block {i} fehlt oder ist ungültig')
        data.append(block)
    try:
        pdf = base64.b64decode(''.join(data), validate=True)
    except (ValueError, binascii.Error) as e:
        raise ValueError('PDF-Base64 beschädigt') from e
    if len(pdf) != size or not pdf.startswith(b'%PDF-') or b'%%EOF' not in pdf[-2048:]:
        raise ValueError('PDF ungültig oder unvollständig')
    return pdf, f


def write_pdf(pdf, filename):
    target_dir = PATH / 'downloads'
    target_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(target_dir, 0o700)
    fd, name = tempfile.mkstemp(prefix='pdf-', suffix='.pdf', dir=target_dir)
    try:
        with os.fdopen(fd, 'wb') as out:
            out.write(pdf)
        os.chmod(name, 0o600)
        return name
    except Exception:
        os.unlink(name)
        raise


def query_waiting(token):
    # The existing Firestore list rule permits only a query limited to 10 with status==wartend.
    structured = {'structuredQuery': {
        'from': [{'collectionId': 'druckauftraege'}],
        'where': {'fieldFilter': {'field': {'fieldPath': 'status'}, 'op': 'EQUAL', 'value': {'stringValue': 'wartend'}}},
        'limit': 10}}
    r = rest('POST', ':runQuery', token, structured)
    # runQuery returns a JSON array (not a JSON object).
    return [x['document'] for x in r if 'document' in x]


def commit_status(token, d, status, detail):
    name = d['name']
    old = {k: field(v) for k,v in d.get('fields', {}).items()}
    if len(detail) > 250: detail = detail[:250]
    if status == 'in_bearbeitung':
        if old.get('status') != 'wartend': raise ValueError('Auftrag nicht wartend')
    elif status in ('an_cups', 'fehler', 'unklar'):
        if old.get('status') != 'in_bearbeitung': raise ValueError('Auftrag nicht in Bearbeitung')
    else: raise ValueError('Status nicht erlaubt')
    path = name.replace(f'projects/{fb.PROJECT}/databases/(default)/documents/', '', 1)
    updated = {'status': {'stringValue': status}, 'detail': {'stringValue': detail}}
    return rest('POST', ':commit', token, {'writes': [{
        'update': {'name': name, 'fields': updated},
        'updateMask': {'fieldPaths': ['status', 'detail']},
        'currentDocument': {'updateTime': d['updateTime']}
    }]})


def process_one(token, d, printer):
    name = d['name'].rsplit('/',1)[-1]
    if not JOB_PATTERN.fullmatch(name): raise ValueError('Ungültige Auftrags-ID')
    f = {k: field(v) for k,v in d.get('fields', {}).items()}
    pdfid = f.get('pdfId')
    if not isinstance(pdfid, str) or not ID_PATTERN.fullmatch(pdfid):
        raise ValueError('Ungültige PDF-ID im Druckauftrag')
    pdf, metadata_obj = get_pdf(token, pdfid)
    print(f'PDF geprüft: {metadata_obj.get("title", pdfid)} ({len(pdf)} Bytes)')
    commit_status(token, d, 'in_bearbeitung', 'PDF validiert, Übergabe an CUPS wird vorbereitet')
    filename = None
    try:
        filename = write_pdf(pdf, name)
        # LPR/CUPS accepts PDF; -d printer optional to use CUPS default.
        cmd = ['lp'] + (['-d', printer] if printer else []) + ['-t', 'ECW-' + name, filename]
        result = subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=45)
        # Update status. If this update fails, do NOT print again: state remains in_bearbeitung.
        print('CUPS:', result.stdout.strip())
        current = doc('druckauftraege/' + name, token)
        commit_status(token, current, 'an_cups', result.stdout.strip()[:250])
    except Exception as exc:
        print('Druck/Status-Problem:', str(exc))
        # Best-effort only; never requeue automatically. Unknown state is deliberately manual.
        try:
            # Need fresh Firestore update time for precondition.
            current = doc('druckauftraege/' + name, token)
            if field(current.get('fields', {}).get('status', {})) == 'in_bearbeitung':
                commit_status(token, current, 'unklar', 'Manuelle Prüfung nötig; kein automatischer Wiederholungsdruck')
        except Exception as e:
            print('WARNUNG: Statusmeldung nicht möglich:', e)
        raise
    finally:
        if filename and os.path.isfile(filename): os.unlink(filename)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sel = p.add_mutually_exclusive_group(required=True)
    sel.add_argument('--pdf-test', metavar='PDF_ID')
    sel.add_argument('--once', action='store_true')
    p.add_argument('--dry-run', action='store_true', help='Nur Aufträge anzeigen, keine Änderungen')
    p.add_argument('--print', dest='printing', action='store_true', help='Aufträge tatsächlich drucken')
    p.add_argument('--printer', default='', help='CUPS-Druckername; leer = Standarddrucker')
    args = p.parse_args()
    if args.once and args.printing == args.dry_run: p.error('Für --once genau --dry-run oder --print setzen')
    if args.pdf_test and (args.printing or args.dry_run): p.error('--pdf-test ohne Druckoptionen verwenden')
    token = auth_token()
    if args.pdf_test:
        pdf, info = get_pdf(token, args.pdf_test)
        name = write_pdf(pdf, info.get('title', ''))
        print('ERFOLG: PDF vollständig aus Firebase geladen und geprüft')
        print('Datei:', name)
        print('Titel:', info.get('title', '(ohne Titel)'))
        print('Größe:', len(pdf), 'Bytes')
        print('Es wurde nicht gedruckt und kein Firebase-Auftrag geändert.')
        return
    jobs = query_waiting(token)
    print('Wartende Druckaufträge:', len(jobs))
    if args.dry_run:
        for d in jobs: print('Auftrag:', d['name'].rsplit('/',1)[-1])
        print('DRY RUN: Kein Druck und keine Änderung.')
        return
    for d in jobs:
        try: process_one(token, d, args.printer)
        except Exception as e: print('AUFTRAGSFEHLER:', e)


if __name__ == '__main__':
    try: main()
    except urllib.error.HTTPError as e:
        print('FIREBASE-FEHLER HTTP',e.code)
        try: print(json.load(e).get('error',{}).get('message', ''))
        except Exception: pass
        raise SystemExit(1)
    except (ValueError, RuntimeError, OSError, urllib.error.URLError) as e:
        print('FEHLER:', e)
        raise SystemExit(1)
