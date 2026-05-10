-- Idempotent mutation ledger + incremental sync query indexes

CREATE TABLE IF NOT EXISTS "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestMethod" TEXT NOT NULL,
    "requestPath" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyRecord_tenantId_actorUserId_idempotencyKey_key"
    ON "IdempotencyRecord"("tenantId", "actorUserId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "IdempotencyRecord_tenantId_expiresAt_idx"
    ON "IdempotencyRecord"("tenantId", "expiresAt");

ALTER TABLE "IdempotencyRecord" DROP CONSTRAINT IF EXISTS "IdempotencyRecord_tenantId_fkey";
ALTER TABLE "IdempotencyRecord"
    ADD CONSTRAINT "IdempotencyRecord_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Appointment_tenantId_updatedAt_id_idx"
    ON "Appointment"("tenantId", "updatedAt", "id");

CREATE INDEX IF NOT EXISTS "Patient_tenantId_updatedAt_id_idx"
    ON "Patient"("tenantId", "updatedAt", "id");
