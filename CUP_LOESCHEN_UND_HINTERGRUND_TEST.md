# Cupauswertung – Lösch- und Hintergrundkorrektur (Test)

- Firebase-Speicherung: Die Map `tournaments` wird jetzt als ganzes Feld ersetzt (`mergeFields`), statt rekursiv zusammengeführt. Dadurch können entfernte Cups tatsächlich verschwinden. Andere Felder im Dokument `turnierauswertung/cup` bleiben erhalten.
- Die rot-schwarze Carbon-Bildvorlage bleibt unverändert; die darüber liegenden blaugrauen Oberflächen wurden in neutral-dunkle, leicht rot getönte und transparentere Flächen geändert.
- Test: Nur versehentlichen doppelten Test-Cup löschen, Seite neu laden und in zweitem Browserfenster prüfen.
- Test: neuen Cup erstellen, Ergebnisse speichern, neu laden, prüfen, dass alle anderen Cups erhalten bleiben.
- Wenn die Farbwirkung weiterhin abweicht, bitte einen Screenshot schicken, damit wir genau den betreffenden Bereich ändern.
- Es wurde kein Zugriff auf die produktive Firebase-Datenbank ausgeführt.
