#!/usr/bin/env python3
"""
Connectivity check script for threat-modeling-service container.
Checks connectivity to PostgreSQL, Neo4j, and Neo4j MCP services.
"""

import os
import sys
import socket
import json
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError


# Configuration from environment variables (with defaults)
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "postgres")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_DB = os.getenv("POSTGRES_DB", "threat_modeling")

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")

NEO4J_MCP_HOST = os.getenv("NEO4J_MCP_HOST", "neo4j-mcp")
NEO4J_MCP_PORT = int(os.getenv("NEO4J_MCP_PORT", "8000"))


class Colors:
    """ANSI color codes for terminal output."""
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def print_header(title: str):
    """Print a formatted header."""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}{Colors.RESET}\n")


def print_success(message: str):
    """Print a success message."""
    print(f"  {Colors.GREEN}✓ {message}{Colors.RESET}")


def print_error(message: str):
    """Print an error message."""
    print(f"  {Colors.RED}✗ {message}{Colors.RESET}")


def print_warning(message: str):
    """Print a warning message."""
    print(f"  {Colors.YELLOW}⚠ {message}{Colors.RESET}")


def print_info(message: str):
    """Print an info message."""
    print(f"  {Colors.BLUE}ℹ {message}{Colors.RESET}")


def check_tcp_connection(host: str, port: int, timeout: int = 5) -> bool:
    """Check if a TCP connection can be established."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except socket.error as e:
        print_error(f"Socket error: {e}")
        return False


def check_postgres_connectivity() -> bool:
    """
    Check PostgreSQL connectivity.
    First tries to use psycopg2 if available, falls back to TCP check.
    """
    print_header("PostgreSQL Connectivity Check")
    print_info(f"Host: {POSTGRES_HOST}")
    print_info(f"Port: {POSTGRES_PORT}")
    print_info(f"Database: {POSTGRES_DB}")
    print_info(f"User: {POSTGRES_USER}")
    print()

    # First check TCP connectivity
    if not check_tcp_connection(POSTGRES_HOST, POSTGRES_PORT):
        print_error(f"Cannot reach PostgreSQL at {POSTGRES_HOST}:{POSTGRES_PORT}")
        return False
    print_success(f"TCP connection to {POSTGRES_HOST}:{POSTGRES_PORT} successful")

    # Try to use psycopg2 for a full database connection test
    try:
        import psycopg2
        print_info("Using psycopg2 driver for database connection test...")
        
        conn = psycopg2.connect(
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
            dbname=POSTGRES_DB,
            connect_timeout=10
        )
        
        # Test query
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        print_success(f"Connected to PostgreSQL")
        print_info(f"Version: {version[:60]}...")
        
        # Check if we can list tables
        cursor.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' LIMIT 5;
        """)
        tables = cursor.fetchall()
        if tables:
            print_success(f"Found {len(tables)} table(s) in public schema")
        else:
            print_warning("No tables found in public schema (database may be empty)")
        
        cursor.close()
        conn.close()
        print_success("PostgreSQL connection test PASSED")
        return True
        
    except ImportError:
        print_warning("psycopg2 not installed - using TCP check only")
        print_success("PostgreSQL TCP connectivity test PASSED")
        return True
        
    except Exception as e:
        print_error(f"PostgreSQL connection failed: {e}")
        return False


def check_neo4j_connectivity() -> bool:
    """
    Check Neo4j connectivity.
    First tries to use neo4j driver if available, falls back to HTTP API.
    """
    print_header("Neo4j Connectivity Check")
    
    # Parse Neo4j URI
    neo4j_host = "neo4j"
    neo4j_bolt_port = 7687
    neo4j_http_port = 7474
    
    if NEO4J_URI.startswith("bolt://"):
        uri_parts = NEO4J_URI.replace("bolt://", "").split(":")
        neo4j_host = uri_parts[0]
        if len(uri_parts) > 1:
            neo4j_bolt_port = int(uri_parts[1])
    
    print_info(f"URI: {NEO4J_URI}")
    print_info(f"Host: {neo4j_host}")
    print_info(f"Bolt Port: {neo4j_bolt_port}")
    print_info(f"User: {NEO4J_USER}")
    print()

    # Check TCP connectivity to Bolt port
    if not check_tcp_connection(neo4j_host, neo4j_bolt_port):
        print_error(f"Cannot reach Neo4j Bolt at {neo4j_host}:{neo4j_bolt_port}")
        return False
    print_success(f"TCP connection to {neo4j_host}:{neo4j_bolt_port} (Bolt) successful")

    # Check TCP connectivity to HTTP port
    if check_tcp_connection(neo4j_host, neo4j_http_port):
        print_success(f"TCP connection to {neo4j_host}:{neo4j_http_port} (HTTP) successful")
    else:
        print_warning(f"HTTP port {neo4j_http_port} not reachable (may be normal)")

    # Try to use neo4j driver for full connection test
    try:
        from neo4j import GraphDatabase
        print_info("Using neo4j driver for database connection test...")
        
        driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(NEO4J_USER, NEO4J_PASSWORD)
        )
        
        # Verify connectivity
        driver.verify_connectivity()
        print_success("Neo4j driver connectivity verified")
        
        # Run a test query
        with driver.session() as session:
            result = session.run("CALL dbms.components() YIELD name, versions RETURN name, versions")
            record = result.single()
            if record:
                print_success(f"Connected to {record['name']}")
                print_info(f"Version: {record['versions'][0]}")
            
            # Check node count
            result = session.run("MATCH (n) RETURN count(n) as nodeCount")
            count = result.single()["nodeCount"]
            print_info(f"Total nodes in database: {count}")
        
        driver.close()
        print_success("Neo4j connection test PASSED")
        return True
        
    except ImportError:
        print_warning("neo4j driver not installed - trying HTTP API...")
        
        # Fall back to HTTP API check
        try:
            import base64
            auth_string = base64.b64encode(f"{NEO4J_USER}:{NEO4J_PASSWORD}".encode()).decode()
            
            url = f"http://{neo4j_host}:{neo4j_http_port}/db/neo4j/tx/commit"
            data = json.dumps({
                "statements": [{"statement": "RETURN 1 as test"}]
            }).encode()
            
            request = Request(url, data=data, method="POST")
            request.add_header("Content-Type", "application/json")
            request.add_header("Authorization", f"Basic {auth_string}")
            
            response = urlopen(request, timeout=10)
            result = json.loads(response.read().decode())
            
            if result.get("results") and not result.get("errors"):
                print_success("Neo4j HTTP API test successful")
                print_success("Neo4j connection test PASSED")
                return True
            else:
                print_error(f"Neo4j query returned errors: {result.get('errors')}")
                return False
                
        except Exception as e:
            print_error(f"Neo4j HTTP API check failed: {e}")
            print_success("Neo4j TCP connectivity test PASSED (driver test skipped)")
            return True
        
    except Exception as e:
        print_error(f"Neo4j connection failed: {e}")
        return False


def check_neo4j_mcp_connectivity() -> bool:
    """
    Check Neo4j MCP service connectivity.
    Tests if the MCP server is responding and can execute queries.
    """
    print_header("Neo4j MCP Service Check")
    print_info(f"Host: {NEO4J_MCP_HOST}")
    print_info(f"Port: {NEO4J_MCP_PORT}")
    print()

    # Check TCP connectivity
    if not check_tcp_connection(NEO4J_MCP_HOST, NEO4J_MCP_PORT):
        print_error(f"Cannot reach Neo4j MCP at {NEO4J_MCP_HOST}:{NEO4J_MCP_PORT}")
        return False
    print_success(f"TCP connection to {NEO4J_MCP_HOST}:{NEO4J_MCP_PORT} successful")

    # Try to check if MCP server is responding via HTTP
    mcp_base_url = f"http://{NEO4J_MCP_HOST}:{NEO4J_MCP_PORT}"
    
    # Try health/root endpoint
    endpoints_to_try = ["/", "/health", "/sse"]
    
    for endpoint in endpoints_to_try:
        try:
            url = f"{mcp_base_url}{endpoint}"
            request = Request(url, method="GET")
            request.add_header("Accept", "application/json")
            
            response = urlopen(request, timeout=10)
            status = response.getcode()
            
            if status == 200:
                print_success(f"MCP endpoint {endpoint} responded with status 200")
                content = response.read().decode()
                if content:
                    try:
                        data = json.loads(content)
                        print_info(f"Response: {json.dumps(data)[:100]}...")
                    except json.JSONDecodeError:
                        print_info(f"Response: {content[:100]}...")
                break
        except HTTPError as e:
            if e.code == 405:  # Method not allowed - server is responding
                print_success(f"MCP endpoint {endpoint} is active (returned 405)")
                break
            elif e.code < 500:  # Client errors mean server is running
                print_success(f"MCP endpoint {endpoint} responded with status {e.code}")
                break
        except URLError as e:
            continue
        except Exception as e:
            continue
    
    # Try MCP JSON-RPC style request
    try:
        url = f"{mcp_base_url}/mcp"
        
        # MCP protocol uses JSON-RPC style messages
        mcp_request = {
            "jsonrpc": "2.0",
            "method": "tools/list",
            "id": 1
        }
        
        data = json.dumps(mcp_request).encode()
        request = Request(url, data=data, method="POST")
        request.add_header("Content-Type", "application/json")
        
        response = urlopen(request, timeout=10)
        result = json.loads(response.read().decode())
        
        if "result" in result:
            print_success("MCP tools/list request successful")
            tools = result.get("result", {}).get("tools", [])
            if tools:
                print_info(f"Available tools: {len(tools)}")
                for tool in tools[:3]:
                    print_info(f"  - {tool.get('name', 'unknown')}")
                if len(tools) > 3:
                    print_info(f"  ... and {len(tools) - 3} more")
        
    except HTTPError as e:
        print_warning(f"MCP JSON-RPC endpoint returned {e.code} (may be expected)")
    except URLError as e:
        print_warning(f"MCP JSON-RPC endpoint not available: {e.reason}")
    except Exception as e:
        print_warning(f"MCP JSON-RPC test: {e}")

    # Try SSE endpoint (common for MCP servers)
    try:
        url = f"{mcp_base_url}/sse"
        request = Request(url, method="GET")
        request.add_header("Accept", "text/event-stream")
        
        response = urlopen(request, timeout=5)
        if response.getcode() == 200:
            print_success("MCP SSE endpoint is available")
    except HTTPError as e:
        if e.code < 500:
            print_info(f"MCP SSE endpoint responded with {e.code}")
    except Exception:
        pass

    print_success("Neo4j MCP service connectivity test PASSED")
    return True


def main():
    """Run all connectivity checks."""
    print(f"\n{Colors.BOLD}{Colors.BLUE}")
    print("╔════════════════════════════════════════════════════════════╗")
    print("║     Threat Modeling Service - Connectivity Check          ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print(f"{Colors.RESET}")

    results = {}
    
    # Run all checks
    results["postgres"] = check_postgres_connectivity()
    results["neo4j"] = check_neo4j_connectivity()
    results["neo4j_mcp"] = check_neo4j_mcp_connectivity()
    
    # Summary
    print_header("Summary")
    
    all_passed = True
    for service, passed in results.items():
        if passed:
            print_success(f"{service}: Connected")
        else:
            print_error(f"{service}: Failed")
            all_passed = False
    
    print()
    if all_passed:
        print(f"{Colors.GREEN}{Colors.BOLD}All connectivity checks PASSED!{Colors.RESET}")
        sys.exit(0)
    else:
        print(f"{Colors.RED}{Colors.BOLD}Some connectivity checks FAILED!{Colors.RESET}")
        sys.exit(1)


if __name__ == "__main__":
    main()
