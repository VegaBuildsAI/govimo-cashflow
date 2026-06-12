# CLAUDE.md — Govimo Cashflow · brief de construcción (Claude Fable 5)

Brief operativo para Claude Code con **Claude Fable 5**. Léelo una vez y construye. La verdad del proyecto vive en los 3 `.docx` de esta carpeta — ábrelos cuando los necesites; **no copies su contenido aquí**.

## 1. Misión
Construir la **herramienta predictiva de flujo de caja** para Govimo (Vimo): app web *standalone* sobre NetSuite. Consolida pagos, cobros y entradas de efectivo desde NetSuite + banco/SINPE + WhatsApp + archivos de Federico; multimoneda (Yuan/CNY · USD · MXN · CRC); forecast a 13 semanas; alerta antes de cada pago importante verificando efectivo disponible **por moneda**; ML que aprende del histórico y predice movimientos.
Actores: **AXIO** = builder (Michael Vega) · **Cosmic** = partner/KPIs (Felipe) · **Govimo** = cliente final. La app **informa y alerta; nunca mueve dinero.**

## 2. Fuentes de verdad (lee por tramos, no las pegues)
| Archivo | Para |
|---|---|
| `1 - Plan de Proyecto*.docx` | fases, roles, alcance, cronograma |
| `2 - Arquitectura Tecnica*.docx` | capas, modelo de datos, ML, motor de alertas, stack, diagramas |
| `3 - Propuesta SOW*.docx` | entregables por fase, ROI |

Léelas con `pandoc`/extracción y toma **solo** el tramo que ocupas. Son referencia, no material para reproducir.

## 3. Objetivo AHORA — Fase 0 + primer entregable
**Mock/demo navegable de la UI** con datos falsos. Cero integración real todavía.
**Listo cuando** corre un front-end que muestra y navega entre: **Dashboard** (posición por moneda + consolidada), **Forecast 13 semanas** (curva + puntos de faltante), **Calendario de pagos/cobros** (por impacto) y **Centro de alertas** (incluye el flujo "pago próximo → ¿hay efectivo en esa moneda?"). On-brand, con mock data realista. Para ahí y muéstramelo.

## 4. UI / UX
- **Estructura e interacción → clona** `./repo-actas-solidaristas/` (lo copio dentro de esta carpeta). Léelo primero: stack, layout, componentes, espaciado, patrones de navegación. Reúsalos; adapta el contenido a flujo de caja. Mismo UX, no reinventes.
- **Marca govimo.io — paleta confirmada en vivo (úsala tal cual; no hace falta re-extraer):**
  - Fondo oscuro: `#0A0A0A` (base) · `#0D0D0D` · `#1A1A1A` (superficies). Claro: `#FFFFFF` · `#F9FAFF`.
  - Acento de marca: `#5447E4` (índigo/violeta). Tint púrpura: `#2C1F58`.
  - Texto: blanco sobre oscuro · `#404040` cuerpo en claro · `#797979` secundario.
  - CTA: botón *pill* (`border-radius: 999px`), outline (borde + texto), relleno `#5447E4` en estado sólido/hover.
  - Tipografía (Google Fonts): **DM Sans** = títulos · **Outfit** = cuerpo.
  - Estética: oscuro, limpio, modular. Lema: "Business. Technology. Simplified."
  - (Ignora los "global colors" naranja/amarillo de Elementor del sitio: son defaults del tema, no se usan en el diseño visible.)
- Conflicto entre ambos: **repo-actas manda en estructura/UX; govimo manda en color/marca.**

## 5. Fases (clasifícalas tú desde los .docx → escribe `PLAN.md`)
`0 Discovery · 1 Cimientos · 2 Proyección · 3 Alertas · 4 ML`. Construye en ese orden.
**Primera acción:** leer tramos de los 3 docx + el repo-actas y escribir `PLAN.md` con fases → tareas y criterio de "listo" por tarea. Mantenlo vivo.

## 6. Cómo trabajar (afinado a Fable 5)
- **Effort:** `high` por defecto; `xhigh` solo para decisiones de arquitectura o ML.
- **Actúa cuando tengas con qué.** No re-deduzcas lo ya decidido aquí ni enumeres opciones que no tomarás. Si dudas, **recomienda**; no hagas encuestas. (No aplica a tus thinking blocks.)
- **Alcance estricto.** Solo lo que el objetivo pide. Sin features especulativas, refactors, abstracciones ni manejo de errores para casos imposibles. Lo más simple que funcione bien. Valida solo en los bordes (input de usuario, APIs externas).
- **Pausa solo** ante algo destructivo/irreversible, un cambio real de alcance, o input que solo yo puedo dar. Si no, sigue de punta a punta. No cierres con "voy a…": hazlo.
- **Progreso real:** respalda cada afirmación de avance con un resultado de herramienta; si algo no está verificado, dilo.
- **Verifica:** en cada hito contrasta lo construido contra este brief con un subagente de contexto fresco.
- **Subagentes:** delega subtareas independientes y sigue trabajando.
- **No narres ni transcribas tu razonamiento interno como texto de salida.**

## 7. Disciplina de tokens (entrada y salida)
- **Entrada:** lee tramos, no documentos enteros; no recargues lo que ya está en `PLAN.md`/`memory/`.
- **Salida:** sin preámbulos ni cierres de cortesía, sin repetir la tarea, sin narrar cada paso, sin descripciones de PR enormes ni comentarios que narran la línea siguiente. Entrega el artefacto + **una línea** de resultado (qué quedó).
- Mantén `CLAUDE.md`, `PLAN.md` y notas **cortos**.

## 8. Memoria
`memory/` — una lección por archivo, resumen de 1 línea arriba. Anota correcciones y enfoques confirmados y por qué importaron. No guardes lo que ya está en el repo o el historial; actualiza en vez de duplicar; borra lo que resultó falso. `PLAN.md` = plan vivo.

## 9. Empieza
Lee repo-actas + tramos de los 3 docx → escribe `PLAN.md` → construye el mock de UI. De punta a punta.
