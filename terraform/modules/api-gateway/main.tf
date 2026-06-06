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
  identity_sources                  = ["$request.header.X-API-Key"]
  name                              = "api-key-authorizer"
  authorizer_payload_format_version = "2.0"
  enable_simple_responses           = true
  authorizer_result_ttl_in_seconds  = 300
}

# Resource-based permission so API Gateway can invoke the authorizer Lambda.
# Without it, every authenticated request fails at the authorizer with a 500
# (returned by API Gateway) before any function — and the authorizer never logs.
resource "aws_lambda_permission" "authorizer" {
  statement_id  = "AllowApiGatewayInvokeAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = var.authorizer_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/authorizers/${aws_apigatewayv2_authorizer.api_key.id}"
}

locals {
  integrations = {
    analyze  = { arn = var.analyze_fn_arn, route = "POST /analyze" }
    estimate = { arn = var.estimate_fn_arn, route = "POST /estimate" }
    generate = { arn = var.generate_fn_arn, route = "POST /generate" }
  }
}

resource "aws_apigatewayv2_integration" "fn" {
  for_each               = local.integrations
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value.arn
  payload_format_version = "2.0"
}

# Resource-based permission so API Gateway can invoke each route's Lambda.
resource "aws_lambda_permission" "fn" {
  for_each      = local.integrations
  statement_id  = "AllowApiGatewayInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
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
