alter table post_pages
  add column is_thumbnail boolean not null default false,
  add column focal_x smallint not null default 50 check (focal_x between 0 and 100),
  add column focal_y smallint not null default 50 check (focal_y between 0 and 100);
