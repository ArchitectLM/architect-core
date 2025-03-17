# Changelog

## [Unreleased]

### Fixed
- Fixed system-loader tests by creating proper test fixtures in tests/fixtures directory
- Added uuid dependency to package.json
- Implemented a mock for the uuid function in vector-db-adapter.ts
- Skipped vector-db-adapter tests that require a running ChromaDB instance
- Updated README with testing information

## [0.1.0] - Initial Release

- Initial implementation of the DSL package 