-- Add rating column to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS rating DECIMAL(2,1) DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_videos_rating ON videos(rating DESC);
