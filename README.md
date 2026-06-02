# small-advertisement-writer-ai

AWS AI service for [small-advertisement-writer](https://github.com/benjamin-canal/small-advertisement-writer).

Expose trois endpoints Claude via API Gateway HTTP v2 :

| Endpoint | Description |
|---|---|
| `POST /analyze` | Identifie l'objet depuis une image S3 (Claude vision) |
| `POST /estimate` | Estime la fourchette de prix (marché FR) |
| `POST /generate` | Génère titre, description, keywords pour Vinted/Leboncoin |

Tous les endpoints sont protégés par un Lambda authorizer (`X-API-Key` → Secrets Manager).

## Stack

- **Runtime** : Node.js 22, TypeScript strict
- **Bundle** : esbuild (single file par Lambda)
- **IaC** : Terraform >= 1.7
- **AI** : Anthropic Claude (`claude-opus-4-8`) avec prompt caching
- **Auth** : Lambda authorizer, API key dans Secrets Manager

## Prérequis

- Node.js 22+
- Terraform 1.7+
- AWS CLI configuré
- Un bucket S3 `saw-terraform-state` pour le backend Terraform

## Développement local

```bash
npm install
npm run typecheck
npm run build
```

## Déploiement

```bash
cd terraform
terraform workspace select dev
terraform apply -var-file=environments/dev.tfvars
```

## Connexion avec small-advertisement-writer

Après déploiement, renseigner dans Vercel :

```
AI_SERVICE_URL=<valeur de l'output api_gateway_url>
AI_SERVICE_API_KEY=<valeur depuis Secrets Manager>
```

Ces variables sont lues dans `src/lib/ai/AIServiceClient.ts`.

## GitHub Actions

- **CI** (sur PR) : typecheck + `terraform fmt/validate/plan` (dev)
- **Deploy** (push main) : build esbuild + `terraform apply` prod + `update-function-code`
