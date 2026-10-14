# EC Wegscheid – V2.5.1 Sicherheitsüberarbeitung (Testversion)

Basis: funktionierende V2.5.0. Kein Eingriff in Firebase-Livedaten oder Benutzerkonten.

## Tatsächlich durchgeführte Änderungen
- Solo-Pyramide: fest codierte Admin-/Infosystem-Standardpasswörter `081500` entfernt; vorhandene Werte in Altdaten werden nicht automatisch gelöscht oder geändert.
- Solo-Pyramide: privilegierte Admin-/Infosystem-Sitzungen werden nicht mehr aus `localStorage` wiederhergestellt. Spieler-Sitzung nur im aktuellen Browser-Tab (`sessionStorage`), mit Namensprüfung.
- Solo-Pyramide: kein Login mit leerem Spielerpasswort mehr. Bestehende Spielerpasswörter bleiben erhalten.
- Solo-Pyramide: vorhandene Spielerpasswörter werden nicht mehr im Admin-Menü angezeigt. Admin-/Info-Passwörter werden nicht mehr in HTML-Eingabefelder zurückgeschrieben.
- Solo-Pyramide: auf GitHub veröffentlichte Seite erlaubt keine separate Solo-Admin-Passwort-Anmeldung; Adminzugang erfolgt über die zentrale Vereinsverwaltung.
- Mitgliederverwaltung: beim Zurücksetzen kein fest vorgeschlagenes Standardpasswort `081500` mehr.
- Alle Versionskennzeichen in HTML, JS und CSS von 2.5.0 auf 2.5.1 angehoben.

## Wichtige weiterhin OFFENE Sicherheitsprobleme
- **Die Solo-Pyramide speichert Spielerpasswörter weiterhin im Klartext in einem öffentlich lesbaren Firestore-Dokument.** Nur das Verstecken der Anzeige behebt das NICHT.
- Die vorhandenen Firestore-Regeln lassen im Solo-Pyramide-Spielbetrieb bestimmte öffentliche Schreibvorgänge zu. Clientseitige Passwortprüfung ist keine sichere Autorisierung.
- `?mode=whiteboard` ist über die öffentliche URL aufrufbar. Dieser Modus ist kein Berechtigungsnachweis.
- Die Mitgliederverwaltung enthält eigene Kennwortdaten. Für sichere zentrale Rechteprüfung ist eine spätere Migration nötig.
- Die übrigen Firebase-Regeln, einschließlich Reservierungssystem, sind nicht live geprüft.

**Daher ist V2.5.1 eine Teilhärtung und KEINE abschließende DSGVO-/Sicherheitsfreigabe.** Für vollständigen Schutz sind serverseitige Regeln und eine sichere Authentifizierung pro Spieler notwendig. Die nötige Umstellung würde die bisherige Spieler- und Whiteboard-Anmeldung verändern und ist deshalb nicht stillschweigend vorgenommen worden.

## Test nach Veröffentlichung
1. Hauptprogramm / Whiteboard / Interne Cups / Navigation wie V2.5.0 prüfen.
2. Solo-Pyramide als Whiteboard, Spieler und zentraler Administrator testen.
3. Spielerpasswortänderung und Spielstände prüfen; nach Browser-Neustart neu anmelden.
4. Im Admin-Menü kontrollieren, dass Kennwörter nicht angezeigt werden.
5. Bei Problemen V2.5.0 zurückspielen; keine Datenbankwiederherstellung durchführen.

## Datenschutz
Dieses ZIP enthält nur die öffentliche Website. Keine privaten Datenbanksicherungen oder Benutzerexporte auf GitHub veröffentlichen.
