#!/bin/bash
# Mine antigravity brain conversations and copy useful artifacts to cognee data dir
set -e

BRAIN="/home/steve/.gemini/antigravity/brain"
DATA="/home/steve/cognee/data"
mkdir -p "$DATA"

count=0

for conv_dir in "$BRAIN"/*/; do
    conv_id=$(basename "$conv_dir")
    
    # Skip the current conversation
    [ "$conv_id" = "8779c39a-f489-4e49-8a88-c3370adff410" ] && continue
    
    # Copy resolved markdown artifacts (implementation plans, walkthroughs, etc.)
    for resolved in "$conv_dir"*.md.resolved; do
        [ -f "$resolved" ] || continue
        basename_file=$(basename "$resolved" .resolved)
        # Only include files with actual content (>100 bytes)
        size=$(wc -c < "$resolved")
        [ "$size" -lt 100 ] && continue
        
        dest="$DATA/${conv_id}_${basename_file}.txt"
        cp "$resolved" "$dest"
        count=$((count + 1))
    done
    
    # Copy task.md if it has content
    if [ -f "$conv_dir/task.md" ]; then
        size=$(wc -c < "$conv_dir/task.md")
        if [ "$size" -gt 100 ]; then
            cp "$conv_dir/task.md" "$DATA/${conv_id}_task.md.txt"
            count=$((count + 1))
        fi
    fi
done

echo "Copied $count files to $DATA"
echo "Total size: $(du -sh "$DATA" | cut -f1)"
echo "File count: $(ls "$DATA" | wc -l)"
