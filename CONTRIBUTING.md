# Contributing to ArchitectLM

Thank you for your interest in contributing to ArchitectLM! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 8+

### Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/architectlm.git`
3. Navigate to the project directory: `cd architectlm`
4. Install dependencies: `pnpm install`
5. Run tests to ensure everything is working: `pnpm test`

## Development Workflow

### Branch Naming

- `feature/your-feature-name` for new features
- `fix/issue-you-are-fixing` for bug fixes
- `docs/what-you-are-documenting` for documentation changes
- `refactor/what-you-are-refactoring` for code refactoring

### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `style:` for formatting changes
- `refactor:` for code refactoring
- `test:` for adding or modifying tests
- `chore:` for maintenance tasks

### Pull Requests

1. Create a new branch from `main`
2. Make your changes
3. Run tests: `pnpm test`
4. Run linting: `pnpm lint`
5. Push your branch to your fork
6. Create a pull request to the `main` branch of the original repository
7. Fill out the pull request template

## Project Structure

```
architectlm/
├── packages/
│   ├── core/           # Core components
│   ├── extensions/     # Extensions for the framework
│   ├── dsl/            # Domain-Specific Language
│   ├── cli/            # Command-line tools
│   ├── examples/       # Examples
│   └── architectlm/    # Main package (re-exports)
├── .github/            # GitHub configuration
├── .vscode/            # VS Code settings
└── scripts/            # Build and maintenance scripts
```

## Testing

- Write tests for all new features and bug fixes
- Run tests with `pnpm test`
- Run tests in watch mode with `pnpm test:watch`

## Linting and Formatting

- Run linting with `pnpm lint`
- Fix linting issues with `pnpm lint:fix`
- Format code with `pnpm format`

## Documentation

- Update documentation for all new features and changes
- Follow the existing documentation style
- Run `pnpm docs` to generate documentation

## Release Process

The release process is handled by maintainers. We use semantic versioning.

## Getting Help

If you need help, please:

1. Check the documentation
2. Search for existing issues
3. Create a new issue if needed

Thank you for contributing to ArchitectLM!
