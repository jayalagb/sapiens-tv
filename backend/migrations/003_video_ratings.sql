-- Per-user video ratings table
CREATE TABLE IF NOT EXISTS video_ratings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    rating DECIMAL(2,1) NOT NULL CHECK (rating >= 0 AND rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_video_ratings_video ON video_ratings(video_id);
CREATE INDEX IF NOT EXISTS idx_video_ratings_user ON video_ratings(user_id);
