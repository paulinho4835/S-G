-- ── RPC: Habilitar RLS y crear políticas ─────────────────────────────────────
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE wholesale_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE wholesale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access" ON parts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON wholesale_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON wholesale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON quotations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON quotation_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── RPC: Crear Venta ─────────────────────────────────────────────────────────
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
CREATE OR REPLACE FUNCTION fn_create_wholesale_order(
    p_cliente      TEXT,
    p_items        JSON,
    p_invoice_type TEXT,
    p_notes        TEXT
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_order_id  BIGINT;
    v_subtotal  FLOAT8 := 0;
    v_item      JSON;
    v_part_id   BIGINT;
    v_qty       INTEGER;
    v_price     FLOAT8;
    v_stock     INTEGER;
    v_part_name TEXT;
    v_new_stk   INTEGER;
    v_inv_label TEXT;
BEGIN
    FOR v_item IN SELECT * FROM json_array_elements(p_items) LOOP
        v_part_id := (v_item->>'part_id')::BIGINT;
        v_qty     := (v_item->>'quantity')::INTEGER;
        SELECT stock, name INTO v_stock, v_part_name FROM parts WHERE id = v_part_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Producto ID % no encontrado', v_part_id; END IF;
        IF v_stock < v_qty THEN
            RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %', v_part_name, v_stock;
        END IF;
    END LOOP;

    SELECT SUM((value->>'unit_price')::FLOAT8 * (value->>'quantity')::INTEGER)
    INTO v_subtotal
    FROM json_array_elements(p_items) value;

    INSERT INTO wholesale_orders (cliente, subtotal, total, invoice_type, notes)
    VALUES (TRIM(p_cliente), v_subtotal, v_subtotal, COALESCE(p_invoice_type, 'SIN_FACTURA'), COALESCE(p_notes, ''))
    RETURNING id INTO v_order_id;

    v_inv_label := COALESCE(p_invoice_type, 'MAYOR_SIN_FACTURA');

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
CREATE OR REPLACE FUNCTION fn_confirm_quotation(p_quote_id BIGINT) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_quote    RECORD;
    v_item     RECORD;
    v_order_id BIGINT;
    v_inv_type TEXT;
    v_new_stk  INTEGER;
BEGIN
    SELECT * INTO v_quote FROM quotations WHERE id = p_quote_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
    IF v_quote.status <> 'pending' THEN
        RAISE EXCEPTION 'La cotización ya está en estado: %', v_quote.status;
    END IF;

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

-- ── RPC: Carga Masiva de Partes ───────────────────────────────────────────────
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
        v_key       := TRIM(LOWER(COALESCE(v_row->>'codigo_producto', '')));
        v_cost      := COALESCE((v_row->>'cost_price')::FLOAT8, 0);
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

    ALTER SEQUENCE parts_id_seq RESTART WITH 1;
    ALTER SEQUENCE sales_id_seq RESTART WITH 1;
    ALTER SEQUENCE stock_movements_id_seq RESTART WITH 1;
    ALTER SEQUENCE wholesale_orders_id_seq RESTART WITH 1;
    ALTER SEQUENCE wholesale_items_id_seq RESTART WITH 1;
    ALTER SEQUENCE quotations_id_seq RESTART WITH 1;
    ALTER SEQUENCE quotation_items_id_seq RESTART WITH 1;

    RETURN json_build_object('message', 'Base de datos vaciada con éxito.');
END; $$;
