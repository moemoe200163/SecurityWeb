-- Create default admin user
-- API Key: aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233aabb (64 chars)
INSERT INTO users (id, api_key, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233aabb', 'admin')
ON CONFLICT (id) DO NOTHING;

-- Create default regular user
INSERT INTO users (id, api_key, role) VALUES
  ('00000000-0000-0000-0000-000000000002', '1122334455667788112233445566778811223344556677881122334455667788', 'user')
ON CONFLICT (id) DO NOTHING;