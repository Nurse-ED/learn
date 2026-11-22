-- =====================================================================
--  E-Learning App — database schema for Supabase (free tier)
--  Run this ONCE in: Supabase Dashboard → SQL Editor → New query → Run
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tables ----------------------------------------------------
create table if not exists profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  username       text unique not null,
  full_name      text not null default '',
  email          text,
  password_plain text,                       -- visible to admin ONLY (see README)
  role           text not null default 'student' check (role in ('student','admin')),
  created_at     timestamptz not null default now()
);

create table if not exists courses (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  category    text not null default 'General',
  emoji       text not null default '📘',
  daily_goal  int not null default 3 check (daily_goal between 0 and 50),
  target_date date,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists modules (
  id        uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title     text not null,
  position  int not null default 0
);

create table if not exists lessons (
  id        uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  module_id uuid not null references modules(id) on delete cascade,
  title     text not null,
  type      text not null check (type in ('video','pdf','ppt','text','flashcards','pamphlet','image','link')),
  url       text,
  body      text,
  cards     jsonb not null default '[]',
  minutes   int not null default 5,
  position  int not null default 0
);

create table if not exists enrollments (
  user_id    uuid not null references profiles(id) on delete cascade,
  course_id  uuid not null references courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create table if not exists lesson_progress (
  user_id      uuid not null references profiles(id) on delete cascade,
  lesson_id    uuid not null references lessons(id) on delete cascade,
  course_id    uuid not null references courses(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists assessments (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references courses(id) on delete cascade,
  title       text not null,
  description text not null default '',
  pass_mark   int not null default 70,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists questions (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  prompt        text not null,
  options       jsonb not null,
  correct       int not null,
  explanation   text not null default '',
  position      int not null default 0
);

create table if not exists attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  assessment_id uuid not null references assessments(id) on delete cascade,
  score         int not null,
  total         int not null,
  passed        boolean not null,
  created_at    timestamptz not null default now()
);

-- ---------- Helpers ---------------------------------------------------
create or replace function is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Create the profile row automatically when someone signs up
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username, full_name, email)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1))),
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.email
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Students can never change their own role or username
create or replace function protect_profile() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then      -- SQL editor has no auth.uid(), so you can promote admins there
    new.role := old.role;
    new.username := old.username;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_trg on profiles;
create trigger protect_profile_trg before update on profiles
  for each row execute function protect_profile();

-- Login by username: look up the email behind a username
create or replace function email_for_username(u text) returns text
language sql security definer stable set search_path = public as $$
  select email from profiles where username = lower(u) limit 1;
$$;

create or replace function username_available(u text) returns boolean
language sql security definer stable set search_path = public as $$
  select not exists (select 1 from profiles where username = lower(u));
$$;

-- Admin can set a new password for any student
create or replace function admin_reset_password(uid uuid, new_password text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  if length(new_password) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  update auth.users set encrypted_password = crypt(new_password, gen_salt('bf')) where id = uid;
  update profiles set password_plain = new_password where id = uid;
end $$;

-- True when the student has completed every lesson of the course (or it has none)
create or replace function course_completed(uid uuid, cid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select not exists (
    select 1 from lessons l where l.course_id = cid
      and not exists (select 1 from lesson_progress p where p.user_id = uid and p.lesson_id = l.id));
$$;

-- Quiz questions WITHOUT the correct answers (so students can't peek via the API)
create or replace function get_quiz(aid uuid)
returns table (id uuid, prompt text, options jsonb, "position" int)
language sql security definer stable set search_path = public as $$
  select q.id, q.prompt, q.options, q.position
  from questions q join assessments a on a.id = q.assessment_id
  where q.assessment_id = aid and (is_admin() or (a.published and course_completed(auth.uid(), a.course_id)))
  order by q.position;
$$;

-- Grade on the server and record the attempt
create or replace function submit_attempt(aid uuid, answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a assessments; q questions;
  total int := 0; score int := 0; pct int; ok boolean; chosen int;
  review jsonb := '[]'::jsonb;
begin
  select * into a from assessments where id = aid and (published or is_admin());
  if not found then raise exception 'Assessment not found'; end if;
  if not is_admin() and not course_completed(auth.uid(), a.course_id) then
    raise exception 'Complete the whole course to unlock this assessment';
  end if;
  for q in select * from questions where assessment_id = aid order by position loop
    total := total + 1;
    chosen := (answers ->> (q.id::text))::int;
    ok := chosen is not null and chosen = q.correct;
    if ok then score := score + 1; end if;
    review := review || jsonb_build_object(
      'id', q.id, 'prompt', q.prompt, 'options', q.options, 'chosen', chosen,
      'correct', q.correct, 'ok', ok, 'explanation', q.explanation);
  end loop;
  pct := case when total = 0 then 0 else round(score * 100.0 / total) end;
  insert into attempts (user_id, assessment_id, score, total, passed)
  values (auth.uid(), aid, score, total, pct >= a.pass_mark);
  return jsonb_build_object('score', score, 'total', total, 'pct', pct,
                            'passed', pct >= a.pass_mark, 'review', review);
end $$;

create or replace view assessment_counts as
  select assessment_id, count(*)::int as n from questions group by assessment_id;

-- ---------- Row Level Security ----------------------------------------
alter table profiles        enable row level security;
alter table courses         enable row level security;
alter table modules         enable row level security;
alter table lessons         enable row level security;
alter table enrollments     enable row level security;
alter table lesson_progress enable row level security;
alter table assessments     enable row level security;
alter table questions       enable row level security;
alter table attempts        enable row level security;

-- profiles
create policy "profiles read own or admin" on profiles for select to authenticated
  using (id = auth.uid() or is_admin());
create policy "profiles update own or admin" on profiles for update to authenticated
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

-- content: everyone signed in can read, only admin can write
create policy "courses read" on courses for select to authenticated using (published or is_admin());
create policy "courses admin write" on courses for all to authenticated using (is_admin()) with check (is_admin());

create policy "modules read" on modules for select to authenticated using (true);
create policy "modules admin write" on modules for all to authenticated using (is_admin()) with check (is_admin());

create policy "lessons read" on lessons for select to authenticated using (true);
create policy "lessons admin write" on lessons for all to authenticated using (is_admin()) with check (is_admin());

create policy "assessments read" on assessments for select to authenticated using (published or is_admin());
create policy "assessments admin write" on assessments for all to authenticated using (is_admin()) with check (is_admin());

-- questions contain the answers → admin only (students use get_quiz())
create policy "questions admin only" on questions for all to authenticated using (is_admin()) with check (is_admin());

-- student data
create policy "enroll read" on enrollments for select to authenticated using (user_id = auth.uid() or is_admin());
create policy "enroll insert" on enrollments for insert to authenticated with check (user_id = auth.uid());
create policy "enroll delete" on enrollments for delete to authenticated using (user_id = auth.uid());

create policy "progress read" on lesson_progress for select to authenticated using (user_id = auth.uid() or is_admin());
create policy "progress insert" on lesson_progress for insert to authenticated with check (user_id = auth.uid());
-- (no delete policy: completed lessons cannot be un-completed)

create policy "attempts read" on attempts for select to authenticated using (user_id = auth.uid() or is_admin());
-- attempts are inserted only by submit_attempt()

-- ---------- Storage (PDFs, images, small videos) ----------------------
insert into storage.buckets (id, name, public) values ('course-files', 'course-files', true)
  on conflict (id) do nothing;

create policy "course files public read" on storage.objects for select
  using (bucket_id = 'course-files');
create policy "course files admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'course-files' and is_admin());
create policy "course files admin update" on storage.objects for update to authenticated
  using (bucket_id = 'course-files' and is_admin());
create policy "course files admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'course-files' and is_admin());
