variable "aws_region" {
  default = "me-south-1"  # Bahrain region (أقرب للسعودية)
}

variable "db_name" {
  default = "inventory_db"
}

variable "db_username" {
  default = "postgres"
}

variable "db_password" {
  sensitive = true
}
