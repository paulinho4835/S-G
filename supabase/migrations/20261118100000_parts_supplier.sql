-- Proveedor habitual opcional por producto. Al agregar el producto a Pedidos,
-- este dato se copia al pedido y puede ajustarse de forma independiente.
ALTER TABLE public.parts
    ADD COLUMN IF NOT EXISTS supplier TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'parts_supplier_length_check'
           AND conrelid = 'public.parts'::regclass
    ) THEN
        ALTER TABLE public.parts
            ADD CONSTRAINT parts_supplier_length_check
            CHECK (supplier IS NULL OR length(trim(supplier)) BETWEEN 1 AND 120);
    END IF;
END;
$$;
