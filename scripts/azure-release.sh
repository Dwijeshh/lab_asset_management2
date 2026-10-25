#!/usr/bin/env bash
set -euo pipefail

: "${AZURE_RESOURCE_GROUP:?Set AZURE_RESOURCE_GROUP}"
: "${AZURE_APP_NAME:?Set AZURE_APP_NAME}"
: "${AZURE_MIGRATION_JOB:?Set AZURE_MIGRATION_JOB}"
: "${APP_IMAGE:?Set APP_IMAGE to an immutable image digest}"
: "${MIGRATION_IMAGE:?Set MIGRATION_IMAGE to an immutable image digest}"

[[ "$APP_IMAGE" == *@sha256:* && "$MIGRATION_IMAGE" == *@sha256:* ]] || {
  echo 'Both images must use immutable @sha256: digests' >&2; exit 1;
}

execution=$(az containerapp job start \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_MIGRATION_JOB" \
  --image "$MIGRATION_IMAGE" \
  --env-vars "DATABASE_URL=secretref:database-url" \
  --query name -o tsv)
[[ -n "$execution" ]] || { echo 'Migration job did not return an execution name' >&2; exit 1; }
echo "Waiting for migration execution: $execution"
for attempt in $(seq 1 60); do
  status=$(az containerapp job execution show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_MIGRATION_JOB" \
    --job-execution-name "$execution" \
    --query properties.status -o tsv)
  case "$status" in
    Succeeded) break ;;
    Failed|Canceled|Cancelled) echo "Migration $status" >&2; exit 1 ;;
  esac
  if [[ "$attempt" -eq 60 ]]; then echo 'Migration timed out' >&2; exit 1; fi
  sleep 10
done

previous_revision=$(az containerapp show \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_APP_NAME" \
  --query properties.latestReadyRevisionName -o tsv)

rollback() {
  if [[ -n "$previous_revision" ]]; then
    echo "Restoring traffic to revision $previous_revision" >&2
    az containerapp ingress traffic set \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$AZURE_APP_NAME" \
      --revision-weight "$previous_revision=100" -o none
  fi
}

az containerapp update \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_APP_NAME" \
  --image "$APP_IMAGE" -o none

new_revision=$(az containerapp show \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_APP_NAME" \
  --query properties.latestRevisionName -o tsv)
[[ -n "$new_revision" ]] || { echo 'Update returned no revision' >&2; rollback; exit 1; }
ready=false
for attempt in $(seq 1 60); do
  ready_revision=$(az containerapp show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_APP_NAME" \
    --query properties.latestReadyRevisionName -o tsv)
  if [[ "$ready_revision" == "$new_revision" ]]; then ready=true; break; fi
  sleep 10
done
if [[ "$ready" != true ]]; then
  echo "Revision $new_revision did not become ready" >&2
  rollback
  exit 1
fi
az containerapp ingress traffic set \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_APP_NAME" \
  --revision-weight latest=100 -o none

fqdn=$(az containerapp show \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_APP_NAME" \
  --query properties.configuration.ingress.fqdn -o tsv)
[[ -n "$fqdn" ]] || { echo 'Container App has no public FQDN' >&2; exit 1; }
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 10 "https://$fqdn/api/health" | grep -q '"ok":true' \
    && curl --fail --silent --show-error --max-time 10 "https://$fqdn/login" >/dev/null; then
    echo "Release healthy: https://$fqdn"
    exit 0
  fi
  sleep 10
done
echo "Release health check failed: https://$fqdn" >&2
rollback
exit 1
