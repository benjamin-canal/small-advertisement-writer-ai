variable "env" {
  description = "Deployment environment (dev or prod)"
  type        = string
  validation {
    condition     = contains(["dev", "prod"], var.env)
    error_message = "env must be dev or prod"
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-1"
}

variable "analyze_memory_mb" {
  description = "Memory for analyze-fn Lambda (MB)"
  type        = number
  default     = 512
}

variable "default_memory_mb" {
  description = "Memory for estimate-fn and generate-fn Lambdas (MB)"
  type        = number
  default     = 512
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

variable "log_level" {
  description = "Lambda log level"
  type        = string
  default     = "ERROR"
}

variable "lambda_reserved_concurrency" {
  description = "Max concurrent Lambda executions per AI function (limits Bedrock cost runaway)"
  type        = number
  default     = 10
}

# Cross-region inference profile for eu-west-1.
# See: https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html
variable "bedrock_model_id" {
  description = "Amazon Bedrock model ID (cross-region inference profile)"
  type        = string
  default     = "eu.anthropic.claude-sonnet-4-5-20250929-v1:0"
}
