#!/usr/bin/env bash
# npm-install-safe.sh
# -------------------------------------------------------------------------
# Unified npm supply chain security tool.
#
# MODES:
#   check   [base-ref]             Diff package-lock.json against base-ref and
#                                  flag new packages with install scripts.
#                                  Exit 1 if any are found.
#
#   install [--base-ref <ref>]     Verify npm >= 11.10.0 and .npmrc has
#           [-- <npm-args...>]     min-release-age > 0, run npm install with
#                                  that value applied, then run check on the
#
# ENVIRONMENT:
#   CHECK_OUTPUT_FILE   (check mode only) If set, flagged package names are
#                       written one per line to this path. Used by CI to build
#                       PR comments without re-parsing output.
#   SAFE_NPM_BASE_REF   Default base ref for install mode (default: origin/main).
#
# EXIT CODES:
#   0   All clear
#   1   Flagged packages found (check mode) or pre-flight check failed (install mode)
#
# Usage:
#   bash scripts/npm-install-safe.sh check [base-ref]
#   bash scripts/npm-install-safe.sh install
#   bash scripts/npm-install-safe.sh install -- --save-dev some-package
#   bash scripts/npm-install-safe.sh install --base-ref origin/develop
# -------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

MODE="${1:-check}"
shift || true

# ── Helpers ───────────────────────────────────────────────────────────────────

version_ge() {
	[[ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | tail -n 1)" == "$1" ]]
}

require_config_line() {
	local pattern="$1"
	local message="$2"
	if ! grep -Eq "$pattern" "$PROJECT_ROOT/.npmrc"; then
		echo "❌ $message" >&2
		exit 1
	fi
}

usage() {
	cat << 'EOF'
Usage:
  bash scripts/npm-install-safe.sh check [base-ref]
  bash scripts/npm-install-safe.sh install [--base-ref <ref>] [-- <npm-args>]

Modes:
  check     Diff package-lock.json against base-ref and flag new packages
            that declare preinstall/install/postinstall scripts.
            Default base-ref: origin/main
            Exit code 1 if flagged packages are found.

  install   Verify npm >= 11.10.0, verify .npmrc contains min-release-age > 0,
            run npm install with the configured cooldown applied, then run
            check on the result.

Environment:
  CHECK_OUTPUT_FILE   (check mode) Write flagged package names one per line
                      to this path — useful for CI PR comment generation.
  SAFE_NPM_BASE_REF   Default base ref for install mode (default: origin/main).
EOF
}

# ── Check mode ────────────────────────────────────────────────────────────────

run_check() {
	local BASE_REF="${1:-origin/main}"
	local LOCKFILE="package-lock.json"

	cd "$PROJECT_ROOT"

	if [[ ! -f "$LOCKFILE" ]]; then
		echo "✅ No $LOCKFILE found — nothing to check."
		[[ -n "${CHECK_OUTPUT_FILE:-}" ]] && : > "$CHECK_OUTPUT_FILE"
		exit 0
	fi

	echo "🔍 Checking for new dependencies with install scripts..."
	echo "   Base ref: $BASE_REF"
	echo ""

	_GIT_ERR=$(mktemp)
	DIFF=$(git diff "$BASE_REF" -- "$LOCKFILE" 2> "$_GIT_ERR")
	_GIT_EXIT=$?
	if [[ $_GIT_EXIT -ne 0 ]]; then
		echo "❌ git diff failed (exit $_GIT_EXIT) for ref '$BASE_REF':" >&2
		cat "$_GIT_ERR" >&2
		rm -f "$_GIT_ERR"
		exit 1
	fi
	rm -f "$_GIT_ERR"

	if [[ -z "$DIFF" ]]; then
		echo "✅ No changes to $LOCKFILE detected."
		[[ -n "${CHECK_OUTPUT_FILE:-}" ]] && : > "$CHECK_OUTPUT_FILE"
		exit 0
	fi

	FLAGGED_PACKAGES=()
	CURRENT_PKG=""

	while IFS= read -r line; do
		if [[ "$line" =~ ^\+[[:space:]]*\"node_modules/([^\"]+)\":[[:space:]]*\{ ]]; then
			CURRENT_PKG="${BASH_REMATCH[1]}"
		fi
		if [[ "$line" =~ ^\+[[:space:]]*\"hasInstallScript\":[[:space:]]*true ]]; then
			if [[ -n "${CURRENT_PKG:-}" ]]; then
				FLAGGED_PACKAGES+=("$CURRENT_PKG")
				CURRENT_PKG=""
			fi
		fi
		if [[ "$line" =~ ^\+[[:space:]]*\} ]]; then
			CURRENT_PKG=""
		fi
	done <<< "$DIFF"

	if [[ ${#FLAGGED_PACKAGES[@]} -eq 0 ]]; then
		echo "✅ No new packages with install scripts detected."
		[[ -n "${CHECK_OUTPUT_FILE:-}" ]] && : > "$CHECK_OUTPUT_FILE"
		exit 0
	fi

	# Write machine-readable list for CI PR comment generation
	if [[ -n "${CHECK_OUTPUT_FILE:-}" ]]; then
		printf '%s\n' "${FLAGGED_PACKAGES[@]}" > "$CHECK_OUTPUT_FILE"
	fi

	echo "⚠️  New Dependency with Install Script Detected!"
	echo ""
	echo "   This branch adds a package that declares a preinstall/install/postinstall script."
	echo "   Install scripts run arbitrary code during 'npm install' and are a common"
	echo "   supply chain attack vector."
	echo ""
	echo "   Flagged package(s):"
	echo ""
	for pkg in "${FLAGGED_PACKAGES[@]}"; do
		echo "   🚨 $pkg  →  https://www.npmjs.com/package/$pkg"
	done
	echo ""
	echo "   What to do:"
	echo ""
	echo "   1. Check the package on npm — verify the publisher, download count, and"
	echo "      recent publish activity look legitimate."
	echo "   2. Inspect the install script — run: npm show <package> scripts"
	echo "   3. Confirm it is intentional — make sure it was deliberately added and is"
	echo "      not a typosquat or transitive surprise."
	echo "   4. If legitimate — open a PR and merge it into main. Once merged, this"
	echo "      package will no longer be flagged in future runs (it is in the baseline)."
	echo "   5. If suspicious — remove it from package.json and run npm install to"
	echo "      regenerate the lockfile."
	echo ""
	echo "   ℹ️  This is an informational warning. Please review the package(s) before merging."
	echo ""

	exit 1
}

# ── Install mode ──────────────────────────────────────────────────────────────

run_install() {
	local BASE_REF="${SAFE_NPM_BASE_REF:-origin/main}"
	local INSTALL_ARGS=()

	while [[ $# -gt 0 ]]; do
		case "$1" in
			--base-ref)
				[[ $# -lt 2 ]] && {
					echo "❌ Missing value for --base-ref." >&2
					exit 1
				}
				BASE_REF="$2"
				shift 2
				;;
			--help | -h)
				usage
				exit 0
				;;
			--)
				shift
				INSTALL_ARGS=("$@")
				break
				;;
			*)
				INSTALL_ARGS+=("$1")
				shift
				;;
		esac
	done

	cd "$PROJECT_ROOT"

	if [[ ! -f .npmrc ]]; then
		echo "❌ Missing .npmrc in project root." >&2
		exit 1
	fi

	NODE_VERSION="$(node --version | sed 's/^v//')"
	NPM_VERSION="$(npm --version)"

	# if ! version_ge "$NODE_VERSION" "24.0.0"; then
	# 	echo "❌ Node.js 24 or newer is required. Current: v$NODE_VERSION" >&2
	# 	exit 1
	# fi

	if ! version_ge "$NPM_VERSION" "11.10.0"; then
		echo "❌ npm 11.10.0 or newer is required. Current: $NPM_VERSION" >&2
		exit 1
	fi

	# Validate min-release-age is present and > 0 (any positive value is accepted)
	if ! grep -qE '^[[:space:]]*min-release-age[[:space:]]*=' .npmrc; then
		echo "❌ .npmrc must contain 'min-release-age' before running a safe install." >&2
		exit 1
	fi
	MIN_AGE=$(awk -F'=' '/^[[:space:]]*min-release-age[[:space:]]*=/{v=$2; gsub(/^[[:space:]]+|[[:space:]]+$/, "", v); print v; exit}' .npmrc)
	if [[ -z "$MIN_AGE" ]] || ! [[ "$MIN_AGE" =~ ^[0-9]+$ ]] || [[ "$MIN_AGE" -eq 0 ]]; then
		echo "❌ .npmrc min-release-age must be a positive number (got: '${MIN_AGE:-empty}'). Recommended: min-release-age=7" >&2
		exit 1
	fi

	# require_config_line '^[[:space:]]*ignore-scripts=true[[:space:]]*$' \
	# 	".npmrc must contain 'ignore-scripts=true' before running a safe install."

	echo "✅ Pre-flight checks passed (Node v$NODE_VERSION, npm $NPM_VERSION, min-release-age=$MIN_AGE)"
	echo ""
	echo "Running npm install with cooldown feature..."
	npm install --min-release-age="$MIN_AGE" --ignore-scripts "${INSTALL_ARGS[@]}"

	echo ""
	echo "Reviewing new lockfile entries for install scripts..."
	run_check "$BASE_REF"

	echo ""
	echo "✅ Safe install completed successfully."
	echo "   If trusted native packages need build steps, rebuild them explicitly after review."
}

# ── Dispatch ──────────────────────────────────────────────────────────────────

case "$MODE" in
	check) run_check "$@" ;;
	install) run_install "$@" ;;
	--help | -h)
		usage
		exit 0
		;;
	*)
		echo "Unknown mode: '$MODE'. Use 'check' or 'install'." >&2
		usage >&2
		exit 1
		;;
esac
