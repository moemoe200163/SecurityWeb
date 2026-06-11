-- Add owning user to Session for IDOR prevention.
-- Nullable to keep historical rows; routes enforce non-null at write time.

ALTER TABLE "Session" ADD COLUMN "userId" TEXT;

-- Backfill orphan sessions: leave NULL so they remain admin-only.
-- Admin routes (requireAdmin) still return them; user routes skip NULL-owned rows.

CREATE INDEX "Session_userId_idx" ON "Session"("userId");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
