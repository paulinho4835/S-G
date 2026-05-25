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
