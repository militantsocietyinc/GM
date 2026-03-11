#!/usr/bin/env bash

BASE="https://api.worldmonitor.app"

ENDPOINTS=(
"/api/market/v1/list-market-quotes?symbols=AAPL"
"/api/seismology/v1/list-earthquakes"
"/api/climate/v1/list-climate-anomalies"
"/api/aviation/v1/list-airport-delays"
)

echo "Checking World Monitor API endpoints..."
echo

for endpoint in "${ENDPOINTS[@]}"
do
  url="$BASE$endpoint"

  status=$(curl -H "Origin: https://worldmonitor.app" -o /dev/null -s -w "%{http_code}" "$url")
  time=$(curl -H "Origin: https://worldmonitor.app" -o /dev/null -s -w "%{time_total}" "$url")

  printf "%-60s status=%s time=%ss\n" "$endpoint" "$status" "$time"
done

echo
echo "Done."
