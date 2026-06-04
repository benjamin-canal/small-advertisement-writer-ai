variable "function_name" { type = string }
variable "handler" { type = string }
variable "runtime" { type = string }
variable "memory_mb" { type = number }
variable "log_retention" { type = number }
variable "source_dir" { type = string }
variable "tags" { type = map(string) }
variable "env_vars" { type = map(string) }
variable "extra_policy_arns" {
  type    = list(string)
  default = []
}
variable "layers" {
  type    = list(string)
  default = []
}
