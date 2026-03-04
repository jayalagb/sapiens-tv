ALTER TABLE users
    ADD COLUMN subscription_tier VARCHAR(20) NOT NULL DEFAULT 'premium';

ALTER TABLE users
    ADD CONSTRAINT users_subscription_tier_check
    CHECK (subscription_tier IN ('free', 'premium'));
