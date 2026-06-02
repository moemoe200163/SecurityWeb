-- AlterTable: Replace plaintext api_key with prefix + hashed key
-- Existing rows cannot be migrated (old keys are plaintext), so remove them first.
-- Re-seed after migration with `npm run db:seed`.
DELETE FROM "users";

-- Drop old api_key column and its constraint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_api_key_key";
ALTER TABLE "users" DROP COLUMN IF EXISTS "api_key";

-- Add new columns (NOT NULL since table is now empty)
ALTER TABLE "users" ADD COLUMN "key_prefix" VARCHAR(11) NOT NULL;
ALTER TABLE "users" ADD COLUMN "hashed_key" VARCHAR(64) NOT NULL;

-- Add unique constraints
CREATE UNIQUE INDEX "users_key_prefix_key" ON "users"("key_prefix");
CREATE UNIQUE INDEX "users_hashed_key_key" ON "users"("hashed_key");
