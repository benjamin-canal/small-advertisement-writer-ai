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

  backend "s3" {
    bucket = "saw-terraform-state"
    key    = "small-advertisement-writer-ai/terraform.tfstate"
    region = "eu-west-1"
  }
}

provider "aws" {
  region = var.aws_region
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

module "analyze_fn" {
  source        = "./modules/lambda"
  function_name = "${local.project}-analyze-fn-${local.env}"
  handler       = "handler.handler"
  runtime       = "nodejs22.x"
  memory_mb     = var.analyze_memory_mb
  log_retention = var.log_retention_days
  source_dir    = "${path.root}/../dist/analyze-fn"
  tags          = local.tags
  env_vars = {
    LOG_LEVEL             = var.log_level
    S3_BUCKET             = module.s3.bucket_name
    DYNAMODB_TABLE        = module.dynamodb.requests_table_name
    ANTHROPIC_SECRET_ARN  = module.secrets_manager.anthropic_secret_arn
  }
  extra_policy_arns = [
    module.s3.read_policy_arn,
    module.dynamodb.write_policy_arn,
    module.secrets_manager.anthropic_read_policy_arn,
  ]
}

module "estimate_fn" {
  source        = "./modules/lambda"
  function_name = "${local.project}-estimate-fn-${local.env}"
  handler       = "handler.handler"
  runtime       = "nodejs22.x"
  memory_mb     = var.default_memory_mb
  log_retention = var.log_retention_days
  source_dir    = "${path.root}/../dist/estimate-fn"
  tags          = local.tags
  env_vars = {
    LOG_LEVEL            = var.log_level
    DYNAMODB_TABLE       = module.dynamodb.requests_table_name
    ANTHROPIC_SECRET_ARN = module.secrets_manager.anthropic_secret_arn
  }
  extra_policy_arns = [
    module.dynamodb.write_policy_arn,
    module.secrets_manager.anthropic_read_policy_arn,
  ]
}

module "generate_fn" {
  source        = "./modules/lambda"
  function_name = "${local.project}-generate-fn-${local.env}"
  handler       = "handler.handler"
  runtime       = "nodejs22.x"
  memory_mb     = var.default_memory_mb
  log_retention = var.log_retention_days
  source_dir    = "${path.root}/../dist/generate-fn"
  tags          = local.tags
  env_vars = {
    LOG_LEVEL            = var.log_level
    DYNAMODB_TABLE       = module.dynamodb.requests_table_name
    ANTHROPIC_SECRET_ARN = module.secrets_manager.anthropic_secret_arn
  }
  extra_policy_arns = [
    module.dynamodb.write_policy_arn,
    module.secrets_manager.anthropic_read_policy_arn,
  ]
}

module "api_gateway" {
  source              = "./modules/api-gateway"
  env                 = local.env
  project             = local.project
  tags                = local.tags
  authorizer_arn      = module.authorizer.function_arn
  authorizer_role_arn = module.authorizer.invoke_role_arn
  analyze_fn_arn      = module.analyze_fn.function_arn
  estimate_fn_arn     = module.estimate_fn.function_arn
  generate_fn_arn     = module.generate_fn.function_arn
}
