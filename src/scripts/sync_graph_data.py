#!/usr/bin/env python3
"""
Sync graph data from YAML files to Neo4j.

Accepts one or more YAML files (e.g. controls.yaml, contamination_service_engagement.yaml)
that follow the schema:
  - nodes: list of { id, labels, properties }
  - relationships: list of { relation_type, source_node_id, target_node_id }

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


# Default path relative to app root (same as sync_controls: parent = scripts, parent.parent = src/app)
REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA_DIR = REPO_ROOT / "data" / "init"

# Env vars (same as docker-compose / check_connectivity)
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")


def load_yaml(path: Path) -> dict:
    """Load and return parsed YAML."""
    with open(path, "r") as f:
        return yaml.safe_load(f)


def _safe_label(s: str) -> str:
    """Allow only alphanumeric, underscore, and hyphen for label names (no injection)."""
    if not s or not str(s).replace("_", "").replace("-", "").isalnum():
        raise ValueError(f"Invalid label for Neo4j: {s!r}")
    return str(s)


def sync_nodes(session, nodes: list) -> tuple[int, int]:
    """Upsert nodes: MERGE on labels + id; ON CREATE/ON MATCH SET. Count created vs updated."""
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
        existed = session.run(
            f"MATCH (n:{label_str} {{id: $id}}) RETURN 1 AS x",
            id=nid,
        ).single() is not None
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


def _relationship_match_clauses(
    src_label: str | None, tgt_label: str | None
) -> tuple[str, str]:
    """Return (a_pattern, b_pattern) for MATCH using labels when provided."""
    if src_label:
        safe_src = _safe_label(src_label.strip())
        a_pattern = f"(a:{safe_src} {{id: $src_id}})"
    else:
        a_pattern = "(a {id: $src_id})"
    if tgt_label:
        safe_tgt = _safe_label(tgt_label.strip())
        b_pattern = f"(b:{safe_tgt} {{id: $tgt_id}})"
    else:
        b_pattern = "(b {id: $tgt_id})"
    return a_pattern, b_pattern


def sync_relationships(session, relationships: list) -> int:
    """Match source and target nodes by id (and by label when source/target_node_type given), MERGE the relationship."""
    count = 0
    for rel in relationships:
        rel_type = (rel.get("relation_type") or "").strip().upper().replace(" ", "_")
        if not rel_type:
            continue
        src_id = rel.get("source_node_id")
        tgt_id = rel.get("target_node_id")
        if not src_id or not tgt_id:
            continue
        src_type = rel.get("source_node_type")
        tgt_type = rel.get("target_node_type")
        a_pattern, b_pattern = _relationship_match_clauses(
            src_type if src_type else None,
            tgt_type if tgt_type else None,
        )
        query = (
            f"MATCH {a_pattern}, {b_pattern} "
            f"MERGE (a)-[r:{rel_type}]->(b) "
            "RETURN 1 AS x"
        )
        session.run(query, src_id=src_id, tgt_id=tgt_id)
        count += 1
    return count


def sync_file(session, path: Path, dry_run: bool) -> tuple[int, int, int]:
    """
    Load one YAML file and sync its nodes and relationships.
    Returns (nodes_created, nodes_updated, relationships_ensured).
    """
    data = load_yaml(path)
    nodes = data.get("nodes") or []
    relationships = data.get("relationships") or []

    if dry_run:
        return len(nodes), 0, len(relationships)

    created, updated = sync_nodes(session, nodes)
    rel_count = sync_relationships(session, relationships)
    return created, updated, rel_count


def collect_yaml_paths(paths: list[Path], recursive: bool) -> list[Path]:
    """Expand paths to a list of YAML files. Paths can be files or directories."""
    result = []
    for p in paths:
        if not p.exists():
            continue
        if p.is_file():
            if p.suffix in (".yaml", ".yml"):
                result.append(p.resolve())
        else:
            pattern = "**/*.yaml" if recursive else "*.yaml"
            for f in p.glob(pattern):
                if f.is_file():
                    result.append(f.resolve())
    return sorted(set(result))


def main():
    parser = argparse.ArgumentParser(
        description="Sync graph data from YAML files to Neo4j (nodes + relationships)."
    )
    parser.add_argument(
        "paths",
        nargs="*",
        type=Path,
        default=[DEFAULT_DATA_DIR],
        help=f"YAML file(s) or directory (default: {DEFAULT_DATA_DIR})",
    )
    parser.add_argument(
        "-r", "--recursive",
        action="store_true",
        help="If a path is a directory, include YAML files in subdirectories",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Load YAML and print summary only, no DB writes",
    )
    args = parser.parse_args()

    # Resolve paths: absolute unchanged, relative relative to cwd
    resolved = []
    for p in args.paths:
        if not p.is_absolute():
            p = Path.cwd() / p
        resolved.append(p)

    yaml_files = collect_yaml_paths(resolved, args.recursive)
    if not yaml_files:
        print("Error: no YAML files found.", file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        total_nodes = 0
        total_rels = 0
        for path in yaml_files:
            data = load_yaml(path)
            nodes = data.get("nodes") or []
            rels = data.get("relationships") or []
            total_nodes += len(nodes)
            total_rels += len(rels)
            print(f"  {path.name}: {len(nodes)} nodes, {len(rels)} relationships")
        print(f"Dry run: would sync {total_nodes} nodes and {total_rels} relationships from {len(yaml_files)} file(s)")
        return

    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    try:
        driver.verify_connectivity()
    except Exception as e:
        print(f"Neo4j connection failed: {e}", file=sys.stderr)
        sys.exit(1)

    total_created = 0
    total_updated = 0
    total_rels = 0

    try:
        with driver.session() as session:
            for path in yaml_files:
                created, updated, rel_count = sync_file(session, path, dry_run=False)
                total_created += created
                total_updated += updated
                total_rels += rel_count
                print(f"{path.name}: {created} nodes created, {updated} nodes updated, {rel_count} relationships")
        print(f"Total: {total_created} created, {total_updated} updated, {total_rels} relationships")
    finally:
        driver.close()


if __name__ == "__main__":
    main()
