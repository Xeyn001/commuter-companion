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

echo "[1/4] enabling APIs (no-op if already on)"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com --quiet

echo "[2/4] handling credentials"

# --set-env-vars writes the key into the Cloud Run service config in
# plaintext. Anyone with roles/run.viewer can read it back with
# `gcloud run services describe`, and it shows up in deployment logs.
# Secret Manager keeps it out of both. Set USE_ENV_VARS=1 to opt out.
SECRET_ARGS=()
ENV_ARGS=()

put_secret() {          # put_secret <secret-name> <value> <env-var-name>
  local name="$1" value="$2" envvar="$3"
  if ! gcloud services list --enabled --format='value(config.name)' 2>/dev/null \
       | grep -q secretmanager.googleapis.com; then
    gcloud services enable secretmanager.googleapis.com --quiet
  fi
  if ! gcloud secrets describe "$name" >/dev/null 2>&1; then
    gcloud secrets create "$name" --replication-policy=automatic --quiet
  fi
  printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- --quiet >/dev/null
  # Cloud Run's runtime service account has to be allowed to read it.
  local sa
  sa="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
  gcloud secrets add-iam-policy-binding "$name" \
    --member="serviceAccount:${sa}" --role=roles/secretmanager.secretAccessor \
    --quiet >/dev/null 2>&1 || true
  SECRET_ARGS+=("${envvar}=${name}:latest")
  echo "  ${envvar} -> Secret Manager (${name})"
}

if [ "${USE_ENV_VARS:-0}" = "1" ]; then
  echo "  WARNING: USE_ENV_VARS=1 — keys will be stored in the service config in plaintext."
  [ -n "${LTA_ACCOUNT_KEY:-}" ]   && ENV_ARGS+=("LTA_ACCOUNT_KEY=${LTA_ACCOUNT_KEY}")
  [ -n "${ANTHROPIC_API_KEY:-}" ] && ENV_ARGS+=("ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}")
else
  [ -n "${LTA_ACCOUNT_KEY:-}" ]   && put_secret lta-account-key   "$LTA_ACCOUNT_KEY"   LTA_ACCOUNT_KEY
  [ -n "${ANTHROPIC_API_KEY:-}" ] && put_secret anthropic-api-key "$ANTHROPIC_API_KEY" ANTHROPIC_API_KEY
fi
[ ${#SECRET_ARGS[@]} -eq 0 ] && [ ${#ENV_ARGS[@]} -eq 0 ] && \
  echo "  no keys given — the app runs on the data in the repo"
echo

echo "[3/4] building and deploying from source"

DEPLOY_ARGS=(
  "$SERVICE"
  --source .
  --region "$REGION"
  --platform managed
  --allow-unauthenticated
  --port 8080
  --memory 512Mi          # measured: ~63 MB resident with the bus index loaded
  --cpu 1
  --min-instances 0
  --max-instances 3
  --timeout 60
  --quiet
)
[ ${#SECRET_ARGS[@]} -gt 0 ] && DEPLOY_ARGS+=(--set-secrets "$(IFS=,; echo "${SECRET_ARGS[*]}")")
[ ${#ENV_ARGS[@]}    -gt 0 ] && DEPLOY_ARGS+=(--set-env-vars "$(IFS=,; echo "${ENV_ARGS[*]}")")

gcloud run deploy "${DEPLOY_ARGS[@]}"

echo
echo "[4/4] checking it actually works"
URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"

# Deploying is not the same as working. Check before claiming success.
fail=0
check() {                # check <path> <what we expect to see>
  local path="$1" want="$2"
  if curl -fsS --max-time 20 "${URL}${path}" | grep -q "$want"; then
    echo "  ok   ${path}"
  else
    echo "  FAIL ${path}"; fail=1
  fi
}
check /healthz ok
check /api/bus '"stops"'
check / "Commuter"
echo
if [ "$fail" = "1" ]; then
  echo "  Deployed, but something is not responding. See DEPLOY.md." >&2
else
  echo "  All checks passed."
fi
echo
echo "  $URL"
echo
echo "  ^ this is the URL you submit. Open it on your phone."
echo
echo "If it returns 403, public access was blocked by an org policy."
echo "See DEPLOY.md, section 'If --allow-unauthenticated is refused'."
