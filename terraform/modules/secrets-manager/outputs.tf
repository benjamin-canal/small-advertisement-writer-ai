output "secret_arn"             { value = aws_secretsmanager_secret.api_key.arn }
output "read_policy_arn"        { value = aws_iam_policy.read.arn }
output "anthropic_secret_arn"   { value = aws_secretsmanager_secret.anthropic.arn }
output "anthropic_read_policy_arn" { value = aws_iam_policy.anthropic_read.arn }
