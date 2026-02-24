-- Add login lockout columns to admins and users tables
ALTER TABLE admins ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
