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
