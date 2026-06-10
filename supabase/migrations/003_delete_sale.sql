-- ── RPC: Eliminar Venta (borra el registro y restaura stock) ─────────────────
CREATE OR REPLACE FUNCTION fn_delete_sale(p_sale_id BIGINT) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_sale RECORD; v_bal INTEGER;
BEGIN
    SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada'; END IF;
    IF v_sale.refunded THEN RAISE EXCEPTION 'No se puede eliminar una venta ya devuelta'; END IF;

    -- Restaurar stock
    UPDATE parts SET stock = stock + v_sale.quantity WHERE id = v_sale.part_id;
    SELECT stock INTO v_bal FROM parts WHERE id = v_sale.part_id;

    -- Registrar movimiento de kardex
    INSERT INTO stock_movements (part_id, type, quantity, price, balance, concept)
    VALUES (v_sale.part_id, 'DEVOLUCION', v_sale.quantity, v_sale.unit_price, v_bal,
            'Eliminación de Venta #' || p_sale_id);

    -- Si pertenece a un pedido mayorista, actualizar estado
    IF v_sale.wholesale_order_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM sales
            WHERE wholesale_order_id = v_sale.wholesale_order_id
              AND refunded = FALSE
              AND id <> p_sale_id
        ) THEN
            UPDATE wholesale_orders SET status = 'returned' WHERE id = v_sale.wholesale_order_id;
        END IF;
    END IF;

    -- Eliminar la venta
    DELETE FROM sales WHERE id = p_sale_id;

    RETURN json_build_object('id', p_sale_id, 'status', 'deleted');
END; $$;
