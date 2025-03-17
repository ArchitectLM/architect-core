# E-Commerce DSL E2E Tests

This directory contains end-to-end tests for the DSL package, focusing on a simple e-commerce application.

## Overview

The e-commerce DSL demonstrates how to use the DSL package to define a domain model for an e-commerce application and integrate it with the core runtime. It includes:

- Schemas for products, customers, orders, and payments
- Commands for creating, validating, and processing orders
- Events for order lifecycle
- A custom plugin for e-commerce validation and compilation
- A custom extension for e-commerce validation and transformation
- An HTTP API for interacting with the e-commerce system

## Components

### E-Commerce DSL

The `ecommerce-dsl.ts` file defines the domain model for the e-commerce application, including:

- **Schemas**: Product, Customer, OrderItem, Order, Payment
- **Commands**: CreateOrder, ValidateOrder, ProcessPayment, FulfillOrder, ShipOrder
- **Events**: OrderCreated, OrderValidated, PaymentProcessed, OrderFulfilled, OrderShipped

### E-Commerce Plugin

The `ecommerce-plugin.ts` file defines a custom plugin for the DSL that adds:

- Validation rules for e-commerce components
- JSDoc comments for compiled components
- Logging for component registration

### E-Commerce Extension

The `ecommerce-extension.ts` file defines a custom extension for the DSL that adds:

- Validation hooks for e-commerce schemas
- Compilation hooks for e-commerce commands
- Transformation hooks for e-commerce schemas

### E2E Test

The `ecommerce-dsl.test.ts` file tests the e-commerce DSL by:

1. Setting up the DSL compiler with the plugin and extension
2. Creating an HTTP API for interacting with the e-commerce system
3. Testing the order process flow from creation to shipping
4. Testing error handling for invalid orders

## Running the Tests

To run the e2e tests:

```bash
pnpm test:e2e
```

## API Endpoints

The e2e test creates an HTTP API with the following endpoints:

- `POST /api/orders`: Create a new order
- `POST /api/orders/:orderId/validate`: Validate an order
- `POST /api/orders/:orderId/payment`: Process payment for an order
- `POST /api/orders/:orderId/fulfill`: Fulfill an order
- `POST /api/orders/:orderId/ship`: Ship an order
- `GET /api/orders/:orderId`: Get order details

## Order Process Flow

The order process flow follows these states:

1. `created`: Initial state when an order is created
2. `validated`: Order has been validated
3. `paid`: Payment has been processed
4. `fulfilled`: Order has been fulfilled
5. `shipped`: Order has been shipped
6. `delivered`: Order has been delivered
7. `cancelled`: Order has been cancelled (can happen from any state) 