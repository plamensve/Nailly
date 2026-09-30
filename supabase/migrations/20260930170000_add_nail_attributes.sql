-- AI-detected manicure metadata, editable by the studio artist.
alter table public.portfolio_looks
  add column if not exists nail_attributes jsonb;

comment on column public.portfolio_looks.nail_attributes is
  'Structured manicure attributes detected by Nailly AI and confirmed/edited by the artist.';

alter table public.portfolio_looks
  drop constraint if exists portfolio_looks_nail_attributes_shape_check;

alter table public.portfolio_looks
  add constraint portfolio_looks_nail_attributes_shape_check
  check (
    nail_attributes is null
    or (
      nail_attributes ? 'shape'
      and nail_attributes ? 'length'
      and nail_attributes ? 'style'
      and nail_attributes ? 'finish'
      and nail_attributes ? 'colors'
      and jsonb_typeof(nail_attributes->'colors') = 'array'
    )
  );
