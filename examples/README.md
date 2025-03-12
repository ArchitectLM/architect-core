# Schema Examples

This directory contains example schema files for the ArchitectLM framework.

## Todo System

`todo-system.json` is a simple example of a todo management system with the following components:

- **Bounded Context**: Todo Management
- **Processes**: 
  - Manage Todos (stateful)
  - Manage Lists (stateless)
- **Tasks**: Various operations for validating, saving, updating, and deleting todos and lists

This example demonstrates a basic schema without any extensions.

## E-Commerce System

`e-commerce-system.json` is a more complex example of an e-commerce system that uses the e-commerce extension:

- **Bounded Contexts**:
  - Product Catalog
  - Order Management
  - Customer Management
- **Processes**:
  - Manage Products (stateful)
  - Manage Inventory (stateless)
  - Process Order (stateful)
  - Manage Returns (stateful)
  - Manage Customers (stateless)
  - Manage Addresses (stateless)
- **Tasks**: Various operations for handling products, inventory, orders, returns, customers, and addresses
- **Sample Products**:
  - **Smartphone X**: A high-end smartphone with 128GB storage, available in black
  - **Laptop Pro**: A professional laptop with Intel i7 processor, 16GB RAM, and 512GB SSD
  - **Wireless Headphones**: Premium noise-cancelling headphones with 20 hours battery life

Each product includes detailed information such as:
- Basic details (name, description, price, SKU)
- Categories
- Attributes (color, specifications, etc.)
- Inventory information (quantity, reserved, available)
- Images

This example demonstrates how to use the e-commerce extension to enhance the schema with domain-specific concepts and data. The extension provides validation for inventory consistency and reference integrity between entities.

## Using the Examples

You can validate these examples using the CLI:

```bash
# Validate the todo system schema
node ./bin/architect-cli.js validate -d examples/todo-system.json

# Validate the e-commerce system schema
node ./bin/architect-cli.js validate -d examples/e-commerce-system.json
```

You can also use these examples as a starting point for your own schemas. 