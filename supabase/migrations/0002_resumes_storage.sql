-- Opened Role — resume file storage.
-- Run this after 0001_init.sql, in the Supabase SQL editor.

-- A private bucket for resume uploads. Files are reached via short-lived signed
-- URLs, never a public link.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

-- storage.objects already has RLS enabled; add policies scoped to this bucket.

-- Anyone signed in can read a resume (profiles are visible to all members, and
-- the download button lives on the public profile page).
create policy "authenticated can read resumes"
  on storage.objects for select to authenticated
  using (bucket_id = 'resumes');

-- You can only write/replace/remove files inside your own folder (folder name
-- must equal your user id).
create policy "users upload own resume"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users update own resume"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete own resume"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
