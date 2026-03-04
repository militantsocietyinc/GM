# AGENTS.md - Development Guidelines for World Monitor

This document provides essential guidelines for AI coding agents working on the World Monitor codebase. Follow these conventions to maintain code quality and consistency.

## Build, Lint, and Test Commands

### Primary Development Commands

- **Development server**: `npm run dev` (full variant), `npm run dev:tech`, `npm run dev:finance`, `npm run dev:happy`
- **Type checking**: `npm run typecheck` (all variants), `npm run typecheck:api` (server-side only)
- **Build**: `npm run build` (current variant), `npm run build:full`, `npm run build:tech`, etc.
- **Linting**: `npm run lint:md` (markdown only - no JS/TS linter configured)

### Testing Commands

- **Unit tests**: `npm run test:data` (Node.js tests in `tests/` directory)
- **E2E tests**: `npm run test:e2e` (all variants), `npm run test:e2e:full`, `npm run test:e2e:tech`, etc.
- **Single test file**: `npx playwright test path/to/test.spec.ts` (for E2E tests)
- **Visual regression**: `npm run test:e2e:visual`, `npm run test:e2e:visual:update`
- **Feed validation**: `npm run test:feeds`
- **Sidecar tests**: `npm run test:sidecar`

### Desktop Build Commands

- **Desktop development**: `npm run desktop:dev`
- **Desktop builds**: `npm run desktop:build:full`, `npm run desktop:build:tech`, etc.
- **Packaging**: `npm run desktop:package` (with platform-specific variants)

### Code Generation

- **Generate API clients/servers**: `make generate` (requires buf and protoc plugins)
- **Proto validation**: `make lint` (buf linting), `make check` (lint + generate)

## Code Style Guidelines

### TypeScript Configuration

- **Target**: ES2020 with strict mode enabled
- **Module system**: ESNext modules with `.js` extensions in imports
- **Path aliases**: Use `@/*` for `src/` directory imports
- **Null checking**: `noUncheckedIndexedAccess: true` - handle potential undefined values
- **Unused code**: `noUnusedLocals` and `noUnusedParameters` enabled - remove dead code

### Import Organization

```typescript
// 1. External dependencies (alphabetized)
import * as Sentry from '@sentry/browser';
import { inject } from '@vercel/analytics';

// 2. Internal absolute imports (with @ alias)
import { MapComponent } from '@/components/Map';
import type { MapLayers } from '@/types';

// 3. Relative imports (rare, prefer absolute)
import { utils } from '../utils';
```

### Naming Conventions

- **Files**: PascalCase for components (`MapContainer.ts`), camelCase for utilities (`urlState.ts`)
- **Classes**: PascalCase (`MapContainer`, `NewsPanel`)
- **Functions/Methods**: camelCase (`getCellCount`, `applyStoredTheme`)
- **Constants**: UPPER_SNAKE_CASE (`SITE_VARIANT`, `VITE_SENTRY_DSN`)
- **Interfaces/Types**: PascalCase with descriptive names (`MapContainerState`, `NewsItem`)
- **Private members**: Prefix with underscore (`_isMobile`, `_resizeObserver`)

### Component Structure

```typescript
/**
 * ComponentName - Brief description of component purpose
 * Additional details about functionality, rendering modes, etc.
 */
export class ComponentName {
  private container: HTMLElement;
  private state: ComponentState;

  constructor(container: HTMLElement, initialState: ComponentState) {
    // Initialize in constructor
  }

  private methodName(): ReturnType {
    // Implementation
  }
}
```

### Error Handling

- **Sentry integration**: All errors are captured automatically - focus on meaningful error messages
- **Graceful degradation**: Handle WebGL failures, network timeouts, API errors
- **User feedback**: Use console warnings for development, silent failures for production
- **Network failures**: Implement circuit breakers and fallbacks (see `CircuitBreaker` class)

### Type Safety

- **Strict typing**: Use explicit types for all parameters and return values
- **Interface segregation**: Create specific interfaces rather than generic objects
- **Discriminated unions**: Use for state management (`'pending' | 'loading' | 'success' | 'error'`)
- **Utility types**: Leverage `Partial<T>`, `Pick<T>`, `Omit<T>` for type transformations

### Async Patterns

```typescript
// Prefer async/await over Promises
async function fetchData(): Promise<Data> {
  try {
    const response = await fetch('/api/data');
    return await response.json();
  } catch (error) {
    console.warn('Data fetch failed:', error);
    return getFallbackData();
  }
}

// Circuit breaker pattern for unreliable APIs
const breaker = new CircuitBreaker(fetchData, {
  timeoutMs: 5000,
  failureThreshold: 3,
  successThreshold: 2
});
```

### Performance Considerations

- **WebGL detection**: Check `hasWebGLSupport()` before initializing 3D components
- **Lazy loading**: Use dynamic imports for large components and locale bundles
- **Caching**: Implement appropriate caching strategies (Redis for API responses, IndexedDB for client data)
- **Memory management**: Clean up event listeners, WebWorkers, and WebGL contexts

### Security Practices

- **Input sanitization**: Use DOMPurify for HTML content, validate URLs and email formats
- **API keys**: Never commit secrets - use environment variables (`VITE_*` prefix for client)
- **CSP compliance**: Content Security Policy headers prevent XSS attacks
- **HTTPS only**: All external requests must use HTTPS

### Testing Patterns

- **Unit tests**: Node.js native test runner in `tests/` directory
- **E2E tests**: Playwright in `e2e/` directory with mobile/desktop variants
- **Test organization**: Group related tests with `describe()`, use descriptive test names
- **Mocking**: Use native Node.js mocking for API calls and file I/O
- **Visual regression**: Screenshot comparisons for UI stability

### Documentation

- **JSDoc comments**: Required for all public APIs and complex functions
- **README updates**: Update documentation when adding major features
- **Code comments**: Explain complex business logic, not obvious implementations
- **API documentation**: Auto-generated from protobuf definitions

### Commit Message Format

- **Style**: Follow conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- **Scope**: Include component/area (`feat:map-container`, `fix:api-client`)
- **Description**: Focus on "why" rather than "what" - explain the motivation

### Architecture Patterns

- **Observer pattern**: Use custom events for cross-component communication
- **Factory pattern**: Component instantiation through factory functions
- **Strategy pattern**: Different rendering strategies (WebGL vs SVG, desktop vs mobile)
- **Service layer**: Data fetching and business logic in dedicated service modules

### Browser Compatibility

- **Target browsers**: Modern evergreen browsers (Chrome, Firefox, Safari, Edge)
- **Progressive enhancement**: Core functionality works without WebGL/JavaScript
- **Feature detection**: Check for required APIs before using them
- **Polyfills**: Minimal - rely on native browser APIs

### Internationalization

- **i18n keys**: Use descriptive keys in `src/locales/` JSON files
- **Lazy loading**: Language bundles loaded on demand
- **RTL support**: Automatic layout switching for Arabic/Hebrew
- **Date/time**: Use `Intl` APIs for locale-aware formatting

### State Management

- **Local state**: Component-level state with reactive updates
- **Persistent state**: `localStorage` for user preferences, `IndexedDB` for large datasets
- **URL state**: Map position, filters, and settings encoded in URL parameters
- **Cross-tab sync**: `BroadcastChannel` API for state synchronization

Remember: This codebase serves 4 different variants from a single source. Always consider the impact on all variants (full, tech, finance, happy) when making changes.</content>
<parameter name="filePath">AGENTS.md