output "secret_arn" { value = aws_secretsmanager_secret.api_key.arn }
output "read_policy_arn" { value = aws_iam_policy.read.arn }
