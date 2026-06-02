output "bucket_name"     { value = aws_s3_bucket.images.id }
output "bucket_arn"      { value = aws_s3_bucket.images.arn }
output "read_policy_arn" { value = aws_iam_policy.read.arn }
