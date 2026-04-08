-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "core";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "virtual_office";

-- CreateEnum
CREATE TYPE "core"."UserRole" AS ENUM ('ADMIN', 'STAFF', 'STUDENT', 'PROFESSOR');

-- CreateEnum
CREATE TYPE "virtual_office"."HairStyle" AS ENUM ('short', 'long', 'curly', 'bald', 'ponytail', 'mohawk', 'afro', 'buzz');

-- CreateEnum
CREATE TYPE "virtual_office"."Accessory" AS ENUM ('glasses', 'headphones', 'hat', 'earbuds', 'none');

-- CreateEnum
CREATE TYPE "virtual_office"."CheckSource" AS ENUM ('WEB', 'BITRIX', 'MOBILE');

-- CreateEnum
CREATE TYPE "virtual_office"."OfficeStatus" AS ENUM ('AVAILABLE', 'BUSY', 'IN_MEETING', 'FOCUS', 'LUNCH', 'BRB', 'OFFLINE');

-- CreateTable
CREATE TABLE "core"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "core"."UserRole" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Plugin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "route" TEXT,
    "icon" TEXT,
    "adminOnly" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plugin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_office"."OfficeLayout" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 40,
    "height" INTEGER NOT NULL DEFAULT 30,
    "backgroundImage" TEXT,
    "zones" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_office"."UserAvatar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skinColor" TEXT NOT NULL DEFAULT '#F5CBA7',
    "hairStyle" "virtual_office"."HairStyle" NOT NULL DEFAULT 'short',
    "hairColor" TEXT NOT NULL DEFAULT '#2C2C2C',
    "shirtColor" TEXT NOT NULL DEFAULT '#3498DB',
    "accessory" "virtual_office"."Accessory" NOT NULL DEFAULT 'none',
    "emoji" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAvatar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_office"."CheckInRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3),
    "totalMinutes" INTEGER,
    "source" "virtual_office"."CheckSource" NOT NULL DEFAULT 'WEB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckInRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_office"."PresenceStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "virtual_office"."OfficeStatus" NOT NULL DEFAULT 'OFFLINE',
    "statusMessage" TEXT,
    "currentZoneId" TEXT,
    "defaultZoneId" TEXT,
    "positionX" INTEGER,
    "positionY" INTEGER,
    "isCheckedIn" BOOLEAN NOT NULL DEFAULT false,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresenceStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_office"."BitrixUserMapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bitrixUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BitrixUserMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "core"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "core"."User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "Plugin_name_key" ON "core"."Plugin"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserAvatar_userId_key" ON "virtual_office"."UserAvatar"("userId");

-- CreateIndex
CREATE INDEX "CheckInRecord_userId_idx" ON "virtual_office"."CheckInRecord"("userId");

-- CreateIndex
CREATE INDEX "CheckInRecord_checkInAt_idx" ON "virtual_office"."CheckInRecord"("checkInAt");

-- CreateIndex
CREATE INDEX "CheckInRecord_userId_checkInAt_idx" ON "virtual_office"."CheckInRecord"("userId", "checkInAt");

-- CreateIndex
CREATE UNIQUE INDEX "PresenceStatus_userId_key" ON "virtual_office"."PresenceStatus"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BitrixUserMapping_userId_key" ON "virtual_office"."BitrixUserMapping"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BitrixUserMapping_bitrixUserId_key" ON "virtual_office"."BitrixUserMapping"("bitrixUserId");

-- AddForeignKey
ALTER TABLE "virtual_office"."UserAvatar" ADD CONSTRAINT "UserAvatar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_office"."CheckInRecord" ADD CONSTRAINT "CheckInRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_office"."PresenceStatus" ADD CONSTRAINT "PresenceStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_office"."BitrixUserMapping" ADD CONSTRAINT "BitrixUserMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
