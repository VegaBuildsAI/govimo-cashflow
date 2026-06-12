# CORTEX.md — Memoria vectorial + cerebro predictivo (Claude Fable 5)

Companion de `CLAUDE.md`. **Mismas reglas de trabajo, tokens y memoria — no las repito; rigen aquí igual.** Este brief cubre solo la pieza que aprende y predice.

## 1. Objetivo
Dejar una solución que **aprende y predice** el flujo de caja a partir de datos y matemáticas, con **Claude como interacción final del usuario** (chat IA). Tres piezas:
1. **Cortex** — base de datos vectorial: memoria semántica del negocio + casos históricos.
2. **Motor predictivo** — forecast multimoneda, validado con backtesting walk-forward.
3. **`govimo-cortex-mcp`** — servidor MCP que expone (1) y (2) como herramientas que Claude consume.

## 2. Reutiliza lo que ya corre (inspecciónalo, no reinventes)
- **AXIO Cortex** (vivo): lee su repo/servicio. Copia su esquema de vector store, modelo de embeddings, chunking, convenciones de colección y storage. Backbone probable: **Postgres + pgvector** (mismo stack que repo-actas: pgvector · MinIO · Redis) — **confírmalo en el código, no asumas**.
- **freecad-mcp** (vivo): lee su código. Replica su patrón de **servidor MCP** (registro de tools, schema de input, config, transporte) para envolver Cortex + el motor predictivo en un MCP nuevo.
- Regla: mismos patrones, nombres y stack que AXIO ya opera. La novedad es el dominio (flujo de caja), no la plataforma.

## 3. Qué guarda la memoria vectorial (naturaleza del proyecto)
Flujo de caja multimoneda y predictivo. Embeber/indexar:
- **Eventos de caja** normalizados (pago/cobro/entrada) con metadatos: moneda, contraparte, fecha esperada/real, estado, categoría → recuperación de **periodos similares** para forecast por analogía.
- **Comportamiento por contraparte** (quién paga tarde y cuánto) y **estacionalidad por moneda** (Yuan/USD/MXN/CRC).
- **Conocimiento del proyecto** (los 3 docx, lógica del "flujo de Federico", SOPs) → RAG para que Claude responda el "por qué".
- **Corridas de backtest, versiones de modelo, predicción vs real y lecciones** → el sistema aprende de sus propios errores.
- **Metadata-first**: filtra por moneda/fecha/estado *antes* del vector search. Una colección por tipo, namespaces claros.

## 4. Motor predictivo + backtesting — teoría en `./Informe_Backtesting_Oro_v1_6.docx`
Lee ese informe (por tramos) y **traduce su metodología del trading al flujo de caja**:
- **Walk-forward, no un solo corte.** Entrena en el pasado, predice el tramo siguiente no visto, desliza la ventana; evalúa en muchos periodos (regímenes distintos: meses fuertes/débiles, varias monedas), no en uno.
- **In-sample vs out-of-sample**: la precisión que vale es la **OOS**.
- **Enemigo #1 = overfitting.** Toda la validación existe para detectarlo y evitarlo.
- **Edge real = ganarle a un baseline ingenuo** ("próxima semana = esta semana", o el forecast por reglas de la Fase 2) de forma **consistente entre ventanas**, no en una con suerte.
- **Métricas (analogía informe → caja):**
  - *% ventanas ganadoras* → % de periodos donde el modelo bate al baseline. Consistencia = lo más importante.
  - *Sharpe / estabilidad* → **estabilidad del error** entre ventanas (positiva y pareja, no errática).
  - *Error de pronóstico*: MAE / MAPE sobre la posición de caja; sesgo (¿sobre/subestima?).
  - *Hit-rate de alertas*: % de faltantes reales anticipados; falsos positivos/negativos.
  - *Tamaño de muestra*: suficientes periodos para fiarse estadísticamente.
  - *Drawdown* → peor error / peor faltante no detectado.
- **Datos honestos**: histórico largo que cubra varios regímenes; fuente verificada; cross-check de cifras (como el informe verifica el oro contra precios conocidos).
- **Mismo ganador en dos horizontes = señal real**: si un modelo gana en semanal y en mensual, es edge, no azar.
- Guarda cada corrida (params, ventana, métricas, veredicto) en Cortex → trazable y reentrenable.

## 5. Claude como interfaz final
El usuario habla con **Claude**; Claude usa `govimo-cortex-mcp` para: consultar memoria, recuperar periodos similares, pedir forecast, **explicar una alerta con evidencia**, correr o leer un backtest. Las respuestas se **fundamentan en lo recuperado** (RAG), no en suposiciones. La solución **informa, predice y explica; nunca mueve dinero.**

## 6. Fases (escríbelas en `PLAN.md`; encajan con la Fase 4/ML del proyecto)
1. **Cortex**: vector store + ingesta + embeddings (espejo de AXIO Cortex).
2. **Motor de forecast + arnés de backtesting** walk-forward (teoría del informe).
3. **`govimo-cortex-mcp`** (espejo de freecad-mcp) exponiendo memoria + forecast + backtest.
4. **Claude como chat final**: integración, validación OOS y reporte de precisión vs baseline.
Construye en orden; cada fase deja algo verificable.

## 7. Empieza
Inspecciona AXIO Cortex + freecad-mcp → lee tramos del informe de backtesting y la Fase 4 del Doc 2 de arquitectura → escribe el plan en `PLAN.md` → construye Cortex primero. De punta a punta.
