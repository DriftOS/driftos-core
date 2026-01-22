#!/bin/bash
# Validate schema parity between driftos-core and driftos-embed-enterprise
# Run this before merging PRs to ensure schemas remain identical

set -e

CORE_SCHEMA="$HOME/development/driftos-core/prisma/schema.prisma"
ENTERPRISE_SCHEMA="$HOME/development/driftos-embed-enterprise/prisma/schema.prisma"

if [ ! -f "$CORE_SCHEMA" ]; then
  echo "❌ driftos-core schema not found at $CORE_SCHEMA"
  exit 1
fi

if [ ! -f "$ENTERPRISE_SCHEMA" ]; then
  echo "❌ driftos-embed-enterprise schema not found at $ENTERPRISE_SCHEMA"
  exit 1
fi

# Compare schemas (ignoring whitespace differences)
if diff -wB "$CORE_SCHEMA" "$ENTERPRISE_SCHEMA" > /dev/null 2>&1; then
  echo "✅ Schemas are identical (driftos-core ↔️ driftos-embed-enterprise)"
  exit 0
else
  echo "❌ Schema mismatch detected!"
  echo ""
  echo "Differences:"
  diff -u "$CORE_SCHEMA" "$ENTERPRISE_SCHEMA" || true
  echo ""
  echo "⚠️  Schemas must be identical for future database merge"
  exit 1
fi
