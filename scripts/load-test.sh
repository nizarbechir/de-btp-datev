#!/bin/bash

# Script to generate load and test the autoscaler
# Generates multiple concurrent requests to increase CPU usage

APP_URL="${APP_URL:?Set APP_URL to the URL of the deployed swiver-srv app}"

echo "🚀 Starting load test on $APP_URL"
echo "⏱️  This script will generate load for 5 minutes"
echo "📊 Monitor instances with: watch -n 5 'cf app swiver-srv'"
echo ""

# Function to make requests
make_requests() {
	for i in {1..100}; do
		curl -s "$APP_URL/odata/v4/processor/" > /dev/null &
		curl -s "$APP_URL/odata/v4/admin/" > /dev/null &
	done
	wait
}

# Generate load for 5 minutes
END_TIME=$((SECONDS + 300))
REQUEST_COUNT=0

while [ $SECONDS -lt $END_TIME ]; do
	make_requests
	REQUEST_COUNT=$((REQUEST_COUNT + 200))
	echo "📈 Requests sent: $REQUEST_COUNT"
	sleep 2
done

echo "✅ Load test completed"
echo "🔍 Verify the number of instances with: cf app swiver-srv"
