#!/bin/bash
# Sequential memify of all datasets with log monitoring
# Stops immediately on rate limit errors

LOGFILE="/home/steve/cognee/memify_run.log"
COGNEE_URL="http://localhost:8000"

DATASETS=(
  "business:00a32172-fef2-5be6-a105-3a0f98cf3e6c"
  "veterinary:1680bc76-2041-53bb-952a-08884b2046b2"
  "main_dataset:42c45012-b0c1-5289-989f-4002d8f79fbf"
  "personal:199327f1-e820-5239-8624-66d5944b8772"
  "bookmarks:aef846a9-1b04-56c8-b332-e3c5a869ae14"
  "codebase:19d3eab2-0915-5683-891b-8bc9a6ff43b2"
  "steve:c3aab799-cfe0-5af8-9070-38e15b8d72f7"
  "openclaw:1f58259e-7a43-588c-bf9f-c6ef3e8f9090"
  "gemini_sessions:c49a8324-19ae-5c20-a860-feea611aff09"
  "gemini_memories:4637cc9c-2405-5726-88a2-52e1d74e4e26"
  "reference:945b00eb-dc49-5ca6-b03c-656a34f2b564"
  "cognee:f7d7d750-fa91-5121-8f39-3176c0a74a9a"
  "test:5a3e1a2b-3e51-5b27-85b0-b7ab59d8812c"
  "repo_docs:e03a46a2-5e40-5bf7-ae86-6cda3f662cd3"
)

check_rate_limits() {
  local logs=$(cd /home/steve/cognee && docker compose logs --tail=200 cognee 2>&1)
  if echo "$logs" | grep -iE "rate.?limit|429|quota.?exceeded|ResourceExhausted|RATE_LIMIT_EXCEEDED" > /dev/null 2>&1; then
    return 1
  fi
  return 0
}

echo "$(date) === MEMIFY RUN STARTED ===" >> "$LOGFILE"

for entry in "${DATASETS[@]}"; do
  NAME="${entry%%:*}"
  ID="${entry##*:}"

  echo "$(date) Starting memify: $NAME ($ID)" >> "$LOGFILE"
  echo ">>> Starting memify: $NAME"

  # Run memify (blocking mode)
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$COGNEE_URL/api/v1/memify" \
    -H "Content-Type: application/json" \
    -d "{\"datasetId\": \"$ID\"}" 2>&1)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  echo "$(date) Response for $NAME: HTTP $HTTP_CODE - $BODY" >> "$LOGFILE"

  # Check for errors
  if [ "$HTTP_CODE" = "429" ]; then
    echo "$(date) RATE LIMITED on $NAME! STOPPING." >> "$LOGFILE"
    echo "🚨 RATE LIMITED! Stopping."
    exit 1
  fi

  if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "202" ]; then
    echo "$(date) ERROR on $NAME (HTTP $HTTP_CODE). Skipping." >> "$LOGFILE"
    echo "⚠️ Error on $NAME (HTTP $HTTP_CODE). Skipping."
    continue
  fi

  echo "$(date) Completed memify: $NAME" >> "$LOGFILE"
  echo "✅ Completed: $NAME"

  # Check logs for rate limit errors after each dataset
  if ! check_rate_limits; then
    echo "$(date) RATE LIMIT detected in logs after $NAME! STOPPING." >> "$LOGFILE"
    echo "🚨 Rate limit in logs! Stopping."
    exit 1
  fi

  # Wait 2 minutes between datasets to be safe
  echo "$(date) Waiting 2 minutes before next dataset..." >> "$LOGFILE"
  sleep 120
done

echo "$(date) === ALL DATASETS MEMIFIED ===" >> "$LOGFILE"
echo "🎉 All datasets processed!"
