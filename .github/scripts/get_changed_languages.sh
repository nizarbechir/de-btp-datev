#!/bin/bash

changes=$(git status --porcelain)

# Declare an associative array to keep track of unique language abbreviations
declare -A lang_abbrs

# Use a loop to process each line of the changes variable
while IFS= read -r line; do
	# Extract the file path from the line
	file_path=$(echo "$line" | awk '{print $2}')

	# Use grep with a regex to extract the language abbreviation
	if [[ $file_path =~ (i18n|messages)_([a-z]{2})\.properties ]]; then
		lang_abbr=${BASH_REMATCH[2]}
		lang_abbrs["$lang_abbr"]=1
	fi
done <<< "$changes"

# Collect the unique language abbreviations into a comma-separated string
output=$(
	IFS=,
	echo "${!lang_abbrs[*]}"
)

# Print the result
echo "$output"
