-- Update associate IDs for customers based on correct data
-- This script updates associate_id values in the customers table

-- sebastianquintero@aoglobelife.com - NO MATCH IN CSV (keeping 333036 for now)
-- johnavila@aoglobelife.com - NO MATCH IN CSV (keeping 333036 for now)
-- joseguzman@aoglobelife.com - NO MATCH IN CSV (keeping 333035 for now)
-- douglaslewis@aoglobelife.com - NO MATCH IN CSV (keeping 333035 for now)
-- crisseanwilliams@aoglobelife.com - NO MATCH IN CSV (keeping 333034 for now)
-- brienbasinger@aoglobelife.com - NO MATCH IN CSV (keeping 333033 for now)
-- omarionstokes@aoglobelife.com - NO MATCH IN CSV (keeping 333032 for now)

-- brendanjones@aoglobelife.com -> jonesbrendan@aoglobelife.com = 201723
UPDATE "public"."customers" 
SET "associate_id" = '201723'
WHERE "company_email" = 'brendanjones@aoglobelife.com' OR "personal_email" = 'brendanjones@aoglobelife.com';

-- alexandernuaman@aoglobelife.com -> alexnuaman@aoglobelife.com = 222493
UPDATE "public"."customers" 
SET "associate_id" = '222493'
WHERE "company_email" = 'alexandernuaman@aoglobelife.com' OR "personal_email" = 'alexandernuaman@aoglobelife.com';

-- terry@aoglobelife.com - NO MATCH IN CSV (keeping 333029 for now)

-- kechatripp@aoglobelife.com -> lakechatripp@aoglobelife.com = 224836
UPDATE "public"."customers" 
SET "associate_id" = '224836'
WHERE "company_email" = 'kechatripp@aoglobelife.com' OR "personal_email" = 'kechatripp@aoglobelife.com';

-- domonicbirtha@aoglobelife.com - NO MATCH IN CSV (keeping 333027 for now)

-- miaswenson@aoglobelife.com -> miaaswenson@aoglobelife.com = 183065
UPDATE "public"."customers" 
SET "associate_id" = '183065'
WHERE "company_email" = 'miaswenson@aoglobelife.com' OR "personal_email" = 'miaswenson@aoglobelife.com';

-- terrysteven@aoglobelife.com -> steventerry@aoglobelife.com = 226180
UPDATE "public"."customers" 
SET "associate_id" = '226180'
WHERE "company_email" = 'terrysteven@aoglobelife.com' OR "personal_email" = 'terrysteven@aoglobelife.com';

-- sarahoh@aoglobelife.com - NO MATCH IN CSV (keeping 333009 for now)

-- wilmerfernandez@aoglobelife.com -> wilmersfernandez@aoglobelife.com = 218218
UPDATE "public"."customers" 
SET "associate_id" = '218218'
WHERE "company_email" = 'wilmerfernandez@aoglobelife.com' OR "personal_email" = 'wilmerfernandez@aoglobelife.com';

-- Summary: Show updated records
SELECT 
  "company_email" as email,
  "associate_id",
  "first_name",
  "last_name"
FROM "public"."customers"
WHERE "company_email" IN (
  'brendanjones@aoglobelife.com',
  'alexandernuaman@aoglobelife.com',
  'kechatripp@aoglobelife.com',
  'miaswenson@aoglobelife.com',
  'terrysteven@aoglobelife.com',
  'wilmerfernandez@aoglobelife.com'
)
OR "personal_email" IN (
  'brendanjones@aoglobelife.com',
  'alexandernuaman@aoglobelife.com',
  'kechatripp@aoglobelife.com',
  'miaswenson@aoglobelife.com',
  'terrysteven@aoglobelife.com',
  'wilmerfernandez@aoglobelife.com'
)
ORDER BY "associate_id";
