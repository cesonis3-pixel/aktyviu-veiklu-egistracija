-- Baltic Winter v1.1: legacy destructive seed retired.
-- Read-only inspection of existing data. Not part of build or deployment.
-- Do not reset or reseed the shared production database.
select id, title, description, location, starts_at, capacity, status
from public.activities
order by starts_at;
