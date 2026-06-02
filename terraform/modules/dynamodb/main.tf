resource "aws_dynamodb_table" "requests" {
  name         = "saw-requests-${var.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "requestId"
  tags         = var.tags

  attribute {
    name = "requestId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "versions" {
  name         = "saw-versions-${var.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "version"
  range_key    = "deployedAt"
  tags         = var.tags

  attribute {
    name = "version"
    type = "S"
  }

  attribute {
    name = "deployedAt"
    type = "S"
  }
}

resource "aws_iam_policy" "write" {
  name = "${var.project}-dynamodb-write-${var.env}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["dynamodb:PutItem"]
      Resource = [
        aws_dynamodb_table.requests.arn,
        aws_dynamodb_table.versions.arn,
      ]
    }]
  })
}
