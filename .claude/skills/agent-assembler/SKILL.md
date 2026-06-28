---
name: agent-assembler
description: "Dynamic agent team composition based on project tech stack analysis. Scans project files to recommend optimal agent combinations, generates custom team configs, and installs agent templates. Sub-commands: /agent-assembler:analyze, :compose, :install. Use when setting up agent teams for a new project or optimizing an existing team."
---

# Agent Assembler — Dynamic Team Composition

You are executing the `/agent-assembler` skill. This skill analyzes a project's tech stack and recommends the optimal combination of agents from the catalog.

Parse the sub-command from the user's invocation:
- `/agent-assembler` → show **menu** of available commands
- `/agent-assembler:analyze` → **Analyze Project Tech Stack**
- `/agent-assembler:compose [focus]` → **Compose Custom Agent Team**
- `/agent-assembler:install [agents]` → **Install Agent Templates**

---

## Menu (no sub-command)

```
Agent Assembler — Choose a command:

1. analyze  — Scan project files to detect tech stack and recommend agents
2. compose  — Generate a custom agent team configuration for your project
3. install  — Copy recommended agent templates into your project's .claude/agents/
```

Ask: "Which command? Or just point me at your project directory and I'll analyze it automatically."

---

## Sub-command: `:analyze` — Analyze Project Tech Stack

### Step 1: Detect Project Files

Scan the project root for tech stack indicators:

```
# Package managers / dependency files
package.json          → Node.js / JavaScript / TypeScript
pyproject.toml        → Python (modern)
requirements.txt      → Python (legacy)
Pipfile               → Python (pipenv)
go.mod                → Go
Cargo.toml            → Rust
pom.xml               → Java (Maven)
build.gradle          → Java (Gradle)
*.csproj              → C# / .NET
composer.json         → PHP

# Infrastructure
Dockerfile            → Docker
docker-compose.yml    → Docker Compose
*.tf                  → Terraform
ansible.cfg           → Ansible
k8s/ or kubernetes/   → Kubernetes
.github/workflows/    → GitHub Actions
.gitlab-ci.yml        → GitLab CI
Jenkinsfile           → Jenkins

# Frameworks (check dependency files)
next.config.*         → Next.js
nuxt.config.*         → Nuxt
angular.json          → Angular
Gemfile               → Ruby on Rails
pubspec.yaml          → Flutter / Dart
Package.swift         → Swift / iOS
build.gradle (android)→ Android

# Data/ML
dbt_project.yml       → dbt
airflow.cfg           → Airflow
mlflow/               → MLflow
*.ipynb               → Jupyter / Data Science

# Smart Contracts
foundry.toml          → Foundry (Solidity)
hardhat.config.*      → Hardhat (Solidity)
truffle-config.*      → Truffle (Solidity)
```

### Step 2: Read Dependency Details

For each detected package manager, read the dependency file to identify:
- **Frameworks**: React, Vue, Angular, FastAPI, Django, Spring Boot, ASP.NET, Laravel, Gin, Actix, Bevy
- **Testing**: Jest, Vitest, Playwright, pytest, JUnit, xUnit, PHPUnit, go test
- **Databases**: PostgreSQL, MySQL, MongoDB, Redis, SQLite
- **Message brokers**: Kafka, RabbitMQ, SQS, NATS
- **Cloud SDKs**: AWS SDK, Google Cloud, Azure SDK

### Step 3: Map to Agent Recommendations

```
Detection Matrix:

Language Agents:
  package.json + TypeScript     → js-ts-patterns skill (already available)
  pyproject.toml / requirements → python-best-practices skill (already available)
  go.mod                        → go-expert agent + go-patterns skill
  Cargo.toml                    → rust-expert agent + rust-patterns skill
  pom.xml / build.gradle        → java-expert agent + java-patterns skill
  *.csproj                      → csharp-expert agent + csharp-patterns skill
  composer.json                 → php-expert agent + php-patterns skill

Architecture Agents:
  REST API routes detected      → api-architect agent + api-design skill
  GraphQL schema detected       → graphql-architect agent + graphql-patterns skill
  Multiple services / monorepo  → microservices-architect agent + microservices skill
  Event/message broker deps     → event-architect agent + event-driven skill
  React/Vue components          → component-architect agent + component-gen skill
  Mobile framework detected     → mobile-developer agent + mobile-dev skill
  Database migrations           → database-design skill

DevOps Agents:
  *.tf files                    → terraform-expert agent + terraform skill
  Dockerfile                    → docker-optimization skill
  CI config detected            → cicd-engineer agent + cicd-pipeline skill
  K8s manifests / Helm          → kubernetes-operations skill + gitops skill
  Cloud SDK imports             → cloud-architect agent + cloud-architect skill

Quality Agents:
  Test files present            → test-architect agent + tdd skill + test-gen skill
  Performance-sensitive project → performance-profiler agent
  Frontend with accessibility   → a11y-specialist agent + a11y-audit skill
  Many dependencies             → dependency-auditor agent + dependency-audit skill

Security Agents:
  Auth/payment code detected    → security-auditor agent + security-review skill
  Smart contracts detected      → web3-security-auditor agent + web3-patterns skill
  Financial/healthcare domain   → compliance-auditor agent + fintech-compliance skill

Workflow Agents:
  Git repo with branches        → pr-reviewer agent + pr-review skill
  GitHub Issues integration     → issue-triager agent + issue-fixer skill
  Release tags present          → release-manager agent + release-prep skill
```

### Step 4: Output Recommendation

Present findings in this format:

```
## Tech Stack Analysis

| Category     | Detected                        |
|-------------|----------------------------------|
| Language     | TypeScript 5.x, Python 3.12     |
| Framework    | Next.js 15, FastAPI 0.115       |
| Database     | PostgreSQL (via Prisma)          |
| Infra        | Docker, Terraform, GitHub Actions|
| Testing      | Vitest, Playwright, pytest       |

## Recommended Agent Team

### Core (install these)
- **code-reviewer** — General code quality
- **api-architect** — REST API design review
- **test-architect** — Test strategy and gaps

### Specialized (install if relevant)
- **terraform-expert** — IaC review
- **performance-profiler** — Performance investigation
- **pr-reviewer** — PR review automation

### Skills to Add
- /api-design, /database-design, /tdd, /test-gen, /terraform, /docker-optimization

Run `/agent-assembler:install core` to install the core team,
or `/agent-assembler:install all` for everything.
```

---

## Sub-command: `:compose` — Compose Custom Agent Team

### Step 1: Gather Focus Area

If the user provides a focus (e.g., "security", "performance", "fullstack"), use it to weight recommendations. Otherwise, ask:

```
What's your primary focus?
1. Full-stack development (balanced team)
2. Backend / API development
3. Frontend / UI development
4. DevOps / Infrastructure
5. Security hardening
6. Performance optimization
7. Data / ML pipeline
```

### Step 2: Generate Team Configuration

Based on focus, generate a `.claude/agent-team.json` configuration:

```json
{
  "team_name": "fullstack-review-team",
  "description": "Balanced team for full-stack TypeScript + Python project",
  "agents": [
    {
      "role": "code-reviewer",
      "model": "sonnet",
      "focus": ["code-quality", "patterns", "testing"],
      "trigger": "on-pr"
    },
    {
      "role": "api-architect",
      "model": "opus",
      "focus": ["api-design", "breaking-changes", "contracts"],
      "trigger": "on-api-change"
    },
    {
      "role": "security-auditor",
      "model": "opus",
      "focus": ["auth", "injection", "data-exposure"],
      "trigger": "on-pr"
    },
    {
      "role": "test-architect",
      "model": "sonnet",
      "focus": ["coverage-gaps", "test-quality", "e2e"],
      "trigger": "on-demand"
    }
  ],
  "skills": [
    "api-design",
    "database-design",
    "tdd",
    "test-gen",
    "security-review"
  ],
  "review_protocol": {
    "parallel_reviewers": true,
    "required_lenses": ["code-quality", "security"],
    "optional_lenses": ["performance", "accessibility"]
  }
}
```

### Step 3: Explain Team Composition

For each agent in the team, explain:
- **Why included**: What tech stack signals triggered this recommendation
- **Model choice**: Why opus vs sonnet vs haiku for this role
- **Trigger**: When this agent should be activated
- **Overlap check**: Note any redundancy with other agents

---

## Sub-command: `:install` — Install Agent Templates

### Step 1: Determine What to Install

Accept arguments:
- `/agent-assembler:install core` — Install core recommended agents
- `/agent-assembler:install all` — Install all recommended agents
- `/agent-assembler:install agent-name [agent-name...]` — Install specific agents
- `/agent-assembler:install from-compose` — Install from previously composed team config

### Step 2: Locate Templates

Agent templates are sourced from the catalog:
```
Source: .claude/skills/bootstrap/templates/agents/{agent-name}.md
Target: {project}/.claude/agents/{agent-name}.md
```

### Step 3: Customize Templates

For each agent template being installed:

1. **Read the template** from the catalog
2. **Replace `shopify-deliverable-website-stack-clone`** with the actual project name (from package.json name, pyproject.toml name, or directory name)
3. **Adjust model tier** if the user has preferences (e.g., prefer haiku for cost savings)
4. **Write to target** `.claude/agents/{agent-name}.md`

### Step 4: Generate Installation Report

```
## Agent Installation Report

Installed 4 agents to .claude/agents/:

| Agent              | Model  | File                              |
|-------------------|--------|-----------------------------------|
| code-reviewer      | sonnet | .claude/agents/code-reviewer.md   |
| api-architect      | opus   | .claude/agents/api-architect.md   |
| security-auditor   | opus   | .claude/agents/security-auditor.md|
| test-architect     | sonnet | .claude/agents/test-architect.md  |

Skills recommended (add to .claude/skills/ or invoke directly):
- /api-design — REST API design patterns
- /tdd — Test-driven development workflows
- /security-review — Security code review

Next steps:
1. Review agent configs in .claude/agents/
2. Customize agent prompts for your project's conventions
3. Try `/agent-teams:review` to run a multi-agent code review
```

### Step 5: Verify Installation

After installation, verify:
- All agent files exist at target paths
- YAML frontmatter is valid (name, description, model fields present)
- No `shopify-deliverable-website-stack-clone` placeholders remain
- No duplicate agents (warn if overwriting existing)

---

## Important Rules

1. **Never fabricate detections** — Only report tech stack elements that are actually found in project files
2. **Prefer existing agents** — Check what's already installed in `.claude/agents/` before recommending duplicates
3. **Respect user preferences** — If the user has a `.claude/settings.json` with model preferences, honor them
4. **Explain trade-offs** — When recommending opus vs sonnet agents, explain the cost/quality trade-off
5. **Cross-reference catalog** — Always check `catalog.json` for the latest available agents and skills
6. **Idempotent installs** — Running install twice should not create duplicates; warn and skip existing files
