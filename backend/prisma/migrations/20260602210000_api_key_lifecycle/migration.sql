-- AlterTable
-- Make key columns nullable (so revocation can null them out)
-- Add lifecycle timestamps (created/revoked/expires)
-- Backfill key_created_at from created_at for existing rows
ALTER TABLE "users" ADD COLUMN     "key_created_at" TIMESTAMP(3),
ADD COLUMN     "key_expires_at" TIMESTAMP(3),
ADD COLUMN     "key_revoked_at" TIMESTAMP(3),
ALTER COLUMN "key_prefix" DROP NOT NULL,
ALTER COLUMN "hashed_key" DROP NOT NULL;

-- Backfill key_created_at for existing users
UPDATE "users" SET "key_created_at" = "createdAt" WHERE "key_created_at" IS NULL;
