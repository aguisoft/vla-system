DROP TABLE IF EXISTS virtual_office."UserProfileOverride";
DROP INDEX IF EXISTS virtual_office."MeetingInvite_hostId_state_idx";
DROP TABLE IF EXISTS virtual_office."MeetingInvite";
DROP TABLE IF EXISTS virtual_office."HolidayOverride";
DROP TABLE IF EXISTS virtual_office."Holiday";
DROP TABLE IF EXISTS virtual_office."AbsenceRecord";
DROP TYPE  IF EXISTS virtual_office."InviteState";
DROP TYPE  IF EXISTS virtual_office."AbsenceType";

ALTER TABLE virtual_office."PresenceStatus"
  DROP COLUMN IF EXISTS justification,
  DROP COLUMN IF EXISTS "statusStartsAt",
  DROP COLUMN IF EXISTS "statusEndsAt",
  DROP COLUMN IF EXISTS "meetingId";

ALTER TABLE virtual_office."BitrixUserMapping"
  DROP COLUMN IF EXISTS "departmentId",
  DROP COLUMN IF EXISTS "isDepartmentHead",
  DROP COLUMN IF EXISTS country;

-- Reversa manual. NO recupera qué filas eran BUSY: ese dato se perdió en el
-- paso 1 de la migración hacia adelante. Restaurar desde el respaldo de
-- PresenceStatus si hace falta el valor original.
UPDATE virtual_office."PresenceStatus"
   SET status = 'AVAILABLE'
 WHERE status IN ('IN_MEETING_INTERNAL', 'IN_MEETING_EXTERNAL');

ALTER TYPE virtual_office."OfficeStatus" RENAME TO "OfficeStatus_new";

CREATE TYPE virtual_office."OfficeStatus" AS ENUM (
  'AVAILABLE', 'BUSY', 'IN_MEETING', 'FOCUS', 'LUNCH', 'BRB', 'OFFLINE'
);

ALTER TABLE virtual_office."PresenceStatus"
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE virtual_office."OfficeStatus"
    USING status::text::virtual_office."OfficeStatus",
  ALTER COLUMN status SET DEFAULT 'OFFLINE';

DROP TYPE virtual_office."OfficeStatus_new";
