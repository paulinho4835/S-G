-- Endurecimiento general del sistema:
-- * Las operaciones destructivas requieren app_metadata.role = admin u owner.
-- * Se registran operaciones sensibles en audit_log.
-- * Se bloquean borrados directos desde el navegador.
-- * Se agregan restricciones de cantidades, precios y stock.

CREATE TABLE IF NOT EXISTS public.audit_log (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action        TEXT NOT NULL CHECK (length(trim(action)) BETWEEN 1 AND 80),
    entity_type   TEXT NOT NULL CHECK (length(trim(entity_type)) BETWEEN 1 AND 80),
    entity_id     TEXT,
    before_data   JSONB,
    after_data    JSONB,
    metadata      JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
    ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity
    ON public.audit_log(entity_type, entity_id, created_at DESC);


ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin read audit log" ON public.audit_log;
CREATE POLICY "admin read audit log"
    ON public.audit_log FOR SELECT TO authenticated
    USING (COALESCE(auth.jwt()->'app_metadata'->>'role', '') IN ('admin', 'owner'));
REVOKE ALL ON public.audit_log FROM anon, authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

-- La autorización se comprueba en el servidor. Nunca se confía en un PIN del navegador.
CREATE OR REPLACE FUNCTION public.fn_require_admin()
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL
       OR COALESCE(auth.jwt()->'app_metadata'->>'role', '') NOT IN ('admin', 'owner') THEN
        RAISE EXCEPTION 'Se requiere rol de administrador';
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_require_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_require_admin() TO authenticated;

-- Restricciones defensivas. NOT VALID conserva los datos existentes y protege las nuevas operaciones.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parts_stock_nonnegative' AND conrelid = 'public.parts'::regclass) THEN
        ALTER TABLE public.parts ADD CONSTRAINT parts_stock_nonnegative CHECK (stock >= 0) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_quantity_positive' AND conrelid = 'public.sales'::regclass) THEN
        ALTER TABLE public.sales ADD CONSTRAINT sales_quantity_positive CHECK (quantity > 0) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_prices_nonnegative' AND conrelid = 'public.sales'::regclass) THEN
        ALTER TABLE public.sales ADD CONSTRAINT sales_prices_nonnegative CHECK (unit_price >= 0 AND total_price >= 0) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_quantity_nonzero' AND conrelid = 'public.stock_movements'::regclass) THEN
        ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_quantity_nonzero CHECK (quantity <> 0) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_balance_nonnegative' AND conrelid = 'public.stock_movements'::regclass) THEN
        ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_balance_nonnegative CHECK (balance >= 0) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wholesale_items_quantity_positive' AND conrelid = 'public.wholesale_items'::regclass) THEN
        ALTER TABLE public.wholesale_items ADD CONSTRAINT wholesale_items_quantity_positive CHECK (quantity > 0) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wholesale_items_prices_nonnegative' AND conrelid = 'public.wholesale_items'::regclass) THEN
        ALTER TABLE public.wholesale_items ADD CONSTRAINT wholesale_items_prices_nonnegative CHECK (unit_price >= 0 AND total_price >= 0) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotation_items_quantity_positive' AND conrelid = 'public.quotation_items'::regclass) THEN
        ALTER TABLE public.quotation_items ADD CONSTRAINT quotation_items_quantity_positive CHECK (quantity > 0) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotation_items_prices_nonnegative' AND conrelid = 'public.quotation_items'::regclass) THEN
        ALTER TABLE public.quotation_items ADD CONSTRAINT quotation_items_prices_nonnegative CHECK (unit_price >= 0 AND total_price >= 0) NOT VALID;
    END IF;
END $$;

-- El frontend ya no necesita borrar pedidos físicamente: solo los archiva.
DROP POLICY IF EXISTS "authenticated full access" ON public.supply_orders;
DROP POLICY IF EXISTS "authenticated read supply orders" ON public.supply_orders;
DROP POLICY IF EXISTS "authenticated create supply orders" ON public.supply_orders;
DROP POLICY IF EXISTS "authenticated update supply orders" ON public.supply_orders;
CREATE POLICY "authenticated read supply orders"
    ON public.supply_orders FOR SELECT TO authenticated
    USING (true);
CREATE POLICY "authenticated create supply orders"
    ON public.supply_orders FOR INSERT TO authenticated
    WITH CHECK (true);
CREATE POLICY "authenticated update supply orders"
    ON public.supply_orders FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);
REVOKE DELETE ON public.supply_orders FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.supply_orders TO authenticated;

-- El stock solo debe cambiar mediante RPC transaccional, no mediante un UPDATE directo.
REVOKE UPDATE ON public.parts FROM authenticated;
GRANT UPDATE (
    name, internal_measure, external_measure, height, description,
    flange_measure, familia, codigo, codigo_producto, marca, mundial,
    aplicacion, cost_price, tope, pv_geli
) ON public.parts TO authenticated;
REVOKE DELETE ON public.parts, public.sales, public.stock_movements,
    public.wholesale_orders, public.wholesale_items,
    public.quotations, public.quotation_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.sales FROM authenticated;
REVOKE UPDATE, DELETE ON public.stock_movements FROM authenticated;

-- Eliminación de producto: atómica, auditada y solo para administradores.
CREATE OR REPLACE FUNCTION public.fn_delete_part(p_part_id BIGINT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_part public.parts%ROWTYPE;
BEGIN
    PERFORM public.fn_require_admin();

    SELECT * INTO v_part
      FROM public.parts
     WHERE id = p_part_id
     FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;

    IF EXISTS (SELECT 1 FROM public.sales WHERE part_id = p_part_id)
       OR EXISTS (SELECT 1 FROM public.stock_movements WHERE part_id = p_part_id)
       OR EXISTS (SELECT 1 FROM public.wholesale_items WHERE part_id = p_part_id)
       OR EXISTS (SELECT 1 FROM public.quotation_items WHERE part_id = p_part_id) THEN
        RAISE EXCEPTION 'No se puede eliminar un producto con historial; debe conservarse para auditoría';
    END IF;

    DELETE FROM public.stock_movements WHERE part_id = p_part_id;
    DELETE FROM public.parts WHERE id = p_part_id;

    INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, before_data)
    VALUES (auth.uid(), 'delete', 'part', p_part_id::TEXT, to_jsonb(v_part));

    RETURN json_build_object('id', p_part_id, 'status', 'deleted');
END;
$$;
REVOKE ALL ON FUNCTION public.fn_delete_part(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_delete_part(BIGINT) TO authenticated;

-- Borrado de venta: conserva la devolución de stock, pero queda protegido y auditado.
CREATE OR REPLACE FUNCTION public.fn_delete_sale(p_sale_id BIGINT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_sale RECORD;
    v_bal INTEGER;
BEGIN
    PERFORM public.fn_require_admin();

    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada'; END IF;
    IF v_sale.refunded THEN RAISE EXCEPTION 'No se puede eliminar una venta ya devuelta'; END IF;

    UPDATE public.parts SET stock = stock + v_sale.quantity WHERE id = v_sale.part_id;
    SELECT stock INTO v_bal FROM public.parts WHERE id = v_sale.part_id;

    INSERT INTO public.stock_movements(part_id, type, quantity, price, balance, concept)
    VALUES (v_sale.part_id, 'DEVOLUCION', v_sale.quantity, v_sale.unit_price, v_bal,
            'Eliminación de Venta #' || p_sale_id);

    IF v_sale.wholesale_order_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM public.sales
            WHERE wholesale_order_id = v_sale.wholesale_order_id
              AND refunded = FALSE
              AND id <> p_sale_id
       ) THEN
        UPDATE public.wholesale_orders SET status = 'returned' WHERE id = v_sale.wholesale_order_id;
    END IF;

    DELETE FROM public.sales WHERE id = p_sale_id;

    INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, before_data)
    VALUES (auth.uid(), 'delete', 'sale', p_sale_id::TEXT, to_jsonb(v_sale));

    RETURN json_build_object('id', p_sale_id, 'status', 'deleted');
END;
$$;
REVOKE ALL ON FUNCTION public.fn_delete_sale(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_delete_sale(BIGINT) TO authenticated;

-- La edición del tipo de comprobante también pasa por una función controlada.
CREATE OR REPLACE FUNCTION public.fn_update_sale_invoice_type(
    p_sale_id BIGINT,
    p_invoice_type TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_sale public.sales%ROWTYPE;
BEGIN
    IF p_invoice_type IS NULL OR length(trim(p_invoice_type)) NOT BETWEEN 1 AND 80 THEN
        RAISE EXCEPTION 'Tipo de comprobante inválido';
    END IF;

    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada'; END IF;

    UPDATE public.sales
       SET invoice_type = trim(p_invoice_type)
     WHERE id = p_sale_id;

    INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, before_data, after_data)
    VALUES (
        auth.uid(), 'update', 'sale', p_sale_id::TEXT,
        jsonb_build_object('invoice_type', v_sale.invoice_type),
        jsonb_build_object('invoice_type', trim(p_invoice_type))
    );

    RETURN json_build_object('id', p_sale_id, 'invoice_type', trim(p_invoice_type));
END;
$$;
REVOKE ALL ON FUNCTION public.fn_update_sale_invoice_type(BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_update_sale_invoice_type(BIGINT, TEXT) TO authenticated;

-- Reset completo: autorización server-side, auditoría y search_path cerrado.
CREATE OR REPLACE FUNCTION public.fn_reset_database(p_confirmation TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_snapshot JSONB;
BEGIN
    PERFORM public.fn_require_admin();
    IF p_confirmation <> 'BORRAR TODO' THEN
        RAISE EXCEPTION 'Código de confirmación incorrecto';
    END IF;

    SELECT jsonb_build_object(
        'parts', (SELECT COUNT(*) FROM public.parts),
        'sales', (SELECT COUNT(*) FROM public.sales),
        'stock_movements', (SELECT COUNT(*) FROM public.stock_movements),
        'wholesale_orders', (SELECT COUNT(*) FROM public.wholesale_orders),
        'quotations', (SELECT COUNT(*) FROM public.quotations)
    ) INTO v_snapshot;

    DELETE FROM public.quotation_items;
    DELETE FROM public.quotations;
    DELETE FROM public.wholesale_items;
    DELETE FROM public.sales;
    DELETE FROM public.stock_movements;
    DELETE FROM public.wholesale_orders;
    DELETE FROM public.parts;

    ALTER SEQUENCE public.parts_id_seq RESTART WITH 1;
    ALTER SEQUENCE public.sales_id_seq RESTART WITH 1;
    ALTER SEQUENCE public.stock_movements_id_seq RESTART WITH 1;
    ALTER SEQUENCE public.wholesale_orders_id_seq RESTART WITH 1;
    ALTER SEQUENCE public.wholesale_items_id_seq RESTART WITH 1;
    ALTER SEQUENCE public.quotations_id_seq RESTART WITH 1;
    ALTER SEQUENCE public.quotation_items_id_seq RESTART WITH 1;

    INSERT INTO public.audit_log(actor_id, action, entity_type, before_data)
    VALUES (auth.uid(), 'reset', 'database', v_snapshot);

    RETURN json_build_object('message', 'Base de datos vaciada con éxito.');
END;
$$;
REVOKE ALL ON FUNCTION public.fn_reset_database(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_reset_database(TEXT) TO authenticated;

-- Asegura search_path explícito en funciones SECURITY DEFINER existentes.
ALTER FUNCTION public.fn_create_sale(BIGINT, INTEGER, FLOAT8, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_return_sale(BIGINT) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_create_restock(BIGINT, INTEGER) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_create_wholesale_order(TEXT, JSON, TEXT, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_return_wholesale_order(BIGINT) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_confirm_quotation(BIGINT) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_get_sales_summary(TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_bulk_upsert_parts(JSON) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_update_sale_invoice_type(BIGINT, TEXT) SET search_path = public, pg_temp;
