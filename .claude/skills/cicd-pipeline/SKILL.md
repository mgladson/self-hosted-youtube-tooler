---
name: cicd-pipeline
description: "CI/CD pipeline patterns: GitHub Actions workflows, GitLab CI pipelines, Jenkins declarative pipelines, and common patterns (caching, matrix builds, secrets, environment promotion). Sub-commands: /cicd-pipeline:github-actions, :gitlab-ci, :jenkins, :common. Use when creating, optimizing, or troubleshooting CI/CD pipelines."
---

# CI/CD Pipeline

You are executing the `/cicd-pipeline` skill. You apply CI/CD best practices for GitHub Actions, GitLab CI, Jenkins, and common patterns.

Parse the sub-command from the user's invocation:
- `/cicd-pipeline` → show **menu** and wait for selection
- `/cicd-pipeline:github-actions` → **GitHub Actions**
- `/cicd-pipeline:gitlab-ci` → **GitLab CI**
- `/cicd-pipeline:jenkins` → **Jenkins**
- `/cicd-pipeline:common` → **Common Patterns**

---

## Menu (no sub-command)

```
CI/CD Pipeline — Choose a topic:

1. github-actions — Workflows, reusable actions, matrix builds, OIDC
2. gitlab-ci      — .gitlab-ci.yml, stages, rules, environments
3. jenkins        — Declarative pipelines, shared libraries, agents
4. common         — Caching, secrets, environment promotion, artifacts
```

---

## GitHub Actions (`:github-actions`)

### Complete CI/CD Workflow
```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read
  packages: write
  id-token: write  # For OIDC

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        ports: [5432:5432]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - run: npm ci
      - run: npm test -- --coverage
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/testdb
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-${{ matrix.node-version }}
          path: coverage/

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          severity: CRITICAL,HIGH

  build-and-push:
    needs: [lint, test, security]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - run: echo "Deploy to staging..."

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://myapp.example.com
    steps:
      - uses: actions/checkout@v4
      - run: echo "Deploy to production..."
```

### Reusable Workflow
```yaml
# .github/workflows/reusable-deploy.yml
on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      image-tag:
        required: true
        type: string
    secrets:
      DEPLOY_KEY:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - run: echo "Deploying ${{ inputs.image-tag }} to ${{ inputs.environment }}"
```

---

## GitLab CI (`:gitlab-ci`)

### Complete Pipeline
```yaml
# .gitlab-ci.yml
stages:
  - lint
  - test
  - security
  - build
  - deploy

variables:
  DOCKER_IMAGE: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

.node-base:
  image: node:22-slim
  cache:
    key: $CI_COMMIT_REF_SLUG
    paths:
      - node_modules/
  before_script:
    - npm ci

lint:
  extends: .node-base
  stage: lint
  script:
    - npm run lint
    - npm run typecheck

test:
  extends: .node-base
  stage: test
  services:
    - postgres:16
  variables:
    POSTGRES_DB: testdb
    POSTGRES_PASSWORD: test
    DATABASE_URL: postgres://postgres:test@postgres:5432/testdb
  script:
    - npm test -- --coverage
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      junit: coverage/junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

security-scan:
  stage: security
  image: aquasec/trivy
  script:
    - trivy fs --exit-code 1 --severity HIGH,CRITICAL .
  allow_failure: false

build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $DOCKER_IMAGE .
    - docker push $DOCKER_IMAGE
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy-staging:
  stage: deploy
  environment:
    name: staging
    url: https://staging.example.com
  script:
    - echo "Deploy $DOCKER_IMAGE to staging"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy-production:
  stage: deploy
  environment:
    name: production
    url: https://example.com
  script:
    - echo "Deploy $DOCKER_IMAGE to production"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: manual
```

---

## Jenkins (`:jenkins`)

### Declarative Pipeline
```groovy
// Jenkinsfile
pipeline {
    agent { label 'docker' }

    environment {
        REGISTRY = 'ghcr.io/myorg/myapp'
        IMAGE_TAG = "${env.GIT_COMMIT?.take(8) ?: 'latest'}"
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Lint & Test') {
            parallel {
                stage('Lint') {
                    steps {
                        sh 'npm ci && npm run lint'
                    }
                }
                stage('Test') {
                    steps {
                        sh 'npm ci && npm test -- --coverage'
                    }
                    post {
                        always {
                            junit 'coverage/junit.xml'
                        }
                    }
                }
            }
        }

        stage('Build') {
            when { branch 'main' }
            steps {
                sh "docker build -t ${REGISTRY}:${IMAGE_TAG} ."
                sh "docker push ${REGISTRY}:${IMAGE_TAG}"
            }
        }

        stage('Deploy Staging') {
            when { branch 'main' }
            steps {
                sh "echo Deploying ${IMAGE_TAG} to staging"
            }
        }

        stage('Deploy Production') {
            when { branch 'main' }
            input {
                message 'Deploy to production?'
                ok 'Deploy'
            }
            steps {
                sh "echo Deploying ${IMAGE_TAG} to production"
            }
        }
    }

    post {
        failure {
            slackSend(color: 'danger', message: "Build failed: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
        }
    }
}
```

---

## Common Patterns (`:common`)

### Caching Strategies
```yaml
# Node.js — cache node_modules via lockfile hash
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: npm-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
    restore-keys: npm-${{ runner.os }}-

# Python — cache pip
- uses: actions/cache@v4
  with:
    path: ~/.cache/pip
    key: pip-${{ runner.os }}-${{ hashFiles('**/requirements*.txt') }}

# Docker — BuildKit layer cache
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### Environment Promotion
```
Feature Branch → PR → main → Staging → Production
                              (auto)    (manual gate)

Rollback: deploy previous known-good image tag
```

### Secrets Management
```yaml
# GitHub Actions: use OIDC for cloud providers (no static secrets)
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::123456789:role/github-actions
    aws-region: us-east-1
    # No AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY needed!
```

---

## Hard Constraints
- Never hardcode secrets in pipeline files — use platform secret stores
- Use OIDC for cloud provider authentication when available
- Pin all action/image versions to specific SHA or tag (not @latest)
- Cancel redundant PR builds on new pushes (concurrency groups)
- Fail builds on security vulnerabilities (HIGH/CRITICAL)
- Production deploys must require manual approval gate
- All pipeline changes must go through code review (PR)
