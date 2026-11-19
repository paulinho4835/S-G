-- The product editor submits supplier on every update. The system hardening
-- migration grants UPDATE by column, and supplier was added afterward.
GRANT UPDATE (supplier) ON TABLE public.parts TO authenticated;
