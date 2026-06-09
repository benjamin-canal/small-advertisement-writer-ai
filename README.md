# small-advertisement-writer-ai

Service AWS IA pour [small-advertisement-writer](https://github.com/benjamin-canal/small-advertisement-writer).

Expose trois endpoints Claude via API Gateway HTTP v2 :

| Endpoint | Description |
|---|---|
| `POST /analyze` | Identifie l'objet depuis une ou plusieurs images S3 (objet + étiquette) — attributs structurés (marque, modèle, type, taille, couleur, matière, genre, état) avec confiance et alternatives par champ (Claude vision + Rekognition OCR) |
| `POST /estimate` | Estime la fourchette de prix (marché FR) |
| `POST /generate` | Génère titre, description, keywords pour Vinted/Leboncoin |

Tous les endpoints sont protégés par un Lambda authorizer (`X-API-Key` → Secrets Manager).

---

## Stack

- **Runtime** : Node.js 22, TypeScript strict
- **Bundle** : esbuild (single file par Lambda)
- **IaC** : Terraform >= 1.7, modules réutilisables
- **AI** : AWS Bedrock — Claude (cross-region inference EU) avec prompt caching
- **Auth** : Lambda authorizer, API key dans AWS Secrets Manager
- **CI/CD** : GitHub Actions — OIDC (pas de clé AWS statique)

---

## Prérequis

- Node.js 22+
- Terraform 1.7+
- AWS CLI configuré

---

## 1 — Bootstrap du backend Terraform

```bash
# Bucket S3 pour le state
aws s3api create-bucket \
  --bucket saw-terraform-state \
  --region eu-west-1 \
  --create-bucket-configuration LocationConstraint=eu-west-1

aws s3api put-bucket-versioning \
  --bucket saw-terraform-state \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket saw-terraform-state \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Table DynamoDB pour le state locking
aws dynamodb create-table \
  --table-name saw-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-1
```

---

## 2 — Setup GitHub Actions OIDC

Créer un IAM Role approuvé par GitHub Actions (remplacer `YOUR_ACCOUNT_ID`) :

```bash
aws iam create-role \
  --role-name saw-github-actions \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:benjamin-canal/small-advertisement-writer-ai:*"
        }
      }
    }]
  }'

aws iam attach-role-policy \
  --role-name saw-github-actions \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

Ajouter dans les paramètres GitHub du repo (par environnement `dev` / `prod`) :
- **Secret** : `AWS_ROLE_ARN` — ARN du rôle IAM créé ci-dessus

---

## 3 — Déploiement manuel

```bash
npm install
npm run build

cd terraform
terraform init

# Dev
terraform apply -var-file=environments/dev.tfvars

# Prod
terraform apply -var-file=environments/prod.tfvars
```

---

## 4 — Connexion avec small-advertisement-writer

Après déploiement, renseigner dans Vercel :

```
AI_SERVICE_URL=<valeur de l'output api_gateway_url>
AI_SERVICE_API_KEY=<valeur depuis AWS Secrets Manager>
```

Ces variables sont lues dans `src/lib/ai/AIServiceClient.ts`.

---

## 5 — Test

```bash
API_URL="https://xxxx.execute-api.eu-west-1.amazonaws.com"
API_KEY="<valeur depuis Secrets Manager>"

curl -s -X POST "$API_URL/generate" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "title": "Vélo de ville 7 vitesses",
    "category": "sport",
    "condition": "bon état",
    "imageKey": "uploads/xxx.jpg"
  }' | jq .
```

---

## GitHub Actions

| Workflow | Déclencheur | Action |
|---|---|---|
| `ci.yml` | PR vers `main` ou `develop` | typecheck + `terraform fmt/validate` |
| `deploy-dev.yml` | Push sur `develop` | build + `terraform apply dev` + update Lambda code |
| `deploy.yml` | Push sur `main` | confirmation manuelle → build + `terraform apply prod` + update Lambda code + tag git |

L'authentification AWS utilise **OIDC** (pas de clé statique). Configurer `AWS_ROLE_ARN` dans les environments GitHub `dev` et `prod`.
