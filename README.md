# Historisk sparsimulator

En statisk presentationsapplikation som jämför fyra ekonomiska beslut mot samma historiska månadsavkastning för SIX Portfolio Return Index (SIXPRX).

## Köra lokalt

Dubbelklicka på `index.html` för att köra programmet direkt från datorn. Ingen installation, terminal, internetanslutning eller lokal server behövs.

Det fungerar även från vanlig statisk webbhosting. För lokal HTTP-testning kan den medföljande servern startas med:

```text
node scripts/serve.js
```

Öppna sedan `http://127.0.0.1:4173` i en aktuell version av Chrome eller Edge. Applikationen gör inga nätverksanrop för historiska data.

## Tester

```text
node --test --test-isolation=none
```

Testerna täcker beräkningsordning, avgifter, skatt, bidragsneutral tidsvägd avkastning, periodurval, analys, uppspelning samt grafens synliga domäner.

## Historiska data

`data/sixprx_monthly_2006-10_2026-09.csv` är den auktoritativa datakällan och innehåller 240 oförändrade månadsavkastningar från oktober 2006 till september 2026.

`data/sixprx.js` genereras från CSV-filen och används av webbläsaren så att programmet även fungerar via `file://`. Testsviten verifierar att båda datakällorna är exakt identiska. `js/app.bundle.js` genereras från de modulära källfilerna i `js/`; beräkningslogiken underhålls alltså endast på ett ställe.
