import os

try:
    from neo4j import GraphDatabase  # type: ignore[import-untyped]
except ImportError:
    GraphDatabase = None

# Relationship from Resource to ResourceType. Engagement YAML sync uses OF_RESOURCE_TYPE;
# try both so it works whether the graph uses OF_TYPE or OF_RESOURCE_TYPE.
REL_NAMES = ("OF_TYPE")

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

def get_driver():
    """Get the Neo4j driver."""
    return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

def get_resource_and_type(resource_id: str):
    """
    Query Neo4j for the Resource node by id and its ResourceType (via OF_TYPE or OF_RESOURCE_TYPE).
    Returns (resource_props, resource_type_props) or (None, None) if not found.
    """
    if GraphDatabase is None:
        raise RuntimeError("neo4j driver not installed. Install with: pip install neo4j")
   
    driver = get_driver()
    try:
        with driver.session() as session:
            rel = "OF_TYPE"
            query = (
                f"MATCH (r:Resource {{id: $resource_id}})-[:{rel}]-(rt:ResourceType) "
                "RETURN r, rt"
            )
            result = session.run(query, resource_id=resource_id)
            record = result.single()
            if record is not None:
                r, rt = record["r"], record["rt"]
                return (r), (rt)
            return None, None
    finally:
        driver.close()

def get_control_conditions(resource_type: str) -> list[str]:
    """Get the control conditions for the resource type."""
    driver = get_driver()
    try:
        with driver.session() as session:
            query = """
                MATCH (cc:ControlCondition)
                WHERE cc.`node.relation.of_type` = $resource_type
                RETURN cc
            """
            result = session.run(query, resource_type=resource_type)
            return [record["cc"] for record in result if record.get("cc")]
    finally:
        driver.close()

def get_control_rules(condition_ids: list[str]) -> list[str]:
    """Get the control rules for the condition ids."""
    driver = get_driver()
    try:
        for condition_id in condition_ids:
            with driver.session() as session:
                query = f"""
                    MATCH (cr:ControlRule) -[:HAS_CONTROL_CONDITION]- (cc:ControlCondition {{id: $condition_id}})
                    RETURN cr
                """
                result = session.run(query, condition_id=condition_id)
                all_control_rules = [record["cr"] for record in result if record.get("cr")]
                applicable_rule_ids = []
                for cr in all_control_rules:
                    rule_id = cr.get("id")
                    print (f"Rule ID: {rule_id}")
                    query = f"""
                        MATCH (cr:ControlRule {{id: $rule_id}}) -[:HAS_CONTROL_CONDITION]- (cc:ControlCondition {{id: $condition_id}})
                        RETURN cc
                    """
                    result = session.run(query, rule_id=rule_id, condition_id=condition_id)
                    rule_control_condition_ids = [record["cc"].get("id") for record in result if record.get("cc") and record["cc"].get("id")]
                    print (f"Rule Control Condition IDs: {rule_control_condition_ids}")
                    if all(cond_id in condition_ids for cond_id in rule_control_condition_ids):
                        applicable_rule_ids.append(cr.get("id"))
                    print (f"Applicable Rule IDs: {applicable_rule_ids}")
                    
        return applicable_rule_ids
    finally:
        driver.close()
    return []

def get_controls(control_rule_ids: list[str]) -> list[str]:
    """Get the controls for the control rule ids."""
    driver = get_driver()
    try:
        for control_rule_id in control_rule_ids:
            with driver.session() as session:
                query = """
                    MATCH (cr:ControlRule {id: $control_rule_id})-[:REQUIRES_CONTROL]-(c:Control)
                    RETURN c
                """
                print (f"Query: {query}")
                result = session.run(query, control_rule_id=control_rule_id)
                control_ids = [record["c"].get("id") for record in result if record.get("c") and record["c"].get("id")]
                print (f"Control IDs: {control_ids}")
                return control_ids
    finally:
        driver.close()
    return []

def main(resource):
    """
    Main function. Expects resource to be a dict with 'id' (the resource id).
    Loads the resource and its type from Neo4j, then identifies applicable controls.
    Returns list of applicable ControlRule nodes.
    """
    resource_id = resource.get("id") if isinstance(resource, dict) else None
    if not resource_id:
        return []
    
    resource_obj, resource_type_obj = get_resource_and_type(resource_id)
    print (f"Resource Name: {resource_obj.get('name')}")
    print (f"Resource Type: {resource_type_obj.get('name')}")
    if resource_obj is None or resource_type_obj is None:
        return []
    
    resource_type_id = resource_type_obj.get("id")
    control_conditions = get_control_conditions(resource_type_id)
    condition_ids = [cc.get("id") for cc in control_conditions if cc and cc.get("id")]
    print (f"Condition IDs: {condition_ids}")
    control_rule_ids= get_control_rules(condition_ids)
    controls = get_controls(control_rule_ids)
    print (f"Controls: {controls}")
    return controls

if __name__ == "__main__":
    main({"id": "contamination_detection_api"})