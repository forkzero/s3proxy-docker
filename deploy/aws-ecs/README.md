# Deploy s3proxy on AWS Fargate

A reference CloudFormation stack that runs the [`forkzero/s3proxy`](https://hub.docker.com/r/forkzero/s3proxy)
container on AWS Fargate behind an Application Load Balancer, streaming objects
from an S3 bucket you name.

[`s3proxy-fargate.yaml`](./s3proxy-fargate.yaml) provisions: an ALB (+ security
group), a listener (HTTPS/443 if you supply an ACM certificate, otherwise
HTTP/80), a target group health-checked on `/health`, an ECS cluster, a Fargate
service + task definition, a **task role scoped to `s3:GetObject` on your bucket
only**, a CloudWatch log group, and CPU target-tracking autoscaling. HTTPS and a
Route 53 alias are optional.

Nothing in the template is account-specific — you pass your VPC, subnets, and
bucket as parameters.

## Prerequisites

- A VPC and **two or more subnets in different AZs**. Public subnets are
  simplest (tasks get a public IP to reach S3); private subnets work if they
  have a NAT gateway.
- The AWS CLI, authenticated to the target account.
- The bucket already exists.

## Deploy

```bash
aws cloudformation deploy \
  --stack-name s3proxy \
  --template-file s3proxy-fargate.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
      BucketName=my-bucket \
      VpcId=vpc-0123456789abcdef0 \
      SubnetIds=subnet-aaaa,subnet-bbbb \
      ContainerImage=forkzero/s3proxy:4.2
```

`CAPABILITY_IAM` is required because the stack creates the task and execution
roles. When it finishes, read the URL from the outputs:

```bash
aws cloudformation describe-stacks --stack-name s3proxy \
  --query "Stacks[0].Outputs[?OutputKey=='Endpoint'].OutputValue" --output text
curl "$(aws cloudformation describe-stacks --stack-name s3proxy \
  --query "Stacks[0].Outputs[?OutputKey=='Endpoint'].OutputValue" --output text)/index.html"
```

### Try it against the public demo bucket

`s3proxy-public` is a world-readable demo bucket. Point the stack at it to see a
working deployment without creating data of your own:

```bash
aws cloudformation deploy \
  --stack-name s3proxy-demo \
  --template-file s3proxy-fargate.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
      BucketName=s3proxy-public \
      VpcId=vpc-0123456789abcdef0 \
      SubnetIds=subnet-aaaa,subnet-bbbb
```

## Enable HTTPS and a custom domain (optional)

Supply an ACM certificate ARN (in the **same region** as the stack) to switch
the listener to HTTPS/443, and a domain + hosted zone to add a Route 53 alias:

```bash
  --parameter-overrides \
      BucketName=my-bucket \
      VpcId=vpc-0123456789abcdef0 \
      SubnetIds=subnet-aaaa,subnet-bbbb \
      CertificateArn=arn:aws:acm:us-east-1:123456789012:certificate/uuid \
      DomainName=s3proxy.example.com \
      HostedZoneName=example.com
```

## Parameters

| Parameter        | Default                 | Notes                                                        |
| ---------------- | ----------------------- | ------------------------------------------------------------ |
| `BucketName`     | *(required)*            | Bucket to serve; the task role gets `s3:GetObject` on it.    |
| `VpcId`          | *(required)*            | VPC to deploy into.                                          |
| `SubnetIds`      | *(required)*            | ≥2 subnets in different AZs (comma-separated).               |
| `ContainerImage` | `forkzero/s3proxy:latest` | **Pin a version in production**, e.g. `forkzero/s3proxy:4.2`. |
| `ContainerPort`  | `8080`                  | Passed to the image as `PORT`.                               |
| `DesiredCount`   | `2`                     | Tasks to run.                                                |
| `MinCapacity` / `MaxCapacity` | `1` / `4`  | Autoscaling bounds (CPU target 70%).                         |
| `Cpu` / `Memory` | `1024` / `2048`         | Fargate task size (must be a valid CPU/memory pair).         |
| `CertificateArn` | `""`                    | ACM cert ARN → HTTPS/443. Blank → HTTP/80.                   |
| `DomainName` / `HostedZoneName` | `""` / `""` | Route 53 alias to the ALB. Blank → no DNS record.      |

## Update the image / roll out

Redeploy with a new `ContainerImage`, or force a fresh pull of a moving tag:

```bash
aws ecs update-service --cluster s3proxy --service s3proxy --force-new-deployment
```

## Tear down

```bash
aws cloudformation delete-stack --stack-name s3proxy
```

## Notes

- **This is a starting point, not a turnkey production stack.** Review the
  security group (open to `0.0.0.0/0`), TLS policy, log retention, and scaling
  bounds for your needs.
- The task role grants read-only `s3:GetObject` on the one bucket — the proxy
  needs nothing more.
- Other platforms (plain `docker run`, Compose, Kubernetes) are covered in the
  [main README](../../README.md).
