EC WEGSCHEID – AKTUELLER STAND
PROGRAMMVERSION 2.0.0
Stand: 08.10.2026

Dieses Paket ist der aktuelle stabile Archiv- und Wiederherstellungsstand
der EC Wegscheid Vereinsverwaltung / des Informationssystems.

WICHTIG:
Alle EC-Wegscheid-Programmversionen und sichtbaren Modulversionen wurden
auf 2.0.0 vereinheitlicht.

Technische Fremdversionen wurden absichtlich NICHT verändert, z. B.
Firebase SDK, JSZip, jsPDF, Schriftlizenzen, SVG/MIME/iCalendar-Standards.
Diese Angaben gehören zu Fremdbibliotheken bzw. Dateiformaten und dürfen
nicht als EC-Wegscheid-Programmversion umbenannt werden.

AKTUELLER HAUPTLINK:
https://ecwegscheid.github.io/Vereinsverwaltung-Aktuell/

ZENTRALES FIREBASE-PROJEKT:
ec-wegscheid-verwaltung-neu

FÜR GITHUB BENÖTIGT:
- index.html
- turnierauswertung.html
- turnierverwaltung.html
- solo-pyramide.html
- live-startlisten.html
- Hintergrund Rot ohne Logo.png
- version.json
- .nojekyll

FÜR FIREBASE:
- Firestore_Regeln_EC_Wegscheid_V2.0.0_KOMPLETT.rules

WICHTIGE FUNKTIONEN DES AKTUELLEN STANDS:
- zentrale Firebase-Anmeldung und Rechteverwaltung
- öffentlicher Whiteboard-/Informationsmodus
- Turnierplaner mit Speicherung von Spieler 1–4 und "Gemeldet von"
- Positionsfix im Turnierplaner
- eigener Whiteboard-Spielerpicker
- Cupauswertung mit Firebase-Speicherung am Whiteboard
- Jahresmeisterschaft Ziel
- Stockdart
- Turnierauslosung
- Turnierverwaltung inkl. Smartphone-Nutzung
- Live-Startlisten
- Solo Pyramide
- Mitgliederverwaltung, Sponsoren, Fotos, Nachrichten, Links,
  Turniereinladungen, eigene Turniere und Zeitungsberichte
- App-Datensicherung

UPDATE AUF GITHUB:
Die oben genannten GitHub-Dateien in das Repository
"Vereinsverwaltung-Aktuell" übernehmen. Danach die Seite am Whiteboard
vollständig neu laden.

FIRESTORE:
Die beigefügten Regeln sind Bestandteil dieses Archivstands.
Beim Wiederherstellen oder bei einer neuen Firebase-Konfiguration die
Regeln vollständig veröffentlichen.

SICHERHEIT / BACKUP:
Die in der App erzeugte Datensicherung enthält Firestore-Daten und lokale
App-Daten, aber nicht automatisch Firebase-Authentication-Passwörter,
veröffentlichte Regeln/Indizes, Hosting oder andere externe Firebase-
Bestandteile. Dieses Versionspaket deshalb immer gemeinsam mit einer
aktuellen App-Datensicherung aufbewahren.

WIEDERHERSTELLUNG:
1. Dateien dieses Pakets auf GitHub wiederherstellen.
2. Firestore-Regeln aus diesem Paket in Firebase veröffentlichen.
3. Hauptseite öffnen und Version 2.0.0 kontrollieren.
4. Whiteboard testen: Turnierplaner, Cup, Live-Startlisten, Solo Pyramide.
5. Falls Daten fehlen, die zuletzt erstellte App-Datensicherung verwenden.

HINWEIS:
Alte Migrationsfunktionen sind weiterhin im Programm enthalten.
Alte Firebase-Projekte nicht allein aufgrund dieses Pakets löschen.


MOBILZUGANG – ERWEITERUNG
=========================
Neue Datei:
- mobile-zugang.html

Zentraler Mobilzugang:
- ein QR-Code
- responsive für Smartphone und Tablet
- Firebase-Anmeldung bleibt auf dem Gerät gespeichert
- Benutzer sieht nur freigegebene Funktionen

Mobile Bereiche:
1. Turnierverwaltung
   Berechtigung: tv
   Öffnet die vorhandene Smartphone-Schnellanmeldung.

2. Vereinsnachrichten
   Berechtigung: n
   Neue Nachricht mit Überschrift, Text, Darstellung und Anzeigezeitraum.

3. Turnier / Termin anlegen
   Berechtigung: tp
   Neuer Eintrag direkt in Firestore collection tournamentPlanner.

4. Ziel Jahresmeisterschaft
   neue Berechtigung: jm
   Spieler + Wertungsblatt + Durchgang 1–4.
   Speichern erfolgt per Firestore-Transaktion, damit parallele Änderungen
   nicht unnötig überschrieben werden.

QR-CODE:
Unter "Benutzer & Rechte" wird der zentrale QR-Code angezeigt.
Dort kann auch die neue Berechtigung
"Ziel Jahresmeisterschaft – Mobil eingeben"
für Benutzer gesetzt werden.

FIRESTORE:
Die Regeln in
Firestore_Regeln_EC_Wegscheid_V2.0.0_KOMPLETT.rules
wurden erweitert. Sie müssen nach diesem Update erneut veröffentlicht werden.

WICHTIG FÜR GITHUB:
Zusätzlich zu den bisherigen Dateien muss jetzt auch
mobile-zugang.html
hochgeladen werden.
