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

# ARN of the AWS Parameters and Secrets Lambda Extension layer for the target region.
# See: https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets_lambda.html
variable "secrets_extension_layer_arn" {
  description = "ARN of the AWS Parameters and Secrets Lambda Extension layer"
  type        = string
  # eu-west-1 — update for other regions
  default = "arn:aws:lambda:eu-west-1:015030872274:layer:AWS-Parameters-and-Secrets-Lambda-Extension:11"
}
