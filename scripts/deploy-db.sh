#!/bin/sh

# Source the shared functions (also provides DB_INSTANCE_BASE and DESTINATION_INSTANCE)
SCRIPT_DIR="$(dirname "$0")"
. "$SCRIPT_DIR/get-db-instance.sh"

# Determine DB_INSTANCE
DB_INSTANCE=$(get_db_instance "$1" "deploy:db")
if [ $? -ne 0 ]; then
	exit 1
fi

# Display which instance is being used
if [ "$1" = "default" ]; then
	echo "Deploying to default shared HDI container"
elif [ "$1" = "auto" ]; then
	echo "Using CF user: $CF_USER_EXTRACTED"
	echo "Deploying to user-specific HDI container"
else
	echo "Deploying to custom HDI container"
fi

echo "Target HDI container: $DB_INSTANCE"
cd "$(dirname "$0")"
cd ..
cds deploy --to hana:$DB_INSTANCE --production
