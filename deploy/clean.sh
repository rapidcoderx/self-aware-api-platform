cd /Users/sathishkr/self-aware-api-platform
set -a
source backend/.env
set +a

curl -sS -o /tmp/anthropic_check.json -w "%{http_code}\n" \
  https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model":"claude-sonnet-4-20250514",
    "max_tokens":16,
    "messages":[{"role":"user","content":"ping"}]
  }'

cat /tmp/anthropic_check.json
