ALTER TABLE videos ADD COLUMN likes_count INT NOT NULL DEFAULT 0;

CREATE TABLE video_likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, video_id)
);

CREATE INDEX idx_video_likes_video ON video_likes(video_id);
CREATE INDEX idx_video_likes_user ON video_likes(user_id);
CREATE INDEX idx_videos_likes_count ON videos(likes_count DESC);
