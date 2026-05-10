-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PatientSex" AS ENUM ('male', 'female');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PatientRecordStatus" AS ENUM ('new', 'active', 'inactive');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "sex" "PatientSex" NOT NULL DEFAULT 'male';
ALTER TABLE "Patient" ADD COLUMN "bloodType" TEXT NOT NULL DEFAULT 'O+';
ALTER TABLE "Patient" ADD COLUMN "recordStatus" "PatientRecordStatus" NOT NULL DEFAULT 'new';
ALTER TABLE "Patient" ADD COLUMN "ageYears" INTEGER;
ALTER TABLE "Patient" ADD COLUMN "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Patient" ADD COLUMN "medications" JSONB;
ALTER TABLE "Patient" ADD COLUMN "vitals" JSONB;
