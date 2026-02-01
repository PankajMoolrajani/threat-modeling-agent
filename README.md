# Threat Modeling Agent

A containerized threat modeling service with PostgreSQL and Neo4j databases.

## Services Overview

| Service | Container Name | Port(s) | Description |
|---------|---------------|---------|-------------|
| threat-modeling-service | threat-modeling-service | 8000 | Main application service |
| postgres | postgres | 5432 | PostgreSQL database |
| neo4j | neo4j | 7474 (HTTP), 7687 (Bolt) | Neo4j graph database |
| neo4j-mcp | neo4j-mcp | 8808 | MCP server for Neo4j |

## Getting Started

### Start All Containers

```bash
docker-compose up -d
```

### Stop All Containers

```bash
docker-compose down
```

## Testing Container Health

### Quick Health Check (All Containers)

Check the status of all containers at once:

```bash
docker-compose ps
```

All services should show `Up` status. Example output:
```
NAME                      STATUS
neo4j                     Up (healthy)
neo4j-mcp                 Up
postgres                  Up
threat-modeling-service   Up
```

### View Container Logs

```bash
# All containers
docker-compose logs

# Specific container
docker-compose logs <service-name>

# Follow logs in real-time
docker-compose logs -f
```

---

## Individual Service Tests

### 1. PostgreSQL

**Check if PostgreSQL is accepting connections:**

```bash
docker exec -it postgres pg_isready -U postgres
```

Expected output: `/var/run/postgresql:5432 - accepting connections`

**Connect to the database:**

```bash
docker exec -it postgres psql -U postgres -d threat_modeling -c "SELECT 1;"
```

Expected output:
```
 ?column? 
----------
        1
```

**From host machine (requires psql client):**

```bash
psql -h localhost -p 5432 -U postgres -d threat_modeling -c "SELECT version();"
```

---

### 2. Neo4j

**Check Neo4j HTTP interface:**

```bash
curl -s http://localhost:7474 | head -5
```

Expected: HTML response from Neo4j browser interface.

**Test Cypher query via HTTP API:**

```bash
curl -s -u neo4j:password123 \
  -H "Content-Type: application/json" \
  -d '{"statements":[{"statement":"RETURN 1 as test"}]}' \
  http://localhost:7474/db/neo4j/tx/commit
```

Expected: JSON response with `"test": 1`

**Connect using cypher-shell inside container:**

```bash
docker exec -it neo4j cypher-shell -u neo4j -p password123 "RETURN 'Neo4j is running!' AS status;"
```

Expected output:
```
+------------------------+
| status                 |
+------------------------+
| "Neo4j is running!"    |
+------------------------+
```

**Access Neo4j Browser:**

Open in your web browser: http://localhost:7474

- Username: `neo4j`
- Password: `password123`

---

### 3. Threat Modeling Service

**Check if the service is responding:**

```bash
curl -s http://localhost:8000/health
```

Or simply check if the port is open:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/
```

Expected: HTTP status code (e.g., `200`, `404`, etc. depending on endpoint)

---

### 4. Neo4j MCP Server

**Check if MCP server is running:**

```bash
curl -s http://localhost:8808/
```

---

## Automated Health Check Script

Create and run this script to check all services at once:

```bash
#!/bin/bash

echo "=== Container Health Check ==="
echo ""

# Check Docker containers status
echo "📦 Docker Containers Status:"
docker-compose ps
echo ""

# PostgreSQL
echo "🐘 PostgreSQL:"
if docker exec postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "   ✅ PostgreSQL is accepting connections"
else
    echo "   ❌ PostgreSQL is not responding"
fi
echo ""

# Neo4j
echo "🔷 Neo4j:"
if curl -s http://localhost:7474 > /dev/null 2>&1; then
    echo "   ✅ Neo4j HTTP interface is accessible"
else
    echo "   ❌ Neo4j HTTP interface is not responding"
fi

if docker exec neo4j cypher-shell -u neo4j -p password123 "RETURN 1" > /dev/null 2>&1; then
    echo "   ✅ Neo4j Bolt protocol is working"
else
    echo "   ❌ Neo4j Bolt protocol is not responding"
fi
echo ""

# Threat Modeling Service

`
source ./../.env && adk api_server  --host 0.0.0.0 --port 5151
`

echo "🛡️ Threat Modeling Service:"
if curl -s http://localhost:8000 > /dev/null 2>&1; then
    echo "   ✅ Service is accessible on port 8000"
else
    echo "   ❌ Service is not responding on port 8000"
fi
echo ""

# Neo4j MCP
echo "🔌 Neo4j MCP Server:"
if curl -s http://localhost:8808 > /dev/null 2>&1; then
    echo "   ✅ MCP server is accessible on port 8808"
else
    echo "   ❌ MCP server is not responding on port 8808"
fi
echo ""

echo "=== Health Check Complete ==="
```

Save as `health-check.sh` and run:

```bash
chmod +x health-check.sh
./health-check.sh
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs for errors
docker-compose logs <service-name>

# Restart specific service
docker-compose restart <service-name>

# Rebuild and restart
docker-compose up -d --build <service-name>
```

### Port already in use

```bash
# Find what's using the port
lsof -i :<port-number>

# Kill the process or change the port mapping in docker-compose.yaml
```

### Database connection issues

Ensure the containers are on the same network:

```bash
docker network inspect threat-modeling-network
```

### Clear all data and start fresh

```bash
docker-compose down -v
rm -rf data/neo4j data/postgres
docker-compose up -d
```

---

## Environment Variables

| Variable | Service | Default Value |
|----------|---------|---------------|
| POSTGRES_USER | postgres | postgres |
| POSTGRES_PASSWORD | postgres | postgres |
| POSTGRES_DB | postgres | threat_modeling |
| NEO4J_AUTH | neo4j | neo4j/password123 |
| NEO4J_URI | threat-modeling-service | bolt://neo4j:7687 |

