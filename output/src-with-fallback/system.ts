
    /**
     * Todo System
     * 
     * A simple todo management system
     * Version: 1.0.0
     */
    
    export const system = {
  "id": "todo-system",
  "name": "Todo System",
  "version": "1.0.0",
  "description": "A simple todo management system",
  "boundedContexts": {
    "todos": {
      "id": "todos",
      "name": "Todo Management",
      "description": "Manages todo items and lists",
      "processes": [
        "manage-todos",
        "manage-lists"
      ]
    }
  },
  "processes": {
    "manage-todos": {
      "id": "manage-todos",
      "name": "Manage Todos",
      "type": "stateful",
      "contextId": "todos",
      "states": [
        "active",
        "completed",
        "archived"
      ],
      "transitions": [
        {
          "from": "active",
          "to": "completed",
          "trigger": "complete"
        },
        {
          "from": "completed",
          "to": "active",
          "trigger": "reactivate"
        },
        {
          "from": "active",
          "to": "archived",
          "trigger": "archive"
        },
        {
          "from": "completed",
          "to": "archived",
          "trigger": "archive"
        },
        {
          "from": "archived",
          "to": "active",
          "trigger": "restore"
        }
      ],
      "tasks": [
        "validate-todo",
        "save-todo",
        "update-todo",
        "delete-todo",
        "mark-important"
      ]
    },
    "manage-lists": {
      "id": "manage-lists",
      "name": "Manage Todo Lists",
      "type": "stateless",
      "contextId": "todos",
      "tasks": [
        "validate-list",
        "save-list",
        "update-list",
        "delete-list"
      ]
    }
  },
  "tasks": {
    "validate-todo": {
      "id": "validate-todo",
      "name": "Validate Todo",
      "type": "operation",
      "description": "Validates todo data",
      "input": [
        {
          "name": "title",
          "type": "string",
          "required": true
        },
        {
          "name": "description",
          "type": "string",
          "required": false
        },
        {
          "name": "dueDate",
          "type": "string",
          "required": false
        },
        {
          "name": "priority",
          "type": "string",
          "required": false
        },
        {
          "name": "listId",
          "type": "string",
          "required": false
        }
      ],
      "output": [
        {
          "name": "isValid",
          "type": "boolean"
        }
      ]
    },
    "save-todo": {
      "id": "save-todo",
      "name": "Save Todo",
      "type": "operation",
      "description": "Saves todo to database",
      "input": [
        {
          "name": "todo",
          "type": "object",
          "required": true
        }
      ],
      "output": [
        {
          "name": "id",
          "type": "string"
        },
        {
          "name": "success",
          "type": "boolean"
        }
      ]
    },
    "update-todo": {
      "id": "update-todo",
      "name": "Update Todo",
      "type": "operation",
      "description": "Updates todo in database",
      "input": [
        {
          "name": "todoId",
          "type": "string",
          "required": true
        },
        {
          "name": "updates",
          "type": "object",
          "required": true
        }
      ],
      "output": [
        {
          "name": "success",
          "type": "boolean"
        }
      ]
    },
    "delete-todo": {
      "id": "delete-todo",
      "name": "Delete Todo",
      "type": "operation",
      "description": "Deletes todo from database",
      "input": [
        {
          "name": "todoId",
          "type": "string",
          "required": true
        }
      ],
      "output": [
        {
          "name": "success",
          "type": "boolean"
        }
      ]
    },
    "validate-list": {
      "id": "validate-list",
      "name": "Validate List",
      "type": "operation",
      "description": "Validates list data",
      "input": [
        {
          "name": "name",
          "type": "string",
          "required": true
        },
        {
          "name": "description",
          "type": "string",
          "required": false
        },
        {
          "name": "color",
          "type": "string",
          "required": false
        }
      ],
      "output": [
        {
          "name": "isValid",
          "type": "boolean"
        }
      ]
    },
    "save-list": {
      "id": "save-list",
      "name": "Save List",
      "type": "operation",
      "description": "Saves list to database",
      "input": [
        {
          "name": "list",
          "type": "object",
          "required": true
        }
      ],
      "output": [
        {
          "name": "id",
          "type": "string"
        },
        {
          "name": "success",
          "type": "boolean"
        }
      ]
    },
    "update-list": {
      "id": "update-list",
      "name": "Update List",
      "type": "operation",
      "description": "Updates list in database",
      "input": [
        {
          "name": "listId",
          "type": "string",
          "required": true
        },
        {
          "name": "updates",
          "type": "object",
          "required": true
        }
      ],
      "output": [
        {
          "name": "success",
          "type": "boolean"
        }
      ]
    },
    "delete-list": {
      "id": "delete-list",
      "name": "Delete List",
      "type": "operation",
      "description": "Deletes list from database",
      "input": [
        {
          "name": "listId",
          "type": "string",
          "required": true
        }
      ],
      "output": [
        {
          "name": "success",
          "type": "boolean"
        }
      ]
    },
    "mark-important": {
      "id": "mark-important",
      "name": "Mark Todo as Important",
      "type": "operation",
      "description": "Marks a todo as important with a priority level",
      "input": [
        {
          "name": "todoId",
          "type": "string",
          "required": true
        },
        {
          "name": "priority",
          "type": "string",
          "required": true
        }
      ],
      "output": [
        {
          "name": "success",
          "type": "boolean"
        }
      ]
    }
  }
};
    
    export default system;
  