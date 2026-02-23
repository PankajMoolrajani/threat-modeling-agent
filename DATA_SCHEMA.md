# Data Model: Entity Types and Relationships

This document describes the entity types defined in the YAML seed files and how they relate. The model is used for threat modeling and security architecture, with data loaded into Neo4j.

---

## Contents

- [Entity types](#entity-types)
- [Relationship diagram](#relationship-diagram)
- [Relationships (detailed)](#relationships-detailed)
- [YAML files reference](#yaml-files-reference)
- [How it fits together](#how-it-fits-together)

---

## Entity types

| Type | Description | File |
|------|-------------|------|
| **Engagement** | Security review or assessment scope | `init/contamination_service_engagement.yaml` |
| **Component** | Logical building block (e.g. API, web app) | `init/contamination_service_engagement.yaml` |
| **Resource** | Concrete deployable (API, DB, web app); has type and assets | `init/contamination_service_engagement.yaml` |
| **ResourceType** | Kind of resource: generic_api, generic_db, generic_webapp, etc. | `init/resource_types.yaml` |
| **Asset** | Data or system asset to protect (e.g. location, VIN) | `init/assets.yaml` |
| **AssetType** | Kind of asset: customer_pii_data, customer_pci_data, customer_phi_data | `init/assets.yaml` |
| **Control** | Security control: encryption, auth, RBAC, etc. | `init/controls.yaml` |
| **ControlCondition** | Condition on the graph (e.g. “resource is generic API”) | `init/controls.yaml` |
| **ControlRule** | Groups conditions and specifies required controls | `init/controls.yaml` |

---

## Relationship diagram

**Architecture & assets**

```
     Engagement
           │ REVIEWS_RESOURCE
           ▼
  Component ──HAS_RESOURCE──▶ Resource ──OF_RESOURCE_TYPE──▶ ResourceType
                                  │
                                  │ HAS_ASSET
                                  ▼
                              Asset ──OF_ASSET_TYPE──▶ AssetType
                                  │
  Resource ◀─────── TALKS_TO ─────┘
```

**Control rules**

```
  ControlRule ──HAS_CONTROL_CONDITION──▶ ControlCondition
         │
         └──REQUIRES_CONTROL──▶ Control
```

---

## Relationships (detailed)

### Engagement & scope

| From | Relationship | To | Meaning |
|------|--------------|-----|---------|
| Engagement | `REVIEWS_RESOURCE` | Resource | Engagement reviews these resources. |

---

### Architecture: components & resources

| From | Relationship | To | Meaning |
|------|--------------|-----|---------|
| Component | `HAS_RESOURCE` | Resource | Component is implemented by / contains these resources. |

A component can have multiple resources; a resource may back a component (same id in examples).

---

### Resource: type, assets, and communication

| From | Relationship | To | Meaning |
|------|--------------|-----|---------|
| Resource | `OF_RESOURCE_TYPE` | ResourceType | Resource is this type (e.g. generic_api, generic_db). |
| Resource | `HAS_ASSET` | Asset | Resource stores or processes this asset. |
| Resource | `TALKS_TO` | Resource | Resource communicates with another resource. |

---

### Asset classification

| From | Relationship | To | Meaning |
|------|--------------|-----|---------|
| Asset | `OF_ASSET_TYPE` | AssetType | Asset is this type (e.g. PII, PCI, PHI). |

---

### Control rules & conditions

| From | Relationship | To | Meaning |
|------|--------------|-----|---------|
| ControlRule | `HAS_CONTROL_CONDITION` | ControlCondition | Rule uses this condition (e.g. resource type, asset type). |
| ControlRule | `REQUIRES_CONTROL` | Control | When conditions match, these controls are required. |

---

## YAML files reference

| File | What it defines |
|------|------------------|
| `data/init/resource_types.yaml` | **ResourceType** only (generic_api, generic_db, generic_webapp, generic_file_storage, generic_queue). |
| `data/init/assets.yaml` | **AssetType**, **Asset**, and `OF_ASSET_TYPE`. |
| `data/init/controls.yaml` | **Control**, **ControlCondition**, **ControlRule**, `HAS_CONTROL_CONDITION`, `REQUIRES_CONTROL`. |
| `data/init/contamination_service_engagement.yaml` | **Engagement**, **Component**, **Resource**; `REVIEWS_RESOURCE`, `HAS_RESOURCE`, `OF_RESOURCE_TYPE`, `HAS_ASSET`, `TALKS_TO`. |
| `src/rule_engine/rules.yaml` | Rule definitions (minimal). |
| `src/wowbits/data/controls.yaml` | Same control model as init; alternate IDs. |
| `src/wowbits/data/contamination_service_engagement.yaml` | Same engagement/component/resource model as init; fewer nodes. |

---

## How it fits together

1. **Engagements** define which **Resources** are in scope for a review.
2. **Components** group **Resources**; each **Resource** has an **ResourceType** and can **TALKS_TO** other resources.
3. **Resources** that handle sensitive data **HAS_ASSET** links to **Assets**; **Assets** are categorized by **AssetType** (PII, PCI, PHI).
4. **ControlRules** use **ControlConditions** (e.g. “resource is generic API”, “resource has customer PII”) to decide when **Controls** are required, via **REQUIRES_CONTROL**.

> **Summary:** For a given engagement and its resources, the model answers: *What controls are required based on resource type and asset types?*
