-- Tenant DB roles must not be able to connect to the control plane database.
DO $$
BEGIN
  EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', current_database());
END
$$;
