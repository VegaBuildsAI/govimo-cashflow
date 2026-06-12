# Govimo Cashflow

Mock/demo navegable y nucleo inicial de flujo de caja para Govimo.

## Frontend

```powershell
cd C:\Users\AXIO\Documents\govimo\app
npm.cmd run dev
npm.cmd run typecheck
npm.cmd run build
npm.cmd run preview
```

La app corre por defecto en `http://localhost:5180`.

Usuarios demo:

- `Michael`
- `Felipe`
- `Federico`

Password comun: `govimo2026`

## Backend Core

```powershell
cd C:\Users\AXIO\Documents\govimo
$env:PYTHONPATH='backend'
C:\Users\AXIO\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -m unittest discover backend\tests -v
```

Este nucleo no mueve dinero: solo normaliza datos, calcula forecast y evalua alertas.
