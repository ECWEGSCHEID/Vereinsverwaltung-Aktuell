# Test: Einladungen senden – Gmail und Alle abwählen

1. Entpacken, gesamten Ordner in VS Code öffnen und index.html mit Live Server starten.
2. Turnierverwaltung → Einladungen senden, Turnier wählen, Phase und Kategorie wählen.
3. Mehrere E-Mail-Adressen auswählen, „Alle abwählen“ anklicken: Alle Häkchen müssen verschwinden, auch wenn ein Suchfilter aktiv ist.
4. Einzelne Adressen erneut auswählen. „Mit Gmail vorbereiten“ anklicken. PDF wird heruntergeladen. Danach im Status auf „Gmail-Entwurf öffnen“ klicken.
5. In Gmail BCC, Betreff, Nachricht prüfen und PDF aus Downloads manuell anhängen. Nichts wird automatisch versendet.
6. „EML für Outlook/Thunderbird“ ist für Desktop-Mailprogramme; Gmail importiert keine EML-Datei als Entwurf.

Es wurden nur Oberfläche und E-Mail-Vorbereitung in turnierverwaltung.html geändert. Keine Änderungen an Firebase-Regeln, Live-Startlisten oder Einladungsdokumenten.
