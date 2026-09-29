-- Permite registrar 'wompi' como método de pago (antes solo efectivo/transferencia/otro)
alter table public.sales drop constraint if exists sales_metodo_pago_check;
alter table public.sales add constraint sales_metodo_pago_check
  check (metodo_pago in ('efectivo', 'transferencia', 'otro', 'wompi'));
