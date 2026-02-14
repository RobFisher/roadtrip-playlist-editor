# AWS Deployment Playbook (Milestone 1)

This playbook is for deploying the app in your own AWS account using `S3 + CloudFront + CDK`.
It is written for single-account usage with clear cost controls and a fast teardown path.

## 1. Target Architecture

- Static app assets in a private S3 bucket.
- CloudFront distribution in front of S3.
- CloudFront Origin Access Control (OAC) so S3 is not public.
- Optional Route 53 hosted zone + DNS records for custom domain.
- ACM certificate (for custom domain with HTTPS).

Why this design:
- Lower operational overhead than Amplify for this project.
- Good security baseline for static sites.
- Simple `cdk deploy` / `cdk destroy` lifecycle.

## 2. Account Safety First (Root User)

Use root only for one-time account setup. Do not use root for day-to-day deploys.

1. Enable MFA on root.
2. Ensure root has no access keys.
3. Create an admin/deployer IAM identity and use that for console/CLI/CDK.

Reference:
- Root user best practices: https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html

## 3. IAM Setup for CDK Deployments

Two options are listed. Option A is easiest to start; Option B is more controlled.

### Important: CLI Auth Model Depends on Account Setup

This is a common source of confusion:

- If your account uses **IAM Identity Center (SSO)**, use `aws configure sso` and `aws sso login` (or `aws login` on newer CLI flows).
- If you are using a plain **IAM user** (like `roadtrip-deployer`) without SSO, use an **access key** with `aws configure`.

So for a non-SSO home account, `aws login` is typically not the right path.

### Option A (Recommended for Milestone 1 simplicity)

Create an IAM user (or IAM Identity Center user) for deployments:

1. Create user `roadtrip-deployer`.
2. Enforce MFA for this user.
3. Attach `AdministratorAccess` temporarily while bootstrapping Milestone 1.
4. Configure CLI profile for this user.
5. Do all `cdk` and `aws` commands as this user, not root.

After first successful deploy, replace `AdministratorAccess` with a least-privilege policy.

Example CLI setup for IAM user auth:

```bash
aws configure --profile roadtrip-deployer
aws sts get-caller-identity --profile roadtrip-deployer
```

### Option B (Role-based deploy flow)

If you want role assumption from day one:

1. Create IAM role `RoadtripPlaylistCdkDeployRole`.
2. Trust policy: allow assumption by your deploy user/group.
3. Attach permissions required for CDK bootstrap/deploy.
4. Use `aws sts assume-role` workflow in CLI.

CDK bootstrap permission baseline reference:
- https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping-env.html

## 4. One-Time CDK Environment Bootstrap

From repo root:

```bash
nix develop
cdk bootstrap aws://<ACCOUNT_ID>/<REGION>
```

Notes:
- Bootstrap creates CDK support resources in your account.
- You may run bootstrap per region/account pair used for deployments.

Reference:
- https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping-env.html

## 5. Deployment Workflow (Per Account)

1. Authenticate as deploy identity.
2. Enter dev shell.
3. Build app artifacts.
4. `cdk deploy` stack.
5. Verify CloudFront URL.

Planned stack naming convention:
- `RoadtripPlaylistEditor-<env>` (example: `RoadtripPlaylistEditor-dev`)

Repository commands:

```bash
npm run deploy:dev
npm run destroy:dev
```

With explicit profile and region:

```bash
AWS_PROFILE=roadtrip-deployer AWS_REGION=<REGION> npm run deploy:dev
AWS_PROFILE=roadtrip-deployer AWS_REGION=<REGION> npm run destroy:dev
```

## 6. Cost Model (What You Pay For)

Core monthly cost drivers for this architecture:

1. CloudFront:
   - data transfer out to internet
   - HTTP/HTTPS request volume
   - cache invalidations above free allowance
2. S3:
   - object storage volume
   - PUT/GET/list request volume
3. Route 53 (if used):
   - hosted zone monthly charge
   - DNS query volume
4. Domain registration (if you buy a domain via Route 53 Registrar or elsewhere)

Usually free/no additional direct fee in this setup:
- ACM public certificate for CloudFront custom domain.

Pricing references (check before deploy):
- CloudFront pricing: https://aws.amazon.com/cloudfront/pricing/
- S3 pricing: https://aws.amazon.com/s3/pricing/
- Route 53 pricing: https://aws.amazon.com/route53/pricing/

Important Route 53 details:
- Public hosted zone is billed monthly.
- Alias A/AAAA queries to CloudFront are not charged as Route 53 queries.

Reference:
- https://aws.amazon.com/route53/pricing/

## 7. Budget and Alarm Guardrails

Set this before first production deploy:

1. Create AWS Budget for monthly spend (for example: `$10`).
2. Add alerts at `80%` actual and `100%` forecast.
3. Send notifications to email.

Suggested second budget:
- Service budget scoped to CloudFront + S3 + Route 53.

Note on timing:
- Budget data updates at least daily; alerts are not real-time minute-by-minute.

Reference:
- https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html

## 8. Fast Teardown / Cost Stop Procedure

If cost spikes or you want to stop all charges for this app:

1. Destroy CDK stack:
   ```bash
   cdk destroy RoadtripPlaylistEditor-<env>
   ```
   Or all stacks:
   ```bash
   cdk destroy --all --force
   ```
2. Confirm CloudFront distribution is deleted (can take time to fully disable/delete).
3. Confirm S3 bucket is removed (or manually empty/delete if retained by policy).
4. If custom DNS was created, delete Route 53 records/hosted zone if no longer needed.
5. Review billing console after 24 hours for residual charges.

Reference:
- CDK destroy command: https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-destroy.html

## 9. DNS in Plain Language (AWS + CloudFront)

DNS is the phonebook of the internet:
- Your domain name points to a DNS record.
- DNS record points users to CloudFront.
- CloudFront fetches content from S3.

### Common patterns

- Subdomain (`app.example.com`):
  - CNAME record to CloudFront domain (or Route 53 alias).
- Apex/root domain (`example.com`):
  - cannot be plain CNAME at apex
  - use Route 53 Alias A/AAAA to CloudFront

Why use Route 53 alias at apex:
- Works at zone apex.
- Supported directly with CloudFront target.

References:
- Alias vs non-alias records: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-choosing-alias-non-alias.html
- Add domain to CloudFront: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/add-domain-existing-distribution.html

### Certificate region rule (important)

For CloudFront custom domains, request/import ACM certificate in `us-east-1` (N. Virginia).

## 10. Security Defaults to Keep

1. Keep S3 bucket private (no public website hosting mode).
2. Use CloudFront OAC with signed origin requests.
3. Keep root user out of deployment workflow.
4. Rotate/disable unused credentials.
5. Use MFA for human users.

Reference:
- CloudFront OAC recommendation: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html

## 11. Deployability Goal for External Users

To let anyone deploy this app to their own account, keep these repo conventions:

1. `README` has exact bootstrap/deploy/destroy commands.
2. CDK stack parameters are environment-driven (`ACCOUNT`, `REGION`, optional domain).
3. No hardcoded account IDs.
4. Cost section links to live AWS pricing pages.
5. Teardown section is in same doc as deploy steps.
