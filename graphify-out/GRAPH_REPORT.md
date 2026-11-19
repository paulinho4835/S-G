# Graph Report - Felipillo  (2026-11-18)

## Corpus Check
- 106 files · ~124,974 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 18 file(s) not represented in the graph (top: (none) 14, .css 2, .code-workspace 1)

## Summary
- 822 nodes · 1323 edges · 64 communities (52 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f817c620`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.jsx
- package.json
- project.yml
- frontend/package.json
- api.js
- bank-qr/index.ts
- expo
- BankQrSettings.jsx
- Dashboard.jsx
- build
- server.js
- backend/package.json
- OrdersList.jsx
- mobile/package.json
- Web Migration: Electron → Vercel + Supabase Implementation Plan
- check_db_internal.js
- main.js
- ref_path
- App Mobile Android — Consulta de Catálogo
- reload_from_excel.js
- exportar-catalogo.js
- App Mobile Android — Consulta de Catálogo — Implementation Plan
- scripts
- KardexModal.jsx
- 📦 Guía de Distribución e Instalación - La Casa de los Retenes S&G
- QuotationsList
- scripts
- migrate-sqlite-to-supabase.js
- load_supabase.js
- paths
- HyperFrames Composition Project
- restore-pv-geli.js
- HyperFrames Composition Project
- middleware.test.js
- migrate_cost_price.js
- migrate_db.js
- migrate_familia_aplicacion.js
- migrate_new_fields.js
- migrate_pv_geli.js
- migrate_sales.js
- migrate_tope.js
- check_db.js
- buildSupplyOrderRow
- devDependencies
- scripts
- compilerOptions
- restore-pv-geli-final.js
- inspect_measures.js
- remove_duplicates.js
- vercel.json
- Guía de Instalación - Spare Parts Store
- 🚀 Felipillo - Estado del Proyecto
- sw.js
- 001_schema.sql
- mobile/AGENTS.md
- public.fn_delete_sale
- qr_payments
- 20261015150000_supply_orders_lifecycle.sql
- QuotationsList

## God Nodes (most connected - your core abstractions)
1. `ConfirmDialog()` - 20 edges
2. `parts` - 18 edges
3. `App()` - 17 edges
4. `Dashboard()` - 17 edges
5. `lucide-react` - 16 edges
6. `OrdersList()` - 14 edges
7. `toast` - 14 edges
8. `Web Migration: Electron → Vercel + Supabase Implementation Plan` - 14 edges
9. `sales` - 14 edges
10. `BankQrSettings()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Task 7: Actualizar componentes para usar api.js` --references--> `getWholesaleOrders()`  [INFERRED]
  docs/superpowers/plans/2026-05-25-web-migration-vercel-supabase.md → frontend/src/lib/api.js
- `Task 7: Actualizar componentes para usar api.js` --references--> `getQuotations()`  [INFERRED]
  docs/superpowers/plans/2026-05-25-web-migration-vercel-supabase.md → frontend/src/lib/api.js
- `Task 10: Configurar URL del PDF en Edge Function` --references--> `downloadQuotationPdf()`  [INFERRED]
  docs/superpowers/plans/2026-05-25-web-migration-vercel-supabase.md → frontend/src/lib/api.js
- `Dashboard()` --calls--> `getParts()`  [EXTRACTED]
  frontend/src/components/Dashboard.jsx → frontend/src/lib/api.js
- `Dashboard()` --calls--> `getSalesSummary()`  [EXTRACTED]
  frontend/src/components/Dashboard.jsx → frontend/src/lib/api.js

## Import Cycles
- None detected.

## Communities (64 total, 12 thin omitted)

### Community 0 - "App.jsx"
Cohesion: 0.07
Nodes (47): App(), BulkUpload, Dashboard, DatabaseMaintenance, isAdminSession(), NAV_ITEMS, OrdersList, PartForm (+39 more)

### Community 1 - "package.json"
Cohesion: 0.11
Nodes (22): author, dependencies, concurrently@^8.2.2, dotenv@^17.4.2, pdfkit@^0.18.0, sqlite3@^6.0.1, @supabase/supabase-js@^2.106.2, wait-on@^7.2.0 (+14 more)

### Community 2 - "project.yml"
Cohesion: 0.08
Nodes (25): activation_command, activation_command_timeout, added_modes, agent_interface, default_modes, encoding, excluded_apis, excluded_tools (+17 more)

### Community 3 - "frontend/package.json"
Cohesion: 0.05
Nodes (49): json(), login(), mockSupabase(), TEST_PART, dependencies, lucide-react@^1.16.0, react@^18.2.0, react-dom@^18.2.0 (+41 more)

### Community 4 - "api.js"
Cohesion: 0.11
Nodes (16): PartForm(), SalesHistory(), archiveSupplyOrder(), createPart(), deleteSale(), deleteSupplyOrder(), getDeadStock(), getParts() (+8 more)

### Community 5 - "bank-qr/index.ts"
Cohesion: 0.08
Nodes (36): bankToken(), chargeFor(), checkStock(), cors, Line, loadPayment(), loadProvider(), Payment (+28 more)

### Community 6 - "expo"
Cohesion: 0.08
Nodes (23): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, expo, android (+15 more)

### Community 7 - "BankQrSettings.jsx"
Cohesion: 0.19
Nodes (19): BankQrSettings(), dateTime, emptyForm, environmentLabel, styles, TestCharge(), DatabaseMaintenance(), resetDatabase() (+11 more)

### Community 8 - "Dashboard.jsx"
Cohesion: 0.27
Nodes (16): Dashboard(), PERIOD_LABELS, PRESETS, TAB_COLOR, TOOLTIP_STYLE, calcMargin(), calcTrend(), formatCurrency() (+8 more)

### Community 9 - "build"
Cohesion: 0.11
Nodes (19): build, appId, asar, directories, extraResources, files, npmRebuild, nsis (+11 more)

### Community 10 - "server.js"
Cohesion: 0.11
Nodes (15): db, path, sqlite3, app, bodyParser, cors, express, fs (+7 more)

### Community 11 - "backend/package.json"
Cohesion: 0.12
Nodes (22): dependencies, body-parser@^1.20.2, cors@^2.8.5, express@^4.19.2, multer@^2.0.2, pdfkit@^0.18.0, sqlite3@^5.1.7, xlsx@^0.18.5 (+14 more)

### Community 12 - "OrdersList.jsx"
Cohesion: 0.17
Nodes (16): compactInputStyle, controlStyle, formatDate(), localDateKey(), mapSupplyOrder(), OrdersList(), parseLocalJson(), persistLocalBackup() (+8 more)

### Community 13 - "mobile/package.json"
Cohesion: 0.05
Nodes (42): App(), styles, dependencies, expo@~56.0.4, expo-document-picker@~56.0.4, expo-file-system@~56.0.7, expo-sqlite@~56.0.4, expo-status-bar@~56.0.4 (+34 more)

### Community 14 - "Web Migration: Electron → Vercel + Supabase Implementation Plan"
Cohesion: 0.15
Nodes (12): Archivos que se crean o modifican, Prerequisitos manuales (antes de empezar), Resumen de la arquitectura final, Task 1: PostgreSQL Schema, Task 2: Supabase Auth + RLS, Task 3: Stored Procedures (RPCs) para lógica transaccional, Task 4: Edge Function para generación de PDF, Task 5: Frontend — Cliente Supabase + api.js (+4 more)

### Community 15 - "check_db_internal.js"
Cohesion: 0.23
Nodes (7): main(), { open }, PartService, path, sqlite3, sqlite@^5.1.1, sqlite

### Community 16 - "main.js"
Cohesion: 0.17
Nodes (8): { execSync }, path, { app, BrowserWindow }, { fork }, isDev, path, electron-is-dev@^2.0.0, electron-is-dev

### Community 17 - "ref_path"
Cohesion: 0.22
Nodes (6): path, xlsx, path, xlsx, bulkUploadParts(), exportPartsExcel()

### Community 18 - "App Mobile Android — Consulta de Catálogo"
Cohesion: 0.17
Nodes (11): App Mobile, App Mobile Android — Consulta de Catálogo, Arquitectura, Base de datos local (SQLite en el celular), Contexto, Distribución, Flujo de uso, Lo que queda fuera del scope (+3 more)

### Community 19 - "reload_from_excel.js"
Cohesion: 0.25
Nodes (8): db, DB_PATH, EXCEL_PATH, main(), path, run(), sqlite3, xlsx

### Community 20 - "exportar-catalogo.js"
Cohesion: 0.22
Nodes (7): candidates, db, dbPath, fs, path, sqlite3, startBackend()

### Community 21 - "App Mobile Android — Consulta de Catálogo — Implementation Plan"
Cohesion: 0.18
Nodes (10): App Mobile Android — Consulta de Catálogo — Implementation Plan, Estructura de archivos, Task 1: Script de exportación, Task 2: Setup del proyecto Expo, Task 3: Capa de base de datos local, Task 4: Pantalla de búsqueda (SearchScreen), Task 5: Pantalla de detalle (DetailScreen), Task 6: Pantalla de ajustes e importación (SettingsScreen) (+2 more)

### Community 22 - "scripts"
Cohesion: 0.22
Nodes (8): name, private, scripts, check, dev, publish, render, type

### Community 23 - "KardexModal.jsx"
Cohesion: 0.33
Nodes (8): buildPrintHtml(), COMMERCIAL_TYPES, formatDate(), KardexModal(), MANUAL_TYPES, MovementTable(), TYPE_CONFIG, getKardex()

### Community 24 - "📦 Guía de Distribución e Instalación - La Casa de los Retenes S&G"
Cohesion: 0.20
Nodes (9): 🚀 Archivos Generados en `dist_electron/`, 📊 Carga Masiva desde Excel (Offline), 📦 Guía de Distribución e Instalación - La Casa de los Retenes S&G, 🎨 Identidad Visual y Marca Premium, 📥 Instrucciones para Instalar en otra Máquina, Paso 1: Copiar el instalador, Paso 2: Ejecutar el Instalador, Paso 3: ¡Listo para Usar! (+1 more)

### Community 25 - "QuotationsList"
Cohesion: 0.33
Nodes (6): Task 7: Actualizar componentes para usar api.js, WholesaleHistory(), getQuotations(), getWholesaleOrder(), getWholesaleOrders(), returnWholesaleOrder()

### Community 26 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build:electron, build:frontend, dev, dev:backend, dev:frontend, dist, postinstall (+1 more)

### Community 27 - "migrate-sqlite-to-supabase.js"
Cohesion: 0.33
Nodes (6): authenticate(), { createClient }, migrate(), path, sqlite3, supabase

### Community 28 - "load_supabase.js"
Cohesion: 0.29
Nodes (5): { createClient }, EXCEL_PATH, path, supabase, xlsx

### Community 29 - "paths"
Cohesion: 0.29
Nodes (6): paths, assets, blocks, components, registry, $schema

### Community 30 - "HyperFrames Composition Project"
Cohesion: 0.25
Nodes (7): Commands, Documentation, HyperFrames Composition Project, Key Rules, Linting — Always Run After Changes, Project Structure, Skills

### Community 31 - "restore-pv-geli.js"
Cohesion: 0.15
Nodes (8): { createClient }, path, sqlite3, supabase, { createClient }, path, sqlite3, supabase

### Community 32 - "HyperFrames Composition Project"
Cohesion: 0.25
Nodes (7): Commands, Documentation, HyperFrames Composition Project, Key Rules, Linting — ALWAYS RUN AFTER CHANGES, Project Structure, Skills — USE THESE FIRST

### Community 34 - "migrate_cost_price.js"
Cohesion: 0.40
Nodes (4): db, dbPath, path, sqlite3

### Community 35 - "migrate_db.js"
Cohesion: 0.40
Nodes (4): db, dbPath, path, sqlite3

### Community 36 - "migrate_familia_aplicacion.js"
Cohesion: 0.40
Nodes (4): db, dbPath, path, sqlite3

### Community 37 - "migrate_new_fields.js"
Cohesion: 0.40
Nodes (4): db, dbPath, path, sqlite3

### Community 38 - "migrate_pv_geli.js"
Cohesion: 0.40
Nodes (4): db, dbPath, path, sqlite3

### Community 39 - "migrate_sales.js"
Cohesion: 0.40
Nodes (4): db, dbPath, path, sqlite3

### Community 40 - "migrate_tope.js"
Cohesion: 0.40
Nodes (4): db, dbPath, path, sqlite3

### Community 41 - "check_db.js"
Cohesion: 0.40
Nodes (4): db, dbPath, path, sqlite3

### Community 42 - "buildSupplyOrderRow"
Cohesion: 0.43
Nodes (7): buildSupplyOrderRow(), createSupplyOrder(), importSupplyOrders(), normalizeSupplyQuantity(), normalizeSupplyStatus(), normalizeSupplyText(), updateSupplyOrder()

### Community 43 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, electron@^28.2.0, electron-builder@^24.9.1, electron-packager@^17.1.2, electron, electron-builder, electron-packager

### Community 44 - "scripts"
Cohesion: 0.50
Nodes (4): scripts, dev, start, test

### Community 45 - "compilerOptions"
Cohesion: 0.50
Nodes (3): compilerOptions, baseUrl, paths

### Community 50 - "Guía de Instalación - Spare Parts Store"
Cohesion: 0.33
Nodes (5): 1. Configuración del Backend, 2. Configuración del Frontend, Guía de Instalación - Spare Parts Store, Requisitos Previos, Resumen de Comandos

### Community 51 - "🚀 Felipillo - Estado del Proyecto"
Cohesion: 0.33
Nodes (5): 🛠️ Arquitectura Técnica, 🚀 Felipillo - Estado del Proyecto, ✅ Funcionalidades Implementadas, 📌 Resumen Actual, 📍 Última Tarea (Donde nos quedamos)

### Community 53 - "001_schema.sql"
Cohesion: 0.12
Nodes (28): idx_movements_part, idx_parts_codigo, idx_parts_codigo_producto, idx_parts_measures, idx_parts_name, idx_quotation_items_q, idx_quotations_cliente, idx_sales_date (+20 more)

### Community 56 - "public.fn_delete_sale"
Cohesion: 0.12
Nodes (12): idx_audit_log_created_at, idx_audit_log_entity, public.audit_log, public.fn_delete_part(), public.fn_delete_sale(), public.fn_require_admin(), public.fn_reset_database(), public.fn_update_sale_invoice_type() (+4 more)

### Community 57 - "qr_payments"
Cohesion: 0.24
Nodes (9): fn_register_qr_payment(), get_payment_provider(), payment_providers, qr_payments, qr_payments_created_idx, qr_payments_provider_qr_idx, idx_supply_orders_order_date, idx_supply_orders_part_id (+1 more)

### Community 58 - "20261015150000_supply_orders_lifecycle.sql"
Cohesion: 0.48
Nodes (5): idx_supply_orders_active_date, idx_supply_orders_status, idx_supply_orders_supplier, public.fn_touch_supply_order(), trg_supply_orders_updated_at

### Community 61 - "QuotationsList"
Cohesion: 0.33
Nodes (6): Task 10: Configurar URL del PDF en Edge Function, QuotationsList(), cancelQuotation(), confirmQuotation(), downloadQuotationPdf(), getQuotation()

## Knowledge Gaps
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `bulkUploadParts()` connect `ref_path` to `App.jsx`, `api.js`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07177033492822966 - nodes in this community are weakly interconnected._
- **Why does `electron-is-dev` connect `main.js` to `package.json`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.11462450592885376 - nodes in this community are weakly interconnected._
- **Why does `exportPartsExcel()` connect `ref_path` to `api.js`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Should `project.yml` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `frontend/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._