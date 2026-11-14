EC Wegscheid - Firebase / CUPS Druckdienst - 14.11.2026

PROJEKT: ec-wegscheid-verwaltung-neu

STUFE A: Read-only PDF-Abruf testen (NICHT drucken)
1. ecw_druckserver.py nach /home/administrator/ uebertragen.
2. Von Windows PowerShell aufrufen (OHNE PS C:\...> am Anfang):
   ssh administrator@ECWDRUCKSERVER.local "python3 /home/administrator/ecw_druckserver.py --pdf-test pmw834l5qecqkx1"
   ID anhand des Screenshots vom Mitgliedsantrag, ggf. aktuelle Firebase-ID prüfen.
3. Nach Erfolg wird eine validierte PDF-Datei unter ~/.local/share/ecw-druckserver/downloads/ gespeichert.
   Sie wird noch NICHT gedruckt. Der Speicherort soll vor Aktivierung des Dienstes geprüft werden.

STUFE B: Warteschlange read-only pruefen
   ssh administrator@ECWDRUCKSERVER.local "python3 /home/administrator/ecw_druckserver.py --once --dry-run"
   Es werden keine Aufträge erstellt oder geändert.

STUFE C: Erst nach erfolgreicher Stufe A und B, Berechtigungs-/Clienttests,
        und ausdruecklicher Freigabe produktiven Druck aktivieren.
        Dazu die zwei systemd-Dateien nach /etc/systemd/system/ kopieren,
        daemon-reload und den Timer aktivieren.

WICHTIG: Die bisherige Web-Oberflaeche js/dokumente-drucken.js erzeugt aktuell
Browser-Druckdialoge und noch KEINE Auftraege in /druckauftraege.
Die Whiteboard-Schaltflaeche ist daher noch nicht an diese Warteschlange angeschlossen.
Dafuer muss eine zusaetzliche, kontrollierte Client-Implementierung erfolgen.

Die Firestore-Regeln lassen Create fuer die Informationssystem-UID nur zu,
wenn die ID genau 20 alphanumerische Zeichen, pdfId 8-40 Kleinbuchstaben/Ziffern,
status='wartend' und erstellt=request.time ist.

Sicherheitsprinzip: Bei unklarem CUPS-Status kein automatischer Neudruck.
Weder Service noch Timer werden durch das Testpaket automatisch installiert.
