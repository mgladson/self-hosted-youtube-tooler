---
name: terraform
description: "Terraform IaC patterns: module scaffolding (variables/outputs/README), state management (backends/locking), drift detection and plan analysis, security scanning (tfsec/checkov), and refactoring (module extraction/resource rename). Sub-commands: /terraform:module, :state, :drift, :security, :refactor. Use when writing, reviewing, or managing Terraform infrastructure."
---

# Terraform

You are executing the `/terraform` skill. You apply Terraform IaC best practices for modules, state, drift, security, and refactoring.

Parse the sub-command from the user's invocation:
- `/terraform` → show **menu** and wait for selection
- `/terraform:module` → **Module Scaffolding**
- `/terraform:state` → **State Management**
- `/terraform:drift` → **Drift Detection**
- `/terraform:security` → **Security Scanning**
- `/terraform:refactor` → **Refactoring**

---

## Menu (no sub-command)

```
Terraform — Choose a topic:

1. module   — Module scaffolding, variables, outputs, README, versioning
2. state    — Backend config, state locking, workspaces, import
3. drift    — Plan analysis, drift detection, reconciliation
4. security — tfsec, checkov, IAM policy review, secrets management
5. refactor — Module extraction, resource rename without destroy, moved blocks
```

---

## Module Scaffolding (`:module`)

### Module Structure
```
modules/
└── vpc/
    ├── main.tf          # Resource definitions
    ├── variables.tf     # Input variables
    ├── outputs.tf       # Output values
    ├── versions.tf      # Provider and Terraform version constraints
    ├── locals.tf        # Computed local values
    ├── data.tf          # Data sources
    └── README.md        # Auto-generated with terraform-docs
```

### Module Template
```hcl
# versions.tf
terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# variables.tf
variable "name" {
  description = "Name prefix for all resources"
  type        = string
  validation {
    condition     = length(var.name) > 0 && length(var.name) <= 32
    error_message = "Name must be between 1 and 32 characters."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "Must be a valid CIDR block."
  }
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}

# main.tf
resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, {
    Name = "${var.name}-vpc"
  })
}

resource "aws_subnet" "private" {
  count             = length(local.azs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone = local.azs[count.index]

  tags = merge(var.tags, {
    Name = "${var.name}-private-${local.azs[count.index]}"
    Tier = "private"
  })
}

# locals.tf
locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 3)
}

# outputs.tf
output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.this.id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}
```

---

## State Management (`:state`)

### Backend Configuration
```hcl
# S3 backend with DynamoDB locking
terraform {
  backend "s3" {
    bucket         = "mycompany-terraform-state"
    key            = "production/vpc/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
    # Use assume_role for cross-account state access
  }
}

# DynamoDB lock table (create once, manually or with bootstrap)
resource "aws_dynamodb_table" "terraform_locks" {
  name         = "terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}
```

### State Import
```bash
# Import existing resources into Terraform state
terraform import aws_vpc.this vpc-0123456789abcdef0

# Terraform 1.5+ import blocks (declarative)
import {
  to = aws_vpc.this
  id = "vpc-0123456789abcdef0"
}
```

### Workspace Strategy
```bash
# Workspaces for environment separation (lightweight)
terraform workspace new staging
terraform workspace new production
terraform workspace select production

# In config: reference workspace name
locals {
  env = terraform.workspace
  instance_type = {
    staging    = "t3.small"
    production = "t3.large"
  }[local.env]
}
```

---

## Drift Detection (`:drift`)

### Plan Analysis
```bash
# Detect drift: compare state to actual infrastructure
terraform plan -detailed-exitcode
# Exit codes: 0 = no changes, 1 = error, 2 = changes detected

# Save plan for review and apply
terraform plan -out=tfplan
terraform show -json tfplan | jq '.resource_changes[] | select(.change.actions != ["no-op"])'

# Apply only the reviewed plan
terraform apply tfplan
```

### Common Drift Patterns
```
| Drift Type              | Cause                          | Resolution                    |
|------------------------|--------------------------------|-------------------------------|
| Resource modified      | Manual console/CLI change      | terraform apply to reconcile  |
| Resource deleted       | Manual deletion                | terraform apply to recreate   |
| State stale            | Resource updated outside TF    | terraform refresh             |
| Config drift           | Code changed, not applied      | terraform apply               |
```

---

## Security Scanning (`:security`)

### tfsec Integration
```bash
# Run tfsec on Terraform code
tfsec .
tfsec . --format json --out results.json

# Common findings and fixes:
# AWS001: S3 bucket without encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

# AWS002: Security group with 0.0.0.0/0 ingress
resource "aws_security_group_rule" "restricted" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["10.0.0.0/8"]  # Not 0.0.0.0/0
  security_group_id = aws_security_group.this.id
}
```

### IAM Least Privilege
```hcl
# Use data source for policy documents (easier to audit)
data "aws_iam_policy_document" "lambda_exec" {
  statement {
    sid    = "AllowDynamoDB"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
    ]
    resources = [aws_dynamodb_table.this.arn]
  }

  statement {
    sid    = "AllowLogging"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:*:*:*"]
  }
}
```

---

## Refactoring (`:refactor`)

### Resource Rename (Zero Downtime)
```hcl
# Terraform 1.1+ moved blocks — rename without destroy/recreate
moved {
  from = aws_instance.web_server
  to   = aws_instance.app_server
}

moved {
  from = module.old_name
  to   = module.new_name
}
```

### Module Extraction
```hcl
# Step 1: Create module with the resources
# Step 2: Add moved blocks in root module
moved {
  from = aws_vpc.main
  to   = module.networking.aws_vpc.this
}

moved {
  from = aws_subnet.private
  to   = module.networking.aws_subnet.private
}

# Step 3: terraform plan — should show 0 changes
# Step 4: Remove moved blocks after successful apply
```

### for_each Migration (from count)
```hcl
# Before: count-based (fragile ordering)
resource "aws_subnet" "private" {
  count = 3
  # ...
}

# After: for_each (stable keys)
resource "aws_subnet" "private" {
  for_each          = toset(local.azs)
  availability_zone = each.value
  # ...
}

# State move commands (run before apply)
# terraform state mv 'aws_subnet.private[0]' 'aws_subnet.private["us-east-1a"]'
# terraform state mv 'aws_subnet.private[1]' 'aws_subnet.private["us-east-1b"]'
```

---

## Hard Constraints
- Always pin provider versions (never use `>=` without upper bound)
- State files must be encrypted at rest and use locking
- Never commit .tfstate files to version control
- All resources must have meaningful tags (Name, Environment, Team, ManagedBy=terraform)
- IAM policies must follow least privilege — no `*` actions or resources in production
- Use `prevent_destroy` lifecycle on critical resources (databases, S3 buckets with data)
- Modules must have variable validation blocks for all user-facing inputs
