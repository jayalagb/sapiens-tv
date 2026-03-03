ALTER TABLE videos ADD COLUMN location VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE videos ADD COLUMN university VARCHAR(255) NOT NULL DEFAULT '';
CREATE INDEX idx_videos_location ON videos(location);
CREATE INDEX idx_videos_university ON videos(university);
