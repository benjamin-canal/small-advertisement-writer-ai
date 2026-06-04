resource "aws_dynamodb_table" "requests" {
  name             = "saw-requests-${var.env}"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "requestId"
  deletion_protection_enabled = true
  tags             = var.tags

  attribute {
    name = "requestId"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
}

resource "aws_dynamodb_table" "versions" {
  name             = "saw-versions-${var.env}"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "version"
  range_key        = "deployedAt"
  deletion_protection_enabled = true
  tags             = var.tags

  attribute {
    name = "version"
    type = "S"
  }

  attribute {
    name = "deployedAt"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
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
