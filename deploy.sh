#!/usr/bin/env bash
# One-shot deploy to Cloud Run. Run it from Cloud Shell.
#
#   bash deploy.sh                    # deploy without a DataMall key
#   LTA_ACCOUNT_KEY=xxx bash deploy.sh   # deploy with live data
#
# Safe to run repeatedly; each run replaces the running revision.
set -euo pipefail

SERVICE="${SERVICE:-commuter-companion}"
REGION="${REGION:-asia-southeast1}"     # Singapore
PROJECT="$(gcloud config get-value project 2>/dev/null)"

if [ -z "$PROJECT" ] || [ "$PROJECT" = "(unset)" ]; then
  echo "No project set. Run:  gcloud config set project YOUR_PROJECT_ID" >&2
  exit 1
fi

echo "project : $PROJECT"
echo "region  : $REGION"
echo "service : $SERVICE"
echo

echo "[1/3] enabling APIs (no-op if already on)"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com --quiet

echo "[2/3] building and deploying from source"
ENVS=""
[ -n "${LTA_ACCOUNT_KEY:-}" ]   && ENVS="LTA_ACCOUNT_KEY=${LTA_ACCOUNT_KEY}"
[ -n "${ANTHROPIC_API_KEY:-}" ] && ENVS="${ENVS:+$ENVS,}ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"

# shellcheck disable=SC2086
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  ${ENVS:+--set-env-vars "$ENVS"} \
  --quiet

echo
echo "[3/3] done"
URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo
echo "  $URL"
echo
echo "  ^ this is the URL you submit. Open it on your phone."
echo
echo "If it returns 403, public access was blocked by an org policy."
echo "See DEPLOY.md, section 'If --allow-unauthenticated is refused'."
