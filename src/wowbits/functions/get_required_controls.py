def main():
    """Main function."""
    node = "node"
    relation = "relation"
    controls = identify_dataflow_controls(node, relation)
    print(controls)

if __name__ == "__main__":
    main()