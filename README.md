# Reimbursement Automation

Monorepo for reimbursement pipeline: **app** (Python/Lambdas) and **iac** (CDK/TypeScript).

## Structure

| Directory | Stack |
|-----------|--------|
| `app/` | Python app (uv, Ruff, pytest) |
| `iac/` | Infrastructure as Code (Bun, ESLint, Prettier) |

## Setup

- **Root & IAC:** [Bun](https://bun.sh) — `bun install` at root and in `iac/`
- **App:** [uv](https://docs.astral.sh/uv/) — `uv sync` in `app/`

### Pre-commit hooks

Hooks run lint/format on staged files (IAC: lint-staged in `iac/`, App: Ruff via pre-commit). To enable them:

1. **From repo root:** run `bun install` (this runs `prepare` and configures git to use `.husky`).
2. If hooks still don’t run, set the hooks path manually:
   ```bash
   git config core.hooksPath .husky
   ```
   Or run: `bun run prepare-hooks`.

After that, `git commit` will run the root `.husky/pre-commit`, which runs IAC or App checks based on what’s staged.

## Commit format

Commits must follow: **`[ORGINIT-XXX][type] subject`**

- Ticket ID: `ORGINIT-` + number (e.g. `ORGINIT-123`)
- Type: `chore`, `fix`, `feat`, `docs`, `style`, `refactor`, `test`, `ci`, `build`, `perf`

Example: `[ORGINIT-42][feat] Add login endpoint`

## CI/CD

- **CI** (`.github/workflows/ci.yml`): runs on every push and PR. Only runs IAC or App checks when files under `iac/` or `app/` change. Uses Bun (IAC) and uv (App).
- **CD** (`.github/workflows/deploy.yml`): deploys to dev/staging on push to those branches; production via manual workflow dispatch.

CI runs automatically when you push. For **CD**, GitHub Actions needs AWS credentials (IAM user keys or OIDC role). See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for setup.
