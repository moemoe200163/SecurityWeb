-- CreateIndex
CREATE INDEX "alerts_createdAt_status_idx" ON "alerts"("createdAt", "status");

-- CreateIndex
CREATE INDEX "alerts_status_idx" ON "alerts"("status");
