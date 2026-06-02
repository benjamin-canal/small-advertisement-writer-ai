output "api_gateway_url" {
  description = "HTTP API Gateway invoke URL"
  value       = module.api_gateway.invoke_url
}

output "api_key_secret_arn" {
  description = "ARN of the API key secret in Secrets Manager"
  value       = module.secrets_manager.secret_arn
  sensitive   = true
}
