# Setup Supabase Storage for Presentation Recordings

## Quick Setup:

1. **Go to Supabase Dashboard:** https://supabase.com/dashboard
2. **Navigate to Storage** (left sidebar)
3. **Create New Bucket:**
   - Name: `presentation-recordings`
   - Public: ✅ **YES** (videos need to be playable)
   - File size limit: 500 MB
   - Allowed MIME types: `video/webm`

4. **Set Bucket Policies:**
   ```sql
   -- Allow authenticated users to upload
   CREATE POLICY "Allow authenticated uploads"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'presentation-recordings');

   -- Allow public access to read videos
   CREATE POLICY "Allow public downloads"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'presentation-recordings');
   ```

## Done!

Videos will now upload to Supabase Storage just like the AOI Precheck recordings!

