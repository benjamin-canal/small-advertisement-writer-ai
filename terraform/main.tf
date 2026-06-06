terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # bucket passé via -backend-config en CI (secret TF_BACKEND_BUCKET)
  backend "s3" {
    key          = "small-advertisement-writer-ai/terraform.tfstate"
    region       = "eu-west-1"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "small-advertisement-writer-ai"
      Environment = var.env
      ManagedBy   = "terraform"
    }
  }
}

locals {
  project = "saw"
  env     = var.env
  tags = {
    Project     = "small-advertisement-writer-ai"
    Environment = var.env
    ManagedBy   = "terraform"
  }
}

module "s3" {
  source  = "./modules/s3"
  env     = local.env
  project = local.project
  tags    = local.tags
}

module "dynamodb" {
  source  = "./modules/dynamodb"
  env     = local.env
  project = local.project
  tags    = local.tags
}

module "secrets_manager" {
  source  = "./modules/secrets-manager"
  env     = local.env
  project = local.project
  tags    = local.tags
}

module "authorizer" {
  source        = "./modules/lambda"
  function_name = "${local.project}-authorizer-${local.env}"
  handler       = "handler.handler"
  runtime       = "nodejs22.x"
  memory_mb     = 128
  log_retention = var.log_retention_days
  source_dir    = "${path.root}/../dist/authorizer"
  tags          = local.tags
  env_vars = {
    LOG_LEVEL          = var.log_level
    API_KEY_SECRET_ARN = module.secrets_manager.secret_arn
  }
  extra_policy_arns = [module.secrets_manager.read_policy_arn]
}

# IAM policy granting Rekognition object-detection access (analyze function only)
resource "aws_iam_policy" "rekognition" {
  name = "${local.project}-rekognition-${local.env}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["rekognition:DetectLabels"]
      Resource = "*"
    }]
  })
  tags = local.tags
}

# IAM policy granting Bedrock InvokeModel access to Claude models
resource "aws_iam_policy" "bedrock" {
  name = "${local.project}-bedrock-${local.env}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["bedrock:InvokeModel"]
      Resource = [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-*",
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-*",
        "arn:aws:bedrock:${var.aws_region}:*:inference-profile/eu.anthropic.claude-haiku-4-5-*",
        "arn:aws:bedrock:${var.aws_region}:*:inference-profile/eu.anthropic.claude-sonnet-4-*",
      ]
    }]
  })
  tags = local.tags
}

module "analyze_fn" {
  source               = "./modules/lambda"
  function_name        = "${local.project}-analyze-fn-${local.env}"
  handler              = "handler.handler"
  runtime              = "nodejs22.x"
  memory_mb            = var.analyze_memory_mb
  timeout_seconds      = 60
  log_retention        = var.log_retention_days
  source_dir           = "${path.root}/../dist/analyze-fn"
  tags                 = local.tags
  reserved_concurrency = var.lambda_reserved_concurrency
  env_vars = {
    LOG_LEVEL        = var.log_level
    S3_BUCKET        = module.s3.bucket_name
    DYNAMODB_TABLE   = module.dynamodb.requests_table_name
    BEDROCK_MODEL_ID = var.bedrock_model_id
  }
  extra_policy_arns = [
    module.s3.read_policy_arn,
    module.dynamodb.write_policy_arn,
    aws_iam_policy.bedrock.arn,
    aws_iam_policy.rekognition.arn,
  ]
}

module "estimate_fn" {
  source               = "./modules/lambda"
  function_name        = "${local.project}-estimate-fn-${local.env}"
  handler              = "handler.handler"
  runtime              = "nodejs22.x"
  memory_mb            = var.default_memory_mb
  log_retention        = var.log_retention_days
  source_dir           = "${path.root}/../dist/estimate-fn"
  tags                 = local.tags
  reserved_concurrency = var.lambda_reserved_concurrency
  env_vars = {
    LOG_LEVEL        = var.log_level
    DYNAMODB_TABLE   = module.dynamodb.requests_table_name
    BEDROCK_MODEL_ID = var.bedrock_model_id
  }
  extra_policy_arns = [
    module.dynamodb.write_policy_arn,
    aws_iam_policy.bedrock.arn,
  ]
}

module "generate_fn" {
  source               = "./modules/lambda"
  function_name        = "${local.project}-generate-fn-${local.env}"
  handler              = "handler.handler"
  runtime              = "nodejs22.x"
  memory_mb            = var.default_memory_mb
  log_retention        = var.log_retention_days
  source_dir           = "${path.root}/../dist/generate-fn"
  tags                 = local.tags
  reserved_concurrency = var.lambda_reserved_concurrency
  env_vars = {
    LOG_LEVEL        = var.log_level
    DYNAMODB_TABLE   = module.dynamodb.requests_table_name
    BEDROCK_MODEL_ID = var.bedrock_model_id
  }
  extra_policy_arns = [
    module.dynamodb.write_policy_arn,
    aws_iam_policy.bedrock.arn,
  ]
}

module "api_gateway" {
  source               = "./modules/api-gateway"
  env                  = local.env
  project              = local.project
  tags                 = local.tags
  authorizer_arn       = module.authorizer.function_arn
  authorizer_role_arn  = module.authorizer.invoke_role_arn
  analyze_fn_arn       = module.analyze_fn.function_arn
  estimate_fn_arn      = module.estimate_fn.function_arn
  generate_fn_arn      = module.generate_fn.function_arn
  analyze_fn_role_arn  = module.analyze_fn.invoke_role_arn
  estimate_fn_role_arn = module.estimate_fn.invoke_role_arn
  generate_fn_role_arn = module.generate_fn.invoke_role_arn
}
