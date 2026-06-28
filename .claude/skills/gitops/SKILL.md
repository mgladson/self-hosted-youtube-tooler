---
name: gitops
description: "GitOps workflow patterns: Flux v2 (HelmRelease/ImagePolicy), ArgoCD (Application/ApplicationSet/sync policies), environment promotion pipelines (PR-based), and secrets management (Sealed Secrets/SOPS/External Secrets). Sub-commands: /gitops:flux, :argocd, :promotion, :secrets. Use when implementing GitOps workflows, managing Kubernetes deployments declaratively, or handling secrets in Git."
---

# GitOps

You are executing the `/gitops` skill. You apply GitOps best practices for Flux, ArgoCD, promotion, and secrets management.

Parse the sub-command from the user's invocation:
- `/gitops` → show **menu** and wait for selection
- `/gitops:flux` → **Flux v2**
- `/gitops:argocd` → **ArgoCD**
- `/gitops:promotion` → **Environment Promotion**
- `/gitops:secrets` → **Secrets Management**

> **Note:** For Kubernetes-specific patterns (manifests, Helm, security policies), see `/kubernetes-operations`. This skill focuses on the GitOps workflow layer.

---

## Menu (no sub-command)

```
GitOps — Choose a topic:

1. flux      — Flux v2 setup, HelmRelease, ImagePolicy, Kustomization
2. argocd    — Application, ApplicationSet, sync policies, rollback
3. promotion — PR-based environment promotion, staging → production pipeline
4. secrets   — Sealed Secrets, SOPS, External Secrets Operator
```

---

## Flux v2 (`:flux`)

### Repository Structure
```
clusters/
├── staging/
│   ├── flux-system/          # Flux bootstrap
│   ├── infrastructure.yaml   # Kustomization: infra sources
│   └── apps.yaml             # Kustomization: app sources
├── production/
│   ├── flux-system/
│   ├── infrastructure.yaml
│   └── apps.yaml
infrastructure/
├── sources/                  # HelmRepository, GitRepository
├── controllers/              # ingress-nginx, cert-manager
└── monitoring/               # prometheus, grafana
apps/
├── base/                     # Base manifests
│   └── my-app/
│       ├── deployment.yaml
│       ├── service.yaml
│       └── kustomization.yaml
├── staging/                  # Staging overlays
│   └── my-app/
│       ├── kustomization.yaml
│       └── patch-replicas.yaml
└── production/               # Production overlays
    └── my-app/
        ├── kustomization.yaml
        └── patch-replicas.yaml
```

### HelmRelease
```yaml
apiVersion: helm.toolkit.fluxcd.io/v2beta2
kind: HelmRelease
metadata:
  name: my-app
  namespace: apps
spec:
  interval: 5m
  chart:
    spec:
      chart: my-app
      version: ">=1.0.0 <2.0.0"
      sourceRef:
        kind: HelmRepository
        name: my-charts
      interval: 1m
  values:
    replicas: 3
    image:
      repository: ghcr.io/myorg/my-app
      tag: v1.2.3
    resources:
      limits:
        cpu: 500m
        memory: 256Mi
  upgrade:
    remediation:
      retries: 3
  rollback:
    cleanupOnFail: true
```

### Image Automation
```yaml
# Automatically update image tags in Git
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: my-app
spec:
  image: ghcr.io/myorg/my-app
  interval: 1m

---
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: my-app
spec:
  imageRepositoryRef:
    name: my-app
  policy:
    semver:
      range: ">=1.0.0"

---
apiVersion: image.toolkit.fluxcd.io/v1beta1
kind: ImageUpdateAutomation
metadata:
  name: my-app
spec:
  interval: 1m
  sourceRef:
    kind: GitRepository
    name: flux-system
  git:
    checkout:
      ref:
        branch: main
    commit:
      author:
        name: fluxcdbot
        email: fluxcd@example.com
      messageTemplate: "chore: update {{.AutomationObject.Name}} to {{range .Updated.Images}}{{println .}}{{end}}"
    push:
      branch: main
  update:
    path: ./apps
    strategy: Setters
```

---

## ArgoCD (`:argocd`)

### Application
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app-staging
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/myorg/gitops-config
    targetRevision: main
    path: apps/staging/my-app
  destination:
    server: https://kubernetes.default.svc
    namespace: staging
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ApplyOutOfSyncOnly=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

### ApplicationSet (Multi-Cluster/Multi-Environment)
```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: my-app
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - cluster: staging
            url: https://staging-k8s.example.com
            replicas: "2"
          - cluster: production
            url: https://production-k8s.example.com
            replicas: "5"
  template:
    metadata:
      name: "my-app-{{cluster}}"
    spec:
      project: default
      source:
        repoURL: https://github.com/myorg/gitops-config
        targetRevision: main
        path: "apps/{{cluster}}/my-app"
      destination:
        server: "{{url}}"
        namespace: my-app
```

---

## Environment Promotion (`:promotion`)

### PR-Based Promotion Pipeline
```
1. Developer merges code → CI builds image → pushes ghcr.io/myorg/app:v1.2.3
2. Image automation (Flux) or CI job updates staging manifest:
   - Opens PR: "chore: promote app v1.2.3 to staging"
   - Auto-merged (staging auto-promotes)
3. Staging tests pass → promotion job opens PR:
   - "chore: promote app v1.2.3 to production"
   - Requires manual approval (PR review)
4. On merge → GitOps controller deploys to production
5. Post-deploy verification (smoke tests, canary metrics)
```

### Promotion Script
```bash
#!/bin/bash
# promote.sh — Update image tag in target environment
set -euo pipefail

APP=$1
VERSION=$2
TARGET_ENV=$3

MANIFEST="apps/${TARGET_ENV}/${APP}/kustomization.yaml"
BRANCH="promote/${APP}-${VERSION}-${TARGET_ENV}"

git checkout -b "$BRANCH"
# Update image tag using kustomize edit or yq
yq -i ".images[0].newTag = \"${VERSION}\"" "$MANIFEST"
git add "$MANIFEST"
git commit -m "chore: promote ${APP} ${VERSION} to ${TARGET_ENV}"
git push origin "$BRANCH"

gh pr create \
  --title "Promote ${APP} ${VERSION} to ${TARGET_ENV}" \
  --body "Automated promotion from CI pipeline." \
  --label "promotion,${TARGET_ENV}"
```

---

## Secrets Management (`:secrets`)

### Sealed Secrets
```bash
# Encrypt secrets for Git storage
kubeseal --controller-name=sealed-secrets \
  --controller-namespace=kube-system \
  --format=yaml \
  < secret.yaml > sealed-secret.yaml

# sealed-secret.yaml is safe to commit to Git
# Only the cluster's controller can decrypt it
```

### SOPS (Mozilla)
```yaml
# .sops.yaml — encryption rules
creation_rules:
  - path_regex: .*staging.*
    kms: arn:aws:kms:us-east-1:123456789:key/staging-key-id
  - path_regex: .*production.*
    kms: arn:aws:kms:us-east-1:123456789:key/production-key-id
```

```bash
# Encrypt
sops --encrypt --in-place secrets/staging/db-credentials.yaml

# Decrypt (requires KMS access)
sops --decrypt secrets/staging/db-credentials.yaml
```

### External Secrets Operator
```yaml
# Pull secrets from AWS Secrets Manager / Vault into K8s
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: db-credentials
    creationPolicy: Owner
  data:
    - secretKey: username
      remoteRef:
        key: production/myapp/db
        property: username
    - secretKey: password
      remoteRef:
        key: production/myapp/db
        property: password
```

---

## Hard Constraints
- Git is the single source of truth — all changes flow through Git
- Never apply manifests directly with kubectl in production
- Secrets must never be committed to Git in plaintext — use Sealed Secrets, SOPS, or ESO
- Production promotions require PR approval (no auto-merge to production)
- All GitOps controllers must have rollback capability configured
- Image tags must be immutable (never use :latest in GitOps manifests)
- Drift detection must be enabled — self-heal unauthorized manual changes
