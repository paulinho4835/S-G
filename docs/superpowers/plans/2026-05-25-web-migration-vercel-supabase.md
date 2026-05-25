# Web Migration: Electron → Vercel + Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el sistema de inventario de repuestos de una app Electron de escritorio a una aplicación web en Vercel (frontend) + Supabase (base de datos, auth, lógica transaccional).

**Architecture:** El frontend React/Vite se despliega en Vercel sin cambios estructurales a sus componentes. Todas las llamadas a la API se centralizan en un nuevo archivo `frontend/src/lib/api.js` que reemplaza el backend Express con: PostgREST auto-generado de Supabase para CRUD simple, procedimientos almacenados de PostgreSQL para operaciones transaccionales (ventas, stock), y una Edge Function de Deno para generar PDFs.

**Tech Stack:**
- Frontend: React/Vite → Vercel (free)
- Base de datos: SQLite → Supabase PostgreSQL (free, 500 MB)
- Auth: localStorage hardcodeado → Supabase Auth
- Lógica transaccional: rutas Express → stored procedures PostgreSQL (RPC de Supabase)
- PDF: pdfkit (Node.js) → pdf-lib (Deno Edge Function en Supabase)
- Export Excel: ruta Express → generación client-side con xlsx
- Import Excel: multer + server → parse client-side + RPC batch

---

## Prerequisitos manuales (antes de empezar)

- [ ] Crear cuenta en [supabase.com](https://supabase.com) (free)
- [ ] Crear nuevo proyecto Supabase → guardar **Project URL** y **anon key** (Settings → API)
- [ ] Crear cuenta en [vercel.com](https://vercel.com) (free)
- [ ] Instalar Supabase CLI: `npm i -g supabase`
- [ ] Instalar Vercel CLI: `npm i -g vercel`
- [ ] Autenticar Supabase CLI: `supabase login`
- [ ] Autenticar Vercel CLI: `vercel login`

---

## Archivos que se crean o modifican

| Acción | Archivo | Responsabilidad |
|--------|---------|-----------------|
| Crear | `supabase/migrations/001_schema.sql` | Schema completo PostgreSQL |
| Crear | `supabase/migrations/002_rpc.sql` | Stored procedures (ventas, stock, wholesale, etc.) |
| Crear | `supabase/functions/quotation-pdf/index.ts` | Edge Function: generar PDF cotización |
| Crear | `scripts/migrate-sqlite-to-supabase.js` | Migración datos existentes → Supabase |
| Crear | `frontend/src/lib/supabase.js` | Cliente Supabase singleton |
| Crear | `frontend/src/lib/api.js` | Todas las llamadas a API (reemplaza fetch a Express) |
| Crear | `frontend/.env.local` | Variables de entorno (URL + anon key) |
| Modificar | `frontend/vite.config.js` | Eliminar proxy `/api`, sin cambios estructurales |
| Modificar | `frontend/src/components/Login.jsx` | Usar Supabase Auth en vez de hardcode |
| Modificar | `frontend/src/App.jsx` | Usar sesión Supabase en vez de localStorage |
| Modificar | `frontend/src/components/BulkUpload.jsx` | Parse Excel client-side, enviar JSON a RPC |
| Modificar | `frontend/src/components/PartList.jsx` | Usar api.js |
| Modificar | `frontend/src/components/PartForm.jsx` | Usar api.js |
| Modificar | `frontend/src/components/SalesHistory.jsx` | Usar api.js |
| Modificar | `frontend/src/components/SalesModal.jsx` | Usar api.js |
| Modificar | `frontend/src/components/Dashboard.jsx` | Usar api.js |
| Modificar | `frontend/src/components/OrdersList.jsx` | Usar api.js |
| Modificar | `frontend/src/components/WholesaleCart.jsx` | Usar api.js |
| Modificar | `frontend/src/components/WholesaleHistory.jsx` | Usar api.js |
| Modificar | `frontend/src/components/QuotationsList.jsx` | Usar api.js |
| Modificar | `frontend/src/components/KardexModal.jsx` | Usar api.js |
| Modificar | `frontend/src/components/AdjustStockModal.jsx` | Usar api.js |
| Modificar | `frontend/src/components/EditPartModal.jsx` | Usar api.js |
| Modificar | `frontend/src/components/DatabaseMaintenance.jsx` | Usar api.js |
| Crear | `vercel.json` | Config SPA routing para Vercel |

---

## Task 1: PostgreSQL Schema

**Files:**
- Create: `supabase/migrations/001_schema.sql`

- [ ] **Step 1: Crear el directorio de migraciones**

```bash
mkdir -p supabase/migrations
```

- [ ] **Step 2: Escribir la migración del schema**

Crear `supabase/migrations/001_schema.sql`:

```sql
-- ── PARTES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parts (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL DEFAULT '',
    internal_measure FLOAT8 NOT NULL DEFAULT 0,
    external_measure FLOAT8 NOT NULL DEFAULT 0,
    height          FLOAT8 NOT NULL DEFAULT 0,
    description     TEXT DEFAULT '',
    stock           INTEGER DEFAULT 0,
    flange_measure  FLOAT8 DEFAULT 0,
    familia         TEXT DEFAULT '',
    codigo          TEXT DEFAULT '',
    codigo_producto TEXT DEFAULT '',
    marca           TEXT DEFAULT '',
    mundial         TEXT DEFAULT '',
    aplicacion      TEXT DEFAULT '',
    cost_price      FLOAT8 DEFAULT 0,
    tope            FLOAT8 DEFAULT 0,
    pv_geli         TEXT DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parts_name ON parts(name);
CREATE INDEX IF NOT EXISTS idx_parts_codigo ON parts(codigo);
CREATE INDEX IF NOT EXISTS idx_parts_codigo_producto ON parts(codigo_producto);
CREATE INDEX IF NOT EXISTS idx_parts_measures ON parts(internal_measure, external_measure, height);

-- ── VENTAS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
    id                  BIGSERIAL PRIMARY KEY,
    part_id             BIGINT NOT NULL REFERENCES parts(id),
    quantity            INTEGER NOT NULL,
    unit_price          FLOAT8 DEFAULT 0,
    total_price         FLOAT8 DEFAULT 0,
    invoice_type        TEXT DEFAULT 'SIN_FACTURA',
    sale_date           TIMESTAMPTZ DEFAULT NOW(),
    refunded            BOOLEAN DEFAULT FALSE,
    wholesale_order_id  BIGINT
);

CREATE INDEX IF NOT EXISTS idx_sales_part ON sales(part_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_wholesale ON sales(wholesale_order_id);

-- ── KARDEX (MOVIMIENTOS DE STOCK) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
    id         BIGSERIAL PRIMARY KEY,
    part_id    BIGINT NOT NULL REFERENCES parts(id),
    type       TEXT NOT NULL,
    quantity   INTEGER NOT NULL,
    price      FLOAT8 DEFAULT 0,
    balance    INTEGER NOT NULL,
    concept    TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_part ON stock_movements(part_id);

-- ── PEDIDOS MAYORISTAS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wholesale_orders (
    id           BIGSERIAL PRIMARY KEY,
    cliente      TEXT NOT NULL,
    subtotal     FLOAT8 DEFAULT 0,
    total        FLOAT8 DEFAULT 0,
    invoice_type TEXT DEFAULT 'SIN_FACTURA',
    notes        TEXT DEFAULT '',
    status       TEXT DEFAULT 'active',
    order_date   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wholesale_cliente ON wholesale_orders(cliente);

CREATE TABLE IF NOT EXISTS wholesale_items (
    id          BIGSERIAL PRIMARY KEY,
    order_id    BIGINT NOT NULL REFERENCES wholesale_orders(id),
    part_id     BIGINT NOT NULL REFERENCES parts(id),
    quantity    INTEGER NOT NULL,
    unit_price  FLOAT8 NOT NULL,
    total_price FLOAT8 NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wholesale_items_order ON wholesale_items(order_id);

-- ── COTIZACIONES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotations (
    id                 BIGSERIAL PRIMARY KEY,
    cliente            TEXT NOT NULL,
    subtotal           FLOAT8 DEFAULT 0,
    total              FLOAT8 DEFAULT 0,
    invoice_type       TEXT DEFAULT 'COTIZACION',
    notes              TEXT DEFAULT '',
    status             TEXT DEFAULT 'pending',
    valid_days         INTEGER DEFAULT 7,
    wholesale_order_id BIGINT,
    quote_date         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotations_cliente ON quotations(cliente);

CREATE TABLE IF NOT EXISTS quotation_items (
    id            BIGSERIAL PRIMARY KEY,
    quotation_id  BIGINT NOT NULL REFERENCES quotations(id),
    part_id       BIGINT NOT NULL REFERENCES parts(id),
    quantity      INTEGER NOT NULL,
    unit_price    FLOAT8 NOT NULL,
    total_price   FLOAT8 NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_q ON quotation_items(quotation_id);
```

- [ ] **Step 3: Ejecutar la migración en Supabase**

Ir al Dashboard de Supabase → SQL Editor → pegar el contenido de `001_schema.sql` → Run.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_schema.sql
git commit -m "feat: add PostgreSQL schema migration for Supabase"
```

---

## Task 2: Supabase Auth + RLS

- [ ] **Step 1: Crear el usuario en Supabase**

En el Dashboard de Supabase → Authentication → Users → "Add user":
- Email: `admin@retenes.app`
- Password: `pochita2024`
- Auto-confirm: ON

Guardar el email y password para configurar el Login más adelante.

- [ ] **Step 2: Habilitar RLS y crear políticas**

En Supabase → SQL Editor:

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE wholesale_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE wholesale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

-- Política: usuarios autenticados tienen acceso total
CREATE POLICY "authenticated full access" ON parts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON wholesale_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON wholesale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON quotations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON quotation_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

---

## Task 3: Stored Procedures (RPCs) para lógica transaccional

**Files:**
- Create: `supabase/migrations/002_rpc.sql`

Estas funciones reemplazan las rutas Express que hacen múltiples operaciones en una sola transacción.

- [ ] **Step 1: Escribir las funciones PostgreSQL**

Crear `supabase/migrations/002_rpc.sql`:

```sql
-- ── RPC: Crear Venta ─────────────────────────────────────────────────────────
-- Reemplaza POST /api/sales (verifica stock, descuenta, registra kardex)
CREATE OR REPLACE FUNCTION fn_create_sale(
    p_part_id      BIGINT,
    p_quantity     INTEGER,
    p_unit_price   FLOAT8,
    p_invoice_type TEXT
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_stock    INTEGER;
    v_name     TEXT;
    v_total    FLOAT8;
    v_sale_id  BIGINT;
    v_new_stk  INTEGER;
BEGIN
    SELECT stock, name INTO v_stock, v_name FROM parts WHERE id = p_part_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;
    IF v_stock < p_quantity THEN
        RAISE EXCEPTION 'Stock insuficiente. Disponible: %', v_stock;
    END IF;

    v_total := p_unit_price * p_quantity;

    UPDATE parts SET stock = stock - p_quantity WHERE id = p_part_id;
    v_new_stk := v_stock - p_quantity;

    INSERT INTO sales (part_id, quantity, unit_price, total_price, invoice_type)
    VALUES (p_part_id, p_quantity, p_unit_price, v_total, p_invoice_type)
    RETURNING id INTO v_sale_id;

    INSERT INTO stock_movements (part_id, type, quantity, price, balance, concept)
    VALUES (p_part_id, 'VENTA', -p_quantity, p_unit_price, v_new_stk,
            'Venta #' || v_sale_id || ' - ' || p_invoice_type);

    RETURN json_build_object(
        'id', v_sale_id, 'part_id', p_part_id,
        'quantity', p_quantity, 'unit_price', p_unit_price,
        'total_price', v_total, 'invoice_type', p_invoice_type
    );
END; $$;

-- ── RPC: Devolver Venta ───────────────────────────────────────────────────────
-- Reemplaza POST /api/sales/:id/return
CREATE OR REPLACE FUNCTION fn_return_sale(p_sale_id BIGINT) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_sale RECORD; v_bal INTEGER;
BEGIN
    SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada'; END IF;
    IF v_sale.refunded THEN RAISE EXCEPTION 'Ya fue devuelta'; END IF;

    UPDATE sales SET refunded = TRUE WHERE id = p_sale_id;
    UPDATE parts SET stock = stock + v_sale.quantity WHERE id = v_sale.part_id;

    SELECT stock INTO v_bal FROM parts WHERE id = v_sale.part_id;
    INSERT INTO stock_movements (part_id, type, quantity, price, balance, concept)
    VALUES (v_sale.part_id, 'DEVOLUCION', v_sale.quantity, v_sale.unit_price, v_bal,
            'Devolución de Venta #' || p_sale_id);

    IF v_sale.wholesale_order_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM sales
            WHERE wholesale_order_id = v_sale.wholesale_order_id AND refunded = FALSE
        ) THEN
            UPDATE wholesale_orders SET status = 'returned' WHERE id = v_sale.wholesale_order_id;
        END IF;
    END IF;

    RETURN json_build_object('id', p_sale_id, 'status', 'returned');
END; $$;

-- ── RPC: Ajuste de Stock (Restock) ───────────────────────────────────────────
-- Reemplaza POST /api/parts/:id/restock
CREATE OR REPLACE FUNCTION fn_create_restock(p_part_id BIGINT, p_quantity INTEGER) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_new_stk INTEGER;
BEGIN
    UPDATE parts SET stock = stock + p_quantity WHERE id = p_part_id RETURNING stock INTO v_new_stk;
    IF NOT FOUND THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;

    INSERT INTO stock_movements (part_id, type, quantity, price, balance, concept)
    VALUES (p_part_id,
            CASE WHEN p_quantity >= 0 THEN 'AJUSTE_ENTRADA' ELSE 'AJUSTE_SALIDA' END,
            p_quantity, 0, v_new_stk,
            'Ajuste manual de stock (' || CASE WHEN p_quantity >= 0 THEN '+' ELSE '' END || p_quantity || ' unidades)');

    RETURN json_build_object('id', p_part_id, 'adjusted', p_quantity, 'new_stock', v_new_stk);
END; $$;

-- ── RPC: Crear Pedido Mayorista ──────────────────────────────────────────────
-- Reemplaza POST /api/wholesale
-- p_items: [{"part_id":1,"quantity":2,"unit_price":100.0}, ...]
CREATE OR REPLACE FUNCTION fn_create_wholesale_order(
    p_cliente      TEXT,
    p_items        JSON,
    p_invoice_type TEXT,
    p_notes        TEXT
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_order_id BIGINT;
    v_subtotal FLOAT8 := 0;
    v_item     JSON;
    v_part_id  BIGINT;
    v_qty      INTEGER;
    v_price    FLOAT8;
    v_stock    INTEGER;
    v_part_name TEXT;
    v_new_stk  INTEGER;
    v_inv_label TEXT;
BEGIN
    -- Validar stock de todos los ítems primero
    FOR v_item IN SELECT * FROM json_array_elements(p_items) LOOP
        v_part_id := (v_item->>'part_id')::BIGINT;
        v_qty     := (v_item->>'quantity')::INTEGER;
        SELECT stock, name INTO v_stock, v_part_name FROM parts WHERE id = v_part_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Producto ID % no encontrado', v_part_id; END IF;
        IF v_stock < v_qty THEN
            RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %', v_part_name, v_stock;
        END IF;
    END LOOP;

    -- Calcular subtotal
    SELECT SUM((value->>'unit_price')::FLOAT8 * (value->>'quantity')::INTEGER)
    INTO v_subtotal
    FROM json_array_elements(p_items) value;

    -- Crear cabecera del pedido
    INSERT INTO wholesale_orders (cliente, subtotal, total, invoice_type, notes)
    VALUES (TRIM(p_cliente), v_subtotal, v_subtotal, COALESCE(p_invoice_type, 'SIN_FACTURA'), COALESCE(p_notes, ''))
    RETURNING id INTO v_order_id;

    v_inv_label := COALESCE(p_invoice_type, 'MAYOR_SIN_FACTURA');

    -- Procesar cada ítem
    FOR v_item IN SELECT * FROM json_array_elements(p_items) LOOP
        v_part_id := (v_item->>'part_id')::BIGINT;
        v_qty     := (v_item->>'quantity')::INTEGER;
        v_price   := (v_item->>'unit_price')::FLOAT8;

        INSERT INTO wholesale_items (order_id, part_id, quantity, unit_price, total_price)
        VALUES (v_order_id, v_part_id, v_qty, v_price, v_qty * v_price);

        UPDATE parts SET stock = stock - v_qty WHERE id = v_part_id RETURNING stock INTO v_new_stk;

        INSERT INTO stock_movements (part_id, type, quantity, price, balance, concept)
        VALUES (v_part_id, 'VENTA_MAYOR', -v_qty, v_price, v_new_stk,
                'Venta Mayor #' || v_order_id || ' — Cliente: ' || p_cliente);

        INSERT INTO sales (part_id, quantity, unit_price, total_price, invoice_type, wholesale_order_id)
        VALUES (v_part_id, v_qty, v_price, v_qty * v_price, v_inv_label, v_order_id);
    END LOOP;

    RETURN json_build_object(
        'id', v_order_id, 'cliente', p_cliente,
        'subtotal', v_subtotal, 'total', v_subtotal,
        'items_count', json_array_length(p_items)
    );
END; $$;

-- ── RPC: Devolver Pedido Mayorista ───────────────────────────────────────────
-- Reemplaza POST /api/wholesale/:id/return
CREATE OR REPLACE FUNCTION fn_return_wholesale_order(p_order_id BIGINT) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_order RECORD;
    v_sale  RECORD;
    v_bal   INTEGER;
BEGIN
    SELECT * INTO v_order FROM wholesale_orders WHERE id = p_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
    IF v_order.status = 'returned' THEN RAISE EXCEPTION 'Este pedido ya fue devuelto'; END IF;

    UPDATE wholesale_orders SET status = 'returned' WHERE id = p_order_id;

    FOR v_sale IN SELECT * FROM sales WHERE wholesale_order_id = p_order_id AND refunded = FALSE LOOP
        UPDATE sales SET refunded = TRUE WHERE id = v_sale.id;
        UPDATE parts SET stock = stock + v_sale.quantity WHERE id = v_sale.part_id;
        SELECT stock INTO v_bal FROM parts WHERE id = v_sale.part_id;

        INSERT INTO stock_movements (part_id, type, quantity, price, balance, concept)
        VALUES (v_sale.part_id, 'DEVOLUCION_MAYOR', v_sale.quantity, v_sale.unit_price, v_bal,
                'Devolución Venta Mayor #' || p_order_id || ' — ' || v_order.cliente);
    END LOOP;

    RETURN json_build_object('id', p_order_id, 'status', 'returned');
END; $$;

-- ── RPC: Confirmar Cotización → Pedido Mayorista ─────────────────────────────
-- Reemplaza POST /api/quotations/:id/confirm
CREATE OR REPLACE FUNCTION fn_confirm_quotation(p_quote_id BIGINT) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_quote     RECORD;
    v_item      RECORD;
    v_order_id  BIGINT;
    v_inv_type  TEXT;
    v_new_stk   INTEGER;
BEGIN
    SELECT * INTO v_quote FROM quotations WHERE id = p_quote_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
    IF v_quote.status <> 'pending' THEN
        RAISE EXCEPTION 'La cotización ya está en estado: %', v_quote.status;
    END IF;

    -- Verificar stock de todos los ítems
    FOR v_item IN
        SELECT qi.*, p.stock, p.name
        FROM quotation_items qi JOIN parts p ON qi.part_id = p.id
        WHERE qi.quotation_id = p_quote_id
    LOOP
        IF v_item.stock < v_item.quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %', v_item.name, v_item.stock;
        END IF;
    END LOOP;

    v_inv_type := CASE WHEN v_quote.invoice_type = 'COTIZACION' THEN 'MAYOR_SIN_FACTURA' ELSE v_quote.invoice_type END;

    INSERT INTO wholesale_orders (cliente, subtotal, total, invoice_type, notes)
    VALUES (v_quote.cliente, v_quote.subtotal, v_quote.total, v_inv_type, COALESCE(v_quote.notes, ''))
    RETURNING id INTO v_order_id;

    FOR v_item IN
        SELECT qi.* FROM quotation_items qi WHERE qi.quotation_id = p_quote_id
    LOOP
        INSERT INTO wholesale_items (order_id, part_id, quantity, unit_price, total_price)
        VALUES (v_order_id, v_item.part_id, v_item.quantity, v_item.unit_price, v_item.total_price);

        UPDATE parts SET stock = stock - v_item.quantity WHERE id = v_item.part_id RETURNING stock INTO v_new_stk;

        INSERT INTO stock_movements (part_id, type, quantity, price, balance, concept)
        VALUES (v_item.part_id, 'VENTA_MAYOR', -v_item.quantity, v_item.unit_price, v_new_stk,
                'Venta Mayor #' || v_order_id || ' (Cotiz. #' || p_quote_id || ') — ' || v_quote.cliente);

        INSERT INTO sales (part_id, quantity, unit_price, total_price, invoice_type, wholesale_order_id)
        VALUES (v_item.part_id, v_item.quantity, v_item.unit_price, v_item.total_price, v_inv_type, v_order_id);
    END LOOP;

    UPDATE quotations SET status = 'confirmed', wholesale_order_id = v_order_id WHERE id = p_quote_id;

    RETURN json_build_object('id', v_order_id, 'cliente', v_quote.cliente, 'total', v_quote.total);
END; $$;

-- ── RPC: Resumen de Ventas (Dashboard) ───────────────────────────────────────
-- Reemplaza GET /api/sales/summary?period=today|week|month
CREATE OR REPLACE FUNCTION fn_get_sales_summary(p_period TEXT DEFAULT 'today') RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_result RECORD;
    v_tz TEXT := 'America/Caracas';
BEGIN
    SELECT
        COALESCE(SUM(total_price), 0)  AS total_bs,
        COALESCE(SUM(quantity), 0)     AS units_sold,
        COUNT(*)                        AS transactions
    INTO v_result
    FROM sales
    WHERE refunded = FALSE
      AND CASE p_period
            WHEN 'week'  THEN (sale_date AT TIME ZONE v_tz)::DATE >= (NOW() AT TIME ZONE v_tz)::DATE - 6
            WHEN 'month' THEN TO_CHAR(sale_date AT TIME ZONE v_tz, 'YYYY-MM') = TO_CHAR(NOW() AT TIME ZONE v_tz, 'YYYY-MM')
            ELSE              (sale_date AT TIME ZONE v_tz)::DATE = (NOW() AT TIME ZONE v_tz)::DATE
          END;

    RETURN json_build_object(
        'total_bs',     v_result.total_bs,
        'units_sold',   v_result.units_sold,
        'transactions', v_result.transactions,
        'period',       p_period
    );
END; $$;

-- ── RPC: Carga Masiva de Partes (desde Excel parseado en browser) ─────────────
-- Reemplaza POST /api/parts/bulk-upload
-- p_rows: array JSON de objetos con los campos de parts
CREATE OR REPLACE FUNCTION fn_bulk_upsert_parts(p_rows JSON) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_row       JSON;
    v_key       TEXT;
    v_existing  RECORD;
    v_new_id    BIGINT;
    v_imported  INTEGER := 0;
    v_updated   INTEGER := 0;
    v_stock_old INTEGER;
    v_stock_new INTEGER;
    v_diff      INTEGER;
    v_cost      FLOAT8;
BEGIN
    FOR v_row IN SELECT * FROM json_array_elements(p_rows) LOOP
        v_key  := TRIM(LOWER(COALESCE(v_row->>'codigo_producto', '')));
        v_cost := COALESCE((v_row->>'cost_price')::FLOAT8, 0);
        v_stock_new := COALESCE((v_row->>'stock')::INTEGER, 0);

        SELECT id, stock INTO v_existing FROM parts WHERE LOWER(TRIM(codigo_producto)) = v_key LIMIT 1;

        IF FOUND THEN
            v_stock_old := v_existing.stock;
            UPDATE parts SET
                familia          = COALESCE(v_row->>'familia', familia),
                codigo           = COALESCE(v_row->>'codigo', codigo),
                name             = COALESCE(v_row->>'codigo_producto', name),
                marca            = COALESCE(v_row->>'marca', marca),
                mundial          = COALESCE(v_row->>'mundial', mundial),
                internal_measure = COALESCE((v_row->>'internal_measure')::FLOAT8, internal_measure),
                external_measure = COALESCE((v_row->>'external_measure')::FLOAT8, external_measure),
                height           = COALESCE((v_row->>'height')::FLOAT8, height),
                aplicacion       = COALESCE(v_row->>'aplicacion', aplicacion),
                description      = COALESCE(v_row->>'aplicacion', description),
                stock            = v_stock_new,
                flange_measure   = COALESCE((v_row->>'flange_measure')::FLOAT8, flange_measure),
                cost_price       = v_cost,
                tope             = COALESCE((v_row->>'tope')::FLOAT8, tope),
                pv_geli          = COALESCE(v_row->>'pv_geli', pv_geli)
            WHERE id = v_existing.id;

            v_diff := v_stock_new - v_stock_old;
            IF v_diff <> 0 THEN
                INSERT INTO stock_movements (part_id, type, quantity, price, balance, concept)
                VALUES (v_existing.id,
                        CASE WHEN v_diff > 0 THEN 'INGRESO_AJUSTE' ELSE 'EGRESO_AJUSTE' END,
                        ABS(v_diff), v_cost, v_stock_new,
                        'Actualización de stock vía Excel (Carga masiva)');
            END IF;
            v_updated := v_updated + 1;
        ELSE
            INSERT INTO parts (familia, codigo, codigo_producto, name, marca, mundial,
                               internal_measure, external_measure, height, description, aplicacion,
                               stock, flange_measure, cost_price, tope, pv_geli)
            VALUES (
                COALESCE(v_row->>'familia', ''),
                COALESCE(v_row->>'codigo', ''),
                COALESCE(v_row->>'codigo_producto', ''),
                COALESCE(v_row->>'codigo_producto', ''),
                COALESCE(v_row->>'marca', ''),
                COALESCE(v_row->>'mundial', ''),
                COALESCE((v_row->>'internal_measure')::FLOAT8, 0),
                COALESCE((v_row->>'external_measure')::FLOAT8, 0),
                COALESCE((v_row->>'height')::FLOAT8, 0),
                COALESCE(v_row->>'aplicacion', ''),
                COALESCE(v_row->>'aplicacion', ''),
                v_stock_new,
                COALESCE((v_row->>'flange_measure')::FLOAT8, 0),
                v_cost,
                COALESCE((v_row->>'tope')::FLOAT8, 0),
                COALESCE(v_row->>'pv_geli', '')
            ) RETURNING id INTO v_new_id;

            INSERT INTO stock_movements (part_id, type, quantity, price, balance, concept)
            VALUES (v_new_id, 'INGRESO_EXCEL', v_stock_new, v_cost, v_stock_new,
                    'Carga masiva desde Excel (' || v_stock_new || ' unidades iniciales)');

            v_imported := v_imported + 1;
        END IF;
    END LOOP;

    RETURN json_build_object('imported', v_imported, 'updated', v_updated);
END; $$;

-- ── RPC: Resetear Base de Datos ──────────────────────────────────────────────
-- Reemplaza POST /api/database/reset
CREATE OR REPLACE FUNCTION fn_reset_database(p_confirmation TEXT) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF p_confirmation <> 'BORRAR TODO' THEN
        RAISE EXCEPTION 'Código de confirmación incorrecto';
    END IF;

    DELETE FROM quotation_items;
    DELETE FROM quotations;
    DELETE FROM wholesale_items;
    DELETE FROM sales;
    DELETE FROM stock_movements;
    DELETE FROM wholesale_orders;
    DELETE FROM parts;

    -- Reset sequences
    ALTER SEQUENCE parts_id_seq RESTART WITH 1;
    ALTER SEQUENCE sales_id_seq RESTART WITH 1;
    ALTER SEQUENCE stock_movements_id_seq RESTART WITH 1;
    ALTER SEQUENCE wholesale_orders_id_seq RESTART WITH 1;
    ALTER SEQUENCE wholesale_items_id_seq RESTART WITH 1;
    ALTER SEQUENCE quotations_id_seq RESTART WITH 1;
    ALTER SEQUENCE quotation_items_id_seq RESTART WITH 1;

    RETURN json_build_object('message', 'Base de datos vaciada con éxito.');
END; $$;
```

- [ ] **Step 2: Ejecutar en Supabase SQL Editor**

Copiar el contenido de `002_rpc.sql` y ejecutarlo en Supabase → SQL Editor → Run.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_rpc.sql
git commit -m "feat: add PostgreSQL stored procedures for transactional operations"
```

---

## Task 4: Edge Function para generación de PDF

**Files:**
- Create: `supabase/functions/quotation-pdf/index.ts`

- [ ] **Step 1: Crear la estructura de la función**

```bash
mkdir -p supabase/functions/quotation-pdf
```

- [ ] **Step 2: Escribir la Edge Function**

Crear `supabase/functions/quotation-pdf/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const quoteId = url.searchParams.get('id');
    const tipo = url.searchParams.get('type') || 'cliente'; // 'cliente' | 'interno'

    if (!quoteId) {
      return new Response(JSON.stringify({ error: 'Falta id' }), { status: 400, headers: corsHeaders });
    }

    // Usar service role key para ignorar RLS desde la función
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Obtener cotización
    const { data: quote, error: qErr } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (qErr || !quote) {
      return new Response(JSON.stringify({ error: 'Cotización no encontrada' }), { status: 404, headers: corsHeaders });
    }

    // Obtener ítems con datos de las partes
    const { data: items, error: iErr } = await supabase
      .from('quotation_items')
      .select('*, parts(codigo_producto, codigo, name, internal_measure, external_measure, height, marca)')
      .eq('quotation_id', quoteId);

    if (iErr || !items) {
      return new Response(JSON.stringify({ error: 'Error obteniendo ítems' }), { status: 500, headers: corsHeaders });
    }

    // ── Generar PDF con pdf-lib ───────────────────────────────────────────────
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height: pageH } = page.getSize();
    const margin = 50;

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = pageH - margin;

    const drawText = (text: string, x: number, yPos: number, size = 10, bold = false, color = rgb(0, 0, 0)) => {
      page.drawText(String(text), {
        x, y: yPos, size,
        font: bold ? fontBold : fontReg,
        color,
      });
    };

    const drawLine = (yPos: number, color = rgb(0.8, 0.8, 0.8)) => {
      page.drawLine({ start: { x: margin, y: yPos }, end: { x: width - margin, y: yPos }, thickness: 0.5, color });
    };

    const fmtDate = (d: string) => {
      const dt = new Date(d);
      return dt.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Encabezado
    drawText('La casa de los retenes S&G', width / 2 - 130, y, 18, true);
    y -= 22;
    const subtitleText = tipo === 'interno' ? 'COTIZACION — USO INTERNO' : 'COTIZACION';
    const subtitleColor = tipo === 'interno' ? rgb(0.49, 0.23, 0.93) : rgb(0.33, 0.33, 0.33);
    drawText(subtitleText, width / 2 - 70, y, 12, false, subtitleColor);
    y -= 20;

    const qDate = new Date(quote.quote_date);
    const validUntil = new Date(qDate);
    validUntil.setDate(validUntil.getDate() + (quote.valid_days || 7));

    drawText(`Fecha de emision: ${fmtDate(quote.quote_date)}`, width - margin - 180, y, 9);
    y -= 13;
    drawText(`Valida hasta: ${fmtDate(validUntil.toISOString())}`, width - margin - 180, y, 9);
    y -= 18;

    drawText('Cliente: ', margin, y, 11, true);
    drawText(quote.cliente, margin + 55, y, 11);
    y -= 15;

    if (quote.notes) {
      drawText('Notas: ', margin, y, 10, true);
      drawText(quote.notes, margin + 45, y, 10);
      y -= 15;
    }

    y -= 5;
    drawLine(y);
    y -= 12;

    // Cabecera de tabla
    if (tipo === 'interno') {
      drawText('#',            margin,       y, 9, true);
      drawText('Cod.Producto', margin + 22,  y, 9, true);
      drawText('Medidas',      margin + 135, y, 9, true);
      drawText('Referencia',   margin + 238, y, 9, true);
      drawText('Cant',         margin + 318, y, 9, true);
      drawText('P.Unit Bs.',   margin + 360, y, 9, true);
      drawText('Subtotal Bs.', margin + 426, y, 9, true);
    } else {
      drawText('#',                          margin,       y, 9, true);
      drawText('Medidas (MI x ME x ALT)',    margin + 25,  y, 9, true);
      drawText('Cant',                       margin + 285, y, 9, true);
      drawText('P.Unit Bs.',                 margin + 330, y, 9, true);
      drawText('Subtotal Bs.',               margin + 422, y, 9, true);
    }

    y -= 4;
    drawLine(y, rgb(0.2, 0.2, 0.2));
    y -= 13;

    // Filas de ítems
    items.forEach((item: any, i: number) => {
      const part = item.parts || {};
      const measures = `${part.internal_measure ?? 0}x${part.external_measure ?? 0}x${part.height ?? 0}`;
      const sub = ((item.quantity ?? 0) * (item.unit_price ?? 0)).toFixed(2);

      if (i % 2 === 0) {
        page.drawRectangle({ x: margin, y: y - 3, width: width - 2 * margin, height: 14, color: rgb(0.97, 0.97, 0.97) });
      }

      if (tipo === 'interno') {
        drawText(String(i + 1),          margin,       y, 9);
        drawText(part.codigo_producto ?? '-', margin + 22,  y, 9);
        drawText(measures,               margin + 135, y, 9);
        drawText(part.codigo ?? '-',     margin + 238, y, 9);
        drawText(String(item.quantity),  margin + 318, y, 9);
        drawText(item.unit_price?.toFixed(2) ?? '0', margin + 360, y, 9);
        drawText(sub,                    margin + 426, y, 9);
      } else {
        const measuresLong = `${part.internal_measure ?? 0} x ${part.external_measure ?? 0} x ${part.height ?? 0}`;
        drawText(String(i + 1),          margin,       y, 9);
        drawText(measuresLong,           margin + 25,  y, 9);
        drawText(String(item.quantity),  margin + 285, y, 9);
        drawText(item.unit_price?.toFixed(2) ?? '0', margin + 330, y, 9);
        drawText(sub,                    margin + 422, y, 9);
      }

      y -= 16;
    });

    y -= 5;
    drawLine(y, rgb(0.2, 0.2, 0.2));
    y -= 18;
    drawText(`TOTAL: Bs. ${(quote.total ?? 0).toFixed(2)}`, width - margin - 130, y, 13, true);

    y -= 50;
    drawText(`Esta cotizacion es valida por ${quote.valid_days || 7} dias desde su emision.`, width / 2 - 130, y, 8, false, rgb(0.53, 0.53, 0.53));
    y -= 12;
    drawText('La casa de los retenes S&G', width / 2 - 80, y, 8, false, rgb(0.53, 0.53, 0.53));

    const pdfBytes = await pdfDoc.save();
    const suffix = tipo === 'interno' ? '-interno' : '-cliente';

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cotizacion-${quoteId}${suffix}.pdf"`,
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 3: Desplegar la Edge Function**

```bash
supabase functions deploy quotation-pdf --project-ref <TU_PROJECT_REF>
```

El `<TU_PROJECT_REF>` está en el URL del dashboard: `https://supabase.com/dashboard/project/<PROJECT_REF>`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/
git commit -m "feat: add Supabase Edge Function for quotation PDF generation"
```

---

## Task 5: Frontend — Cliente Supabase + api.js

**Files:**
- Create: `frontend/src/lib/supabase.js`
- Create: `frontend/src/lib/api.js`
- Create: `frontend/.env.local`
- Modify: `frontend/vite.config.js`

- [ ] **Step 1: Instalar dependencias**

```bash
cd frontend
npm install @supabase/supabase-js xlsx
```

- [ ] **Step 2: Crear archivo de variables de entorno**

Crear `frontend/.env.local` (reemplazar con tus valores reales de Supabase → Settings → API):

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- [ ] **Step 3: Crear el cliente Supabase**

Crear `frontend/src/lib/supabase.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 4: Crear api.js (reemplaza todos los fetch a Express)**

Crear `frontend/src/lib/api.js`:

```javascript
import { supabase } from './supabase';
import * as XLSX from 'xlsx';

const TOLERANCE = 0.5;

// ── PARTES ────────────────────────────────────────────────────────────────────
export async function getParts({ search, internal, external, height } = {}) {
    let query = supabase.from('parts').select('*');

    if (search) {
        query = query.or(
            `name.ilike.%${search}%,codigo.ilike.%${search}%,codigo_producto.ilike.%${search}%,internal_measure.ilike.%${search}%,external_measure.ilike.%${search}%,aplicacion.ilike.%${search}%`
        );
    }
    if (internal) {
        const v = parseFloat(internal);
        query = query.gte('internal_measure', v - TOLERANCE).lte('internal_measure', v + TOLERANCE);
    }
    if (external) {
        const v = parseFloat(external);
        query = query.gte('external_measure', v - TOLERANCE).lte('external_measure', v + TOLERANCE);
    }
    if (height) {
        const v = parseFloat(height);
        query = query.gte('height', v - TOLERANCE).lte('height', v + TOLERANCE);
    }

    query = query.order('internal_measure').order('external_measure').order('height');

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function getPartById(id) {
    const { data, error } = await supabase.from('parts').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function createPart(body) {
    const { aplicacion, description, ...rest } = body;
    const finalAplicacion = aplicacion || description || '';
    const { data, error } = await supabase.from('parts').insert({
        ...rest,
        aplicacion: finalAplicacion,
        description: finalAplicacion,
        name: body.codigo_producto || '',
    }).select().single();
    if (error) throw new Error(error.message);

    if ((parseInt(body.stock) || 0) > 0) {
        await supabase.from('stock_movements').insert({
            part_id: data.id,
            type: 'REGISTRO_NUEVO',
            quantity: parseInt(body.stock),
            price: parseFloat(body.cost_price) || 0,
            balance: parseInt(body.stock),
            concept: `Registro manual de producto (${body.stock} unidades iniciales)`,
        });
    }
    return { message: 'success', data };
}

export async function updatePart(id, body) {
    const { aplicacion, description, ...rest } = body;
    const finalAplicacion = aplicacion || description || undefined;
    const { data, error } = await supabase.from('parts').update({
        ...rest,
        ...(finalAplicacion && { aplicacion: finalAplicacion, description: finalAplicacion }),
        ...(body.codigo_producto && { name: body.codigo_producto }),
    }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function deletePart(id) {
    await supabase.from('stock_movements').delete().eq('part_id', id);
    await supabase.from('sales').delete().eq('part_id', id);
    const { error } = await supabase.from('parts').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { message: 'deleted' };
}

export async function restock(partId, quantity) {
    const { data, error } = await supabase.rpc('fn_create_restock', {
        p_part_id: partId,
        p_quantity: quantity,
    });
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export function exportPartsExcel(parts) {
    const excelData = parts.map(p => ({
        'FAMILIA': p.familia || '',
        'CODIGO_PRODUCT': p.codigo_producto || p.name || '',
        'MARCA': p.marca || '',
        'MUNDIAL': p.mundial || '',
        'PRECIO BAS': p.cost_price || 0,
        'PV_GELI': p.pv_geli || '',
        'STO': p.stock || 0,
        'MI': p.internal_measure,
        'ME': p.external_measure,
        'ALT': p.height,
        'PES': p.flange_measure || 0,
        'TOP': p.tope || 0,
        'APLICACION': p.aplicacion || '',
        'CODIGO': p.codigo || '',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'productos.xlsx');
}

export async function bulkUploadParts(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(e.target.result, { type: 'array' });
                const ws = workbook.Sheets[workbook.SheetNames[0]];
                const rawRows = XLSX.utils.sheet_to_json(ws);

                const rows = rawRows.map(row => ({
                    familia:          row['FAMILIA'] || row['Familia'] || '',
                    codigo_producto:  row['CODIGO_PRODUCT'] || row['CODIGO_PRODUC'] || '',
                    marca:            row['MARCA'] || row['Marca'] || '',
                    mundial:          row['MUNDIAL'] || row['Mundial'] || '',
                    cost_price:       parseFloat(row['PRECIO BAS'] || row['PRECIO_BAS'] || 0) || 0,
                    pv_geli:          row['PV_GELIPE'] || row['PV GELIPE'] || row['PV_GELI'] || '',
                    stock:            parseInt(row['STO'] || row['Stock'] || 0) || 0,
                    internal_measure: parseFloat(row['MI'] || row['Interna'] || 0) || 0,
                    external_measure: parseFloat(row['ME'] || row['Externa'] || 0) || 0,
                    height:           parseFloat(row['ALT'] || row['Altura'] || 0) || 0,
                    flange_measure:   parseFloat(row['PES'] || row['PE'] || 0) || 0,
                    tope:             parseFloat(row['TOP'] || row['Tope'] || 0) || 0,
                    aplicacion:       row['APLICACION'] || row['Aplicación'] || '',
                    codigo:           row['CODIGO'] || row['Codigo'] || '',
                })).filter(r => r.codigo_producto || r.codigo);

                const { data, error } = await supabase.rpc('fn_bulk_upsert_parts', { p_rows: rows });
                if (error) return reject(new Error(error.message));
                resolve({ message: 'success', imported: data.imported, updated: data.updated });
            } catch (err) {
                reject(err);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

// ── KARDEX ────────────────────────────────────────────────────────────────────
export async function getKardex(partId) {
    const { data, error } = await supabase
        .from('stock_movements')
        .select('*, parts(codigo_producto, codigo, name)')
        .eq('part_id', partId)
        .order('created_at');
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

// ── VENTAS ────────────────────────────────────────────────────────────────────
export async function getSales({ date, startDate, endDate } = {}) {
    let query = supabase
        .from('sales')
        .select('*, parts(name, codigo, codigo_producto, aplicacion)')
        .order('sale_date');

    const tz = 'America/Caracas';
    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });

    if (date === 'today' || !date && !startDate && !endDate) {
        query = query.gte('sale_date', today).lt('sale_date', today + 'T23:59:59.999Z');
    } else if (date) {
        query = query.gte('sale_date', date).lt('sale_date', date + 'T23:59:59.999Z');
    } else {
        if (startDate) query = query.gte('sale_date', startDate);
        if (endDate)   query = query.lte('sale_date', endDate + 'T23:59:59.999Z');
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const flattened = (data || []).map(s => ({
        ...s,
        part_name: s.parts?.name,
        codigo: s.parts?.codigo,
        codigo_producto: s.parts?.codigo_producto,
        aplicacion: s.parts?.aplicacion,
    }));
    return { message: 'success', data: flattened };
}

export async function getSalesSummary(period = 'today') {
    const { data, error } = await supabase.rpc('fn_get_sales_summary', { p_period: period });
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function createSale({ part_id, quantity, unit_price, invoice_type }) {
    const { data, error } = await supabase.rpc('fn_create_sale', {
        p_part_id:      part_id,
        p_quantity:     quantity,
        p_unit_price:   parseFloat(unit_price) || 0,
        p_invoice_type: invoice_type || 'SIN_FACTURA',
    });
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function returnSale(saleId) {
    const { data, error } = await supabase.rpc('fn_return_sale', { p_sale_id: saleId });
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

// ── MAYORISTA ─────────────────────────────────────────────────────────────────
export async function getWholesaleOrders({ cliente } = {}) {
    let query = supabase.from('wholesale_orders').select('*').order('order_date');
    if (cliente) query = query.ilike('cliente', `%${cliente}%`);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function getWholesaleOrder(id) {
    const { data: order, error: oErr } = await supabase.from('wholesale_orders').select('*').eq('id', id).single();
    if (oErr) throw new Error(oErr.message);
    const { data: items, error: iErr } = await supabase
        .from('wholesale_items')
        .select('*, parts(codigo_producto, codigo, name, internal_measure, external_measure, height)')
        .eq('order_id', id);
    if (iErr) throw new Error(iErr.message);
    const flatItems = (items || []).map(i => ({ ...i, ...i.parts }));
    return { message: 'success', data: { ...order, items: flatItems } };
}

export async function getPriceHint(partId, cliente) {
    if (!cliente) return { message: 'success', data: null };
    const { data, error } = await supabase
        .from('wholesale_items')
        .select('unit_price, wholesale_orders(order_date, cliente, status)')
        .eq('part_id', partId)
        .order('wholesale_orders(order_date)', { ascending: false })
        .limit(1);
    if (error) return { message: 'success', data: null };
    const match = (data || []).find(i => i.wholesale_orders?.cliente?.toLowerCase().includes(cliente.toLowerCase()) && i.wholesale_orders?.status === 'active');
    return { message: 'success', data: match ? { unit_price: match.unit_price } : null };
}

export async function createWholesaleOrder({ cliente, items, invoice_type, notes }) {
    const { data, error } = await supabase.rpc('fn_create_wholesale_order', {
        p_cliente:      cliente,
        p_items:        items,
        p_invoice_type: invoice_type || 'SIN_FACTURA',
        p_notes:        notes || '',
    });
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function returnWholesaleOrder(orderId) {
    const { data, error } = await supabase.rpc('fn_return_wholesale_order', { p_order_id: orderId });
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

// ── COTIZACIONES ──────────────────────────────────────────────────────────────
export async function getQuotations() {
    const { data, error } = await supabase.from('quotations').select('*').order('quote_date', { ascending: false });
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function getQuotation(id) {
    const { data: quote, error: qErr } = await supabase.from('quotations').select('*').eq('id', id).single();
    if (qErr) throw new Error(qErr.message);
    const { data: items, error: iErr } = await supabase
        .from('quotation_items')
        .select('*, parts(codigo_producto, codigo, name, internal_measure, external_measure, height, marca)')
        .eq('quotation_id', id);
    if (iErr) throw new Error(iErr.message);
    const flatItems = (items || []).map(i => ({ ...i, ...i.parts }));
    return { message: 'success', data: { ...quote, items: flatItems } };
}

export async function createQuotation({ cliente, items, invoice_type, notes, valid_days }) {
    const subtotal = items.reduce((acc, i) => acc + parseFloat(i.unit_price) * parseInt(i.quantity), 0);
    const { data: quote, error } = await supabase.from('quotations').insert({
        cliente: cliente.trim(),
        subtotal,
        total: subtotal,
        invoice_type: invoice_type || 'COTIZACION',
        notes: notes || '',
        valid_days: valid_days || 7,
    }).select().single();
    if (error) throw new Error(error.message);

    const itemRows = items.map(i => ({
        quotation_id: quote.id,
        part_id:      i.part_id,
        quantity:     parseInt(i.quantity),
        unit_price:   parseFloat(i.unit_price),
        total_price:  parseInt(i.quantity) * parseFloat(i.unit_price),
    }));
    const { error: iErr } = await supabase.from('quotation_items').insert(itemRows);
    if (iErr) throw new Error(iErr.message);
    return { message: 'success', data: { id: quote.id, cliente, subtotal, total: subtotal } };
}

export async function confirmQuotation(id) {
    const { data, error } = await supabase.rpc('fn_confirm_quotation', { p_quote_id: id });
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function cancelQuotation(id) {
    const { data, error } = await supabase
        .from('quotations')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('status', 'pending')
        .select();
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('No se pudo cancelar. Ya está confirmada o cancelada.');
    return { message: 'success' };
}

export function downloadQuotationPdf(id, type = 'cliente') {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: { session } } = supabase.auth.getSession();
    // Abrir en nueva tab — el browser descarga el PDF
    const token = localStorage.getItem('sb-access-token') || '';
    window.open(`${supabaseUrl}/functions/v1/quotation-pdf?id=${id}&type=${type}`, '_blank');
}

// ── BASE DE DATOS ─────────────────────────────────────────────────────────────
export async function resetDatabase(confirmation) {
    const { data, error } = await supabase.rpc('fn_reset_database', { p_confirmation: confirmation });
    if (error) throw new Error(error.message);
    return data;
}
```

- [ ] **Step 5: Eliminar el proxy de vite.config.js**

Modificar `frontend/vite.config.js` — eliminar el bloque `server.proxy` ya que no hay backend Express:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
})
```

- [ ] **Step 6: Agregar .env.local a .gitignore**

Verificar que `.gitignore` tenga `.env.local`:

```bash
echo ".env.local" >> .gitignore
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/supabase.js frontend/src/lib/api.js frontend/vite.config.js
git commit -m "feat: add Supabase client and api.js abstraction layer"
```

---

## Task 6: Frontend — Actualizar Auth (Login + App)

**Files:**
- Modify: `frontend/src/components/Login.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Actualizar Login.jsx**

Reemplazar el contenido de `frontend/src/components/Login.jsx`:

```jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';

export default function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            toast.error('Credenciales incorrectas');
        } else {
            toast.success('¡Bienvenido!');
            onLogin();
        }
        setLoading(false);
    };

    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div className="card" style={{
                width: '100%', maxWidth: '400px', padding: '2.5rem',
                display: 'flex', flexDirection: 'column', gap: '1.5rem',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ fontSize: '1.8rem', color: '#f8fafc', marginBottom: '0.5rem', marginTop: 0 }}>La Casa de los Retenes S&G</h1>
                    <p style={{ color: '#94a3b8', margin: 0 }}>Inicia sesión para continuar</p>
                </div>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Email</label>
                        <input
                            type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="admin@retenes.app" required
                            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #334155', backgroundColor: 'rgba(15,23,42,0.5)', color: '#f8fafc', fontSize: '1rem', boxSizing: 'border-box' }}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Contraseña</label>
                        <input
                            type="password" value={password} onChange={e => setPassword(e.target.value)}
                            placeholder="Contraseña" required
                            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #334155', backgroundColor: 'rgba(15,23,42,0.5)', color: '#f8fafc', fontSize: '1rem', boxSizing: 'border-box' }}
                        />
                    </div>
                    <button type="submit" className="primary" disabled={loading}
                        style={{ marginTop: '0.5rem', padding: '0.85rem', fontSize: '1rem', fontWeight: 'bold', backgroundColor: '#3b82f6' }}>
                        {loading ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Actualizar App.jsx — reemplazar auth de localStorage a Supabase**

En `frontend/src/App.jsx`, cambiar las líneas de autenticación:

Reemplazar:
```jsx
const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('auth_token') === 'pochita';
});
```

Con:
```jsx
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [authLoading, setAuthLoading] = useState(true);

useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
        setIsAuthenticated(!!session);
        setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsAuthenticated(!!session);
    });
    return () => subscription.unsubscribe();
}, []);
```

Agregar el import al inicio:
```jsx
import { supabase } from './lib/supabase';
```

Reemplazar el handler de login:
```jsx
const handleLogin = () => {
    setIsAuthenticated(true);
};
```

Reemplazar el botón de cerrar sesión (en el `<header>`):
```jsx
onClick={() => {
    supabase.auth.signOut();
    setIsAuthenticated(false);
}}
```

Reemplazar el bloque condicional de render antes del return principal:
```jsx
if (authLoading) return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', color:'#94a3b8' }}>Cargando...</div>;
if (!isAuthenticated) return <Login onLogin={handleLogin} />;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Login.jsx frontend/src/App.jsx
git commit -m "feat: replace hardcoded auth with Supabase Auth"
```

---

## Task 7: Actualizar componentes para usar api.js

Para cada componente, el patrón es el mismo: reemplazar `fetch('/api/...')` con la función correspondiente de `api.js`. A continuación las modificaciones necesarias por componente.

**Files:**
- Modify: `frontend/src/components/PartList.jsx`
- Modify: `frontend/src/components/PartForm.jsx`
- Modify: `frontend/src/components/SalesHistory.jsx`
- Modify: `frontend/src/components/SalesModal.jsx`
- Modify: `frontend/src/components/Dashboard.jsx`
- Modify: `frontend/src/components/OrdersList.jsx`
- Modify: `frontend/src/components/WholesaleCart.jsx`
- Modify: `frontend/src/components/WholesaleHistory.jsx`
- Modify: `frontend/src/components/QuotationsList.jsx`
- Modify: `frontend/src/components/KardexModal.jsx`
- Modify: `frontend/src/components/AdjustStockModal.jsx`
- Modify: `frontend/src/components/EditPartModal.jsx`
- Modify: `frontend/src/components/DatabaseMaintenance.jsx`
- Modify: `frontend/src/components/BulkUpload.jsx`

**Patrón de cambio en CADA componente:**

1. Agregar import al inicio:
```jsx
import * as api from '../lib/api';
```

2. Reemplazar cada `fetch('/api/...')`:

| Antes (fetch) | Después (api) |
|---------------|---------------|
| `fetch('/api/parts')` | `api.getParts(params)` |
| `fetch('/api/parts', {method:'POST', body: JSON.stringify(data)})` | `api.createPart(data)` |
| `fetch('/api/parts/'+id, {method:'PUT', body: JSON.stringify(data)})` | `api.updatePart(id, data)` |
| `fetch('/api/parts/'+id, {method:'DELETE'})` | `api.deletePart(id)` |
| `fetch('/api/parts/'+id+'/restock', {method:'POST', body: JSON.stringify({quantity})})` | `api.restock(id, quantity)` |
| `fetch('/api/parts/export')` | `api.exportPartsExcel(parts)` — client-side, no fetch |
| `fetch('/api/kardex/'+partId)` | `api.getKardex(partId)` |
| `fetch('/api/sales')` | `api.getSales(filters)` |
| `fetch('/api/sales/summary?period='+p)` | `api.getSalesSummary(p)` |
| `fetch('/api/sales', {method:'POST', body: JSON.stringify(data)})` | `api.createSale(data)` |
| `fetch('/api/sales/'+id+'/return', {method:'POST'})` | `api.returnSale(id)` |
| `fetch('/api/wholesale')` | `api.getWholesaleOrders(filters)` |
| `fetch('/api/wholesale/'+id)` | `api.getWholesaleOrder(id)` |
| `fetch('/api/wholesale/price-hint/'+pid+'?cliente='+c)` | `api.getPriceHint(pid, c)` |
| `fetch('/api/wholesale', {method:'POST', body: JSON.stringify(data)})` | `api.createWholesaleOrder(data)` |
| `fetch('/api/wholesale/'+id+'/return', {method:'POST'})` | `api.returnWholesaleOrder(id)` |
| `fetch('/api/quotations')` | `api.getQuotations()` |
| `fetch('/api/quotations/'+id)` | `api.getQuotation(id)` |
| `fetch('/api/quotations', {method:'POST', body: JSON.stringify(data)})` | `api.createQuotation(data)` |
| `fetch('/api/quotations/'+id+'/confirm', {method:'POST'})` | `api.confirmQuotation(id)` |
| `fetch('/api/quotations/'+id+'/cancel', {method:'POST'})` | `api.cancelQuotation(id)` |
| `fetch('/api/quotations/'+id+'/pdf?type=...')` | `api.downloadQuotationPdf(id, type)` |
| `fetch('/api/database/reset', {method:'POST', body: JSON.stringify({confirmation})})` | `api.resetDatabase(confirmation)` |

3. Adaptar el manejo de respuestas. La mayoría de funciones de api.js ya retornan `{ message, data }` igual al backend anterior. Los errores se lanzan como excepciones, así que reemplazar:
```jsx
const data = await response.json();
if (!response.ok) { setError(data.error); return; }
```
con:
```jsx
try {
    const data = await api.someFunction(...);
    // usar data
} catch (err) {
    setError(err.message);
}
```

- [ ] **Step 1: Actualizar BulkUpload.jsx — cambio mayor (parseo client-side)**

Reemplazar el método `handleUpload` en `BulkUpload.jsx`:

```jsx
import * as api from '../lib/api';

const handleUpload = async () => {
    if (!file) { setMessage('Por favor selecciona un archivo Excel'); return; }
    setUploading(true);
    setMessage('');
    try {
        const result = await api.bulkUploadParts(file);
        setMessage(`✅ Carga completada: ${result.imported} nuevos, ${result.updated || 0} actualizados.`);
        setFile(null);
        onUploadComplete();
    } catch (err) {
        setMessage(`❌ Error: ${err.message}`);
    } finally {
        setUploading(false);
    }
};
```

- [ ] **Step 2: Actualizar PartList.jsx**

Reemplazar `fetch('/api/parts')` con `api.getParts(params)` y `fetch('/api/parts/export')` con `api.exportPartsExcel(parts)` (exportar los parts que ya están en el estado local).

Agregar import: `import * as api from '../lib/api';`

- [ ] **Step 3: Actualizar Dashboard.jsx**

Reemplazar:
```jsx
fetch(`/api/sales/summary?period=${period}`)
```
con:
```jsx
api.getSalesSummary(period).then(d => { if (d.message === 'success') setSalesSummary(d.data); })
```

Reemplazar:
```jsx
fetch('/api/parts')
```
con:
```jsx
api.getParts().then(payload => { const parts = payload.data || payload; ... })
```

- [ ] **Step 4: Actualizar los demás componentes**

Aplicar el patrón de la tabla de arriba a:
- `PartForm.jsx` → `api.createPart(data)`
- `SalesHistory.jsx` → `api.getSales(filters)`, `api.returnSale(id)`
- `SalesModal.jsx` → `api.createSale(data)`
- `OrdersList.jsx` → `api.getSales(filters)`
- `WholesaleCart.jsx` → `api.createWholesaleOrder(data)`, `api.createQuotation(data)`, `api.getPriceHint(id, cliente)`
- `WholesaleHistory.jsx` → `api.getWholesaleOrders()`, `api.getWholesaleOrder(id)`, `api.returnWholesaleOrder(id)`
- `QuotationsList.jsx` → `api.getQuotations()`, `api.getQuotation(id)`, `api.confirmQuotation(id)`, `api.cancelQuotation(id)`, `api.downloadQuotationPdf(id, type)`
- `KardexModal.jsx` → `api.getKardex(partId)`
- `AdjustStockModal.jsx` → `api.restock(partId, quantity)`
- `EditPartModal.jsx` → `api.updatePart(id, data)`
- `DatabaseMaintenance.jsx` → `api.resetDatabase(confirmation)`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: migrate all components from Express fetch to Supabase api.js"
```

---

## Task 8: Migración de datos SQLite → Supabase

**Files:**
- Create: `scripts/migrate-sqlite-to-supabase.js`

- [ ] **Step 1: Crear el script de migración**

Crear `scripts/migrate-sqlite-to-supabase.js`:

```javascript
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Instalar: npm install @supabase/supabase-js sqlite3 dotenv
require('dotenv').config({ path: path.join(__dirname, '../frontend/.env.local') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en frontend/.env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Autenticar primero
async function authenticate() {
    const email = process.argv[2];
    const password = process.argv[3];
    if (!email || !password) {
        console.error('Uso: node migrate-sqlite-to-supabase.js <email> <password>');
        process.exit(1);
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { console.error('Auth falló:', error.message); process.exit(1); }
    console.log('✅ Autenticado en Supabase');
}

async function migrate() {
    await authenticate();

    const dbPath = path.join(__dirname, '../backend/parts.db');
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

    const query = (sql, params = []) => new Promise((resolve, reject) =>
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
    );

    const tables = ['parts', 'sales', 'stock_movements', 'wholesale_orders', 'wholesale_items', 'quotations', 'quotation_items'];
    const counts = {};
    for (const t of tables) {
        const rows = await query(`SELECT COUNT(*) as c FROM ${t}`);
        counts[t] = rows[0].c;
    }
    console.log('📊 Datos en SQLite:', counts);

    const BATCH = 200;

    // Migrar parts
    console.log('\n📦 Migrando parts...');
    const parts = await query('SELECT * FROM parts ORDER BY id');
    const idMap = {}; // oldId → newId
    for (let i = 0; i < parts.length; i += BATCH) {
        const batch = parts.slice(i, i + BATCH).map(p => ({
            name: p.name || '',
            internal_measure: p.internal_measure || 0,
            external_measure: p.external_measure || 0,
            height: p.height || 0,
            description: p.description || '',
            stock: p.stock || 0,
            flange_measure: p.flange_measure || 0,
            familia: p.familia || '',
            codigo: p.codigo || '',
            codigo_producto: p.codigo_producto || '',
            marca: p.marca || '',
            mundial: p.mundial || '',
            aplicacion: p.aplicacion || '',
            cost_price: p.cost_price || 0,
            tope: p.tope || 0,
            pv_geli: p.pv_geli || '',
            created_at: p.created_at || new Date().toISOString(),
        }));
        const { data, error } = await supabase.from('parts').insert(batch).select('id');
        if (error) { console.error('Error parts:', error.message); continue; }
        data.forEach((row, j) => { idMap[parts[i + j].id] = row.id; });
        process.stdout.write(`  ${Math.min(i + BATCH, parts.length)}/${parts.length}\r`);
    }
    console.log(`\n✅ ${parts.length} partes migradas`);

    // Migrar stock_movements
    console.log('📦 Migrando stock_movements...');
    const movements = await query('SELECT * FROM stock_movements ORDER BY id');
    for (let i = 0; i < movements.length; i += BATCH) {
        const batch = movements.slice(i, i + BATCH)
            .filter(m => idMap[m.part_id])
            .map(m => ({
                part_id: idMap[m.part_id],
                type: m.type,
                quantity: m.quantity,
                price: m.price || 0,
                balance: m.balance,
                concept: m.concept || '',
                created_at: m.created_at || new Date().toISOString(),
            }));
        if (batch.length > 0) {
            const { error } = await supabase.from('stock_movements').insert(batch);
            if (error) console.error('Error movements:', error.message);
        }
        process.stdout.write(`  ${Math.min(i + BATCH, movements.length)}/${movements.length}\r`);
    }
    console.log(`\n✅ ${movements.length} movimientos migrados`);

    // Migrar wholesale_orders (con nuevo id mapping)
    console.log('📦 Migrando wholesale_orders...');
    const orders = await query('SELECT * FROM wholesale_orders ORDER BY id');
    const orderIdMap = {};
    for (let i = 0; i < orders.length; i += BATCH) {
        const batch = orders.slice(i, i + BATCH).map(o => ({
            cliente: o.cliente,
            subtotal: o.subtotal || 0,
            total: o.total || 0,
            invoice_type: o.invoice_type || 'SIN_FACTURA',
            notes: o.notes || '',
            status: o.status || 'active',
            order_date: o.order_date || new Date().toISOString(),
        }));
        const { data, error } = await supabase.from('wholesale_orders').insert(batch).select('id');
        if (error) { console.error('Error wholesale_orders:', error.message); continue; }
        data.forEach((row, j) => { orderIdMap[orders[i + j].id] = row.id; });
    }
    console.log(`✅ ${orders.length} pedidos mayoristas migrados`);

    // Migrar wholesale_items
    console.log('📦 Migrando wholesale_items...');
    const wItems = await query('SELECT * FROM wholesale_items ORDER BY id');
    for (let i = 0; i < wItems.length; i += BATCH) {
        const batch = wItems.slice(i, i + BATCH)
            .filter(wi => orderIdMap[wi.order_id] && idMap[wi.part_id])
            .map(wi => ({
                order_id: orderIdMap[wi.order_id],
                part_id: idMap[wi.part_id],
                quantity: wi.quantity,
                unit_price: wi.unit_price,
                total_price: wi.total_price,
            }));
        if (batch.length > 0) {
            const { error } = await supabase.from('wholesale_items').insert(batch);
            if (error) console.error('Error wholesale_items:', error.message);
        }
    }
    console.log(`✅ ${wItems.length} ítems mayoristas migrados`);

    // Migrar sales (con referencias a orders y parts actualizadas)
    console.log('📦 Migrando sales...');
    const sales = await query('SELECT * FROM sales ORDER BY id');
    for (let i = 0; i < sales.length; i += BATCH) {
        const batch = sales.slice(i, i + BATCH)
            .filter(s => idMap[s.part_id])
            .map(s => ({
                part_id: idMap[s.part_id],
                quantity: s.quantity,
                unit_price: s.unit_price || 0,
                total_price: s.total_price || 0,
                invoice_type: s.invoice_type || 'SIN_FACTURA',
                sale_date: s.sale_date || new Date().toISOString(),
                refunded: !!s.refunded,
                wholesale_order_id: s.wholesale_order_id ? (orderIdMap[s.wholesale_order_id] || null) : null,
            }));
        if (batch.length > 0) {
            const { error } = await supabase.from('sales').insert(batch);
            if (error) console.error('Error sales:', error.message);
        }
        process.stdout.write(`  ${Math.min(i + BATCH, sales.length)}/${sales.length}\r`);
    }
    console.log(`\n✅ ${sales.length} ventas migradas`);

    // Migrar quotations
    console.log('📦 Migrando quotations...');
    const quotes = await query('SELECT * FROM quotations ORDER BY id');
    const quoteIdMap = {};
    for (let i = 0; i < quotes.length; i += BATCH) {
        const batch = quotes.slice(i, i + BATCH).map(q => ({
            cliente: q.cliente,
            subtotal: q.subtotal || 0,
            total: q.total || 0,
            invoice_type: q.invoice_type || 'COTIZACION',
            notes: q.notes || '',
            status: q.status || 'pending',
            valid_days: q.valid_days || 7,
            wholesale_order_id: q.wholesale_order_id ? (orderIdMap[q.wholesale_order_id] || null) : null,
            quote_date: q.quote_date || new Date().toISOString(),
        }));
        const { data, error } = await supabase.from('quotations').insert(batch).select('id');
        if (error) { console.error('Error quotations:', error.message); continue; }
        data.forEach((row, j) => { quoteIdMap[quotes[i + j].id] = row.id; });
    }
    console.log(`✅ ${quotes.length} cotizaciones migradas`);

    // Migrar quotation_items
    console.log('📦 Migrando quotation_items...');
    const qItems = await query('SELECT * FROM quotation_items ORDER BY id');
    for (let i = 0; i < qItems.length; i += BATCH) {
        const batch = qItems.slice(i, i + BATCH)
            .filter(qi => quoteIdMap[qi.quotation_id] && idMap[qi.part_id])
            .map(qi => ({
                quotation_id: quoteIdMap[qi.quotation_id],
                part_id: idMap[qi.part_id],
                quantity: qi.quantity,
                unit_price: qi.unit_price,
                total_price: qi.total_price,
            }));
        if (batch.length > 0) {
            const { error } = await supabase.from('quotation_items').insert(batch);
            if (error) console.error('Error quotation_items:', error.message);
        }
    }
    console.log(`✅ ${qItems.length} ítems de cotizaciones migrados`);

    db.close();
    console.log('\n🎉 Migración completada exitosamente!');
}

migrate().catch(err => { console.error('Fatal:', err); process.exit(1); });
```

- [ ] **Step 2: Instalar dependencias del script**

```bash
npm install @supabase/supabase-js sqlite3 dotenv
```

(En el directorio raíz del proyecto, no en frontend/)

- [ ] **Step 3: Ejecutar la migración**

```bash
node scripts/migrate-sqlite-to-supabase.js admin@retenes.app pochita2024
```

Verificar en Supabase → Table Editor que los datos aparecen correctamente.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-sqlite-to-supabase.js package.json package-lock.json
git commit -m "feat: add SQLite to Supabase data migration script"
```

---

## Task 9: Deploy en Vercel

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Crear vercel.json**

Crear `vercel.json` en la raíz del proyecto:

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 2: Configurar variables de entorno en Vercel**

```bash
cd frontend && vercel env add VITE_SUPABASE_URL production
# Pegar el URL de Supabase cuando pregunte

vercel env add VITE_SUPABASE_ANON_KEY production
# Pegar el anon key cuando pregunte
```

- [ ] **Step 3: Desplegar**

Desde la raíz del proyecto:
```bash
vercel deploy --prod
```

Vercel retornará una URL pública como `https://felipillo-xxx.vercel.app`.

- [ ] **Step 4: Verificar el deploy**

1. Abrir la URL de Vercel
2. Hacer login con `admin@retenes.app` / `pochita2024`
3. Verificar que el catálogo de productos carga
4. Verificar que una búsqueda funciona
5. Verificar que el dashboard muestra estadísticas
6. Crear una venta de prueba y confirmar que el stock se descuenta
7. Generar PDF de una cotización

- [ ] **Step 5: Commit**

```bash
git add vercel.json
git commit -m "feat: add Vercel deployment config"
```

---

## Task 10: Configurar URL del PDF en Edge Function

La Edge Function del PDF necesita el JWT del usuario para funcionar con RLS. Actualizar `downloadQuotationPdf` en `api.js`:

- [ ] **Step 1: Actualizar downloadQuotationPdf en api.js**

Reemplazar la función `downloadQuotationPdf` en `frontend/src/lib/api.js`:

```javascript
export async function downloadQuotationPdf(id, type = 'cliente') {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';

    // Fetch con Authorization header para que la Edge Function use el JWT
    const response = await fetch(
        `${supabaseUrl}/functions/v1/quotation-pdf?id=${id}&type=${type}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error generando PDF');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cotizacion-${id}-${type}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Commit y redeploy**

```bash
git add frontend/src/lib/api.js
git commit -m "fix: pass JWT to Edge Function for PDF generation"
vercel deploy --prod
```

---

## Resumen de la arquitectura final

```
Usuario (browser)
    │
    ▼
Vercel (frontend React/Vite)
    │
    ├─── Supabase PostgREST (CRUD simple: parts, quotations, etc.)
    ├─── Supabase Auth (login/logout)
    ├─── Supabase RPC (ventas, restock, wholesale, bulk upload, reset)
    └─── Supabase Edge Function (PDF de cotizaciones)
         └─── Supabase PostgreSQL (base de datos)
```

**Costo total: $0/mes** en los planes gratuitos de Vercel y Supabase para el volumen de esta aplicación.
