#!/bin/bash
# NASA HUNCH: Continuous Telemetry & AI Log Sync
# Pushes local AI thinking logs and CAD/logistics manifests to the Latitude 5290 NAS
# Executed via crontab on the M4 Mac Mini

SOURCE_DIR="/Users/harshan/Hunch/Hunch/nasa-llaso-cad"
DEST="harshan@192.168.1.27:/home/harshan/hunch_telemetry_sync"

# Use rsync to only push updated data efficiently
rsync -avz --update \
  "$SOURCE_DIR/rover_actions.log" \
  "$SOURCE_DIR/dataset_latest.json" \
  "$SOURCE_DIR/lunar_logistics_manifest.json" \
  "$DEST/"
