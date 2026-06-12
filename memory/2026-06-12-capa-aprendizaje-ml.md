# Capa de aprendizaje (Fase 4): predicción→realidad→ROI

- 4 tablas en `schema.sql` (apéndice, las recoge `apply_schema`): `forecast_runs`, `forecast_predictions`, `prediction_outcomes`, `model_metrics`. Repo aparte en `db/learning.py` (no en `repo.py`) porque es concern de Fase 4.
- **Línea base sin entrenar nada:** las reglas asumen pago en `fecha_esperada`, así que el error base = `fecha_real − fecha_esperada`, ya presente en `transactions`. `compute_metrics` la calcula en el mismo query; `supera_baseline = mae_dias < baseline_mae_dias`. Es el criterio del doc §6 ("el ML solo gana si supera a las reglas").
- `reconcile_outcomes` auto-mide predicciones cuyo tx ya está `conciliado` y aún no tienen outcome → así "aprende de la data que se va guardando" sin paso manual.
- `error_monto_base` se deriva del FX implícito de la predicción (`pred_monto_base/pred_monto`), no se re-resuelve FX — evita depender de tasas nuevas al medir.
- Verificación: el Postgres del proyecto está en el host Windows (Docker :5434); el sandbox Linux no lo alcanza y no tiene psycopg/pg, así que los tests e2e (igual que `test_repo_api`) solo corren en el host. Aquí se validó: import limpio, DDL parseado con sqlglot (dialecto postgres) y lógica pura de error. Correr en host: `PYTHONPATH=backend python -m unittest discover backend/tests -v`.
- Quirk de entorno: el mount Linux va con retraso frente a los archivos canónicos; `Write` nuevos aparecen, pero un `Edit` a archivo existente puede no reflejarse en bash. Confirmar estado con la tool Read, no con `cat` del mount.
