# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Run all tests: `npm run test`
- Run single test: `npx vitest run tests/fileName.test.ts`
- Watch tests: `npm run test:watch`
- All (typecheck, test, build): `npm run all`

## Code Style
- TypeScript with strict typing and error checks
- Use ES modules with NodeNext module system
- Follow existing naming conventions: camelCase for variables/methods, PascalCase for classes
- Create test-friendly code with dependency injection patterns
- Use zod for type validation and parsing
- Error handling: custom error classes extending Error
- Imports: group by external packages first, then internal modules
- Tests use Vitest in global mode
- Use nullable patterns with proper type checking