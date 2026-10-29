# Drihanna Panel

Dashboard für den Kunden Drihanna (drihanna.de), betreut über adsupply.

- **Live:** https://drihanna.adsupply.de
- **Deploy:** Cloudflare Pages, verbunden mit diesem Repo. Jeder Push auf `main` geht automatisch live.
- **Build:** keiner. Statische Einzeldatei, Output-Verzeichnis `/`.

## Inhalt

`index.html` ist eine in sich geschlossene Seite: Styles, Skript und alle Daten stecken in der Datei.
Die Zahlen sind als Stand eingetragen, nicht live abgefragt — sie werden bei jeder
Aktualisierung aus dem Meta-Werbekonto und dem Shopify-Store neu gezogen.

Stand der Zahlen: 29.10.2026.

## Ändern

Die Seite wird im Claude-Chat des Accounts gepflegt und von dort gepusht.
Wer von Hand ändert: die Datenblöcke stehen unten im `<script>` (`MONTHS`, `SHOP`, `TOP`, `STAGES`, `BUDGET`, `TASKS`).
