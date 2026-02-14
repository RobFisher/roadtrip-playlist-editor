# AWS Early Deployment Plan

Objective: get a publicly reachable "hello world" deployed before advanced features.

## Deployment Target

Use a static SPA deployment first:

- Frontend bundle hosted in S3.
- CloudFront distribution for HTTPS and caching.
- CDK manages infrastructure.

This is low complexity and fast to iterate.

## Phase A: Deploy in One Session

1. Bootstrap AWS account for CDK (`cdk bootstrap`).
2. Deploy minimal stack containing:
   - S3 bucket for site assets.
   - CloudFront distribution.
   - Origin access restrictions.
3. Upload basic built app artifact.

Success criteria:

- HTTPS URL accessible from browser.
- CloudFront serves latest deploy.

## Phase B: Add Deployment Safety Basics

1. Versioned asset uploads.
2. Cache invalidation on deploy.
3. Basic observability:
   - CloudFront request metrics.
   - Error rate monitoring.

Success criteria:

- Re-deploy does not require manual console edits.
- Failed deploy can roll back to previous asset version.

## Minimal Operational Checklist

1. AWS budget alarm configured.
2. Least-privilege IAM role for deploy.
3. Secrets handled outside source code.
4. Production and dev environments separated.

## Suggested "Hello World" Definition

Page content:

- App name.
- Build/version marker.
- Environment label (dev/prod).
- Health check route for uptime monitoring.

This verifies end-to-end deploy mechanics early.

## Why This First

- Proves Nix + Node + CDK toolchain.
- De-risks AWS account/config issues early.
- Lets feature work happen against a real deployed endpoint.
