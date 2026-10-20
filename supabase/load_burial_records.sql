-- Loads data/south-view-1905-sample.csv into public.burial_records. Safe to re-run.
-- Assumption: a bare age number with no unit (e.g. "3") is stored as months.

-- lot is text (some lots are words like 'Club'), so it gets no numeric comparisons: drop any check on it (e.g. "lot > 0").
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.burial_records'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~* '\mlot\M'
  loop
    execute format('alter table public.burial_records drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.burial_records alter column lot type text using lot::text;
alter table public.burial_records alter column range drop not null;
alter table public.burial_records alter column entry_number drop not null;
alter table public.burial_records add column if not exists age_months int2;
alter table public.burial_records add column if not exists age_days int2;
alter table public.burial_records add column if not exists uncertain_fields text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'burial_records_ledger_page_line_key') then
    alter table public.burial_records
      add constraint burial_records_ledger_page_line_key unique (ledger_page, line_on_page);
  end if;
end $$;

insert into public.burial_records
  (index_record, ledger_page, line_on_page, entry_number, name_as_written, is_infant_of_parent,
   burial_date, age_years, age_months, age_days, plat, section, block, lot, range, grave,
   uncertain_fields, transcriber_note)
values
  (1, 6, 1, 862, 'B.F. Simpson', false, '1905-10-10', 38, null, null, 'VR', 1, 1, '5', 'M', 16, array['range']::text[], null),
  (2, 6, 2, 863, 'Inf. of B. Moss', true, '1905-10-11', null, 3, null, 'VR', 1, 1, '6', 'B', 25, array['range']::text[], null),
  (3, 6, 3, 864, 'Mary Tramell', false, '1905-10-11', 27, null, null, 'VR', 1, 1, '5', 'M', 16, array['name']::text[], null),
  (4, 6, 4, 865, 'E. Cuthbert', false, '1905-10-11', 54, null, null, 'SS', 1, 2, '27', 'B', 2, array['plat']::text[], null),
  (5, 6, 5, 866, 'Inf. of G. Dozier', true, '1905-10-11', null, null, 7, 'VR', 1, 1, '6', 'W', 26, array[]::text[], null),
  (6, 6, 6, 868, 'Jno. Harris', false, '1905-10-11', 93, null, null, 'VR', 1, 3, '23', 'B', 1, array['name','lot']::text[], 'Plat code struck through'),
  (7, 6, 7, 869, 'Inf. of Sandy Bell', true, '1905-10-11', null, null, null, 'VR', 1, 1, '6', 'A', 26, array['range']::text[], null),
  (8, 6, 8, 870, 'Rusell Martin', false, '1905-10-12', 21, null, null, 'VR', 1, 1, '5', 'M', 17, array[]::text[], null),
  (9, 6, 9, 871, 'Inf. of Pinkney Goodman', true, '1905-10-12', null, null, null, 'VR', 1, 1, '6', 'T', 26, array['name']::text[], null),
  (10, 6, 10, 872, 'Hattie Tolbert', false, '1905-10-12', 40, null, null, 'VR', 1, 1, '5', 'J', 15, array[]::text[], null),
  (11, 6, 11, 873, 'Amos Rucker', false, '1905-10-12', 81, null, null, 'NS', 1, 3, '5', 'A', 32, array['range']::text[], 'Lot overwritten'),
  (12, 6, 12, 874, 'Bloomer Mathews', false, '1905-10-12', 40, null, null, 'VR', 1, 1, '5', 'H', 15, array[]::text[], null),
  (13, 6, 13, 875, 'James Collens', false, '1905-10-13', 41, null, null, 'VR', 1, 1, '5', 'K', 16, array['name']::text[], null),
  (14, 6, 14, 876, 'Inf. of Lucy Holt', true, '1905-10-14', null, null, null, 'W', 2, 1, '10', 'H', 17, array[]::text[], null),
  (15, 6, 15, 877, 'Inf. of Cora Hanners', true, '1905-10-14', null, null, null, 'W', 2, 1, '10', 'D', 18, array['name']::text[], null),
  (16, 6, 16, 878, 'Hanah Crawford', false, '1905-10-14', 47, null, null, 'VR', 1, 1, '5', 'L', 16, array[]::text[], null),
  (17, 6, 17, 879, 'Ed Bearman', false, '1905-10-14', 25, null, null, 'VR', 1, 1, '5', 'E', 16, array['name']::text[], null),
  (18, 6, 18, 880, 'Inf. of Luler Thompson', true, '1905-10-14', null, null, null, 'VR', 1, 1, '6', 'G', 26, array[]::text[], null),
  (19, 6, 19, 881, 'Andrew Dunlap', false, '1905-10-16', 49, null, null, 'VR', 1, 1, '5', 'H', 16, array[]::text[], null),
  (20, 6, 20, 882, 'Martha Jackson', false, '1905-10-18', 44, null, null, 'VR', 1, 1, '5', 'G', 16, array['age_years']::text[], null),
  (21, 6, 21, 883, 'Margrett Butler', false, '1905-10-18', 4, null, null, 'VR', 1, 1, '6', 'G', 26, array['range']::text[], null),
  (22, 6, 22, 884, 'Henry Smith', false, '1905-10-19', 1, null, null, 'VR', 1, 1, '6', 'R', 26, array[]::text[], null),
  (23, 6, 23, 885, 'Charls Cartwright', false, '1905-10-19', 34, null, null, 'VR', 1, 1, '5', 'H', 16, array[]::text[], null),
  (24, 6, 24, 886, 'Mary Marshall', false, '1905-10-20', 25, null, null, 'VR', 1, 1, '5', 'O', 16, array[]::text[], null),
  (25, 6, 25, 887, 'Arther Malone', false, '1905-10-21', 17, null, null, 'VR', 1, 1, '5', 'J', 16, array[]::text[], null),
  (26, 6, 26, 888, 'Lucy Dupree', false, '1905-10-21', 32, null, null, 'VR', 1, 1, '5', 'H', 17, array['name']::text[], null),
  (27, 6, 27, 889, 'Edw. Murphy', false, '1905-10-21', 7, null, null, 'VR', 1, 1, '5', 'R', 17, array['name']::text[], null),
  (28, 6, 28, 890, 'Emma Thomas', false, '1905-10-22', 35, null, null, 'W', 2, 1, '10', 'B', 17, array[]::text[], null),
  (29, 6, 29, 891, 'Andrew Mason', false, '1905-10-23', 48, null, null, 'SS', 1, 2, '136', 'A', 1, array['plat']::text[], null),
  (30, 6, 30, 892, 'Adline Matose', false, '1905-10-23', 42, null, null, 'VR', 1, 1, '5', 'E', 17, array['name']::text[], null),
  (31, 6, 31, 893, 'Saddy N. Astres', false, '1905-10-23', null, 3, null, 'VR', 1, 1, '6', 'V', 26, array['name']::text[], null),
  (32, 6, 32, 894, 'Willie Williams', false, '1905-10-23', 1, null, 28, 'VR', 1, 1, '6', 'S', 26, array['range']::text[], null),
  (33, 6, 33, 895, 'Joel Adkins', false, '1905-10-24', 70, null, null, 'VR', 1, 1, '5', 'B', 17, array[]::text[], null),
  (34, 6, 34, 896, 'Jno. W. Amos', false, '1905-10-24', 35, null, null, 'W', 2, 1, '11', 'E', 36, array[]::text[], null),
  (35, 6, 35, 897, 'Holland', false, '1905-10-25', 83, null, null, 'VR', 1, 1, '5', 'C', 17, array[]::text[], 'First name left blank in ledger'),
  (36, 6, 36, 898, 'Malissia May', false, '1905-10-26', 60, null, null, 'VR', 1, 1, '5', 'A', 17, array[]::text[], null),
  (37, 6, 37, 900, 'J.R. Barrow', false, '1905-10-27', 69, null, null, 'VR', 1, 1, '5', 'D', 17, array[]::text[], null),
  (38, 6, 38, 901, 'Inf. of Annie Sherpard', true, '1905-10-28', null, null, null, 'W', 2, 1, '10', 'H', 18, array[]::text[], null),
  (39, 6, 39, 902, 'Inf. of William Wilson', true, '1905-10-28', null, null, null, 'W', 2, 1, '10', 'H', 18, array[]::text[], null),
  (40, 6, 40, 903, 'Henry Barnes', false, '1905-10-28', 37, null, null, 'W', 2, 1, '11', 'H', 3, array['grave']::text[], null),
  (41, 6, 41, null, 'Annie Jackson', false, '1905-10-25', 25, null, null, 'VR', 1, 1, '5', 'G', 17, array[]::text[], 'Listed under margin note "By Cert." [?]; no entry number'),
  (42, 6, 42, null, 'Inf. of Mattie Allen', true, null, null, null, 4, 'M', 1, 1, '6', null, 26, array[]::text[], 'No entry number; day blank'),
  (43, 7, 1, null, 'Jesse Harris', false, '1905-10-31', 28, null, null, 'W', 2, 1, '11', 'J', 4, array[]::text[], 'October entry at top of page 7; no entry number'),
  (44, 7, 2, null, 'Jack Ramon', false, '1905-11-01', 35, null, null, 'NS', 1, 2, '100', 'A', 1, array['name','range']::text[], 'No entry number'),
  (45, 7, 3, 921, 'Mary Wilton', false, '1905-11-06', 23, null, null, 'VR', 1, 1, '5', 'B', 18, array[]::text[], null),
  (46, 7, 4, 922, 'P. Pope', false, '1905-11-03', null, null, null, 'VR', 1, 1, '5', 'A', 18, array['name']::text[], null),
  (47, 7, 5, 923, 'Carrie White', false, '1905-11-04', 87, null, null, 'VR', 1, 1, '5', 'O', 18, array['name']::text[], null),
  (48, 7, 6, 924, 'Fannie Baily', false, '1905-11-05', 81, null, null, 'VR', 1, 1, '5', 'N', 18, array['name']::text[], null),
  (49, 7, 7, 925, 'Wm. Marshal', false, '1905-11-05', 46, null, null, 'NS', 1, 3, '14', 'B', 1, array['range']::text[], null),
  (50, 7, 8, 926, 'J.D. Johnson', false, '1905-11-06', 40, null, null, 'VR', 1, 1, '5', 'E', 18, array['name']::text[], null),
  (51, 7, 9, 927, 'B. Gelaske', false, '1905-11-06', 45, null, null, 'VR', 1, 1, '5', 'L', 18, array['name','age_years','range']::text[], null),
  (52, 7, 10, 928, 'R. Sutton', false, '1905-11-07', 80, null, null, 'VR', 1, 1, '5', 'J', 18, array[]::text[], null),
  (53, 7, 11, 929, 'Estella Addams', false, '1905-11-07', 10, null, null, 'VR', 1, 1, '5', null, 18, array[]::text[], 'Range obscured by ink blot'),
  (54, 7, 12, 930, 'A.J. Griffin', false, '1905-11-08', 37, null, null, 'MS', 1, 1, '6', 'B', 4, array['plat']::text[], null),
  (55, 7, 13, 931, 'Julia Williams', false, '1905-11-09', 28, null, null, 'VR', 1, 1, '5', 'H', 18, array[]::text[], null),
  (56, 7, 14, 932, 'Lizzie Hunter', false, '1905-11-10', 84, null, null, 'M', 1, 1, 'Hunter', 'A', 2, array['age_years']::text[], 'Lot written as "Hunter" (family lot?)'),
  (57, 7, 15, 933, 'M. Cartwright', false, '1905-11-11', 52, null, null, 'VR', 1, 1, '5', 'O', 15, array[]::text[], null),
  (58, 7, 16, 934, 'M. Thompson', false, '1905-11-12', 85, null, null, 'VR', 1, 1, '5', 'E', 18, array['age_years']::text[], null),
  (59, 7, 17, 935, 'Gus Dupree', false, '1905-11-12', 52, null, null, 'VR', 1, 1, '5', 'G', 18, array[]::text[], null),
  (60, 7, 18, 937, 'Sarah Pearson', false, '1905-11-13', 26, null, null, 'VR', 1, 1, '5', 'N', 19, array['name']::text[], null),
  (61, 7, 19, 942, 'Estelle Lester', false, '1905-11-16', 32, null, null, 'VR', 1, 1, '5', 'M', 19, array['name']::text[], null),
  (62, 7, 20, 943, 'Jos. L. Gray', false, '1905-11-19', 31, null, null, 'VR', 1, 1, '5', 'M', 20, array[]::text[], null),
  (63, 7, 21, 944, 'Jno. Long', false, '1905-11-19', 12, 5, null, 'VR', 1, 1, '5', 'O', 20, array['name']::text[], null),
  (64, 7, 22, 958, 'Inf. of H. Wilson', true, '1905-11-28', null, null, null, 'VR', 1, 1, '6', 'N', 27, array[]::text[], '"1897" pencilled in margin'),
  (65, 7, 23, 959, 'F. Brown Jr.', false, '1905-11-29', 1, 1, null, 'VR', 1, 1, '6', 'T', 27, array['name']::text[], null),
  (66, 7, 24, 961, 'Inf. of Thomas Leary', true, '1905-11-29', null, 1, null, 'VR', 1, 1, '6', 'G', 27, array['name','range']::text[], null),
  (67, 7, 25, 938, 'Inf. of W. Britten', true, '1905-11-13', null, null, null, 'W', 2, 1, '10', 'L', 18, array['range']::text[], null),
  (68, 7, 26, 953, 'Jno. Phillips', false, '1905-11-25', 2, 4, null, 'VR', 1, 1, '6', 'S', 27, array['range']::text[], null),
  (69, 7, 27, 952, 'Inf. of Jno. Weeks', true, '1905-11-24', null, null, 2, 'VR', 1, 1, '6', 'L', 27, array['range']::text[], null),
  (70, 7, 28, 951, 'A. Holland', false, '1905-11-22', null, 1, null, 'VR', 1, 1, '6', 'G', 27, array[]::text[], null),
  (71, 7, 29, 948, 'Inf. of Levy Logan', true, '1905-11-22', null, 1, null, 'W', 2, 1, '10', 'B', 18, array['name']::text[], null),
  (72, 7, 30, 947, 'Willie L. McDuffie', false, '1905-11-21', null, null, 6, 'VR', 1, 1, '6', null, 27, array['name']::text[], 'Range obscured by ink blot'),
  (73, 7, 31, 941, 'Jno. D. Davis', false, '1905-11-14', 1, 7, null, 'VR', 1, 1, '6', null, 27, array[]::text[], 'Range obscured by ink blot'),
  (74, 7, 32, 940, 'Inf. of Josy Key', true, '1905-11-14', null, null, 32, 'VR', 1, 1, '6', 'S', 27, array['name','range']::text[], null),
  (75, 7, 33, 920, 'Inf. of Geo. Martin', true, '1905-11-02', null, null, null, 'VR', 1, 1, '6', 'B', 27, array[]::text[], null),
  (76, 7, 34, 919, 'Johnie Cunningham', false, '1905-11-01', null, null, null, 'VR', 1, 1, '6', 'J', 27, array[]::text[], null),
  (77, 7, 35, 945, 'Mary Boner', false, '1905-11-20', 40, null, null, 'VR', 1, 1, '5', 'L', 19, array['name']::text[], null),
  (78, 7, 36, 946, 'Betsy Story', false, '1905-11-21', 71, null, null, 'SS', 1, 2, '86', 'O', 2, array['plat','lot']::text[], null),
  (79, 7, 37, 949, 'Jno. T. Hanford', false, '1905-11-22', 45, null, null, 'VR', 1, 1, '5', 'L', 18, array['range']::text[], null),
  (80, 7, 38, 950, 'Wm. Leland', false, '1905-11-22', 80, null, null, 'SS', 1, 3, 'Club', 'A', 1, array['plat','lot','range']::text[], null),
  (81, 7, 39, 954, 'Henry Harris', false, '1905-11-23', 58, null, null, 'VR', 1, 1, '5', 'E', 19, array[]::text[], null),
  (82, 7, 40, 955, 'Oliver J. Keith', false, '1905-11-25', 18, null, null, 'VR', 1, 1, '5', 'E', 19, array[]::text[], null),
  (83, 7, 41, 956, 'Amos J. Woodard', false, '1905-11-27', 48, null, null, 'SS', 2, 2, '36', 'A', 4, array['plat']::text[], null)
on conflict do nothing;

select count(*) from public.burial_records;
