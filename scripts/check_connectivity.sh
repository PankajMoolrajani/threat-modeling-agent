#!/bin/bash
#
# Connectivity check script wrapper
# Run this inside the threat-modeling-service container
#
# Usage from host:
#   docker exec -it threat-modeling-service /app/scripts/check_connectivity.sh
#
# Or if running inside container:
#   /app/scripts/check_connectivity.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting connectivity checks..."
echo ""

# Run the Python connectivity check script
python3 "${SCRIPT_DIR}/check_connectivity.py"
