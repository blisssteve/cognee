#!/bin/bash
while true; do
  LOGS=$(cd /home/steve/cognee && docker compose logs --tail=100 cognee 2>&1)
  if echo "$LOGS" | grep -iE "rate limit|429 Too Many Requests|quota exceeded|RateLimitError"; then
    echo "RATE LIMIT ERROR DETECTED! Stopping cognee..." >> /home/steve/cognee/memify_monitor.log
    cd /home/steve/cognee && docker compose stop cognee
    openclaw message send --target +61407642907 --message "🚨 **ALERT**: Rate limit error detected in Cognee. I've stopped the container automatically to prevent a ban."
    exit 1
  fi
  echo "$(date) - Checked logs, no rate limit errors." >> /home/steve/cognee/memify_monitor.log
  sleep 300
done
