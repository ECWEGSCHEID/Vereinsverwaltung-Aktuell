EC WEGSCHEID – VEREINSVERWALTUNG V3.0.75
TURNIERAUSWERTUNG V2.4.15 – WHITEBOARD FIREBASE-SPEICHERUNG

KORREKTUREN

1. Cupauswertung am Whiteboard
- Beim Speichern eines Ergebnisses wird jetzt unten am Bildschirm sichtbar:
  "Firebase: Speicherung läuft ..."
- Erst nach bestätigtem Firestore-Schreibvorgang erscheint:
  "Firebase: erfolgreich gespeichert"
- Bei einem Fehler wird die konkrete Firebase-Fehlermeldung sichtbar angezeigt.
- Mehrere schnelle Eingaben werden nacheinander gespeichert und können sich
  nicht gegenseitig überholen.

2. Whiteboard-Kennzeichnung
- Öffentliche Whiteboard-Speicherungen werden mit updatedBy="whiteboard-public"
  gekennzeichnet.

3. iframe / Meldungen
- Die dynamische Sandbox der eingebetteten internen Apps enthält jetzt
  ebenfalls allow-modals. Fehler-/Hinweismeldungen werden nicht mehr vom
  Browser unterdrückt.

4. FIRESTORE-REGELN – WICHTIG
- Das öffentliche Whiteboard besitzt absichtlich keine sichtbare Anmeldung.
- Deshalb wurde die Regel für /turnierauswertung/cup ausdrücklich so gefasst,
  dass NUR tournaments, updatedAt und updatedBy öffentlich geschrieben werden
  dürfen.
- Das Cup-Dokument darf damit auch neu angelegt werden, falls es versehentlich
  fehlt.
- Jahresmeisterschaft, StockDart und andere interne Dokumente bleiben beim
  Schreiben weiterhin Admin-only.

INSTALLATION
Für diesen Fix bitte:
1. index.html ersetzen
2. turnierauswertung.html ersetzen
3. version.json ersetzen
4. DIE BEIGEFÜGTEN FIRESTORE-REGELN V3.0.75 VERÖFFENTLICHEN

Ohne Schritt 4 kann die Speicherung am öffentlichen Whiteboard weiterhin
mit "Missing or insufficient permissions" scheitern.
