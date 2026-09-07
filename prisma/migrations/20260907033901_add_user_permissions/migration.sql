/*
  Warnings:

  - A unique constraint covering the columns `[Email]` on the table `Users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Users" ADD COLUMN     "Email" TEXT,
ADD COLUMN     "FullName" TEXT,
ADD COLUMN     "IsActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "LastLogin" TIMESTAMPTZ(6),
ADD COLUMN     "Permissions" JSONB,
ADD COLUMN     "UpdatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "Users_Email_key" ON "Users"("Email");
