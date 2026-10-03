#!/bin/sh

# Source the shared functions (also provides DB_INSTANCE_BASE and DESTINATION_INSTANCE)
SCRIPT_DIR="$(dirname "$0")"
. "$SCRIPT_DIR/get-db-instance.sh"

# Determine DB_INSTANCE
DB_INSTANCE=$(get_db_instance "$1" "bind-to-services")
if [ $? -ne 0 ]; then
	exit 1
fi

# Extract CF user for KEY_NAME only when needed and not already provided
if [ -z "$CF_USER_EXTRACTED" ]; then
	extract_cf_user || exit 1
fi
echo "Current user: $CF_USER_EXTRACTED"

# Set KEY_NAME - use second parameter if provided, otherwise use CF user
if [ -n "$2" ]; then
	KEY_NAME="$2"
	echo "Using custom KEY_NAME: $KEY_NAME"
else
	KEY_NAME="$CF_USER_EXTRACTED"
fi

# Display which instance is being used
if [ "$1" = "default" ]; then
	echo "Using default shared HDI container"
elif [ "$1" = "auto" ]; then
	echo "Using CF user: $CF_USER_EXTRACTED"
	echo "Creating user-specific HDI container"
else
	echo "Using custom HDI container name"
fi

echo "HDI container instance name: $DB_INSTANCE"

cd "$(dirname "$0")"
cd ..

# Create HDI container if it doesn't exist
echo "Creating HDI container service instance..."
if cf service "$DB_INSTANCE" > /dev/null 2>&1; then
	echo "Service instance already exists, continuing..."
else
	cf create-service hana hdi-shared "$DB_INSTANCE" --wait || exit 1
fi

# Create service key
echo "Creating service key..."
if cf service-key "$DB_INSTANCE" "$KEY_NAME" > /dev/null 2>&1; then
	echo "Service key already exists, continuing..."
else
	cf create-service-key "$DB_INSTANCE" "$KEY_NAME" --wait || exit 1
fi

# Remove old bindings
rm -f .cdsrc-private.json

# Bind to services
echo "Binding to services..."
cds bind --to "$DB_INSTANCE:$KEY_NAME,$DESTINATION_INSTANCE:$KEY_NAME" --for hybrid

echo "Successfully bound to HDI container: $DB_INSTANCE and destination: $DESTINATION_INSTANCE"
