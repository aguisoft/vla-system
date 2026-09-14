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
