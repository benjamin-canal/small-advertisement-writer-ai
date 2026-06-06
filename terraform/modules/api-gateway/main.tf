data "aws_region" "current" {}

resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project}-api-${var.env}"
  protocol_type = "HTTP"
  tags          = var.tags

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["POST", "OPTIONS"]
    allow_headers = ["Content-Type", "X-API-Key"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_authorizer" "api_key" {
  api_id                            = aws_apigatewayv2_api.api.id
  authorizer_type                   = "REQUEST"
  authorizer_uri                    = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${var.authorizer_arn}/invocations"
  authorizer_credentials_arn        = var.authorizer_role_arn
  identity_sources                  = ["$request.header.X-API-Key"]
  name                              = "api-key-authorizer"
  authorizer_payload_format_version = "2.0"
  enable_simple_responses           = true
  authorizer_result_ttl_in_seconds  = 300
}

locals {
  integrations = {
    analyze  = { arn = var.analyze_fn_arn, role = var.analyze_fn_role_arn, route = "POST /analyze" }
    estimate = { arn = var.estimate_fn_arn, role = var.estimate_fn_role_arn, route = "POST /estimate" }
    generate = { arn = var.generate_fn_arn, role = var.generate_fn_role_arn, route = "POST /generate" }
  }
}

resource "aws_apigatewayv2_integration" "fn" {
  for_each               = local.integrations
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value.arn
  payload_format_version = "2.0"
  # Without credentials, API Gateway cannot invoke the target Lambda and returns
  # a 500 before the function ever runs (no CloudWatch logs). Each function's
  # invoke role grants apigateway.amazonaws.com the lambda:InvokeFunction right.
  credentials_arn = each.value.role
}

resource "aws_apigatewayv2_route" "fn" {
  for_each           = local.integrations
  api_id             = aws_apigatewayv2_api.api.id
  route_key          = each.value.route
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.api_key.id
  target             = "integrations/${aws_apigatewayv2_integration.fn[each.key].id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
  tags        = var.tags

  default_route_settings {
    throttling_burst_limit = 50
    throttling_rate_limit  = 20
  }
}
