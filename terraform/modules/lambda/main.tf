data "archive_file" "zip" {
  type        = "zip"
  source_dir  = var.source_dir
  output_path = "${path.module}/../../.build/${var.function_name}.zip"
}

resource "aws_iam_role" "lambda" {
  name = "${var.function_name}-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "extra" {
  count      = length(var.extra_policy_arns)
  role       = aws_iam_role.lambda.name
  policy_arn = var.extra_policy_arns[count.index]
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = var.log_retention
  tags              = var.tags
}

resource "aws_lambda_function" "fn" {
  function_name    = var.function_name
  role             = aws_iam_role.lambda.arn
  handler          = var.handler
  runtime          = var.runtime
  memory_size      = var.memory_mb
  timeout          = var.timeout_seconds
  filename         = data.archive_file.zip.output_path
  source_code_hash = data.archive_file.zip.output_base64sha256

  layers                         = var.layers
  reserved_concurrent_executions = var.reserved_concurrency

  environment {
    variables = var.env_vars
  }

  tags       = var.tags
  depends_on = [aws_cloudwatch_log_group.lambda]
}

resource "aws_iam_role" "invoke" {
  name = "${var.function_name}-invoke-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "apigateway.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy" "invoke" {
  role = aws_iam_role.invoke.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_function.fn.arn
    }]
  })
}
