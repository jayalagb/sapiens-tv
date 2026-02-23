-- Add expiration to password resets (1 hour default)
ALTER TABLE password_resets
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour');

-- Auto-expire old pending resets
UPDATE password_resets SET status = 'completed'
    WHERE status = 'pending' AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 hour';
