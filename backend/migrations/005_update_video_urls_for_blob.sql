-- Migration: Strip /uploads/videos/ prefix from video_url so it stores only the blob name (uuid.ext)
UPDATE videos
SET video_url = REPLACE(video_url, '/uploads/videos/', '')
WHERE video_url LIKE '/uploads/videos/%';
