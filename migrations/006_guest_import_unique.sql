-- One D1 row per KIE provider job (guest-job import cannot duplicate across users/requests).
-- If this fails, dedupe first:
--   DELETE FROM generations WHERE provider_job_id IS NOT NULL AND id NOT IN
--     (SELECT MIN(id) FROM generations WHERE provider_job_id IS NOT NULL GROUP BY provider_job_id);
--   npx wrangler d1 execute dreamutopia-db --remote --file=migrations/006_guest_import_unique.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_generations_provider_job_unique
  ON generations(provider_job_id) WHERE provider_job_id IS NOT NULL;
