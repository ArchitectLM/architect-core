# Contributing to ArchitectLM

Thank you for your interest in contributing to ArchitectLM! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to foster an inclusive and respectful community.

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** to your local machine.
3. **Install dependencies** with `npm install`.
4. **Run tests** with `npm test` to ensure everything is working.

## Development Workflow

1. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
   or
   ```bash
   git checkout -b fix/issue-you-are-fixing
   ```

2. **Make your changes** and ensure they follow the project's coding standards.

3. **Write tests** for your changes to maintain code quality and prevent regressions.

4. **Run the test suite** to ensure all tests pass:
   ```bash
   npm test
   ```

5. **Commit your changes** with clear, descriptive commit messages:
   ```bash
   git commit -m "feat: add new feature X"
   ```
   or
   ```bash
   git commit -m "fix: resolve issue with Y"
   ```

   We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages.

6. **Push your changes** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a pull request** from your fork to the main repository.

## Pull Request Guidelines

When submitting a pull request, please:

1. **Reference any related issues** in the PR description.
2. **Provide a clear description** of the changes and their purpose.
3. **Include screenshots or examples** if applicable.
4. **Ensure all tests pass** and add new tests for new functionality.
5. **Update documentation** if necessary.

## Coding Standards

We follow these coding standards:

1. **TypeScript**: Use TypeScript for all code.
2. **ESLint**: Follow the ESLint configuration in the project.
3. **Prettier**: Use Prettier for code formatting.
4. **Tests**: Write tests for all new functionality.
5. **Documentation**: Document all public APIs.

## Architecture Guidelines

When contributing to the core architecture, please follow these guidelines:

1. **Immutability**: Prefer immutable data structures.
2. **Type Safety**: Ensure strong typing throughout the codebase.
3. **Separation of Concerns**: Keep components focused on a single responsibility.
4. **Testability**: Design components to be easily testable.
5. **Performance**: Consider performance implications of changes.

## Adding New Features

When adding new features:

1. **Discuss First**: Open an issue to discuss the feature before implementing it.
2. **Follow Patterns**: Follow existing patterns and architecture.
3. **Documentation**: Add documentation for the new feature.
4. **Examples**: Add examples demonstrating the feature.
5. **Tests**: Add comprehensive tests for the feature.

## Reporting Bugs

When reporting bugs:

1. **Check Existing Issues**: Check if the bug has already been reported.
2. **Minimal Reproduction**: Provide a minimal reproduction of the bug.
3. **Environment Details**: Include details about your environment.
4. **Expected vs. Actual**: Describe the expected behavior and the actual behavior.
5. **Screenshots**: Include screenshots if applicable.

## Feature Requests

When requesting features:

1. **Check Existing Requests**: Check if the feature has already been requested.
2. **Clear Description**: Provide a clear description of the feature.
3. **Use Case**: Describe the use case for the feature.
4. **Alternatives**: Describe any alternatives you've considered.

## Documentation

We value good documentation. When contributing:

1. **Update README**: Update the README.md if necessary.
2. **API Documentation**: Document all public APIs.
3. **Examples**: Add examples for new features.
4. **Comments**: Add comments for complex code.

## Testing

We value comprehensive testing. When contributing:

1. **Unit Tests**: Write unit tests for all new functionality.
2. **Integration Tests**: Write integration tests for complex features.
3. **Test Coverage**: Maintain or improve test coverage.

## Releasing

The release process is managed by the maintainers. We follow semantic versioning:

1. **Major Version**: Breaking changes.
2. **Minor Version**: New features without breaking changes.
3. **Patch Version**: Bug fixes without breaking changes.

## Getting Help

If you need help with contributing:

1. **Open an Issue**: Open an issue with your question.
2. **Discussions**: Use the GitHub Discussions feature.
3. **Contact Maintainers**: Contact the maintainers directly.

## License

By contributing to ArchitectLM, you agree that your contributions will be licensed under the project's [MIT License](LICENSE). 