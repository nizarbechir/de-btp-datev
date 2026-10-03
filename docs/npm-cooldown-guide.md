# Org-Wide NPM Supply Chain Security — Rollout Guide

## Prerequisites

| Requirement                           | How to check                 |
| ------------------------------------- | ---------------------------- |
| npm ≥ 11.10.0                         | `npm --version`              |
| Node.js ≥ 24.15.0 (ships npm 11.10.x) | `node --version`             |
| GitHub Dependabot enabled             | Org settings → Code security |

Set in package.json minimum versions, which then will be used by GitHub CI pipelines and BTP deployment:

`"engines": {
		"node": "^24.15",
		"npm": "^11.12"
}`

To install or change in Business Application Studio, use following terminal commands:

`asdf install nodejs 24.15.0` - install a specific version

`asdf list nodejs` - list installed Node.js versions

Dont forget to create/change your Repo Variable: GH_ACTION_NODEJS_VERSION = 24.15

## Step 1: `.npmrc` — Cooldown on manual installs

Copy `.npmrc` from this repo into the root of each project:

```bash
cp .npmrc /path/to/your-project/.npmrc
```

Key setting: `min-release-age=7` blocks any package version published less than 7 days ago.

## Step 2: Dependabot cooldown — Automated PR safety

Copy `.github/dependabot.yml` into each project's `.github/` directory. Adjust:

- `directory` if your `package.json` is not at root
- `schedule.timezone` for your team
- `cooldown` values if you want different periods

The cooldown ensures Dependabot won't create PRs for versions published less than N days ago.

## Step 3: Check and warn on packages with scripts in Local and CI environments

Copy following files into your project:

- `scripts/npm-install-safe.sh`
- `.github/workflows/pr-install-script-check.yml`

### LOCAL - Business Application Studio

You can add to your package.json following lines in the scripts section:

- `"install:safe": "bash ./scripts/npm-install-safe.sh install"`
- `"install:check": "bash ./scripts/npm-install-safe.sh check"`

We strongly recommend to run `npm run install:safe` instead of `npm install` — it runs all .npmrc pre-flight checks, performs the install, then checks for new packages with install scripts.
Alternatively, run `npm run install:check` after any `npm install` to check if new packages with executable scripts have been introduced.

### CI - GitHub pipelines

Workflow `.github/workflows/pr-install-script-check.yml` will be run everytime new changes pushed for the package-lock.json via Pull request. If there are some new packages with the preinstall/install/postinstall scripts then it will create Warning Comment in the Pull Request advising to double check the flagged packages.

## Step 4: Pre-commit hook — Prevent missing `.npmrc` settings

Install the pre-commit hook to block commits if `.npmrc` is missing or lacks `min-release-age`:

- Run following command `git config core.hooksPath .github/hooks`. This points Git at the checked-in hooks folder so all team members get the hook automatically after cloning.

- Copy the file `.github/hooks/pre-commit` into your local project at the same folder

> ```bash
> cp .github/hooks/pre-commit .github/hooks/pre-commit
> chmod +x .github/hooks/pre-commit
> ```

## Step 5: Verify

1. Create a test branch.
2. Add a dependency with an install script into your package.json (e.g., `"bcrypt": "^6.0.0"`).
3. Run `npm install` followed by `npm run install:check` or `npm run install:safe`. Either way you should get warning that new package has associated scripts.
4. Push and open a PR.
5. Confirm the CI check flags it with a PR comment.
6. Try committing with `min-release-age` removed from `.npmrc` — the hook should block it.

## FAQ

**Q: Will `min-release-age` break CI if a package was just published?**
A: Yes — that's the point. If you urgently need a fresh version, temporarily override with `npm install --min-release-age=0` (requires explicit opt-in).

**Q: What about monorepos with multiple `package-lock.json` files?**
A: Add multiple entries in `dependabot.yml` with different `directory` values. The reusable workflow accepts a `lockfile-path` input.
