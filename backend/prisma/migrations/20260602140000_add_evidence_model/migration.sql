-- CreateTable
CREATE TABLE "evidence" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "alert_id" VARCHAR(255),
    "tool_execution_id" VARCHAR(255),
    "type" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "data" JSONB,
    "created_by_id" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "evidence_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "evidence_session_id_idx" ON "evidence"("session_id");

-- CreateIndex
CREATE INDEX "evidence_alert_id_idx" ON "evidence"("alert_id");

-- CreateIndex
CREATE INDEX "evidence_type_idx" ON "evidence"("type");
