-- Schema canónico Govimo Cashflow — Fase 1 (ver 2 - Arquitectura Técnica §4-5)

CREATE TABLE IF NOT EXISTS fx_rates (
    fecha       date    NOT NULL,
    moneda      text    NOT NULL CHECK (moneda IN ('CNY', 'USD', 'MXN', 'CRC')),
    tasa_a_usd  numeric(18, 8) NOT NULL CHECK (tasa_a_usd > 0),
    fuente      text    NOT NULL DEFAULT 'manual',
    PRIMARY KEY (fecha, moneda)
);

CREATE TABLE IF NOT EXISTS accounts (
    id              text    PRIMARY KEY,
    banco           text    NOT NULL,
    alias           text    NOT NULL,
    moneda          text    NOT NULL CHECK (moneda IN ('CNY', 'USD', 'MXN', 'CRC')),
    saldo_inicial   numeric(18, 2) NOT NULL,
    fecha_corte     date    NOT NULL
);

-- Mínimo operativo por moneda (lo configura Felipe; umbral para alertas de faltante)
CREATE TABLE IF NOT EXISTS currency_settings (
    moneda            text PRIMARY KEY CHECK (moneda IN ('CNY', 'USD', 'MXN', 'CRC')),
    minimo_operativo  numeric(18, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
    id              text    PRIMARY KEY,
    fuente          text    NOT NULL CHECK (fuente IN ('NetSuite', 'Banco', 'SINPE', 'WhatsApp', 'Archivo')),
    tipo            text    NOT NULL CHECK (tipo IN ('pago', 'cobro', 'entrada')),
    estado          text    NOT NULL CHECK (estado IN ('esperado', 'programado', 'confirmado', 'conciliado', 'provisional')),
    monto           numeric(18, 2) NOT NULL CHECK (monto >= 0),
    moneda          text    NOT NULL CHECK (moneda IN ('CNY', 'USD', 'MXN', 'CRC')),
    fx_tasa         numeric(18, 8),
    fx_fecha        date,
    monto_base      numeric(18, 2),
    fecha_esperada  date    NOT NULL,
    fecha_real      date,
    contraparte     text    NOT NULL,
    categoria       text    NOT NULL,
    raw_ref         text,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    actualizado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_moneda_fecha ON transactions (moneda, fecha_esperada);
CREATE INDEX IF NOT EXISTS idx_transactions_estado ON transactions (estado);

-- ── Capa de aprendizaje (Fase 4) — predicción vs. realidad, base del ROI ────────
-- Cierra el loop: cada corrida del motor guarda lo que predijo; al conciliarse el
-- movimiento se mide el error; las métricas agregadas prueban si un modelo supera
-- a la línea base de reglas. La línea base siempre existe: las reglas asumen pago
-- en fecha_esperada, así que su error = fecha_real − fecha_esperada (ya en
-- transactions). Ver "2 - Arquitectura Técnica" §6 (Motor de inteligencia).

-- Una corrida del motor: el estado del mundo (fecha_corte) y qué modelo predijo.
CREATE TABLE IF NOT EXISTS forecast_runs (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    modelo          text NOT NULL CHECK (modelo IN ('reglas', 'estadistica', 'ml')),
    fecha_corte     date NOT NULL,
    horizonte_sem   int  NOT NULL CHECK (horizonte_sem > 0),
    notas           text,
    creado_en       timestamptz NOT NULL DEFAULT now()
);

-- Lo que el modelo creyó que pasaría con cada movimiento (fecha y monto probables).
-- transaction_id es nullable: el modelo puede predecir algo aún no registrado.
CREATE TABLE IF NOT EXISTS forecast_predictions (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id          bigint NOT NULL REFERENCES forecast_runs(id) ON DELETE CASCADE,
    transaction_id  text REFERENCES transactions(id) ON DELETE SET NULL,
    moneda          text NOT NULL CHECK (moneda IN ('CNY', 'USD', 'MXN', 'CRC')),
    pred_fecha      date NOT NULL,
    pred_monto      numeric(18, 2) NOT NULL CHECK (pred_monto >= 0),
    pred_monto_base numeric(18, 2),
    contraparte     text,
    categoria       text,
    creado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pred_run ON forecast_predictions (run_id);
CREATE INDEX IF NOT EXISTS idx_pred_tx ON forecast_predictions (transaction_id);

-- La realidad, una vez conciliado el movimiento: el error medido por predicción.
-- error_dias = fecha_real − pred_fecha (+ = pagó más tarde de lo predicho).
CREATE TABLE IF NOT EXISTS prediction_outcomes (
    prediction_id    bigint PRIMARY KEY REFERENCES forecast_predictions(id) ON DELETE CASCADE,
    fecha_real       date NOT NULL,
    monto_real       numeric(18, 2) NOT NULL CHECK (monto_real >= 0),
    error_dias       int NOT NULL,
    error_monto      numeric(18, 2) NOT NULL,
    error_monto_base numeric(18, 2),
    medido_en        timestamptz NOT NULL DEFAULT now()
);

-- Error agregado por modelo y periodo, contra la línea base de reglas.
-- supera_baseline = el modelo solo "gana" si su MAE en días < el de las reglas.
CREATE TABLE IF NOT EXISTS model_metrics (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    modelo            text NOT NULL CHECK (modelo IN ('reglas', 'estadistica', 'ml')),
    periodo_desde     date NOT NULL,
    periodo_hasta     date NOT NULL,
    n_predicciones    int  NOT NULL CHECK (n_predicciones >= 0),
    mae_dias          numeric(10, 2),
    sesgo_dias        numeric(10, 2),
    mae_monto_base    numeric(18, 2),
    baseline_mae_dias numeric(10, 2),
    supera_baseline   boolean,
    creado_en         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metrics_modelo_periodo ON model_metrics (modelo, periodo_desde);

-- ── Memoria vectorial (Fase 4 · Nivel 3) — pgvector ─────────────────────────────
-- Cada movimiento se proyecta a un embedding determinístico de rasgos
-- (contraparte, categoría, moneda, escala de monto, calendario, tipo). El modelo
-- 'ml' predice por vecinos más cercanos: el retraso probable de un pendiente =
-- mediana del retraso real de los k conciliados más parecidos (db/vector.py).
-- Requiere la imagen pgvector/pgvector:pg16 en el contenedor govimo-postgres.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS movement_embeddings (
    transaction_id  text PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
    embedding       public.vector(16) NOT NULL,
    actualizado_en  timestamptz NOT NULL DEFAULT now()
);
