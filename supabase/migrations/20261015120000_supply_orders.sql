-- Lista compartida de pedidos a proveedor.
-- A diferencia de la antigua lista en localStorage, estos registros quedan
-- disponibles desde cualquier navegador autenticado del negocio.

CREATE TABLE IF NOT EXISTS supply_orders (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_order_id   TEXT NOT NULL CHECK (length(trim(client_order_id)) BETWEEN 1 AND 100),
    part_id           BIGINT REFERENCES parts(id) ON DELETE SET NULL,
    product_snapshot  JSONB NOT NULL CHECK (jsonb_typeof(product_snapshot) = 'object'),
    quantity          INTEGER CHECK (quantity IS NULL OR quantity >= 1),
    order_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by        UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT supply_orders_client_order_id_key UNIQUE (client_order_id)
);

CREATE INDEX IF NOT EXISTS idx_supply_orders_order_date
    ON supply_orders(order_date ASC);
CREATE INDEX IF NOT EXISTS idx_supply_orders_part_id
    ON supply_orders(part_id);

ALTER TABLE supply_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated full access" ON supply_orders;
CREATE POLICY "authenticated full access"
    ON supply_orders FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

REVOKE ALL ON supply_orders FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON supply_orders TO authenticated;
GRANT ALL ON supply_orders TO service_role;
