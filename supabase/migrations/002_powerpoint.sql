-- Run once in Supabase → SQL Editor. Allows PowerPoint lessons.
alter table lessons drop constraint if exists lessons_type_check;
alter table lessons add constraint lessons_type_check
  check (type in ('video','pdf','ppt','text','flashcards','pamphlet','image','link'));
