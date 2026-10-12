# Einladungen senden – Phasen und Ansprechpartner (Testversion)

Basis: V2.0.14 Historie Klappbereiche.

- Phase 1: Vereine mit bisherigen Teilnahmen in der gewählten Kategorie (Herren, Damen, Mixed; Alle = alle bisherigen Teilnehmer).
- Phase 2: Vereine aus dem Adressbuch, die noch nie bei EC Wegscheid teilgenommen haben. Phase 2 wird erst nach bestätigter Phase 1 freigegeben.
- Pro Verein E-Mail-Adressen einzeln auswählbar, auch mehrere gleichzeitig; vorhandene Ansprechpartner werden soweit zuordenbar angezeigt.
- Bereits als eingeladen markierte und bereits angemeldete Vereine werden in beiden Phasen ausgeschlossen.
- Bestätigung der tatsächlich versendeten Einladungen erfolgt **manuell** nach dem Versand im externen Mailprogramm. Ein EML-Download ist noch kein Versand.
- Bestätigte Empfänger werden turnierbezogen unter `einladungsPhasen.phase1/phase2` in Firestore gespeichert; bestehende Listen werden ergänzt, nicht überschrieben.
- Keine Änderung an Live-Startlisten, Historie, Einladungsdokumenten oder Turnieranmeldung.

## Test
1. ZIP entpacken, gesamten Ordner in VS Code als vertrauenswürdig öffnen, index.html mit Live Server starten.
2. Einladungen senden → Turnier auswählen → Kategorie Herren, Damen oder Mixed wählen.
3. Zwei E-Mail-Adressen desselben Vereins wählen, EML herunterladen und Entwurf kontrollieren.
4. **Nur wenn wirklich versendet**: als eingeladen markieren. Prüfen, dass der Verein anschließend nicht erneut auswählbar ist.
5. Phase 2 wählen, prüfen, ob bereits eingeladene Vereine fehlen.

Achtung: Nicht in der produktiven Umgebung als eingeladen markieren, bevor die E-Mail tatsächlich versendet wurde. Die App kann nicht erkennen, ob das Mailprogramm die E-Mail gesendet hat.
