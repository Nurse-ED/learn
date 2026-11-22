-- Run once in Supabase → SQL Editor. Assessments unlock only at 100% course completion (enforced on the server).
create or replace function course_completed(uid uuid, cid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select not exists (
    select 1 from lessons l where l.course_id = cid
      and not exists (select 1 from lesson_progress p where p.user_id = uid and p.lesson_id = l.id));
$$;

create or replace function get_quiz(aid uuid)
returns table (id uuid, prompt text, options jsonb, "position" int)
language sql security definer stable set search_path = public as $$
  select q.id, q.prompt, q.options, q.position
  from questions q join assessments a on a.id = q.assessment_id
  where q.assessment_id = aid and (is_admin() or (a.published and course_completed(auth.uid(), a.course_id)))
  order by q.position;
$$;

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
