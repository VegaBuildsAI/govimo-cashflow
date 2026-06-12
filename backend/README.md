# Govimo Cashflow Backend

Nucleo inicial de reglas para Fase 1-3, sin dependencias externas todavia.

- `govimo_cashflow.ingest`: carga CSV canonica para exportes de NetSuite, banco/SINPE, WhatsApp y archivos.
- `govimo_cashflow.money`: conversion y consolidacion multimoneda.
- `govimo_cashflow.forecast`: forecast semanal y deteccion de faltantes por moneda.
- `govimo_cashflow.alerts`: verificacion de efectivo para pagos importantes.

La capa FastAPI/PostgreSQL debe montarse encima de este nucleo cuando existan archivos reales, credenciales o un schema aprobado.
