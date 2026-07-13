# TODO

## Migrate CI AWS auth to GitHub OIDC (remove long-lived keys)

**Why:** CI currently authenticates to S3 with a static access key from the IAM
user `s3proxy-docker-ci`, stored as the `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
repo secrets. Long-lived keys work until manually rotated and stay valid if ever
leaked. OIDC lets GitHub Actions assume an IAM **role** for short-lived
credentials per run — nothing persistent to leak or rotate.

**Scope:** one-time AWS setup + a `ci.yml` change + deleting the static user.

### 1. Register GitHub's OIDC provider in AWS (once per account)

Skip if it already exists (`aws iam list-open-id-connect-providers`).

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 2. Create the role with the same least-privilege policy + a repo-scoped trust policy

Trust policy — only this repo's workflows may assume the role (`trust.json`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::624920530251:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:forkzero/s3proxy-docker:*"
        }
      }
    }
  ]
}
```

```bash
aws iam create-role \
  --role-name s3proxy-docker-ci \
  --assume-role-policy-document file://trust.json \
  --description "GitHub OIDC role for s3proxy-docker CI (least-privilege S3 read)"

# Reuse the exact same S3 policy already used by the static user:
#   s3:ListBucket on arn:aws:s3:::s3proxy-public
#   s3:GetObject  on arn:aws:s3:::s3proxy-public/*
aws iam put-role-policy \
  --role-name s3proxy-docker-ci \
  --policy-name s3proxy-public-read \
  --policy-document file://ci-policy.json
```

Tighten `sub` later if desired, e.g. `repo:forkzero/s3proxy-docker:ref:refs/heads/main`
or `:pull_request`.

### 3. Switch `.github/workflows/ci.yml`

- Add job-level permissions to the `test` and `docker` jobs:
  ```yaml
  permissions:
    id-token: write   # mint the OIDC token
    contents: read
  ```
- Replace the credential inputs in the `configure-aws-credentials@v4` step with:
  ```yaml
  with:
    role-to-assume: arn:aws:iam::624920530251:role/s3proxy-docker-ci
    aws-region: us-east-1
  ```
  (drop `aws-access-key-id` / `aws-secret-access-key`; `aws-region` can stay a
  literal or move to a repo **variable** since it's no longer secret.)

### 4. Tear down the static credential

```bash
aws iam list-access-keys --user-name s3proxy-docker-ci   # note the AccessKeyId
aws iam delete-access-key  --user-name s3proxy-docker-ci --access-key-id <AKID>
aws iam delete-user-policy --user-name s3proxy-docker-ci --policy-name s3proxy-public-read
aws iam delete-user        --user-name s3proxy-docker-ci
# Remove the now-unused repo secrets:
gh secret delete AWS_ACCESS_KEY_ID     --repo forkzero/s3proxy-docker
gh secret delete AWS_SECRET_ACCESS_KEY --repo forkzero/s3proxy-docker
```

Verify a CI run is green **before** deleting the user/keys, so there's a rollback.
