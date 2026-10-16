-- Corrección de ventas para usuarios autenticados.
-- La devolución conserva el historial, restaura el stock y no requiere rol admin.

CREATE OR REPLACE FUNCTION public.fn_return_sale(p_sale_id BIGINT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_sale public.sales%ROWTYPE;
    v_balance INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Se requiere una sesión autenticada';
    END IF;

    SELECT *
      INTO v_sale
      FROM public.sales
     WHERE id = p_sale_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venta no encontrada';
    END IF;
    IF v_sale.refunded THEN
        RAISE EXCEPTION 'Ya fue devuelta';
    END IF;

    UPDATE public.sales
       SET refunded = TRUE
     WHERE id = p_sale_id;

    UPDATE public.parts
       SET stock = stock + v_sale.quantity
     WHERE id = v_sale.part_id
     RETURNING stock INTO v_balance;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto de la venta no encontrado';
    END IF;

    INSERT INTO public.stock_movements (part_id, type, quantity, price, balance, concept)
    VALUES (
        v_sale.part_id,
        'DEVOLUCION',
        v_sale.quantity,
        v_sale.unit_price,
        v_balance,
        'Devolución de Venta #' || p_sale_id
    );

    IF v_sale.wholesale_order_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
             FROM public.sales
            WHERE wholesale_order_id = v_sale.wholesale_order_id
              AND refunded = FALSE
       ) THEN
        UPDATE public.wholesale_orders
           SET status = 'returned'
         WHERE id = v_sale.wholesale_order_id;
    END IF;

    INSERT INTO public.audit_log(
        actor_id, action, entity_type, entity_id, before_data, after_data, metadata
    )
    VALUES (
        auth.uid(),
        'return',
        'sale',
        p_sale_id::TEXT,
        to_jsonb(v_sale),
        jsonb_build_object('refunded', TRUE),
        jsonb_build_object('reason', 'sale_correction')
    );

    RETURN json_build_object('id', p_sale_id, 'status', 'returned');
END;
$$;

REVOKE ALL ON FUNCTION public.fn_return_sale(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_return_sale(BIGINT) TO authenticated;
