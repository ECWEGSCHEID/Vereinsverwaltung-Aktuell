EC WEGSCHEID – VEREINSVERWALTUNG V3.0.74
TURNIERAUSWERTUNG V2.4.14 – FIRESTORE NESTED-ARRAY FIX

FEHLER AUS SCREENSHOT
DocumentReference.set() called with invalid data.
Nested arrays are not supported
(found in document turnierauswertung/jahresmeisterschaft)

URSACHE
Die alten Daten der Jahresmeisterschaft enthalten verschachtelte Arrays
(Arrays direkt innerhalb anderer Arrays). Firebase Realtime Database kann
diese Struktur speichern, Cloud Firestore erlaubt sie jedoch nicht.

KORREKTUR
- Verschachtelte Arrays werden vor dem Speichern automatisch und verlustfrei
  in Firestore-kompatible Marker-Objekte umgewandelt.
- Beim Laden werden diese Marker automatisch wieder in die ursprünglichen
  Arrays zurückverwandelt.
- Für die Jahresmeisterschaft sieht das Programm daher weiterhin exakt die
  bisherige Datenstruktur.
- Die gleiche Technik gilt vorsorglich auch für StockDart und Auslosungsdaten.
- Die bereits behobene Cross-Frame-"custom Object object"-Problematik bleibt
  ebenfalls berücksichtigt.

WICHTIG
Die bereits erfolgreich übertragenen Cupdaten können beim erneuten Start der
Migration einfach nochmals überschrieben/aktualisiert werden. Es ist keine
manuelle Bereinigung nötig.

UPDATE
Bitte ersetzen:
- index.html
- turnierauswertung.html
- version.json

Die Firestore-Regeln wurden funktional nicht verändert.
