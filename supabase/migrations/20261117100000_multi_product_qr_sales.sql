-- Permite cobrar varios productos en un solo QR y conservar una fila de venta por producto.
-- La referencia en sales permite conciliar cada línea con el mismo cobro bancario.

ALTER TABLE public.qr_payments
    DROP CONSTRAINT IF EXISTS qr_payments_kind_check;

ALTER TABLE public.qr_payments
    ADD CONSTRAINT qr_payments_kind_check
    CHECK (kind IS NULL OR kind IN ('sale', 'sale_cart', 'wholesale'));

ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS qr_payment_id UUID
    REFERENCES public.qr_payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sales_qr_payment_id_idx
    ON public.sales(qr_payment_id)
    WHERE qr_payment_id IS NOT NULL;

-- Registra ventas en efectivo con varias líneas como ventas normales independientes.
-- Todo el carrito comparte una única transacción: si una línea falla, no se vende ninguna.
CREATE OR REPLACE FUNCTION public.fn_create_multi_sale(p_items JSONB, p_invoice_type TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_item JSONB;
    v_part_id BIGINT;
    v_quantity INTEGER;
    v_unit_price FLOAT8;
    v_cost_price NUMERIC;
    v_result JSON;
    v_sale_ids BIGINT[] := ARRAY[]::BIGINT[];
    v_total NUMERIC(12, 2) := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Se requiere una sesión autenticada';
    END IF;
    IF p_invoice_type NOT IN ('SIN_FACTURA', 'FACTURA') THEN
        RAISE EXCEPTION 'Tipo de comprobante inválido para venta en efectivo';
    END IF;
    IF COALESCE(jsonb_typeof(p_items), '') <> 'array'
       OR COALESCE(jsonb_array_length(p_items), 0) NOT BETWEEN 1 AND 300 THEN
        RAISE EXCEPTION 'La venta no tiene productos válidos';
    END IF;

    -- Orden estable de bloqueo para evitar interbloqueos entre carritos simultáneos.
    PERFORM p.id
      FROM public.parts p
     WHERE p.id IN (
         SELECT DISTINCT (entry.value->>'part_id')::BIGINT
           FROM jsonb_array_elements(p_items) AS entry(value)
     )
     ORDER BY p.id
     FOR UPDATE;

    FOR v_item IN
        SELECT value FROM jsonb_array_elements(p_items) AS entry(value)
    LOOP
        v_part_id := (v_item->>'part_id')::BIGINT;
        v_quantity := (v_item->>'quantity')::INTEGER;
        v_unit_price := (v_item->>'unit_price')::FLOAT8;

        IF v_part_id IS NULL OR v_part_id <= 0 OR v_quantity IS NULL OR v_quantity <= 0 THEN
            RAISE EXCEPTION 'Producto o cantidad inválidos';
        END IF;
        IF v_unit_price IS NULL OR v_unit_price <= 0
           OR v_unit_price::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
            RAISE EXCEPTION 'El precio debe ser mayor a cero y válido';
        END IF;

        v_unit_price := round(v_unit_price::NUMERIC, 2)::FLOAT8;
        SELECT cost_price INTO v_cost_price
          FROM public.parts
         WHERE id = v_part_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Producto no encontrado';
        END IF;
        IF COALESCE(v_cost_price, 0) > v_unit_price THEN
            RAISE EXCEPTION 'El precio de venta no puede ser menor al costo base';
        END IF;

        v_result := public.fn_create_sale(v_part_id, v_quantity, v_unit_price, p_invoice_type);
        v_sale_ids := array_append(v_sale_ids, (v_result->>'id')::BIGINT);
        v_total := v_total + (v_unit_price::NUMERIC * v_quantity);
    END LOOP;

    RETURN json_build_object(
        'ok', TRUE,
        'sale_ids', to_json(v_sale_ids),
        'sale_count', cardinality(v_sale_ids),
        'total', v_total
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_multi_sale(JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_multi_sale(JSONB, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_register_qr_payment(p_payment_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment public.qr_payments%ROWTYPE;
    v_result JSON;
    v_item JSONB;
    v_sale_id BIGINT;
    v_sale_ids BIGINT[] := ARRAY[]::BIGINT[];
BEGIN
    SELECT *
      INTO v_payment
      FROM public.qr_payments
     WHERE id = p_payment_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cobro QR no encontrado';
    END IF;
    IF v_payment.status <> 'paid' THEN
        RAISE EXCEPTION 'El cobro QR no está pagado';
    END IF;
    IF v_payment.kind IS NULL THEN
        RETURN json_build_object('ok', TRUE);
    END IF;

    IF v_payment.registered_at IS NOT NULL THEN
        SELECT COALESCE(array_agg(s.id ORDER BY s.id), ARRAY[]::BIGINT[])
          INTO v_sale_ids
          FROM public.sales s
         WHERE s.qr_payment_id = p_payment_id;

        IF cardinality(v_sale_ids) = 0 AND v_payment.sale_id IS NOT NULL THEN
            v_sale_ids := ARRAY[v_payment.sale_id];
        END IF;

        RETURN json_build_object(
            'ok', TRUE,
            'sale_id', COALESCE(v_payment.sale_id, v_sale_ids[1]),
            'sale_ids', to_json(v_sale_ids),
            'sale_count', cardinality(v_sale_ids),
            'wholesale_order_id', v_payment.wholesale_order_id
        );
    END IF;

    -- El bloque de excepción crea una subtransacción: si falla una línea, no queda ninguna
    -- venta parcial ni descuento de stock. El mismo QR puede reintentarse tras corregir stock.
    BEGIN
        IF v_payment.kind = 'sale' THEN
            v_result := public.fn_create_sale(
                (v_payment.payload->>'part_id')::BIGINT,
                (v_payment.payload->>'quantity')::INTEGER,
                (v_payment.payload->>'unit_price')::FLOAT8,
                v_payment.payload->>'invoice_type'
            );
            v_sale_id := (v_result->>'id')::BIGINT;
            v_sale_ids := ARRAY[v_sale_id];

            UPDATE public.sales
               SET qr_payment_id = p_payment_id
             WHERE id = v_sale_id;

            UPDATE public.qr_payments
               SET sale_id = v_sale_id,
                   registered_at = NOW(),
                   register_error = NULL,
                   updated_at = NOW()
             WHERE id = p_payment_id;
        ELSIF v_payment.kind = 'sale_cart' THEN
            IF COALESCE(jsonb_typeof(v_payment.payload->'items'), '') <> 'array'
               OR COALESCE(jsonb_array_length(v_payment.payload->'items'), 0) NOT BETWEEN 1 AND 300 THEN
                RAISE EXCEPTION 'La venta no tiene productos válidos';
            END IF;

            -- Bloquea los productos en un orden estable para reducir interbloqueos
            -- cuando dos cajas cobran carritos que contienen los mismos artículos.
            PERFORM p.id
              FROM public.parts p
             WHERE p.id IN (
                 SELECT DISTINCT (entry.value->>'part_id')::BIGINT
                   FROM jsonb_array_elements(v_payment.payload->'items') AS entry(value)
             )
             ORDER BY p.id
             FOR UPDATE;

            FOR v_item IN
                SELECT value FROM jsonb_array_elements(v_payment.payload->'items') AS entry(value)
            LOOP
                v_result := public.fn_create_sale(
                    (v_item->>'part_id')::BIGINT,
                    (v_item->>'quantity')::INTEGER,
                    (v_item->>'unit_price')::FLOAT8,
                    v_payment.payload->>'invoice_type'
                );
                v_sale_id := (v_result->>'id')::BIGINT;
                v_sale_ids := array_append(v_sale_ids, v_sale_id);

                UPDATE public.sales
                   SET qr_payment_id = p_payment_id
                 WHERE id = v_sale_id;
            END LOOP;

            UPDATE public.qr_payments
               SET sale_id = v_sale_ids[1],
                   registered_at = NOW(),
                   register_error = NULL,
                   updated_at = NOW()
             WHERE id = p_payment_id;
        ELSE
            v_result := public.fn_create_wholesale_order(
                v_payment.payload->>'cliente',
                (v_payment.payload->'items')::JSON,
                v_payment.payload->>'invoice_type',
                v_payment.payload->>'notes'
            );

            UPDATE public.qr_payments
               SET wholesale_order_id = (v_result->>'id')::BIGINT,
                   registered_at = NOW(),
                   register_error = NULL,
                   updated_at = NOW()
             WHERE id = p_payment_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        UPDATE public.qr_payments
           SET register_error = left(SQLERRM, 300), updated_at = NOW()
         WHERE id = p_payment_id;
        RETURN json_build_object('ok', FALSE, 'error', SQLERRM);
    END;

    RETURN json_build_object(
        'ok', TRUE,
        'sale_id', v_sale_ids[1],
        'sale_ids', to_json(v_sale_ids),
        'sale_count', cardinality(v_sale_ids),
        'wholesale_order_id', CASE
            WHEN v_payment.kind = 'wholesale' THEN (v_result->>'id')::BIGINT
            ELSE NULL
        END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_register_qr_payment(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_register_qr_payment(UUID) TO service_role;
