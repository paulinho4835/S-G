-- Mejora la lista de pedidos sin perder los registros existentes.
-- Los pedidos pasan a tener ciclo de vida y se archivan mediante soft delete.

ALTER TABLE public.supply_orders
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS supplier TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'supply_orders_status_check'
          AND conrelid = 'public.supply_orders'::regclass
    ) THEN
        ALTER TABLE public.supply_orders
            ADD CONSTRAINT supply_orders_status_check
            CHECK (status IN ('pending', 'ordered', 'received', 'cancelled'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'supply_orders_supplier_length_check'
          AND conrelid = 'public.supply_orders'::regclass
    ) THEN
        ALTER TABLE public.supply_orders
            ADD CONSTRAINT supply_orders_supplier_length_check
            CHECK (supplier IS NULL OR length(trim(supplier)) BETWEEN 1 AND 120);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'supply_orders_notes_length_check'
          AND conrelid = 'public.supply_orders'::regclass
    ) THEN
        ALTER TABLE public.supply_orders
            ADD CONSTRAINT supply_orders_notes_length_check
            CHECK (notes IS NULL OR length(notes) <= 500);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_supply_orders_active_date
    ON public.supply_orders(order_date ASC)
    WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_supply_orders_status
    ON public.supply_orders(status, order_date DESC)
    WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_supply_orders_supplier
    ON public.supply_orders(supplier)
    WHERE archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.fn_touch_supply_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at := NOW();
    NEW.updated_by := auth.uid();
    IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
        NEW.archived_by := CASE WHEN NEW.archived_at IS NULL THEN NULL ELSE auth.uid() END;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supply_orders_updated_at ON public.supply_orders;
CREATE TRIGGER trg_supply_orders_updated_at
    BEFORE UPDATE ON public.supply_orders
    FOR EACH ROW EXECUTE FUNCTION public.fn_touch_supply_order();

REVOKE ALL ON FUNCTION public.fn_touch_supply_order() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_touch_supply_order() TO service_role;
