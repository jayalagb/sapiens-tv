-- Fix race condition: only one pending reset per user at a time
CREATE UNIQUE INDEX idx_password_resets_user_pending
    ON password_resets (user_id)
    WHERE status = 'pending';

-- Audit log for critical admin actions
CREATE TABLE admin_audit_log (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(255),
    details TEXT,
    ip_addr VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX idx_audit_log_created ON admin_audit_log(created_at DESC);
