#!/usr/bin/env python3
"""Read-only StockTV reachability monitor. Never sends a switching command."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import subprocess
import sys
import time

DEVICES = {
    '1': '192.168.178.168',
    '2': '192.168.178.196',
    '3': '192.168.178.158',
    '4': '192.168.178.71',
}


def ping(address):
    for attempt in range(2):
        try:
            result = subprocess.run(['ping', '-n', '-c', '1', '-W', '1', address],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                    timeout=4, check=False)
        except (OSError, subprocess.TimeoutExpired):
            return None
        if result.returncode == 0:
            return True
        if result.returncode != 1:
            return None
        if attempt == 0:
            time.sleep(1)
    return False


def collect():
    with ThreadPoolExecutor(max_workers=4) as pool:
        return dict(zip(DEVICES, pool.map(ping, DEVICES.values())))


def publish(states):
    # Reuse the existing authenticated Firestore connection; do not alter the
    # printing or temperature service. Only patch the two status fields.
    from ecw_druckserver import auth_token, rest, fb
    token = auth_token()
    name = f'projects/{fb.PROJECT}/databases/(default)/documents/technik/stockTvStatus'
    fields = {key: {'booleanValue': value} if value is not None else {'nullValue': None}
              for key, value in states.items()}
    rest('POST', ':commit', token, {'writes': [{
        'update': {'name': name, 'fields': {'anzeigen': {'mapValue': {'fields': fields}}}},
        'updateMask': {'fieldPaths': ['anzeigen']},
        'updateTransforms': [{'fieldPath': 'updatedAt', 'setToServerValue': 'REQUEST_TIME'}]
    }]})


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument('--dry-run', action='store_true')
    mode.add_argument('--publish', action='store_true')
    args = ap.parse_args()
    states = collect()
    for n, value in states.items():
        print(f'StockTV {n} ({DEVICES[n]}): ' + ('EIN' if value is True else 'AUS' if value is False else 'UNBEKANNT'))
    if args.publish:
        publish(states)
        print('StockTV-Status in Firebase aktualisiert')
    else:
        print('Test: keine Firebase-Änderung')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('StockTV-Überwachung fehlgeschlagen:', exc, file=sys.stderr)
        raise SystemExit(1)
