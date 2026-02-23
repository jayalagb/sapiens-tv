#!/bin/bash
# Install ffmpeg if not available
if ! command -v ffmpeg &> /dev/null; then
    echo "Installing ffmpeg..."
    apt-get update -qq && apt-get install -y -qq ffmpeg > /dev/null 2>&1
    echo "ffmpeg installed: $(ffmpeg -version 2>&1 | head -1)"
fi

# Start the app
node server.js
