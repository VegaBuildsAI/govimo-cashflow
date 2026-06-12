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
