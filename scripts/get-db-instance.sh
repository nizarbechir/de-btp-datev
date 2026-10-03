#!/bin/sh

# Central configuration - change these to adapt for other repositories
DB_INSTANCE_BASE="swiver-db"
DESTINATION_INSTANCE="swiver-destination"

# Function to extract and validate CF user
# Sets global variable: CF_USER_EXTRACTED
# Exit codes: 0 for success, 1 for error
extract_cf_user() {
	# Check if user is logged in to Cloud Foundry
	if ! cf t > /dev/null 2>&1; then
		echo "Error: Not logged in to Cloud Foundry." >&2
		echo "Please login first" >&2
		return 1
	fi

	# Extract username from email (before @), remove .external suffix if present, replace dots with hyphens
	CF_USER_EXTRACTED=$(cf t | grep "^user:" | awk '{print $2}' | cut -d'@' -f1 | sed 's/\.external$//' | tr '.' '-')

	if [ -z "$CF_USER_EXTRACTED" ]; then
		echo "Error: Could not determine Cloud Foundry user. Please ensure you are logged in." >&2
		return 1
	fi

	return 0
}

# Function to determine DB_INSTANCE based on parameter
# Usage: get_db_instance <parameter> <command_name>
# Returns: DB_INSTANCE name
# Exit codes: 0 for success, 1 for help/error
get_db_instance() {
	PARAM="$1"
	COMMAND="$2"

	if [ -z "$PARAM" ]; then
		# No parameter: show documentation
		echo "Usage: npm run $COMMAND -- <option>" >&2
		echo "" >&2
		echo "Options:" >&2
		echo "  default  - Use shared HDI container: $DB_INSTANCE_BASE" >&2
		echo "  auto     - Create user-specific HDI container: $DB_INSTANCE_BASE-<username>" >&2
		echo "  <name>   - Use custom HDI container with provided name" >&2
		echo "" >&2
		echo "Examples:" >&2
		echo "  npm run $COMMAND -- default" >&2
		echo "  npm run $COMMAND -- auto" >&2
		echo "  npm run $COMMAND -- my-custom-db" >&2
		return 1
	elif [ "$PARAM" = "default" ]; then
		# Default: use shared database
		echo "$DB_INSTANCE_BASE"
		return 0
	elif [ "$PARAM" = "auto" ]; then
		# Auto: create user-specific instance
		# Extract CF user first
		extract_cf_user || return 1

		echo "$DB_INSTANCE_BASE-$CF_USER_EXTRACTED"
		return 0
	else
		# Custom: use provided name
		echo "$PARAM"
		return 0
	fi
}
