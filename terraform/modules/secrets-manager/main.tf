resource "random_password" "api_key" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "api_key" {
  name = "${var.project}-api-key-${var.env}"
  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "api_key" {
  secret_id     = aws_secretsmanager_secret.api_key.id
  secret_string = random_password.api_key.result
}

resource "aws_iam_policy" "read" {
  name = "${var.project}-secrets-read-${var.env}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.api_key.arn
    }]
  })
}

# Anthropic API key — value must be set manually after first apply:
#   aws secretsmanager put-secret-value --secret-id <arn> --secret-string "sk-ant-..."
resource "aws_secretsmanager_secret" "anthropic" {
  name                    = "${var.project}-anthropic-key-${var.env}"
  recovery_window_in_days = 0
  tags                    = var.tags
}

resource "aws_iam_policy" "anthropic_read" {
  name = "${var.project}-anthropic-read-${var.env}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.anthropic.arn
    }]
  })
}
