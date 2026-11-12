#!/usr/bin/env python3
"""Prepare the seven new EC Wegscheid member accounts on Firebase Spark."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

PROJECT = "ec-wegscheid-verwaltung-neu"
AUTH = f"https://identitytoolkit.googleapis.com/v1/projects/{PROJECT}"
DOCS = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
LEGACY_DOC = "https://firestore.googleapis.com/v1/projects/reservierungssystem-wegscheid/databases/(default)/documents/appData/members"
DIRECTORY = f"{DOCS}/smartphoneAnmeldung/mitglieder"
DOMAIN = "login.ec-wegscheid.de"
PLAYERS = (
    "Breitenfellner Lisa", "Eberhardt Toni", "Hogger Diana", "Hogger Matthias",
    "Neussl Josef", "Stögmüller Gerhard", "Weiss Wolfgang",
)


def key(name):
    return " ".join(name.split()).casefold()


def alias_for(name):
    return hashlib.sha256(("ecw-mobile-v1:" + key(name)).encode()).hexdigest()[:32]


def request(url, headers, payload=None, method=None):
    data = None if payload is None else json.dumps(payload).encode()
    try:
        with urlopen(Request(url, data, headers, method=method), timeout=30) as response:
            return json.load(response)
    except HTTPError as error:
        try:
            message = json.load(error).get("error", {})
            reason = next((d.get("reason") for d in message.get("details", []) if d.get("reason")), None)
        except (ValueError, AttributeError):
            reason = None
        raise RuntimeError(f"HTTP {error.code}" + (f" ({reason})" if reason else "")) from None
    except URLError:
        raise RuntimeError("Netzwerkfehler. Bitte den Vorgang prüfen und erneut starten.") from None


def firestore_array(document, field):
    return document["fields"][field]["arrayValue"].get("values", [])


def directory_entries(document):
    entries = {}
    aliases = set()
    for value in firestore_array(document, "members"):
        entry = value["mapValue"]["fields"]
        name = entry["name"]["stringValue"]
        alias = entry["alias"]["stringValue"]
        if not key(name) or not re.fullmatch("[a-f0-9]{32}", alias) or key(name) in entries or alias in aliases:
            raise RuntimeError("Das Anmeldeverzeichnis enthält ungültige oder doppelte Einträge.")
        entries[key(name)] = alias
        aliases.add(alias)
    return entries


def private_file():
    prefix = Path.home() / ("ecw-aktivierungslinks-" + secrets.token_hex(6) + ".txt")
    descriptor = os.open(prefix, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    return prefix, os.fdopen(descriptor, "w", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--anlegen", action="store_true", help="Konten und Aktivierungslinks erstellen")
    args = parser.parse_args()
    token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Goog-User-Project": PROJECT,
        "Content-Type": "application/json",
    }
    roster = request(f"{DOCS}/appSettings/playerList", headers)
    player_keys = [key(row["stringValue"]) for row in firestore_array(roster, "players")]
    legacy = request(LEGACY_DOC, headers)
    legacy_keys = {
        key(row["mapValue"]["fields"]["name"]["stringValue"])
        for row in firestore_array(legacy, "list")
    }
    directory = request(DIRECTORY, headers)
    existing = directory_entries(directory)
    if any(player_keys.count(key(name)) != 1 or key(name) in legacy_keys for name in PLAYERS):
        raise RuntimeError("Spielerliste oder Altbestand weichen ab. Keine Konten geändert.")
    pending = [name for name in PLAYERS if key(name) not in existing]
    if any(alias_for(name) in existing.values() for name in pending):
        raise RuntimeError("Technische Kennung ist bereits im Verzeichnis vergeben.")
    print(f"Zentrale Spielerliste: {len(player_keys)}")
    print(f"Bereits im Anmeldeverzeichnis: {len(PLAYERS) - len(pending)}")
    print(f"Neu anzulegen: {len(pending)}")
    if not args.anlegen or not pending:
        return

    path, output = private_file()
    print(f"Private Aktivierungsdatei: {path}", flush=True)
    values = list(firestore_array(directory, "members"))
    with output:
        for name in pending:
            alias = alias_for(name)
            uid = "ecw-mobile-" + alias
            address = f"{alias}@{DOMAIN}"
            result = request(f"{AUTH}/accounts:lookup", headers, {"localId": [uid]})
            accounts = result.get("users", [])
            if not accounts:
                account = request(f"{AUTH}/accounts", headers, {
                    "localId": uid, "email": address, "displayName": name,
                    "password": "Aa1!" + secrets.token_urlsafe(32),
                })
                if account.get("localId") != uid:
                    raise RuntimeError("Die Konto-ID wurde nicht bestätigt.")
            elif len(accounts) != 1 or any(
                accounts[0].get(field) != expected
                for field, expected in (("localId", uid), ("email", address), ("displayName", name))
            ) or accounts[0].get("disabled"):
                raise RuntimeError("Vorhandenes Konto stimmt nicht mit der vorgesehenen Zuordnung überein.")
            result = request(f"{AUTH}/accounts:sendOobCode", headers, {
                "requestType": "PASSWORD_RESET", "email": address, "returnOobLink": True,
            })
            link = result.get("oobLink", "")
            parsed = urlparse(link)
            if parsed.scheme != "https" or not parsed.netloc:
                raise RuntimeError("Firebase hat keinen gültigen Aktivierungslink zurückgegeben.")
            output.write(f"{name}\t{link}\n")
            output.flush()
            os.fsync(output.fileno())
            values.append({"mapValue": {"fields": {
                "name": {"stringValue": name}, "alias": {"stringValue": alias},
            }}})

    latest_roster = request(f"{DOCS}/appSettings/playerList", headers)
    if latest_roster["updateTime"] != roster["updateTime"]:
        raise RuntimeError("Die Spielerliste wurde geändert. Das Anmeldeverzeichnis wurde nicht aktualisiert.")
    query = urlencode({
        "updateMask.fieldPaths": "members",
        "currentDocument.updateTime": directory["updateTime"],
    })
    updated = request(f"{DIRECTORY}?{query}", headers, {
        "fields": {"members": {"arrayValue": {"values": values}}},
    }, method="PATCH")
    final = directory_entries(updated)
    if any(final.get(key(name)) != alias_for(name) for name in pending):
        raise RuntimeError("Die veröffentlichten Zuordnungen konnten nicht verifiziert werden.")
    print(f"Eingerichtet und im Test-Dropdown eingetragen: {len(pending)}")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, KeyError, subprocess.CalledProcessError) as error:
        sys.exit(f"Abbruch: {error}")
