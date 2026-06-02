-- Migration: Add all tables for SecurityWeb
-- Generated from Prisma schema - DO NOT EDIT MANUALLY

-- Sessions table
CREATE TABLE "Session" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "module" VARCHAR(255) NOT NULL,
    "input" JSONB NOT NULL,
    "status" VARCHAR(255) NOT NULL DEFAULT 'in_progress',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "Session_module_idx" ON "Session"("module");
CREATE INDEX "Session_status_idx" ON "Session"("status");
CREATE INDEX "Session_createdAt_idx" ON "Session"("createdAt");

-- Steps table
CREATE TABLE "Step" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "sessionId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "status" VARCHAR(255) NOT NULL DEFAULT 'pending',
    "content" TEXT,
    "codeBlock" TEXT,
    "toolCalls" JSONB,
    "timestamp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Step_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE
);

CREATE INDEX "Step_sessionId_idx" ON "Step"("sessionId");
CREATE INDEX "Step_status_idx" ON "Step"("status");

-- Messages table
CREATE TABLE "Message" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "sessionId" UUID NOT NULL,
    "role" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE
);

CREATE INDEX "Message_sessionId_idx" ON "Message"("sessionId");

-- IP Reputation table
CREATE TABLE "IpReputation" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ipAddress" VARCHAR(255) UNIQUE NOT NULL,
    "status" VARCHAR(255) NOT NULL DEFAULT 'unknown',
    "threatLevel" VARCHAR(255),
    "confidenceScore" INTEGER,
    "countryCode" VARCHAR(10),
    "countryName" VARCHAR(255),
    "isp" VARCHAR(255),
    "domain" VARCHAR(255),
    "usageType" VARCHAR(255),
    "totalReports" INTEGER,
    "lastReportedAt" TIMESTAMP(3),
    "isWhitelisted" BOOLEAN NOT NULL DEFAULT false,
    "sources" JSONB,
    "firstSeen" TIMESTAMP(3),
    "lastSeen" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "IpReputation_ipAddress_idx" ON "IpReputation"("ipAddress");
CREATE INDEX "IpReputation_status_idx" ON "IpReputation"("status");
CREATE INDEX "IpReputation_threatLevel_idx" ON "IpReputation"("threatLevel");
CREATE INDEX "IpReputation_createdAt_idx" ON "IpReputation"("createdAt");

-- API Usage table
CREATE TABLE "ApiUsage" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "apiName" VARCHAR(255) NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "dailyLimit" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiUsage_apiName_date_key" UNIQUE ("apiName", "date")
);

CREATE INDEX "ApiUsage_apiName_idx" ON "ApiUsage"("apiName");
CREATE INDEX "ApiUsage_date_idx" ON "ApiUsage"("date");

-- BGP Update table (BIGINT id for high-volume time-series data)
CREATE TABLE "BgpUpdate" (
    "id" BIGSERIAL PRIMARY KEY,
    "prefix" VARCHAR(255) NOT NULL,
    "asPath" TEXT,
    "peerAsn" BIGINT,
    "originAsn" BIGINT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" VARCHAR(255) NOT NULL DEFAULT 'A',
    "source" VARCHAR(255),
    "country" VARCHAR(10)
);

CREATE INDEX "BgpUpdate_prefix_idx" ON "BgpUpdate"("prefix");
CREATE INDEX "BgpUpdate_originAsn_idx" ON "BgpUpdate"("originAsn");
CREATE INDEX "BgpUpdate_timestamp_idx" ON "BgpUpdate"("timestamp");
CREATE INDEX "BgpUpdate_timestamp_prefix_idx" ON "BgpUpdate"("timestamp", "prefix");

-- BGP ASN Info table
CREATE TABLE "BgpAsnInfo" (
    "asn" BIGINT PRIMARY KEY,
    "name" VARCHAR(255),
    "country" VARCHAR(10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "BgpAsnInfo_asn_idx" ON "BgpAsnInfo"("asn");

-- System Setting table
CREATE TABLE "SystemSetting" (
    "id" SERIAL PRIMARY KEY,
    "key" VARCHAR(255) UNIQUE NOT NULL,
    "value" TEXT NOT NULL,
    "desc" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SystemSetting_key_idx" ON "SystemSetting"("key");

-- URLhaus Result table
CREATE TABLE "UrlHausResult" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "domain" VARCHAR(255) UNIQUE NOT NULL,
    "malicious" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(255) NOT NULL,
    "threatType" VARCHAR(255),
    "blacklists" JSONB,
    "urlCount" INTEGER NOT NULL DEFAULT 0,
    "lastSeen" TIMESTAMP(3),
    "firstSeen" TIMESTAMP(3),
    "cannedResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "UrlHausResult_domain_idx" ON "UrlHausResult"("domain");
CREATE INDEX "UrlHausResult_malicious_idx" ON "UrlHausResult"("malicious");
CREATE INDEX "UrlHausResult_createdAt_idx" ON "UrlHausResult"("createdAt");

-- OTX Result table
CREATE TABLE "OtxResult" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "indicatorType" VARCHAR(255) UNIQUE NOT NULL,
    "indicator" VARCHAR(255) NOT NULL,
    "type" VARCHAR(255) NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "OtxResult_indicatorType_idx" ON "OtxResult"("indicatorType");
CREATE INDEX "OtxResult_indicator_idx" ON "OtxResult"("indicator");
CREATE INDEX "OtxResult_type_idx" ON "OtxResult"("type");

-- Users table (uses TEXT id, not UUID - matches seed.ts with 'admin-default')
CREATE TABLE "users" (
    "id" VARCHAR(255) PRIMARY KEY,
    "api_key" VARCHAR(255) UNIQUE NOT NULL,
    "role" VARCHAR(255) NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tool Templates table
CREATE TABLE "tool_templates" (
    "id" VARCHAR(255) PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "tool" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "command_template" TEXT NOT NULL,
    "allowed_params" JSONB NOT NULL,
    "riskLevel" VARCHAR(255) NOT NULL DEFAULT 'low',
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tool Executions table
CREATE TABLE "tool_executions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "template_id" VARCHAR(255) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "session_id" VARCHAR(255),
    "params" JSONB NOT NULL,
    "status" VARCHAR(255) NOT NULL DEFAULT 'pending',
    "output" TEXT,
    "error" TEXT,
    "exit_code" INTEGER,
    "duration_ms" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tool_executions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "tool_templates"("id"),
    CONSTRAINT "tool_executions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id")
);

-- Audit Logs table
CREATE TABLE "audit_logs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" VARCHAR(255) NOT NULL,
    "action" VARCHAR(255) NOT NULL,
    "resource_type" VARCHAR(255) NOT NULL,
    "resource_id" VARCHAR(255),
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id")
);

-- Alerts table
CREATE TABLE "alerts" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "source" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "severity" VARCHAR(255) NOT NULL,
    "raw_content" TEXT NOT NULL,
    "normalized_fields" JSONB,
    "ai_verdict" VARCHAR(255),
    "human_verdict" VARCHAR(255),
    "status" VARCHAR(255) NOT NULL DEFAULT 'new',
    "session_id" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Feedback table
CREATE TABLE "knowledge_feedback" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "alert_id" VARCHAR(255) NOT NULL,
    "session_id" VARCHAR(255),
    "ai_verdict" VARCHAR(255) NOT NULL,
    "correct_verdict" VARCHAR(255) NOT NULL,
    "error_reason" VARCHAR(255),
    "lesson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_feedback_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id")
);