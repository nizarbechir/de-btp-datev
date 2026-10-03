#!/bin/bash

# Base directory
BASE_DIR="app"

# Flag to track if any error occurred
ERROR_OCCURRED=0

# Loop through all direct subdirectories of BASE_DIR
for dir in "$BASE_DIR"/*/; do
	WEBAPP_DIR="${dir}webapp"

	# Check if webapp directory exists
	if [ -d "$WEBAPP_DIR" ]; then
		echo "Running ui5lint in: $dir"

		# Run ui5lint and check for errors
		(cd "$dir" && npx ui5lint)
		if [ $? -ne 0 ]; then
			echo "Error in: $dir"
			ERROR_OCCURRED=1
		fi
	else
		echo "No webapp directory in: $dir"
	fi
done

# Return appropriate exit code
if [ $ERROR_OCCURRED -ne 0 ]; then
	echo "At least one error occurred."
	exit 1
else
	echo "All webapp directories linted successfully."
	exit 0
fi
