# Historisk sparsimulator

En statisk presentationsapplikation som jämför fem portföljer och isolerar tre ekonomiska beslut mot samma historiska månadsavkastning för SIX Portfolio Return Index (SIXPRX).

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

`data/kpi_monthly_2006-10_2026-08.csv` är den auktoritativa inflationskällan med 239 månatliga KPI-observationer från SCB (KPI totalt, 2020=100). September 2026 saknar ännu en officiell observation och använder därför uttryckligen den senast tillgängliga observationen, augusti 2026, utan uppskattning eller en fabricerad datarad.

`data/sixprx.js` och `data/kpi.js` genereras från respektive CSV-fil och används av webbläsaren så att programmet även fungerar via `file://`. Testsviten verifierar att runtime-data och auktoritativa CSV-källor är exakt identiska. `js/app.bundle.js` genereras från de modulära källfilerna i `js/`; beräkningslogiken underhålls alltså endast på ett ställe.
