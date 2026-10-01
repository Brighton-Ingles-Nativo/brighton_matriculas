INSERT INTO "roles" ("id", "name", "permissions")
VALUES
  ('7f6a5d4c-3b2a-4918-8c7d-6e5f4a3b2c10', 'supervisor', '{"manageContracts": true}'::jsonb),
  ('8a7b6c5d-4c3b-4a29-9d8e-7f6a5b4c3d21', 'asistente_comercial', '{"viewContracts": true, "exportContracts": true}'::jsonb)
ON CONFLICT ("name") DO NOTHING;
