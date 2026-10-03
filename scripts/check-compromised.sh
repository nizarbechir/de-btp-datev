#!/usr/bin/env bash
# =============================================================================
# check-compromised.sh
# Runs security checks for each direct subdirectory separately:
# compromised packages, malicious files, IDE persistence,
# workflow injection, and suspicious GitHub activity.
# =============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_FILE="$ROOT_DIR/compromised-report-$(date +%Y%m%d-%H%M%S).txt"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

TOTAL_CRITICALS=0
TOTAL_WARNINGS=0
CRITICALS=0
WARNINGS=0

log() { echo -e "$1" | tee -a "$REPORT_FILE"; }
header() {
	log "\n${BOLD}${CYAN}══════════════════════════════════════════════════${RESET}"
	log "${BOLD}${CYAN}  $1${RESET}"
	log "${CYAN}══════════════════════════════════════════════════${RESET}"
}
subheader() { log "\n${BOLD}${BLUE}    ── $1 ──${RESET}"; }
ok() { log "    ${GREEN}✔ $1${RESET}"; }
warn() {
	log "    ${YELLOW}⚠ $1${RESET}"
	WARNINGS=$((WARNINGS + 1))
	TOTAL_WARNINGS=$((TOTAL_WARNINGS + 1))
}
critical() {
	log "    ${RED}✘ CRITICAL: $1${RESET}"
	CRITICALS=$((CRITICALS + 1))
	TOTAL_CRITICALS=$((TOTAL_CRITICALS + 1))
}
info() { log "    $1"; }

# Compromised package versions
COMPROMISED_PACKAGES=(
	"mbt:1.2.48"
	"@cap-js/sqlite:2.2.2"
	"@cap-js/postgres:2.2.2"
	"@cap-js/db-service:2.10.1"
)

# Malicious setup.mjs paths
MALICIOUS_FILES=(
	"node_modules/mbt/setup.mjs"
	"node_modules/@cap-js/sqlite/setup.mjs"
	"node_modules/@cap-js/postgres/setup.mjs"
	"node_modules/@cap-js/db-service/setup.mjs"
)

# =============================================================================
# Check function for a single subdirectory
# =============================================================================
check_subdir() {
	local dir="$1"
	local relative="${dir#"$ROOT_DIR"/}"
	CRITICALS=0
	WARNINGS=0

	log ""
	log "${BOLD}${CYAN}╔══════════════════════════════════════════════════╗${RESET}"
	log "${BOLD}${CYAN}║  Subdirectory: $relative${RESET}"
	log "${BOLD}${CYAN}╚══════════════════════════════════════════════════╝${RESET}"

	# ── 1. Compromised package versions ──────────────────────────────────────
	subheader "1/5  Compromised Package Versions"

	mapfile -t pkg_dirs < <(find "$dir" -name "package.json" \
		! -path "*/node_modules/*" -exec dirname {} \; 2> /dev/null | sort -u)

	if [[ ${#pkg_dirs[@]} -eq 0 ]]; then
		info "No package.json found."
	else
		local pkg_criticals=0
		local pkg_warnings=0
		for pdir in "${pkg_dirs[@]}"; do
			local prelative="${pdir#"$ROOT_DIR"/}"
			for entry in "${COMPROMISED_PACKAGES[@]}"; do
				local pkg="${entry%%:*}"
				local ver="${entry##*:}"

				# Check for the exact compromised version via npm list
				local result
				result=$(cd "$pdir" && npm list "$pkg" 2> /dev/null | grep "$ver" || true)
				if [[ -n "$result" ]]; then
					critical "$pkg@$ver found in node_modules → $prelative"
					pkg_criticals=$((pkg_criticals + 1))
				else
					# Warn if any version of the package is installed
					local any_version
					any_version=$(cd "$pdir" && npm list "$pkg" 2> /dev/null | grep "$pkg" || true)
					if [[ -n "$any_version" ]]; then
						local installed_ver
						installed_ver=$(echo "$any_version" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+[^ ]*' | head -1)
						warn "$pkg installed (v$installed_ver) – compromised version is $ver → $prelative"
						pkg_warnings=$((pkg_warnings + 1))
					fi
				fi

				if [[ -f "$pdir/package-lock.json" ]]; then
					local lock_result
					lock_result=$(grep -A3 "\"node_modules/$pkg\":" "$pdir/package-lock.json" \
						| grep "\"version\": \"$ver\"" || true)
					if [[ -n "$lock_result" ]]; then
						critical "$pkg@$ver resolved/installed in package-lock.json → $prelative"
						pkg_criticals=$((pkg_criticals + 1))
					else
						# Warn if any version is locked
						local any_locked_ver
						any_locked_ver=$(grep -A3 "\"node_modules/$pkg\":" "$pdir/package-lock.json" \
							| grep -oE '"version": "[^"]+"' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+[^"]*' | head -1 || true)
						if [[ -n "$any_locked_ver" ]]; then
							warn "$pkg@$any_locked_ver in package-lock.json – compromised version is $ver → $prelative"
							pkg_warnings=$((pkg_warnings + 1))
						fi
					fi
				fi

				if [[ -f "$pdir/package.json" ]]; then
					local dep_result
					dep_result=$(grep -E "\"$pkg\"" "$pdir/package.json" | grep "$ver" || true)
					if [[ -n "$dep_result" ]]; then
						warn "$pkg@$ver in package.json (direct dependency) → $prelative"
						pkg_warnings=$((pkg_warnings + 1))
					else
						# Warn if any version is declared as a dependency
						local any_dep_ver
						any_dep_ver=$(grep -E "\"$pkg\"" "$pdir/package.json" \
							| grep -oE '["^~>=<]*[0-9]+\.[0-9]+\.[0-9]+[^"]*' | head -1 || true)
						if [[ -n "$any_dep_ver" ]]; then
							warn "$pkg declared in package.json ($any_dep_ver) – compromised version is $ver → $prelative"
							pkg_warnings=$((pkg_warnings + 1))
						fi
					fi
				fi
			done
		done
		[[ $pkg_criticals -eq 0 && $pkg_warnings -eq 0 ]] && ok "No compromised versions found."
	fi

	# ── 2. Malicious setup.mjs files ───────────────────────────────────────
	subheader "2/5  Malicious setup.mjs Files"
	local found_any=0

	for pdir in "${pkg_dirs[@]}"; do
		local prelative="${pdir#"$ROOT_DIR"/}"
		for malfile in "${MALICIOUS_FILES[@]}"; do
			if [[ -f "$pdir/$malfile" ]]; then
				critical "Malicious file found: $prelative/$malfile"
				found_any=1
			fi
		done
	done

	mapfile -t found_setup < <(find "$dir" -path "*/node_modules/*/setup.mjs" \
		! -path "*/node_modules/.bin/*" 2> /dev/null || true)
	if [[ ${#found_setup[@]} -gt 0 ]]; then
		for f in "${found_setup[@]}"; do
			warn "setup.mjs found (review manually): ${f#"$ROOT_DIR"/}"
			found_any=1
		done
	fi

	[[ $found_any -eq 0 ]] && ok "No setup.mjs files found in node_modules."

	# ── 3. IDE persistence ─────────────────────────────────────────────────────
	subheader "3/5  IDE Persistence (VSCode & Claude)"
	local ide_clean=1

	mapfile -t vscode_tasks < <(find "$dir" -path "*/.vscode/tasks.json" \
		-exec grep -l 'setup\.mjs' {} \; 2> /dev/null || true)
	if [[ ${#vscode_tasks[@]} -gt 0 ]]; then
		for f in "${vscode_tasks[@]}"; do
			critical "Malicious VSCode task found: ${f#"$ROOT_DIR"/}"
			ide_clean=0
		done
	fi

	mapfile -t claude_settings < <(find "$dir" -path "*/.claude/settings.json" \
		-exec grep -l 'SessionStart' {} \; 2> /dev/null || true)
	if [[ ${#claude_settings[@]} -gt 0 ]]; then
		for f in "${claude_settings[@]}"; do
			critical "Malicious Claude hook found: ${f#"$ROOT_DIR"/}"
			ide_clean=0
		done
	fi

	mapfile -t exec_files < <(find "$dir" -path "*/.claude/execution.js" \
		-size +1M 2> /dev/null || true)
	if [[ ${#exec_files[@]} -gt 0 ]]; then
		for f in "${exec_files[@]}"; do
			critical "Suspicious execution.js (>1 MB): ${f#"$ROOT_DIR"/}"
			ide_clean=0
		done
	fi

	if [[ -d "$dir/.git" ]]; then
		local suspicious_commits
		suspicious_commits=$(cd "$dir" && git log --all \
			--author='claude@users.noreply.github.com' --oneline 2> /dev/null | head -20 || true)
		if [[ -n "$suspicious_commits" ]]; then
			critical "Suspicious commits from claude@users.noreply.github.com:"
			info "$suspicious_commits"
			ide_clean=0
		fi
	fi

	[[ $ide_clean -eq 1 ]] && ok "No IDE persistence issues found."

	# ── 4. GitHub workflow injection ──────────────────────────────────────────
	subheader "4/5  GitHub Workflow Injection"
	local wf_clean=1

	if [[ -d "$dir/.git" ]]; then
		local dep_branch
		dep_branch=$(cd "$dir" && git branch -r 2> /dev/null | grep 'dependabout' || true)
		if [[ -n "$dep_branch" ]]; then
			critical "Suspicious 'dependabout' branch found: $dep_branch"
			wf_clean=0
		fi
	fi

	mapfile -t wf_files < <(find "$dir" -path "*/.github/workflows/*.yml" \
		-exec grep -l 'toJSON(secrets)' {} \; 2> /dev/null || true)
	if [[ ${#wf_files[@]} -gt 0 ]]; then
		for f in "${wf_files[@]}"; do
			critical "toJSON(secrets) found in workflow: ${f#"$ROOT_DIR"/}"
			wf_clean=0
		done
	fi

	[[ $wf_clean -eq 1 ]] && ok "No workflow injection found."

	# ── 5. npm packages ───────────────────────────────────────────────────
	subheader "5/5  npm Packages"
	if command -v npm &> /dev/null && [[ ${#pkg_dirs[@]} -gt 0 ]]; then
		local npm_user
		npm_user=$(npm whoami 2> /dev/null || true)
		if [[ -n "$npm_user" ]]; then
			info "npm user: $npm_user"
			local pkg_list
			pkg_list=$(npm access list packages "$npm_user" 2> /dev/null || true)
			if [[ -n "$pkg_list" ]]; then
				info "Published packages:"
				while IFS= read -r line; do
					info "  $line"
				done <<< "$pkg_list"
			else
				info "No packages found or access denied."
			fi
		else
			info "npm not logged in – skipped."
		fi
	else
		info "npm not available or no Node.js project found."
	fi

	# ── Result for this subdirectory ───────────────────────────────────────
	if [[ $CRITICALS -eq 0 && $WARNINGS -eq 0 ]]; then
		log "\n  ${GREEN}${BOLD}✔ $relative: No issues found.${RESET}"
	elif [[ $CRITICALS -eq 0 ]]; then
		log "\n  ${YELLOW}${BOLD}⚠ $relative: $WARNINGS warning(s).${RESET}"
	elif [[ $WARNINGS -eq 0 ]]; then
		log "\n  ${RED}${BOLD}✘ $relative: $CRITICALS critical issue(s).${RESET}"
	else
		log "\n  ${RED}${BOLD}✘ $relative: $CRITICALS critical issue(s), $WARNINGS warning(s).${RESET}"
	fi
}

# =============================================================================
# Main
# =============================================================================
log "${BOLD}Security check started: $(date)${RESET}"
log "Base directory: $ROOT_DIR"
log "Report will be saved to: $REPORT_FILE"

# Collect all direct subdirectories (no hidden dirs, no node_modules)
SUBDIRS=()
for d in "$ROOT_DIR"/*/; do
	[[ -d "$d" ]] || continue
	name="$(basename "$d")"
	[[ "$name" == "node_modules" ]] && continue
	[[ "$name" == .* ]] && continue
	SUBDIRS+=("${d%/}")
done
# Sort the array
IFS=$'\n' SUBDIRS=($(sort <<< "${SUBDIRS[*]}"))
unset IFS

if [[ ${#SUBDIRS[@]} -eq 0 ]]; then
	log "No subdirectories found."
	exit 0
fi

log "Subdirectories found: ${#SUBDIRS[@]}"
for sd in "${SUBDIRS[@]}"; do
	log "  • ${sd#"$ROOT_DIR"/}"
done

# Check each direct subdirectory individually
for subdir in "${SUBDIRS[@]}"; do
	check_subdir "$subdir"
done

# ── GitHub account check (once, global) ──────────────────────────────────────
header "GitHub Account Check (global)"

if command -v gh &> /dev/null && gh auth status &> /dev/null 2>&1; then
	info "Checking for Dune-themed repositories ..."
	dune_repos=$(gh repo list --json name --limit 200 2> /dev/null \
		| grep -iE '(sardaukar|mentat|fremen|atreides|harkonnen)-' || true)
	if [[ -n "$dune_repos" ]]; then
		critical "Suspicious repositories found: $dune_repos"
	else
		ok "No Dune-themed repositories found."
	fi

	info "Checking for repo with description 'A Mini Shai-Hulud has Appeared' ..."
	shai_hulud=$(gh repo list --visibility public --json name,description --limit 100 2> /dev/null \
		| grep -i 'Shai-Hulud' || true)
	if [[ -n "$shai_hulud" ]]; then
		critical "Suspicious repository found: $shai_hulud"
	else
		ok "No 'Shai-Hulud' repository found."
	fi
else
	warn "GitHub CLI (gh) not logged in or not installed – skipped."
fi

# ── Summary ──────────────────────────────────────────────────────
header "Summary"

log "Subdirectories checked: ${#SUBDIRS[@]}"

if [[ $TOTAL_CRITICALS -eq 0 && $TOTAL_WARNINGS -eq 0 ]]; then
	log "${GREEN}${BOLD}No issues found. System appears clean.${RESET}"
else
	[[ $TOTAL_CRITICALS -gt 0 ]] && log "${RED}${BOLD}$TOTAL_CRITICALS critical issue(s) found!${RESET}"
	[[ $TOTAL_WARNINGS -gt 0 ]] && log "${YELLOW}${BOLD}$TOTAL_WARNINGS warning(s) found.${RESET}"
	log "Review report: $REPORT_FILE"
fi

log "\nCheck completed: $(date)"
