# Ergänzung: Einladungstitel unabhängig vom Turniernamen

Basis: V2.0.14 Turnier anlegen Speicherfix TEST (vom Nutzer erfolgreich getestet).

- Zusätzliches Eingabefeld 'Titel der Einladung (nur Einladung)'.
- Fallback auf den Turniernamen, wenn das Feld leer ist.
- Speicherung mit den übrigen Vorlagenfeldern unter `einladungVorlage.einladungsTitel`.
- Geänderter Titel in Einladungsvorschau und Word-Export; PDF/PNG und Mail-PDF verwenden die Vorschau.
- Keine Änderung des Turniernamens oder der Startlisten.

JavaScript-Syntax mit Node.js geprüft; echter Firebase-Test ist lokal nicht möglich.
