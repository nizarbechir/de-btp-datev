#!/bin/bash
# This script will be called by semantic release during release and deploy GitHub action
# If you change or add files, that should be changed during release, don't forget to
# adjust release.config.js as well

set -e

VERSION=$1

# Update version in mta.yaml
sed -i -r "s/^version: [0-9]+\.[0-9]+\.[0-9]+$/version: ${VERSION}/" mta.yaml

# Create version.json
jq -n -c --arg version "$VERSION" '{version: $version}' > version.json
