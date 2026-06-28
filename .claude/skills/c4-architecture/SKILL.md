---
name: c4-architecture
description: "C4 architecture documentation: generates complete Context → Container → Component → Code documentation for any codebase using bottom-up analysis. Coordinates 4 specialized sub-agents. Outputs Mermaid C4 diagrams, OpenAPI specs, persona/user journey maps, and component relationship graphs. Invoke with /c4-architecture."
---

# C4 Architecture Documentation

You are executing the `/c4-architecture` skill. You generate comprehensive C4 architecture documentation for any codebase using a bottom-up analysis approach, coordinating four specialized agents across all four C4 levels.

Parse the argument from the user's invocation:
- `/c4-architecture` → analyze the **current working directory**
- `/c4-architecture <path>` → analyze the directory at `<path>`

---

## Overview

The [C4 model](https://c4model.com/diagrams) describes software architecture at 4 levels:

| Level | Audience | Shows |
|-------|----------|-------|
| **Context** | Everyone | System + users + external dependencies |
| **Container** | Technical | Deployment units + tech choices + APIs |
| **Component** | Developers | Logical groupings within containers |
| **Code** | Developers | Classes, functions, modules |

> **Note:** You don't need all 4 levels. Context + Container is sufficient for most teams. This skill generates all levels for completeness — teams choose which to use.

**Output directory:** `C4-Documentation/` in the analyzed repo root.

---

## Step 0: Resolve Target

If `$ARGUMENTS` provided: resolve path. Otherwise use current directory.

```
Target directory: [resolved path]
```

Read `README.md` for project description if available.

---

## Phase 1: Code-Level Documentation (Bottom-Up)

### 1.1 Discover All Subdirectories

Use Glob to find all subdirectories. Sort by depth (deepest first). Filter out:
- `node_modules/`, `vendor/`, `.venv/`, `__pycache__/`, `.git/`
- `dist/`, `build/`, `.next/`, `target/`
- Test directories: `tests/`, `__tests__/`, `spec/`

### 1.2 Process Each Directory (Bottom-Up)

For each directory, launch a Task with this prompt:

> Analyze the code in directory: [directory_path]
>
> Create C4 Code-level documentation:
>
> 1. **Overview**: Name, description, location link, primary language, purpose
> 2. **Code Elements**: All functions/methods with complete signatures (name, params, types, return type, description, location, dependencies). All classes/modules with methods.
> 3. **Dependencies**: Internal (other repo code) + External (libraries, frameworks, services)
> 4. **Relationships**: Optional Mermaid diagram if relationships are complex
>
> Save as: `C4-Documentation/c4-code-[sanitized-dir-name].md`
> (Replace `/` with `-`, remove special chars from directory name)

Repeat for every subdirectory. Wait for all to complete before Phase 2.

---

## Phase 2: Component-Level Synthesis

### 2.1 Identify Component Boundaries

Read all `c4-code-*.md` files. Identify logical component groupings based on:
- Domain boundaries (related business functionality)
- Technical boundaries (shared frameworks, libraries)
- Directory structure patterns (`api/`, `auth/`, `payments/`, etc.)

### 2.2 Create Component Documentation

For each identified component, launch a Task:

> Synthesize these C4 Code-level files into a component: [list of c4-code-*.md paths]
>
> Create C4 Component-level documentation:
>
> 1. **Overview**: Name (descriptive), description, type (Application/Service/Library), technology
> 2. **Purpose**: Detailed description, problems solved, role in system
> 3. **Software Features**: List of features with descriptions
> 4. **Code Elements**: Links to c4-code-*.md files with descriptions
> 5. **Interfaces**: All interfaces — name, protocol (REST/GraphQL/gRPC/Events), operations
> 6. **Dependencies**: Other components + external systems (DBs, APIs, services)
> 7. **Component Diagram**: Mermaid diagram showing this component and its relationships
>
> Save as: `C4-Documentation/c4-component-[component-name].md`

### 2.3 Master Component Index

Launch a Task to create `C4-Documentation/c4-component.md`:

> Based on all c4-component-*.md files, create:
> 1. System Components section: list all components with name, description, link
> 2. Component Relationships Diagram: Mermaid diagram showing all components, dependencies, external systems

---

## Phase 3: Container-Level Synthesis

### 3.1 Find Deployment Definitions

Search for:
- `Dockerfile*`, `docker-compose*.yml`
- `*.tf` (Terraform), `*.yaml` in `k8s/`, `helm/`, `manifests/`
- `serverless.yml`, `fly.toml`, `railway.toml`
- CI/CD: `.github/workflows/`, `.gitlab-ci.yml`
- Cloud: `cdk.json`, `samconfig.toml`

### 3.2 Map Components to Containers

Launch a Task:

> Map components to deployment containers.
>
> Component docs: [list of c4-component-*.md]
> Deployment files: [list of deployment configs found]
>
> Create C4 Container-level documentation:
>
> For each container:
> 1. **Name, Description, Type** (Web App/API/DB/Queue/etc.), **Technology**, **Deployment** (Docker/K8s/Lambda/etc.)
> 2. **Purpose**: Detailed deployment description, role in system
> 3. **Components**: List of components in this container with links
> 4. **Interfaces**: All APIs — name, protocol, description, link to spec, endpoint list
> 5. **API Specifications**: For each container API, generate OpenAPI 3.1 spec → save as `C4-Documentation/apis/[container-name]-api.yaml`
>    Include: all endpoints (method + path), request/response schemas, auth, error codes
> 6. **Dependencies**: Other containers + external systems with communication protocols
> 7. **Infrastructure**: Link to deployment config, scaling strategy, resource estimates
> 8. **Container Diagram**: Mermaid diagram showing all containers, protocols, external systems
>
> Save as: `C4-Documentation/c4-container.md`

---

## Phase 4: Context-Level Documentation

### 4.1 Gather System Documentation

Read:
- `README.md`, `docs/`, `ADR/` directories
- Requirements docs, architecture docs
- Test files (reveals system behavior)

### 4.2 Create Context Documentation

Launch a Task:

> Create C4 Context-level documentation.
>
> Container docs: `C4-Documentation/c4-container.md`
> Component docs: `C4-Documentation/c4-component.md`
> System docs: [list of READMEs, architecture docs, requirements]
> Tests: [list of test files]
>
> Create documentation understandable by non-technical stakeholders:
>
> 1. **System Overview**: One-sentence description + detailed long description (purpose, capabilities, problems solved)
>
> 2. **Personas**: For each user type (human OR programmatic):
>    - Name, Type (Human User / Programmatic User / External System)
>    - Description (who they are, what they need), Goals, Key features used
>
> 3. **System Features**: For each high-level feature:
>    - Name, Description, Users (which personas), Link to user journey
>
> 4. **User Journeys**: For each key feature × persona combination:
>    - Journey name: "[Feature] — [Persona] Journey"
>    - Numbered step-by-step journey including all system touchpoints
>    - For programmatic users: integration journey with API steps
>
> 5. **External Systems**: For each external dependency:
>    - Name, Type, Description, Integration type, Purpose
>
> 6. **System Context Diagram** (Mermaid C4Context notation):
>    - System in center
>    - All personas (users) with arrows showing interactions
>    - All external systems with arrows showing data flows
>    - Use proper C4Context notation: Person(), System(), SystemExt(), Rel()
>
> 7. **Related Documentation**: Links to container + component docs
>
> Save as: `C4-Documentation/c4-context.md`

---

## Output Structure

After all phases complete, the `C4-Documentation/` directory contains:

```
C4-Documentation/
├── c4-code-*.md              # Code-level docs (one per directory)
├── c4-component-*.md         # Component docs (one per component)
├── c4-component.md           # Master component index + relationship diagram
├── c4-container.md           # Container docs + container diagram
├── c4-context.md             # Context docs + context diagram + user journeys
└── apis/
    └── [container]-api.yaml  # OpenAPI 3.1 spec per container API
```

---

## Success Checklist

Report completion only when ALL of these are true:

- [ ] Every non-excluded subdirectory has a `c4-code-*.md` file
- [ ] All code elements include complete function signatures with types
- [ ] Components logically grouped with clear boundaries
- [ ] All component interfaces documented
- [ ] Master component index created with relationship diagram
- [ ] Containers map to actual deployment units
- [ ] All container APIs have OpenAPI 3.1 specs
- [ ] Container diagram shows tech stack and communication protocols
- [ ] Context includes ALL personas (human and programmatic)
- [ ] User journeys documented for all key features
- [ ] All external systems identified
- [ ] Context diagram uses proper C4 Mermaid notation
- [ ] Documentation is understandable by non-technical stakeholders

---

## Coordination Notes

- **Bottom-up**: Always complete Phase 1 (all directories) before Phase 2
- **Parallel within phases**: Launch all agents within a phase simultaneously
- **Sequential across phases**: Each phase builds on the previous
- **Link consistency**: All docs link to each other using relative paths
- **API specs**: Use OpenAPI 3.1, not 3.0 or Swagger 2.0
- **Mermaid C4**: Use `C4Context`, `C4Container`, `C4Component` diagram types

---

## Example Mermaid Diagrams

**Context level:**
```
C4Context
  title System Context — MyApp

  Person(user, "User", "Application end-user")
  Person(admin, "Admin", "System administrator")
  System(myapp, "MyApp", "The application being documented")
  SystemExt(stripe, "Stripe", "Payment processing")
  SystemExt(sendgrid, "SendGrid", "Email delivery")

  Rel(user, myapp, "Uses", "HTTPS")
  Rel(admin, myapp, "Manages", "HTTPS")
  Rel(myapp, stripe, "Processes payments", "HTTPS/REST")
  Rel(myapp, sendgrid, "Sends emails", "HTTPS/REST")
```

**Container level:**
```
C4Container
  title Container Diagram — MyApp

  Person(user, "User")

  Container_Boundary(app, "MyApp") {
    Container(web, "Web App", "Next.js", "React frontend")
    Container(api, "API Server", "FastAPI", "REST + GraphQL")
    ContainerDb(db, "Database", "PostgreSQL", "User and order data")
    Container(queue, "Message Queue", "Redis", "Background jobs")
  }

  SystemExt(stripe, "Stripe")

  Rel(user, web, "Uses", "HTTPS")
  Rel(web, api, "API calls", "HTTPS/REST")
  Rel(api, db, "Reads/writes", "PostgreSQL")
  Rel(api, queue, "Enqueues jobs", "Redis")
  Rel(api, stripe, "Processes payments", "HTTPS")
```
