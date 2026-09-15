-- 1. Sacar las filas de los valores que se eliminan.
--    Las dos van a AVAILABLE y no a FOCUS ni IN_MEETING_EXTERNAL: esos dos
--    exigen justificación y las filas viejas no la tienen, así que mapearlas
--    ahí crearía registros que violan su propia regla. Son estados del día que
--    el cron de timeman reescribe en 2 minutos; no se pierde nada real.
UPDATE virtual_office."PresenceStatus"
   SET status = 'AVAILABLE'
 WHERE status IN ('BUSY', 'IN_MEETING');

-- 2. Recrear el tipo. El DEFAULT se suelta antes de cambiar el tipo de la
--    columna y se vuelve a poner después; si no, Postgres rechaza el ALTER.
ALTER TYPE virtual_office."OfficeStatus" RENAME TO "OfficeStatus_old";

CREATE TYPE virtual_office."OfficeStatus" AS ENUM (
  'AVAILABLE',
  'IN_MEETING_INTERNAL',
  'IN_MEETING_EXTERNAL',
  'FOCUS',
  'LUNCH',
  'BRB',
  'OFFLINE'
);

ALTER TABLE virtual_office."PresenceStatus"
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE virtual_office."OfficeStatus"
    USING status::text::virtual_office."OfficeStatus",
  ALTER COLUMN status SET DEFAULT 'OFFLINE';

DROP TYPE virtual_office."OfficeStatus_old";

-- 3. Tablas y columnas nuevas
-- Generado con:
--   npx prisma migrate diff \
--     --from-schema-datamodel <schema.prisma previo a esta tarea> \
--     --to-schema-datamodel prisma/schema.prisma \
--     --script
-- (no `--from-migrations` + `--shadow-database-url`: con multiSchema esa
--  combinación reintrospecciona el estado "from" sin los prefijos de schema,
--  y el diff resultante hace DROP + CREATE de TODAS las tablas existentes.
--  Confirmado en este mismo repo con un shadow db real: 300+ líneas de
--  DROP TABLE/DROP TYPE para tablas que no cambiaron. La comparación estática
--  schema-datamodel a schema-datamodel no tiene ese problema y no requiere
--  ninguna base de datos, real o shadow.)

-- CreateEnum
CREATE TYPE "virtual_office"."AbsenceType" AS ENUM ('PERMISO', 'VACACIONES', 'INCAPACIDAD');

-- CreateEnum
CREATE TYPE "virtual_office"."InviteState" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "virtual_office"."PresenceStatus" ADD COLUMN     "justification" TEXT,
ADD COLUMN     "meetingId" TEXT,
ADD COLUMN     "statusEndsAt" TIMESTAMP(3),
ADD COLUMN     "statusStartsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "virtual_office"."BitrixUserMapping" ADD COLUMN     "country" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "isDepartmentHead" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "virtual_office"."AbsenceRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "virtual_office"."AbsenceType" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "justification" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbsenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_office"."Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_office"."HolidayOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "holidayId" TEXT NOT NULL,
    "newDate" DATE NOT NULL,
    "justification" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HolidayOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_office"."MeetingInvite" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "state" "virtual_office"."InviteState" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "MeetingInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_office"."UserProfileOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "managerUserId" TEXT,
    "country" TEXT,

    CONSTRAINT "UserProfileOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AbsenceRecord_userId_startAt_endAt_idx" ON "virtual_office"."AbsenceRecord"("userId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "AbsenceRecord_startAt_endAt_idx" ON "virtual_office"."AbsenceRecord"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "Holiday_country_date_idx" ON "virtual_office"."Holiday"("country", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_country_key" ON "virtual_office"."Holiday"("date", "country");

-- CreateIndex
CREATE INDEX "HolidayOverride_userId_newDate_idx" ON "virtual_office"."HolidayOverride"("userId", "newDate");

-- CreateIndex
CREATE UNIQUE INDEX "HolidayOverride_userId_holidayId_key" ON "virtual_office"."HolidayOverride"("userId", "holidayId");

-- CreateIndex
CREATE INDEX "MeetingInvite_inviteeId_state_idx" ON "virtual_office"."MeetingInvite"("inviteeId", "state");

-- CreateIndex
CREATE INDEX "MeetingInvite_meetingId_idx" ON "virtual_office"."MeetingInvite"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfileOverride_userId_key" ON "virtual_office"."UserProfileOverride"("userId");

-- AddForeignKey
ALTER TABLE "virtual_office"."AbsenceRecord" ADD CONSTRAINT "AbsenceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_office"."HolidayOverride" ADD CONSTRAINT "HolidayOverride_holidayId_fkey" FOREIGN KEY ("holidayId") REFERENCES "virtual_office"."Holiday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_office"."HolidayOverride" ADD CONSTRAINT "HolidayOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
-- Agregado en la ola de arreglo final (defecto #6): cancelMeetingsHostedBy
-- filtra MeetingInvite por hostId en cada PATCH /presence/status y hacía
-- seq-scan sin este índice.
CREATE INDEX "MeetingInvite_hostId_state_idx" ON "virtual_office"."MeetingInvite"("hostId", "state");
