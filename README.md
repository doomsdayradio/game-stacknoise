# Stack Noise

Interaktiver Doomsday-Radio-Empfänger für den Browser. Spielende stimmen
Frequenz, Phase, Verstärkung und Farbkanäle ab und umgehen später die
Stack-Störung über ein Patchfeld. Jede gelöste Stufe legt weitere Teile der
Übertragung frei.

## Lokal starten

```bash
python -m http.server 8000
```

Danach kann das Spiel unter <http://localhost:8000> geöffnet werden. Der
Webserver ist nötig, weil die Anwendung JavaScript-Module und lokale Daten
nachlädt.

## Bedienung und Zustand

- Die integrierte Hilfe und das Tutorial erklären die Regler stufenweise.
- Deutsch und Englisch sind über die Sprachauswahl verfügbar.
- Audio wird erst nach einer Nutzeraktion aktiviert.
- Der Spielfortschritt bleibt im lokalen Browser-Speicher erhalten und kann
	über **Reset** gelöscht werden.

## Projektstruktur

```text
index.html   Oberfläche und Dialoge
css/         Layout und Darstellung
js/          Spiellogik, Signalmodell, Audio und Übersetzungen
audio/       lokale Audioelemente
```

Die Anwendung benötigt keinen Build-Schritt und hat derzeit keine eigene
Deployment-Automation in diesem Repository.
