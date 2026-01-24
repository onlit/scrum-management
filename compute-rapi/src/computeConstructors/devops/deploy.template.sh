#!/bin/sh

# Exit immediately if a command exits with a non-zero status.
# This ensures that the script will stop if any step fails.
set -e

echo "--- Starting deployment on server ---"
echo "Deploying to environment: $CONF_FOLDER"
echo "Base destination path: $DESTINATION"

# Define the full path for the current deployment
DEPLOYMENT_PATH="$DESTINATION/$CONF_FOLDER"

# Ensure the target directory exists before we try to use it.
# The '-p' flag creates parent directories if needed and doesn't fail if it already exists.
echo "Ensuring deployment directory exists: $DEPLOYMENT_PATH"
mkdir -p "$DEPLOYMENT_PATH"

echo "Changing to deployment directory..."
if ! cd "$DEPLOYMENT_PATH"; then
  echo "FATAL: Could not change to directory '$DEPLOYMENT_PATH'. Check path and permissions."
  exit 1
fi

echo "Successfully changed directory. Current directory is: $(pwd)"
echo "Listing directory contents:"
ls -la

echo "Applying Kubernetes manifests from all .yml files..."
sudo kubectl apply --prune -l devOps={{MICROSERVICE_SLUG}}-k8s -n "$CONF_FOLDER" -f $DEPLOYMENT_PATH

sudo kubectl create -n "$CONF_FOLDER" -f $DEPLOYMENT_PATH/jobs

echo "Manifests applied successfully."

echo "Restarting deployments to ensure changes from ConfigMaps or Secrets are applied..."
# Restart the specific deployments by name. This is more direct than referencing the source files.
sudo kubectl rollout restart deployment {{MICROSERVICE_SLUG}}-rapi -n $CONF_FOLDER

echo "--- Deployment finished successfully ---"
