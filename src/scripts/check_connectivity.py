#!/usr/bin/env python3
"""
Database Connectivity Check Script

Checks connectivity to PostgreSQL, Neo4j databases, and Neo4j MCP server.
Requires environment variables for configuration.
"""

import os
import sys
from typing import Tuple


def get_required_env(name: str) -> str:
    """Get a required environment variable or raise an error."""
    value = os.getenv(name)
    if value is None:
        raise EnvironmentError(f"Required environment variable '{name}' is not set")
    return value


def check_postgres() -> Tuple[bool, str]:
    """Check PostgreSQL database connectivity."""
    try:
        import psycopg2
    except ImportError:
        return False, "psycopg2 not installed. Run: pip install psycopg2-binary"

    try:
        host = get_required_env("POSTGRES_HOST")
        port = get_required_env("POSTGRES_PORT")
        user = get_required_env("POSTGRES_USER")
        password = get_required_env("POSTGRES_PASSWORD")
        database = get_required_env("POSTGRES_DB")
    except EnvironmentError as e:
        return False, str(e)

    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            dbname=database,
            connect_timeout=10
        )
        
        # Execute a simple query to verify the connection works
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        return True, f"Connected to PostgreSQL at {host}:{port}/{database}\n  Version: {version}"
    
    except psycopg2.OperationalError as e:
        return False, f"Failed to connect to PostgreSQL at {host}:{port}/{database}\n  Error: {e}"
    except Exception as e:
        return False, f"Unexpected error connecting to PostgreSQL: {e}"


def check_neo4j() -> Tuple[bool, str]:
    """Check Neo4j database connectivity."""
    try:
        from neo4j import GraphDatabase
    except ImportError:
        return False, "neo4j driver not installed. Run: pip install neo4j"

    try:
        uri = get_required_env("NEO4J_URI")
        user = get_required_env("NEO4J_USER")
        password = get_required_env("NEO4J_PASSWORD")
    except EnvironmentError as e:
        return False, str(e)

    try:
        driver = GraphDatabase.driver(uri, auth=(user, password))
        
        # Verify connectivity and get server info
        driver.verify_connectivity()
        
        with driver.session() as session:
            result = session.run("RETURN 1 AS test")
            record = result.single()
            
            # Get Neo4j version
            version_result = session.run("CALL dbms.components() YIELD name, versions RETURN name, versions")
            version_record = version_result.single()
            version_info = f"{version_record['name']} {version_record['versions'][0]}" if version_record else "Unknown"
        
        driver.close()
        
        return True, f"Connected to Neo4j at {uri}\n  Version: {version_info}"
    
    except Exception as e:
        return False, f"Failed to connect to Neo4j at {uri}\n  Error: {e}"


def check_neo4j_mcp() -> Tuple[bool, str]:
    """Check Neo4j MCP server connectivity using JSON-RPC tools/list method."""
    try:
        import urllib.request
        import urllib.error
        import json
    except ImportError:
        return False, "urllib not available"

    try:
        host = get_required_env("NEO4J_MCP_HOST")
        port = get_required_env("NEO4J_MCP_PORT")
    except EnvironmentError as e:
        return False, str(e)

    # Use trailing slash to avoid 307 redirect
    url = f"http://{host}:{port}/api/mcp/"

    try:
        # JSON-RPC request to list available tools
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list"
        }
        
        data = json.dumps(payload).encode('utf-8')
        
        req = urllib.request.Request(url, data=data, method='POST')
        req.add_header('Accept', 'application/json, text/event-stream')
        req.add_header('Content-Type', 'application/json')
        
        with urllib.request.urlopen(req, timeout=10) as response:
            status_code = response.getcode()
            response_body = response.read().decode('utf-8')
            
            if status_code == 200:
                # Handle SSE (Server-Sent Events) response format
                # The response may be in "event: message\ndata: {...}" format
                json_data = response_body
                if response_body.startswith("event:"):
                    # Parse SSE format - extract the data line
                    for line in response_body.split('\n'):
                        if line.startswith("data:"):
                            json_data = line[5:].strip()
                            break
                
                try:
                    result = json.loads(json_data)
                    # Check for valid JSON-RPC response
                    if "result" in result:
                        tools = result.get("result", {}).get("tools", [])
                        tool_count = len(tools) if isinstance(tools, list) else 0
                        return True, f"Connected to Neo4j MCP server at {host}:{port}\n  Status: Server is responding\n  Available tools: {tool_count}"
                    elif "error" in result:
                        error_msg = result.get("error", {}).get("message", "Unknown error")
                        return False, f"Neo4j MCP server returned error: {error_msg}"
                    else:
                        return True, f"Connected to Neo4j MCP server at {host}:{port}\n  Status: Server is responding"
                except json.JSONDecodeError:
                    return True, f"Connected to Neo4j MCP server at {host}:{port}\n  Status: Server is responding (non-JSON response)"
            else:
                return False, f"Neo4j MCP server at {host}:{port} returned status code {status_code}"
    
    except urllib.error.HTTPError as e:
        return False, f"Failed to connect to Neo4j MCP server at {host}:{port}\n  HTTP Error: {e.code} - {e.reason}"
    except urllib.error.URLError as e:
        return False, f"Failed to connect to Neo4j MCP server at {host}:{port}\n  Error: {e.reason}"
    except Exception as e:
        return False, f"Unexpected error connecting to Neo4j MCP server: {e}"


def main():
    """Run connectivity checks for all databases and services."""
    print("=" * 60)
    print("Database & Service Connectivity Check")
    print("=" * 60)
    print()

    all_passed = True

    # Check PostgreSQL
    print("[PostgreSQL]")
    print("-" * 40)
    pg_success, pg_message = check_postgres()
    status = "✓ SUCCESS" if pg_success else "✗ FAILED"
    print(f"Status: {status}")
    print(f"Details: {pg_message}")
    print()
    if not pg_success:
        all_passed = False

    # Check Neo4j
    print("[Neo4j]")
    print("-" * 40)
    neo4j_success, neo4j_message = check_neo4j()
    status = "✓ SUCCESS" if neo4j_success else "✗ FAILED"
    print(f"Status: {status}")
    print(f"Details: {neo4j_message}")
    print()
    if not neo4j_success:
        all_passed = False

    # Check Neo4j MCP Server
    print("[Neo4j MCP Server]")
    print("-" * 40)
    mcp_success, mcp_message = check_neo4j_mcp()
    status = "✓ SUCCESS" if mcp_success else "✗ FAILED"
    print(f"Status: {status}")
    print(f"Details: {mcp_message}")
    print()
    if not mcp_success:
        all_passed = False

    # Summary
    print("=" * 60)
    if all_passed:
        print("All database and service connections successful!")
        sys.exit(0)
    else:
        print("Some connections failed. Check the details above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
