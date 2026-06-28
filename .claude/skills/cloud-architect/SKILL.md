---
name: cloud-architect
description: "Cloud architecture patterns: AWS Well-Architected Framework, GCP best practices, Azure patterns, cost optimization (right-sizing/reserved instances), and IAM least-privilege policies. Sub-commands: /cloud-architect:aws, :gcp, :azure, :cost, :iam. Use when designing cloud infrastructure, reviewing architecture, or optimizing cloud costs."
---

# Cloud Architect

You are executing the `/cloud-architect` skill. You apply cloud engineering best practices for AWS, GCP, Azure, cost optimization, and IAM.

Parse the sub-command from the user's invocation:
- `/cloud-architect` → show **menu** and wait for selection
- `/cloud-architect:aws` → **AWS Patterns**
- `/cloud-architect:gcp` → **GCP Patterns**
- `/cloud-architect:azure` → **Azure Patterns**
- `/cloud-architect:cost` → **Cost Optimization**
- `/cloud-architect:iam` → **IAM & Security**

---

## Menu (no sub-command)

```
Cloud Architect — Choose a topic:

1. aws   — Well-Architected Framework, common service patterns
2. gcp   — Cloud-native patterns, GKE, Cloud Run, BigQuery
3. azure — Azure patterns, Entra ID, AKS, Cosmos DB
4. cost  — Right-sizing, reserved instances, spot/preemptible, waste detection
5. iam   — Least-privilege policies, cross-account access, service accounts
```

---

## AWS Patterns (`:aws`)

### Well-Architected Pillars
```
1. Operational Excellence — IaC, CI/CD, runbooks, observability
2. Security              — IAM, encryption, network isolation, compliance
3. Reliability           — Multi-AZ, auto-scaling, backup, disaster recovery
4. Performance           — Right-sizing, caching, CDN, read replicas
5. Cost Optimization     — Reserved capacity, spot instances, right-sizing
6. Sustainability        — Efficient workloads, managed services
```

### Common Architecture: Web Application
```
Route 53 (DNS)
    │
CloudFront (CDN) ──── S3 (static assets)
    │
ALB (Application Load Balancer)
    │
┌───┴───┐
│  ECS  │ (or EKS / Lambda)
│Fargate│
└───┬───┘
    │
┌───┴────┐     ┌──────────┐
│  RDS   │     │ElastiCache│
│(Aurora)│     │  (Redis)  │
└────────┘     └──────────┘
```

### Service Selection Guide
```
| Workload           | Compute         | Database       | Messaging     |
|--------------------|-----------------|----------------|---------------|
| Web API            | ECS Fargate     | RDS/Aurora     | SQS           |
| Event processing   | Lambda          | DynamoDB       | EventBridge   |
| ML inference       | SageMaker       | S3             | SNS           |
| Batch processing   | Batch / Step Fn | Redshift       | SQS           |
| Real-time stream   | ECS / Lambda    | DynamoDB       | Kinesis       |
```

---

## GCP Patterns (`:gcp`)

### Service Equivalents
```
| AWS               | GCP                    |
|--------------------|------------------------|
| EC2               | Compute Engine         |
| ECS / Fargate     | Cloud Run              |
| Lambda            | Cloud Functions        |
| RDS               | Cloud SQL              |
| DynamoDB          | Firestore / Bigtable   |
| S3                | Cloud Storage          |
| SQS               | Cloud Tasks / Pub/Sub  |
| CloudFront        | Cloud CDN              |
| Route 53          | Cloud DNS              |
| IAM               | Cloud IAM              |
```

### Cloud Run Pattern
```yaml
# service.yaml — Cloud Run service
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: my-service
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1"
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/cpu-throttling: "false"
    spec:
      containerConcurrency: 80
      containers:
        - image: gcr.io/my-project/my-service:latest
          resources:
            limits:
              cpu: "2"
              memory: 512Mi
          env:
            - name: DB_HOST
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: host
```

---

## Azure Patterns (`:azure`)

### Service Equivalents
```
| AWS               | Azure                  |
|--------------------|------------------------|
| EC2               | Virtual Machines       |
| ECS / Fargate     | Container Apps         |
| Lambda            | Azure Functions        |
| RDS               | Azure SQL / Cosmos DB  |
| S3                | Blob Storage           |
| SQS               | Service Bus            |
| CloudFront        | Azure CDN / Front Door |
| IAM               | Entra ID (Azure AD)    |
| EKS               | AKS                    |
```

### Azure Container Apps
```bicep
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'my-app'
  location: resourceGroup().location
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
      }
      secrets: [
        { name: 'db-connection', value: dbConnectionString }
      ]
    }
    template: {
      containers: [
        {
          name: 'my-app'
          image: 'myregistry.azurecr.io/my-app:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'DB_CONNECTION', secretRef: 'db-connection' }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 10
      }
    }
  }
}
```

---

## Cost Optimization (`:cost`)

### Right-Sizing Analysis
```
1. Identify underutilized resources:
   - CPU < 20% average over 14 days → downsize
   - Memory < 30% average → downsize
   - Idle load balancers (0 requests/day) → remove
   - Unattached EBS volumes → snapshot & delete

2. Reserved vs On-Demand vs Spot:
   | Workload Type    | Strategy           | Savings      |
   |------------------|--------------------|--------------|
   | Steady baseline  | Reserved (1yr)     | ~40%         |
   | Steady baseline  | Reserved (3yr)     | ~60%         |
   | Fault-tolerant   | Spot / Preemptible | ~70-90%      |
   | Unpredictable    | On-Demand          | 0% (baseline)|
   | Dev/Test         | Spot + auto-stop   | ~80%         |

3. Storage tiering:
   | Access Pattern    | AWS S3 Class       | Monthly/GB   |
   |-------------------|--------------------|--------------|
   | Frequent          | Standard           | $0.023       |
   | Infrequent (30d+) | IA                 | $0.0125      |
   | Archive (90d+)    | Glacier Instant    | $0.004       |
   | Deep archive      | Glacier Deep       | $0.00099     |
```

### Cost Monitoring
```
- Set billing alerts at 50%, 80%, 100% of budget
- Tag all resources: Team, Environment, Project, CostCenter
- Review cost anomaly detection alerts daily
- Monthly cost review meeting with engineering leads
```

---

## IAM & Security (`:iam`)

### Least Privilege Policy (AWS)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3ReadSpecificBucket",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-app-data",
        "arn:aws:s3:::my-app-data/*"
      ]
    },
    {
      "Sid": "DenyUnencryptedUploads",
      "Effect": "Deny",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::my-app-data/*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": "aws:kms"
        }
      }
    }
  ]
}
```

### Cross-Account Access
```hcl
# Account A: Create role for Account B to assume
resource "aws_iam_role" "cross_account" {
  name = "cross-account-reader"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { AWS = "arn:aws:iam::ACCOUNT_B_ID:root" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = { "sts:ExternalId" = "unique-external-id" }
      }
    }]
  })
}
```

---

## Hard Constraints
- All data at rest must be encrypted (AES-256 or KMS)
- All data in transit must use TLS 1.2+
- IAM policies must follow least privilege — no `*` resources in production
- Multi-AZ deployment for all production workloads
- Automated backups with tested restore procedures
- All resources must be tagged for cost allocation and ownership
- Infrastructure must be defined as code (Terraform, CloudFormation, Bicep)
