#!/bin/sh
# Validates ZUGFeRD / Factur-X PDFs with the Mustang validator (veraPDF for PDF/A-3,
# XSD and EN 16931 Schematron for the embedded XML). Needs Java 17+.
# Usage: scripts/validate-zugferd.sh file.pdf [...]   (npm run validate:zugferd for the test invoices)
set -eu

MUSTANG_VERSION="2.17.0"
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/swiver"
JAR="$CACHE_DIR/Mustang-CLI-$MUSTANG_VERSION.jar"
URL="https://repo1.maven.org/maven2/org/mustangproject/Mustang-CLI/$MUSTANG_VERSION/Mustang-CLI-$MUSTANG_VERSION.jar"

if [ "$#" -eq 0 ]; then
	echo "Usage: $0 file.pdf [...]" >&2
	exit 2
fi

JAVA="${JAVA_HOME:+$JAVA_HOME/bin/}java"
if ! "$JAVA" -version > /dev/null 2>&1; then
	JAVA=/opt/homebrew/opt/openjdk/bin/java
fi
if ! "$JAVA" -version > /dev/null 2>&1; then
	echo "Java 17+ is required (e.g. brew install openjdk)." >&2
	exit 2
fi

if [ ! -f "$JAR" ]; then
	mkdir -p "$CACHE_DIR"
	curl -sSfL "$URL" -o "$JAR.tmp"
	EXPECTED="$(curl -sSfL "$URL.sha1")"
	ACTUAL="$(shasum -a 1 "$JAR.tmp" | cut -d' ' -f1)"
	if [ "$EXPECTED" != "$ACTUAL" ]; then
		rm -f "$JAR.tmp"
		echo "Checksum mismatch for $URL" >&2
		exit 1
	fi
	mv "$JAR.tmp" "$JAR"
fi

FAILED=0
for PDF in "$@"; do
	REPORT="$("$JAVA" -jar "$JAR" --action validate --source "$PDF" --no-notices 2> /dev/null || true)"
	if [ "$(printf '%s' "$REPORT" | grep -c '<summary status="valid"/>')" -eq 3 ]; then
		echo "valid:   $PDF"
	else
		echo "INVALID: $PDF"
		printf '%s\n' "$REPORT" | grep -E '<error|<summary' >&2 || true
		FAILED=1
	fi
done
exit "$FAILED"
