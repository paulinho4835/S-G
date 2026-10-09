-- Cobro con QR dinámico de Banco Económico (API Market), igual que en Inventia/Avicola pero para un
-- solo negocio (sin organizaciones).
--
-- * payment_providers: una sola fila (id = 1) con las credenciales del banco. Las secretas (contraseña y
--   cuenta, ya cifradas con la llave AES del banco, y la propia llave) solo las lee la Edge Function
--   `bank-qr` con service_role: el navegador no tiene ningún permiso sobre la tabla. Lo visible sale de
--   get_payment_provider().
-- * qr_payments: cada QR pedido al banco. Su id es el transactionId que se envía al banco. Guarda en
--   `payload` la venta (o venta por mayor) a registrar: la venta y el descuento de stock se hacen SOLO
--   cuando el banco confirma el pago, con fn_register_qr_payment (idempotente).

CREATE TABLE IF NOT EXISTS payment_providers (
    id                 SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    provider           TEXT NOT NULL DEFAULT 'baneco' CHECK (provider IN ('baneco')),
    environment        TEXT NOT NULL DEFAULT 'certification' CHECK (environment IN ('certification', 'production')),
    enabled            BOOLEAN NOT NULL DEFAULT TRUE,
    username           TEXT NOT NULL CHECK (length(trim(username)) BETWEEN 1 AND 80),
    password_encrypted TEXT NOT NULL,
    aes_key            TEXT NOT NULL,
    account_encrypted  TEXT NOT NULL,
    account_last4      TEXT NOT NULL CHECK (account_last4 ~ '^[0-9]{1,4}$'),
    currency           TEXT NOT NULL DEFAULT 'BOB' CHECK (currency IN ('BOB', 'USD')),
    branch_code        TEXT CHECK (branch_code IS NULL OR length(branch_code) BETWEEN 1 AND 5),
    -- Token del banco reutilizado mientras no venza (unos 30 minutos).
    token              TEXT,
    token_expires_at   TIMESTAMPTZ,
    verified_at        TIMESTAMPTZ,
    updated_by         UUID REFERENCES auth.users(id),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE payment_providers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON payment_providers FROM anon, authenticated;
GRANT ALL ON payment_providers TO service_role;

CREATE TABLE IF NOT EXISTS qr_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider            TEXT NOT NULL DEFAULT 'baneco',
    environment         TEXT NOT NULL,
    qr_id               TEXT,
    amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency            TEXT NOT NULL DEFAULT 'BOB',
    description         TEXT CHECK (description IS NULL OR length(description) <= 120),
    due_date            DATE NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'error')),
    error_message       TEXT,
    payer_name          TEXT,
    payer_bank_code     TEXT,
    payer_account       TEXT,
    bank_transaction_id TEXT,
    paid_at             TIMESTAMPTZ,
    -- Lo que se cobra: 'sale' (venta de un producto) o 'wholesale' (venta por mayor); NULL = cobro de prueba.
    kind                TEXT CHECK (kind IS NULL OR kind IN ('sale', 'wholesale')),
    payload             JSONB,
    -- Resultado del registro tras el pago.
    sale_id             BIGINT REFERENCES sales(id) ON DELETE SET NULL,
    wholesale_order_id  BIGINT REFERENCES wholesale_orders(id) ON DELETE SET NULL,
    registered_at       TIMESTAMPTZ,
    register_error      TEXT,
    created_by          UUID REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((kind IS NULL) = (payload IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS qr_payments_provider_qr_idx ON qr_payments(provider, qr_id) WHERE qr_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS qr_payments_created_idx ON qr_payments(created_at DESC);
ALTER TABLE qr_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON qr_payments;
CREATE POLICY "authenticated read" ON qr_payments FOR SELECT TO authenticated USING (true);
REVOKE ALL ON qr_payments FROM anon, authenticated;
GRANT SELECT ON qr_payments TO authenticated;
GRANT ALL ON qr_payments TO service_role;

-- Lo que la pantalla puede mostrar, sin secretos.
CREATE OR REPLACE FUNCTION get_payment_provider() RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT CASE WHEN p.id IS NULL THEN jsonb_build_object('configured', false)
        ELSE jsonb_build_object(
            'configured', true,
            'provider', p.provider,
            'environment', p.environment,
            'enabled', p.enabled,
            'username', p.username,
            'account_last4', p.account_last4,
            'currency', p.currency,
            'branch_code', p.branch_code,
            'verified_at', p.verified_at,
            'updated_at', p.updated_at
        ) END
    FROM (SELECT 1) one
    LEFT JOIN payment_providers p ON p.id = 1;
$$;
REVOKE ALL ON FUNCTION get_payment_provider() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_payment_provider() TO authenticated;

-- Registra la venta de un cobro QR ya pagado. Idempotente: bloquea la fila y, si ya se registró,
-- devuelve lo registrado. Si falla (p. ej. stock insuficiente) no registra nada, guarda el motivo en
-- register_error y devuelve ok=false para que la pantalla ofrezca «Reintentar registrar».
CREATE OR REPLACE FUNCTION fn_register_qr_payment(p_payment_id UUID) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_payment qr_payments%ROWTYPE;
    v_result  JSON;
BEGIN
    SELECT * INTO v_payment FROM qr_payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cobro QR no encontrado'; END IF;
    IF v_payment.status <> 'paid' THEN RAISE EXCEPTION 'El cobro QR no está pagado'; END IF;
    IF v_payment.kind IS NULL OR v_payment.registered_at IS NOT NULL THEN
        RETURN json_build_object('ok', true, 'sale_id', v_payment.sale_id,
                                 'wholesale_order_id', v_payment.wholesale_order_id);
    END IF;

    BEGIN
        IF v_payment.kind = 'sale' THEN
            v_result := fn_create_sale(
                (v_payment.payload->>'part_id')::BIGINT,
                (v_payment.payload->>'quantity')::INTEGER,
                (v_payment.payload->>'unit_price')::FLOAT8,
                v_payment.payload->>'invoice_type'
            );
            UPDATE qr_payments
               SET sale_id = (v_result->>'id')::BIGINT, registered_at = NOW(), register_error = NULL, updated_at = NOW()
             WHERE id = p_payment_id;
        ELSE
            v_result := fn_create_wholesale_order(
                v_payment.payload->>'cliente',
                (v_payment.payload->'items')::JSON,
                v_payment.payload->>'invoice_type',
                v_payment.payload->>'notes'
            );
            UPDATE qr_payments
               SET wholesale_order_id = (v_result->>'id')::BIGINT, registered_at = NOW(), register_error = NULL, updated_at = NOW()
             WHERE id = p_payment_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        UPDATE qr_payments SET register_error = left(SQLERRM, 300), updated_at = NOW() WHERE id = p_payment_id;
        RETURN json_build_object('ok', false, 'error', SQLERRM);
    END;

    RETURN json_build_object('ok', true,
        'sale_id', CASE WHEN v_payment.kind = 'sale' THEN (v_result->>'id')::BIGINT END,
        'wholesale_order_id', CASE WHEN v_payment.kind = 'wholesale' THEN (v_result->>'id')::BIGINT END);
END; $$;
REVOKE ALL ON FUNCTION fn_register_qr_payment(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_register_qr_payment(UUID) TO service_role;
