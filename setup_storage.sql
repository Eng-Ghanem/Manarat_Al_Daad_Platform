-- Create the course-images bucket
insert into storage.buckets (id, name, public)
values ('course-images', 'course-images', true)
on conflict (id) do nothing;

-- Allow public access for reading images
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'course-images' );

-- Allow authenticated admins to upload images
create policy "Admins can upload"
on storage.objects for insert
with check ( bucket_id = 'course-images' and (auth.role() = 'authenticated') );

-- Allow authenticated admins to update/delete images
create policy "Admins can update"
on storage.objects for update
using ( bucket_id = 'course-images' and (auth.role() = 'authenticated') );

create policy "Admins can delete"
on storage.objects for delete
using ( bucket_id = 'course-images' and (auth.role() = 'authenticated') );
