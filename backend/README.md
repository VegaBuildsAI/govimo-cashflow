# Govimo Cashflow Backend

Núcleo de reglas (`govimo_cashflow`, stdlib pura) + persistencia y API de Fase 1.

- `govimo_cashflow/`: ingesta CSV canónica, FX, forecast semanal, alertas de cobertura.
- `db/`: `schema.sql` (transactions canónica, fx_rates histórica, accounts, currency_settings) y `repo.py` (psycopg).
- `api/main.py`: FastAPI — `POST /ingest/file`, `GET /positions`, `GET /transactions`, `GET /fx`, `GET /health`.
- `fixtures/` + `scripts/seed.py`: datos demo cargados por el mismo pipeline de ingesta.

## Correr (desde la raíz del repo, PowerShell)

```powershell
# Postgres dedicado (una vez)
docker run -d --name govimo-postgres -p 127.0.0.1:5434:5432 `
  -e POSTGRES_USER=govimo -e POSTGRES_PASSWORD=govimo_dev_2026 -e POSTGRES_DB=govimo `
  --restart unless-stopped postgres:16

$env:PYTHONPATH = 'backend'
python backend/scripts/seed.py                      # schema + fixtures
python -m uvicorn api.main:app --port 8000 --app-dir backend
python -m unittest discover backend/tests -v       # 13 tests; los de DB se saltan si no está arriba
```

Conexión configurable con `GOVIMO_DB_URL` (default `postgresql://govimo:...@127.0.0.1:5434/govimo`).
La app informa y alerta; **nunca mueve dinero** — la API solo lee y registra información.
