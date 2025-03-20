#!/bin/bash

# Run Example Script
# This script runs an example file using tsx.

# Check if an example name was provided
if [ -z "$1" ]; then
  echo "Please provide an example name"
  echo "Usage: ./scripts/run-example.sh <example-name>"
  echo "Available examples:"
  
  # List available examples
  for file in examples/*.ts; do
    basename=$(basename "$file" .ts)
    echo "  - $basename"
  done
  
  exit 1
fi

# Check if the example exists
EXAMPLE_PATH="examples/$1.ts"
if [ ! -f "$EXAMPLE_PATH" ]; then
  echo "Example \"$1\" not found"
  exit 1
fi

# Run the example using tsx
echo "Running example: $1"
npx tsx "$EXAMPLE_PATH" 