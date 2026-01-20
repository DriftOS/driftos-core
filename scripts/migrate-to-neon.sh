#!/bin/bash
set -e

echo "🔍 Dumping data from Fly Postgres..."

# Dump driftos_core database
echo "Dumping driftos_core..."
flyctl postgres connect -a driftos-db -d driftos_core -c "pg_dump -Fc -v" > /tmp/driftos_core.dump

# Dump driftos_embed database  
echo "Dumping driftos_embed..."
flyctl postgres connect -a driftos-db -d driftos_embed -c "pg_dump -Fc -v" > /tmp/driftos_embed.dump

# Dump driftos_gateway database
echo "Dumping driftos_gateway..."
flyctl postgres connect -a driftos-db -d driftos_gateway -c "pg_dump -Fc -v" > /tmp/driftos_gateway.dump

echo "✅ Dumps complete! Files saved to /tmp/"
echo ""
echo "Next steps:"
echo "1. Create 3 databases in Neon: driftos_core, driftos_embed, driftos_gateway"
echo "2. Run: pg_restore -d [NEON_CONNECTION_STRING] /tmp/driftos_core.dump"
echo "3. Run: pg_restore -d [NEON_CONNECTION_STRING] /tmp/driftos_embed.dump"  
echo "4. Run: pg_restore -d [NEON_CONNECTION_STRING] /tmp/driftos_gateway.dump"
