#!/usr/bin/env python3
"""
Sync controls from data/init/controls.yaml to Neo4j.
For each node: MERGE on (labels + id); if exists then SET properties, else CREATE and SET.
For each relationship: MATCH source and target by id, MERGE the relationship.
"""

import argparse
import os
import sys
from pathlib import Path

import yaml
try:
    from neo4j import GraphDatabase
except ImportError:
    print("Error: neo4j driver not installed. Install with: pip install neo4j", file=sys.stderr)
    sys.exit(1)


# For resolving relative paths (repo root when run as scripts/sync_controls.py, or app root when run as src/scripts/sync_controls.py)
REPO_ROOT = Path(__file__).resolve().parent.parent

# Env vars (same as docker-compose / check_connectivity)
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")


def load_controls(path: Path) -> dict:
    """Load and return parsed controls YAML."""
    with open(path, "r") as f:
        return yaml.safe_load(f)


def _safe_label(s: str) -> str:
    """Allow only alphanumeric and underscore for label names (no injection)."""
    if not s or not s.replace("_", "").replace("-", "").isalnum():
        raise ValueError(f"Invalid label for Neo4j: {s!r}")
    return str(s)


def sync_nodes(session, nodes: list) -> tuple[int, int]:
    """Upsert nodes: MERGE on labels + id; ON CREATE/ON MATCH SET. Count created vs updated using a prior MATCH."""
    created = 0
    updated = 0
    for node in nodes:
        nid = node.get("id")
        if not nid:
            continue
        labels = node.get("labels") or []
        props = dict(node.get("properties") or {})
        if "id" not in props:
            props["id"] = nid
        label_str = ":".join(_safe_label(l) for l in labels)
        if not label_str:
            continue
        # Check existence first
        existed = session.run(
            f"MATCH (n:{label_str} {{id: $id}}) RETURN 1 AS x",
            id=nid,
        ).single() is not None
        # Upsert
        session.run(
            f"MERGE (n:{label_str} {{id: $id}}) "
            "ON CREATE SET n += $properties "
            "ON MATCH SET n += $properties",
            id=nid,
            properties=props,
        )
        if existed:
            updated += 1
        else:
            created += 1
    return created, updated


def sync_relationships(session, relationships: list) -> int:
    """Match source and target nodes by label + id, MERGE the relationship. Returns count of relationships ensured."""
    count = 0
    for rel in relationships:
        rel_type = (rel.get("relation_type") or "").strip().upper().replace(" ", "_")
        if not rel_type:
            continue
        src_id = rel.get("source_node_id")
        tgt_id = rel.get("target_node_id")
        if not src_id or not tgt_id:
            continue
        # Use source_node_type / target_node_type so we don't match wrong nodes when the same id is used for different labels (e.g. Component and Resource)
        src_label = (rel.get("source_node_type") or "").strip()
        tgt_label = (rel.get("target_node_type") or "").strip()
        src_label = _safe_label(src_label) if src_label else ""
        tgt_label = _safe_label(tgt_label) if tgt_label else ""
        if not src_label or not tgt_label:
            # Fallback: match by id only (same as before)
            query = (
                "MATCH (a {id: $src_id}), (b {id: $tgt_id}) "
                f"MERGE (a)-[r:{rel_type}]->(b) "
                "RETURN 1 AS x"
            )
        else:
            query = (
                f"MATCH (a:{src_label} {{id: $src_id}}), (b:{tgt_label} {{id: $tgt_id}}) "
                f"MERGE (a)-[r:{rel_type}]->(b) "
                "RETURN 1 AS x"
            )
        session.run(query, src_id=src_id, tgt_id=tgt_id)
        count += 1
    return count


def main():
    parser = argparse.ArgumentParser(description="Sync controls.yaml to Neo4j (merge nodes and relationships).")
    parser.add_argument(
        "controls_file",
        type=Path,
        help="Path to controls YAML (e.g. data/init/controls.yaml or wowbits/data/controls.yaml)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Load YAML and print summary only, no DB writes.")
    args = parser.parse_args()

    path = args.controls_file
    if not path.is_absolute():
        path = (REPO_ROOT / path).resolve()
    if not path.exists():
        print(f"Error: controls file not found: {path}", file=sys.stderr)
        print("Pass the YAML path explicitly, e.g. data/init/controls.yaml or wowbits/data/controls.yaml", file=sys.stderr)
        sys.exit(1)

    data = load_controls(path)
    nodes = data.get("nodes") or []
    relationships = data.get("relationships") or []

    if args.dry_run:
        print(f"Dry run: would sync {len(nodes)} nodes and {len(relationships)} relationships from {path}")
        return

    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    try:
        driver.verify_connectivity()
    except Exception as e:
        print(f"Neo4j connection failed: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        with driver.session() as session:
            created, updated = sync_nodes(session, nodes)
            print(f"Nodes: {created} created, {updated} updated")
            rel_count = sync_relationships(session, relationships)
            print(f"Relationships: {rel_count} ensured")
    finally:
        driver.close()


if __name__ == "__main__":
    main()
