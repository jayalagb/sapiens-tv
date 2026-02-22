/**
 * One-time script to migrate existing local video files to Azure Blob Storage.
 *
 * Usage:
 *   cd backend
 *   node scripts/migrate-to-blob.js
 *
 * Prerequisites:
 *   - AZURE_STORAGE_CONNECTION_STRING set in .env
 *   - Migration 005 already applied (video_url stores blob name only)
 *   - Local files still exist in backend/uploads/videos/
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, pool } = require('../config/database');
const { uploadBlob } = require('../config/blobStorage');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'videos');

async function migrate() {
    console.log('Starting migration to Azure Blob Storage...');

    const result = await query('SELECT id, video_url FROM videos ORDER BY id');
    const videos = result.rows;
    console.log(`Found ${videos.length} videos in database.`);

    let uploaded = 0;
    let skipped = 0;
    let errors = 0;

    for (const video of videos) {
        const blobName = video.video_url;
        const localPath = path.join(UPLOADS_DIR, blobName);

        if (!fs.existsSync(localPath)) {
            console.log(`  SKIP: ${blobName} — local file not found`);
            skipped++;
            continue;
        }

        try {
            await uploadBlob(blobName, localPath);
            console.log(`  OK: ${blobName}`);
            uploaded++;
        } catch (err) {
            console.error(`  ERROR: ${blobName} — ${err.message}`);
            errors++;
        }
    }

    console.log('\nMigration complete:');
    console.log(`  Uploaded: ${uploaded}`);
    console.log(`  Skipped:  ${skipped}`);
    console.log(`  Errors:   ${errors}`);

    await pool.end();
}

migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
