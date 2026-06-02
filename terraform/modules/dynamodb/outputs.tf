output "requests_table_name" { value = aws_dynamodb_table.requests.name }
output "versions_table_name" { value = aws_dynamodb_table.versions.name }
output "write_policy_arn"    { value = aws_iam_policy.write.arn }
