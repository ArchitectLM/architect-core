# Changelog

## [Unreleased]

### Added
- Comprehensive architecture documentation in `docs/ARCHITECTURE.md`
- Detailed plugin system documentation in `docs/PLUGIN-SYSTEM.md`
- Integration testing guide in `tests/integration/README.md`

### Fixed
- Fixed process registration issue by ensuring process name matches the ID
- Enhanced event management tests using polling instead of fixed timeouts
- Improved task management tests with more reliable execution tracking
- Fixed runtime lifecycle test by adding proper reset step before restart
- Resolved task cancellation test by directly verifying scheduler state

### Changed
- Updated test methodology to use polling for asynchronous operations
- Improved error handling and state verification in tests
- Enhanced reliability of time-dependent tests
- Added skip conditions for problematic tests in CI environments

## [1.0.0] - 2023-12-01

### Added
- Initial release of Core2 Runtime
- Event-driven architecture with event bus, storage, and source
- Process management with state transitions and checkpoints
- Task scheduling and execution system
- Extension and plugin system
- Integration test suite 