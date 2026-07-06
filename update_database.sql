-- 1. Add pdf_url column to lessons table
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS pdf_url text;

-- 2. Create the lesson-files bucket for PDFs
insert into storage.buckets (id, name, public)
values ('lesson-files', 'lesson-files', true)
on conflict (id) do nothing;

-- 3. Set up Storage Policies for lesson-files
-- Allow public access for reading files
create policy "Public Access Files"
on storage.objects for select
using ( bucket_id = 'lesson-files' );

-- Allow authenticated admins to upload files
create policy "Admins can upload files"
on storage.objects for insert
with check ( bucket_id = 'lesson-files' and (auth.role() = 'authenticated') );

-- Allow authenticated admins to update files
create policy "Admins can update files"
on storage.objects for update
using ( bucket_id = 'lesson-files' and (auth.role() = 'authenticated') );

-- Allow authenticated admins to delete files
create policy "Admins can delete files"
on storage.objects for delete
using ( bucket_id = 'lesson-files' and (auth.role() = 'authenticated') );
