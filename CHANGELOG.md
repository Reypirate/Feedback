# Changelog

## [0.2.0](https://github.com/Reypirate/Feedback/compare/v0.1.2...v0.2.0) (2026-10-28)


### Features

* add Ardiente feedback survey with Supabase ([4c03d25](https://github.com/Reypirate/Feedback/commit/4c03d2514428be9964c80b4e05943b4470bfc9f5))
* add interactive feedback form progress and navigation ([2240929](https://github.com/Reypirate/Feedback/commit/2240929f733caeb03c91e5fa21b3904955e0ebe7))
* make the feedback form more interactive ([bf8af7d](https://github.com/Reypirate/Feedback/commit/bf8af7d17e5fe9c07713bda085cfcec62227fb67))


### Bug Fixes

* align React Query dependencies and integrate reviewed updates ([5ae30fe](https://github.com/Reypirate/Feedback/commit/5ae30fe840359aef2e7746253bc1400486f6e067))
* **deps:** update Zod to patched 4.6.7 ([c4ad45a](https://github.com/Reypirate/Feedback/commit/c4ad45ac2e5dfd42342e7dd99d7b5bbe03cea08e))
* improve feedback form usability ([c30ba64](https://github.com/Reypirate/Feedback/commit/c30ba647282e9211642ffa5743beb1ab05a5eeaf))
* improve feedback form usability ([58e1348](https://github.com/Reypirate/Feedback/commit/58e1348f01aefa448b23d5a020c1c84f4c590d97))
* keep mobile rating options within their grid across fonts ([43006ca](https://github.com/Reypirate/Feedback/commit/43006ca71d217ee6502a6017008cf38fc29b60a1))
* preserve compatible React Query versions after dependency refresh ([f0c5cac](https://github.com/Reypirate/Feedback/commit/f0c5cac033ee3529fdb218f739824d3e1e8eb538))
* resolve feedback review and narrow-screen usability issues ([8474a17](https://github.com/Reypirate/Feedback/commit/8474a17eee34f6b44e0200b188c8bc77ccd41c1b))

## [0.1.2](https://github.com/Reypirate/TypeScript-React-Hono-Template/compare/v0.1.1...v0.1.2) (2026-10-20)


### Bug Fixes

* align workspace and transitive typings with Node 22 ([fb76583](https://github.com/Reypirate/TypeScript-React-Hono-Template/commit/fb76583079df916179334068f48530c0887dbecd))
* apply Node 22 alignment to the resolver upgrade ([006d866](https://github.com/Reypirate/TypeScript-React-Hono-Template/commit/006d86659038e366a267163a72c2f6ea76d7b1f2))
* apply shared dependency fixes to the Radix upgrade ([592f8a3](https://github.com/Reypirate/TypeScript-React-Hono-Template/commit/592f8a389a9c5c016f4df6ff46e31589efaf3584))
* refresh Radix upgrade and cover context menu interactions ([7a1d43c](https://github.com/Reypirate/TypeScript-React-Hono-Template/commit/7a1d43c2202d93fa87241b1ee7deff33882c12d4))
* refresh resolver upgrade and cover Zod form validation ([883479c](https://github.com/Reypirate/TypeScript-React-Hono-Template/commit/883479c17378d7e0605e95c4f6e0c6b77d627cac))
* support jsdom 30 with current Node 22 build runtimes ([db622a4](https://github.com/Reypirate/TypeScript-React-Hono-Template/commit/db622a4e09ef891fbbc281fab2c3d1800860c983))
* verify jsdom upgrade with shared Node 22 dependencies ([b51684a](https://github.com/Reypirate/TypeScript-React-Hono-Template/commit/b51684a8e39e0e5be2113e45fe96d0e4746c776a))

## [0.1.1](https://github.com/Reypirate/TypeScript-React-Hono-Template/compare/v0.1.0...v0.1.1) (2026-10-19)

### Bug Fixes

- supply database config for offline CI migration checks ([23033d8](https://github.com/Reypirate/TypeScript-React-Hono-Template/commit/23033d8c5f114268c9daaca62b4d88da8c29256b))

## Changelog

## Unreleased

### Added

- Production-oriented monorepo build and Bun API start path.
- Runtime client environment injection through `/api/runtime.js`.
- OpenAPI JSON and Scalar-compatible API reference at `/api/scalar`.
- React Query and NUQS providers in the web app.
- Feature-based landing and not-found pages.
- Starter UI primitives, browser hooks, and formatting helpers.
- CI workflow with install, secret scan, format, lint, typecheck, test, and build steps.
- Oxc formatter/linter config and Lefthook pre-commit jobs.
- Optional SMTP and S3-compatible service wiring.

### Changed

- Dockerfile now builds the pnpm/Turbo monorepo instead of assuming a single-package app.
- Drizzle auth tables now provide safer defaults and cascade user-owned rows.
