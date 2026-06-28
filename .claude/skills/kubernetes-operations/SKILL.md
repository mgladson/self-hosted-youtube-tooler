---
name: kubernetes-operations
description: "Kubernetes operations bundle: manifest generation, Helm chart scaffolding, GitOps workflows (Flux/ArgoCD), and security policy hardening. Sub-commands: /kubernetes-operations:manifests, :helm, :gitops, :security. Use for K8s deployments, cluster configuration, and infrastructure-as-code."
---

# Kubernetes Operations

You are executing the `/kubernetes-operations` skill. You handle production Kubernetes operations: generating manifests, scaffolding Helm charts, implementing GitOps workflows, and hardening cluster security.

Parse the sub-command from the user's invocation:
- `/kubernetes-operations` → show **menu** and wait for selection
- `/kubernetes-operations:manifests` → **Generate K8s Manifests**
- `/kubernetes-operations:helm` → **Helm Chart Scaffolding**
- `/kubernetes-operations:gitops` → **GitOps Workflow Setup**
- `/kubernetes-operations:security` → **Security Policy Hardening**

---

## Menu (no sub-command)

```
Kubernetes Operations — Choose a task:

1. manifests — Generate Deployment, Service, Ingress, ConfigMap, HPA manifests
2. helm       — Scaffold a production-ready Helm chart with values, templates, tests
3. gitops     — Set up GitOps with Flux v2 or ArgoCD
4. security   — Pod security standards, NetworkPolicy, RBAC, OPA/Kyverno policies
```

Ask: "Which task? Or describe what you're deploying and I'll generate the full configuration."

---

## Generate K8s Manifests (`:manifests`)

### Step 1: Gather Requirements

Ask for:
- Application name and container image
- Port(s) the app listens on
- Resource requirements (CPU/memory)
- Number of replicas
- Does it need persistent storage?
- External ingress needed?

### Step 2: Generate Production-Ready Manifests

**Deployment with best practices:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  labels:
    app: myapp
    version: "1.0.0"
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0  # zero-downtime
  template:
    metadata:
      labels:
        app: myapp
    spec:
      # Security hardening
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000
        seccompProfile:
          type: RuntimeDefault

      # Graceful shutdown
      terminationGracePeriodSeconds: 60

      containers:
        - name: myapp
          image: myapp:1.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8080
              protocol: TCP

          # Resource limits REQUIRED — prevents noisy neighbor
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"

          # Container security
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]

          # Health checks
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 20
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10

          # Startup probe for slow-starting containers
          startupProbe:
            httpGet:
              path: /health
              port: 8080
            failureThreshold: 30
            periodSeconds: 10

          # Config from ConfigMap/Secret
          envFrom:
            - configMapRef:
                name: myapp-config
            - secretRef:
                name: myapp-secrets

          # Writable tmp dir when readOnlyRootFilesystem=true
          volumeMounts:
            - name: tmp
              mountPath: /tmp

      volumes:
        - name: tmp
          emptyDir: {}

      # Pod disruption budget companion (deploy separately)
      # topologySpreadConstraints for multi-AZ
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: myapp
---
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp
  ports:
    - port: 80
      targetPort: 8080
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: myapp
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: myapp
```

---

## Helm Chart Scaffolding (`:helm`)

### Step 1: Scaffold Chart Structure

```
charts/myapp/
├── Chart.yaml
├── values.yaml
├── values-staging.yaml
├── values-production.yaml
├── templates/
│   ├── _helpers.tpl
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── hpa.yaml
│   ├── pdb.yaml
│   ├── serviceaccount.yaml
│   └── NOTES.txt
└── tests/
    └── test-connection.yaml
```

**`Chart.yaml`:**
```yaml
apiVersion: v2
name: myapp
description: A production-ready Helm chart for myapp
type: application
version: 0.1.0
appVersion: "1.0.0"
maintainers:
  - name: team-platform
    email: platform@example.com
keywords:
  - myapp
```

**`values.yaml` (with sane defaults):**
```yaml
replicaCount: 2

image:
  repository: myapp
  pullPolicy: IfNotPresent
  tag: ""  # Overridden by CI: image.tag=sha-abc123

nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  annotations: {}
  name: ""

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: false
  className: nginx
  annotations: {}
  hosts:
    - host: myapp.example.com
      paths:
        - path: /
          pathType: Prefix
  tls: []

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

config:
  logLevel: info
  port: 8080

secrets: {}  # Injected via external-secrets-operator in production
```

**`templates/_helpers.tpl`:**
```yaml
{{- define "myapp.fullname" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "myapp.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/name: {{ include "myapp.fullname" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
```

---

## GitOps Workflow (`:gitops`)

> **Deeper coverage available:** For comprehensive Flux v2 and ArgoCD patterns including ImagePolicy automation, ApplicationSets, PR-based environment promotion, and secrets management (Sealed Secrets/SOPS/External Secrets Operator), see `/gitops`.

### Flux v2 Setup

```bash
# Bootstrap Flux on cluster
flux bootstrap github \
  --owner=my-org \
  --repository=gitops-config \
  --branch=main \
  --path=clusters/production \
  --personal

# Add HelmRelease for your app
cat > clusters/production/myapp.yaml <<EOF
---
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: myapp
  namespace: flux-system
spec:
  interval: 10m
  url: oci://ghcr.io/my-org/charts

---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: myapp
  namespace: production
spec:
  interval: 10m
  chart:
    spec:
      chart: myapp
      version: ">=0.1.0"
      sourceRef:
        kind: HelmRepository
        name: myapp
        namespace: flux-system
  values:
    replicaCount: 3
    autoscaling:
      enabled: true
  # Image automation
  postRenderers:
    - kustomize:
        patches:
          - patch: |
              - op: replace
                path: /spec/template/spec/containers/0/image
                value: ghcr.io/my-org/myapp:latest
            target:
              kind: Deployment
EOF
```

### CI/CD Integration

```yaml
# .github/workflows/deploy.yml
- name: Update image tag in GitOps repo
  run: |
    IMAGE_TAG="${{ github.sha }}"
    yq e ".image.tag = \"$IMAGE_TAG\"" -i charts/myapp/values-production.yaml
    git add .
    git commit -m "chore: deploy myapp@${IMAGE_TAG}"
    git push
```

---

## Security Policy Hardening (`:security`)

### Pod Security Standards

```yaml
# Enforce restricted PSS at namespace level
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/warn: restricted
```

### NetworkPolicy — zero-trust

```yaml
# Default deny all ingress/egress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: production
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
---
# Allow myapp to receive traffic from ingress controller only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: myapp-ingress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: myapp
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
      ports:
        - port: 8080
---
# Allow myapp to reach database only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: myapp-egress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: myapp
  policyTypes: [Egress]
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - port: 5432
    - ports:  # DNS
        - port: 53
          protocol: UDP
```

### RBAC — least privilege

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: myapp
  namespace: production
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: myapp
  namespace: production
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    resourceNames: ["myapp-config"]
    verbs: ["get", "watch"]
  # Only grant what's needed — no wildcards
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: myapp
  namespace: production
subjects:
  - kind: ServiceAccount
    name: myapp
    namespace: production
roleRef:
  kind: Role
  name: myapp
  apiGroup: rbac.authorization.k8s.io
```

### Kyverno policy — enforce image signing

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signatures
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-image-signature
      match:
        any:
          - resources:
              kinds: [Pod]
              namespaces: [production]
      verifyImages:
        - imageReferences: ["ghcr.io/my-org/*"]
          attestors:
            - entries:
                - keyless:
                    subject: "https://github.com/my-org/*"
                    issuer: "https://token.actions.githubusercontent.com"
```
