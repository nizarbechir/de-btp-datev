#!/bin/bash

# Define the root directory
ROOT_DIR="app"

# Define the packages to remove
PACKAGES="@typescript-eslint/parser @typescript-eslint/eslint-plugin @sap-ux/eslint-plugin-fiori-tools typescript @sap/ui5-builder-webide-extension"

# Loop through first-level subdirectories
for dir in "$ROOT_DIR"/*/; do
	if [ -f "$dir/package.json" ]; then
		echo "Found package.json in $dir"

		# Change to the project directory
		cd "$dir" || continue

		echo "Deleting .eslintrc from $dir"
		[ -f .eslintrc ] && rm .eslintrc

		# Uninstall each package
		echo "Uninstalling $PACKAGES from $dir"
		npm remove $PACKAGES

		# Return to the original directory
		cd - > /dev/null
	fi
done

echo "Package removal process completed."
