#!/bin/bash

# Test Runtime API
# This script tests the runtime API using curl

# Set the base URL
BASE_URL="http://localhost:3000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to make a request and print the response
function make_request() {
  local method=$1
  local endpoint=$2
  local data=$3
  local description=$4

  echo -e "${BLUE}Testing: ${description}${NC}"
  echo -e "${BLUE}${method} ${endpoint}${NC}"
  
  if [ -n "$data" ]; then
    echo -e "${BLUE}Request:${NC}"
    echo "$data" | jq '.'
    response=$(curl -s -X ${method} -H "Content-Type: application/json" -d "${data}" ${BASE_URL}${endpoint})
  else
    response=$(curl -s -X ${method} ${BASE_URL}${endpoint})
  fi

  echo -e "${BLUE}Response:${NC}"
  echo "$response" | jq '.'
  echo ""
}

# Check if the server is running
echo -e "${BLUE}Checking if the server is running...${NC}"
status_response=$(curl -s ${BASE_URL}/status)
if [ $? -ne 0 ]; then
  echo -e "${RED}Error: Server is not running. Please start the server first.${NC}"
  exit 1
fi
echo -e "${GREEN}Server is running!${NC}"
echo ""

# Get initial status
make_request "GET" "/status" "" "Get initial status"

# Load a system
system_json=$(cat <<EOF
{
  "id": "todo-system",
  "name": "Todo System",
  "version": "1.0.0",
  "description": "A simple todo management system",
  "boundedContexts": {
    "todos": {
      "id": "todos",
      "name": "Todo Management",
      "description": "Manages todo items and lists",
      "processes": ["manage-todos"]
    }
  },
  "processes": {
    "manage-todos": {
      "id": "manage-todos",
      "name": "Manage Todos",
      "type": "stateful",
      "contextId": "todos",
      "triggers": [
        {
          "type": "user_event",
          "name": "todo-created",
          "description": "Triggered when a new todo is created"
        },
        {
          "type": "user_event",
          "name": "todo-completed",
          "description": "Triggered when a todo is marked as completed"
        }
      ],
      "tasks": ["validate-todo", "save-todo", "update-todo", "delete-todo"],
      "states": ["active", "completed", "archived"],
      "transitions": [
        { "from": "active", "to": "completed", "on": "complete" },
        { "from": "completed", "to": "active", "on": "reactivate" },
        { "from": "active", "to": "archived", "on": "archive" },
        { "from": "completed", "to": "archived", "on": "archive" },
        { "from": "archived", "to": "active", "on": "restore" }
      ]
    }
  },
  "tasks": {
    "validate-todo": {
      "id": "validate-todo",
      "type": "operation",
      "label": "Validate Todo",
      "description": "Validates todo data",
      "input": ["title", "description", "dueDate"],
      "output": ["isValid", "errors"]
    },
    "save-todo": {
      "id": "save-todo",
      "type": "operation",
      "label": "Save Todo",
      "description": "Saves todo to database",
      "input": ["todo"],
      "output": ["id", "success"]
    },
    "update-todo": {
      "id": "update-todo",
      "type": "operation",
      "label": "Update Todo",
      "description": "Updates todo in database",
      "input": ["todoId", "updates"],
      "output": ["success"]
    },
    "delete-todo": {
      "id": "delete-todo",
      "type": "operation",
      "label": "Delete Todo",
      "description": "Deletes todo from database",
      "input": ["todoId"],
      "output": ["success"]
    }
  }
}
EOF
)

make_request "POST" "/system" "$system_json" "Load a system"

# Get status after loading system
make_request "GET" "/status" "" "Get status after loading system"

# Execute a task with valid input
make_request "POST" "/task" '{"taskId": "validate-todo", "input": {"title": "Test Todo"}}' "Execute a task with valid input"

# Execute a task with invalid input
make_request "POST" "/task" '{"taskId": "validate-todo", "input": {"title": ""}}' "Execute a task with invalid input"

# Send an event
make_request "POST" "/event" '{"eventType": "complete", "payload": {"processId": "manage-todos"}}' "Send an event"

echo -e "${GREEN}All tests completed!${NC}" 