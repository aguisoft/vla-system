-- AlterTable
ALTER TABLE "core"."User" ADD COLUMN     "customRoleId" TEXT;

-- CreateTable
CREATE TABLE "core"."CustomRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomRole_name_key" ON "core"."CustomRole"("name");

-- AddForeignKey
ALTER TABLE "core"."User" ADD CONSTRAINT "User_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "core"."CustomRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
