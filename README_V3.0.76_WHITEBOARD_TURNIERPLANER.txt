EC WEGSCHEID – VEREINSVERWALTUNG V3.0.76
WHITEBOARD – TERMIN-/TURNIERPLANER FIREBASE-FIX

FEHLER
Die Cupauswertung konnte am öffentlichen Whiteboard bereits in Firebase
speichern. Im Termin-/Turnierplaner wurden Änderungen bei
- Gemeldet von
- Spieler 1 bis 4
nicht zentral gespeichert.

URSACHE
Der öffentliche Whiteboardmodus läuft ohne sichtbare Firebase-Anmeldung.
Die bisherigen Firestore-Regeln erlaubten Änderungen im Turnierplaner aber
nur einem authentifizierten Benutzer mit Berechtigung "tp".

KORREKTUR
- Öffentliche Lesezugriffe bleiben erlaubt.
- Das öffentliche Whiteboard darf an BESTEHENDEN Turnierplaner-Terminen
  ausschließlich folgende Felder ändern:
  players
  reportedBy
  updatedAt
- Titel, Datum, Uhrzeit, Ort, Veranstaltungsart und alle anderen Daten
  bleiben für das öffentliche Whiteboard gesperrt.
- Neue Termine anlegen und Termine löschen bleibt ebenfalls gesperrt.
- "Turnierliste aktualisieren" funktioniert jetzt auch im öffentlichen
  Whiteboardmodus ohne Firebase-Login.
- Beim Speichern steht sichtbar:
  "Whiteboard: Änderung wird in Firebase gespeichert ..."
  und anschließend entweder Erfolg oder die konkrete Fehlermeldung.

WICHTIG
Für diese Korrektur müssen die beigefügten Firestore-Regeln V3.0.76
in Firebase veröffentlicht werden. Nur index.html auszutauschen reicht nicht.

UPDATE
1. index.html auf GitHub ersetzen
2. version.json ersetzen
3. Firestore_Regeln_EC_Wegscheid_V3.0.76_KOMPLETT.rules vollständig
   in Firebase veröffentlichen
