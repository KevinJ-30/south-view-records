-- Cleans up rows from the full-ledger CSV import. Safe to re-run: rows already cleaned are left alone.
--
-- The import appended its own details to each transcriber_note, e.g.
--   "Dark band obscures row. [CSV import] image_file=page-0056.png; flags=damaged_page; illegible_fields=entry_no;name_as_written"
-- This script:
--   * keeps each original note in import_note_backup, so the change can be undone;
--   * adds every illegible_fields entry to uncertain_fields, under the names the site reads;
--   * moves flags into condition_flags and image_file into image_file;
--   * cuts the "[CSV import] ..." text off the note, leaving the transcriber's own words (or null);
--   * gives ledger_id a default of 1, so the admin page can add records again.
--
-- To undo:
--   update public.burial_records set transcriber_note = import_note_backup where import_note_backup is not null;
-- (uncertain_fields keeps the added flags; they can be removed by hand if needed.)

begin;

alter table public.burial_records alter column ledger_id set default 1;
alter table public.burial_records add column if not exists import_note_backup text;
alter table public.burial_records add column if not exists image_file text;
alter table public.burial_records add column if not exists condition_flags text[] not null default '{}';

with parsed as (
  select
    id,
    substring(transcriber_note from '\[CSV import\].*$') as import_text
  from public.burial_records
  where transcriber_note like '%[CSV import]%'
),
fields as (
  select
    id,
    substring(import_text from 'image_file=([^; ]+)') as image_file,
    array_remove(string_to_array(substring(import_text from 'flags=([^ ]*)'), ';'), '') as flags,
    array_remove(string_to_array(substring(import_text from 'illegible_fields=([^ ]*)'), ';'), '') as illegible
  from parsed
)
update public.burial_records r
set
  import_note_backup = coalesce(r.import_note_backup, r.transcriber_note),
  transcriber_note = nullif(trim(regexp_replace(r.transcriber_note, '\s*\[CSV import\].*$', '')), ''),
  image_file = coalesce(f.image_file, r.image_file),
  condition_flags = array(
    select distinct flag from unnest(r.condition_flags || coalesce(f.flags, '{}')) as flag order by flag
  ),
  -- Existing flags first, then new ones, without repeats. The import's names are mapped to
  -- the ones already in uncertain_fields: name_as_written -> name, entry_no -> entry_number, day -> burial_date.
  uncertain_fields = array(
    select flag
    from unnest(
      r.uncertain_fields || array(
        select case illegible_field
          when 'name_as_written' then 'name'
          when 'entry_no' then 'entry_number'
          when 'day' then 'burial_date'
          else illegible_field
        end
        from unnest(coalesce(f.illegible, '{}')) as illegible_field
      )
    ) with ordinality as u(flag, position)
    group by flag
    order by min(position)
  )
from fields f
where r.id = f.id;

-- What changed: rows cleaned, and every uncertainty flag now in use.
select count(*) filter (where import_note_backup is not null) as rows_cleaned,
       count(*) filter (where transcriber_note like '%[CSV import]%') as rows_still_with_import_text
from public.burial_records;

select flag, count(*)
from public.burial_records, unnest(uncertain_fields) as flag
group by flag
order by count(*) desc;

commit;
