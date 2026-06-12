# Fase 1: decisiones que no están en el código

- Postgres dedicado en Docker puerto **5434** porque 5432/5433 ya los usan `axio-cortex-postgres` y `freecad-mcp-postgres` (otros proyectos — no tocarlos).
- Git daba "dubious ownership" (.git creado por el usuario sandbox CodexSandboxOffline); se resolvió con `git config --global --add safe.directory C:/Users/AXIO/Documents/govimo`.
- Fixtures calibrados para que la posición servida por el API sea idéntica a la del mock de Fase 0 (continuidad visual en el demo); el consolidado correcto es **$1,104,531.13**.
- `fecha_real = fecha_esperada` cuando estado=conciliado (el modelo canónico del núcleo no trae fecha_real; los estados de cuenta la traen como única fecha). Revisar si se agrega el campo al parser en Fase 2.
- Tests de DB corren en schema temporal `_test_fase1` dentro de una transacción con rollback — no ensucian los datos del seed.
- Consola Windows es cp1252: no imprimir Unicode no-ASCII (Δ, ¥) desde scripts Python.
- `fmtMoney` con locale es-CR separa miles con espacio ("¥1 240 000") — al verificar texto del DOM no buscar comas.
