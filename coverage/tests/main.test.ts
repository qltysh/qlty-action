import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'
import { runWithTracing } from '../src/main'

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  startSpan: vi.fn().mockImplementation((_, operation) => {
    return operation().then(() => {
      return Promise.resolve(undefined)
    })
  }),
  setTag: vi.fn(),
  setContext: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
  addBreadcrumb: vi.fn(),
  captureException: vi.fn()
}))

vi.mock('os', () => {
  const mockPlatform = vi.fn(() => 'linux')
  const mockArch = vi.fn(() => 'x64')

  const osModule = {
    platform: mockPlatform,
    arch: mockArch
  }

  return {
    default: osModule,
    platform: mockPlatform,
    arch: mockArch,
    __esModule: true
  }
})

vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  getBooleanInput: vi.fn(),
  setFailed: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  addPath: vi.fn(),
  setSecret: vi.fn()
}))

vi.mock('@actions/exec', () => ({
  exec: vi.fn()
}))

vi.mock('@actions/tool-cache', () => ({
  downloadTool: vi.fn(),
  extractTar: vi.fn(),
  cacheDir: vi.fn()
}))

vi.mock('@actions/glob', () => ({
  create: vi.fn().mockImplementation(async (patternString: string) => {
    const patterns = patternString.split('\n').filter(Boolean)
    return {
      glob: async () => {
        let files: string[] = []
        for (const p of patterns) {
          if (p === 'nonexistent/**/*.js') {
          } else if (p === 'src/**/*.ts') {
            files = files.concat(['src/main.ts', 'src/utils.ts'])
          } else {
            files = files.concat([p])
          }
        }
        return files
      }
    }
  })
}))

describe('Coverage Action - main.ts', () => {
  let getInputSpy: ReturnType<typeof vi.fn>
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()

    getInputSpy = vi.fn()
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(
        (code?: number | undefined) => undefined as never
      ) as unknown as ReturnType<typeof vi.spyOn>

    vi.mocked(core.getInput).mockImplementation(getInputSpy)

    vi.mocked(tc.downloadTool).mockResolvedValue('/tmp/downloaded-qlty.tar.xz')
    vi.mocked(tc.extractTar).mockResolvedValue('/tmp/extracted-qlty')
    vi.mocked(tc.cacheDir).mockResolvedValue('/tmp/cached-qlty')
  })

  it('should succeed with a non-glob path', async () => {
    getInputSpy.mockImplementation((name: string) => {
      if (name === 'coverage-token') return 'abc123'
      if (name === 'files') return 'src/main.ts'
      return ''
    })
    vi.mocked(core.getBooleanInput).mockReturnValue(false)

    await runWithTracing()

    expect(exec.exec).toHaveBeenCalled()
    const [tool, args] = vi.mocked(exec.exec).mock.calls[0]
    expect(tool).toBe('qlty')
    expect(args).toContain('src/main.ts')
  })

  it('should expand the glob path so the final arguments do not contain the literal "src/**/*.ts"', async () => {
    getInputSpy.mockImplementation((name: string) => {
      if (name === 'coverage-token') return 'fake-coverage-token'
      if (name === 'files') return 'src/**/*.ts'
      return ''
    })
    vi.mocked(core.getBooleanInput).mockReturnValue(false)

    await runWithTracing()

    expect(exec.exec).toHaveBeenCalled()
    const [tool, args] = vi.mocked(exec.exec).mock.calls[0]
    expect(tool).toBe('qlty')
    expect(args).not.toContain('src/**/*.ts')
    expect(args).toEqual(
      expect.arrayContaining(['src/main.ts', 'src/utils.ts'])
    )
  })

  it('should handle multiple files separated by commas', async () => {
    getInputSpy.mockImplementation((name: string) => {
      if (name === 'coverage-token') return 'abc123'
      if (name === 'files') return 'src/main.ts,src/utils.ts'
      return ''
    })
    vi.mocked(core.getBooleanInput).mockReturnValue(false)

    await runWithTracing()

    expect(exec.exec).toHaveBeenCalled()
    const [tool, args] = vi.mocked(exec.exec).mock.calls[0]
    expect(tool).toBe('qlty')
    expect(args).toContain('src/main.ts')
    expect(args).toContain('src/utils.ts')
  })

  it('should handle multiple patterns, including a glob, separated by commas', async () => {
    getInputSpy.mockImplementation((name: string) => {
      if (name === 'coverage-token') return 'another-token'
      if (name === 'files') return 'src/main.ts,src/**/*.ts'
      return ''
    })
    vi.mocked(core.getBooleanInput).mockReturnValue(false)

    await runWithTracing()

    expect(exec.exec).toHaveBeenCalled()
    const [tool, args] = vi.mocked(exec.exec).mock.calls[0]
    expect(tool).toBe('qlty')
    expect(args).toEqual(
      expect.arrayContaining(['src/main.ts', 'src/utils.ts'])
    )
    expect(args).not.toContain('src/main.ts src/**/*.ts')
  })

  it('should handle a pattern that matches no files', async () => {
    getInputSpy.mockImplementation((name: string) => {
      if (name === 'coverage-token') return 'abc123'
      if (name === 'files') return 'nonexistent/**/*.js'
      return ''
    })
    vi.mocked(core.getBooleanInput).mockReturnValue(false)

    await runWithTracing()

    expect(exec.exec).toHaveBeenCalled()
    const [tool, args] = vi.mocked(exec.exec).mock.calls[0]

    expect(args).not.toContain('nonexistent/**/*.js')
  })

  it('should handle repeated patterns by removing duplicates', async () => {
    getInputSpy.mockImplementation((name: string) => {
      if (name === 'coverage-token') return 'abc123'
      if (name === 'files') return 'src/main.ts,src/main.ts,src/**/*.ts'
      return ''
    })
    vi.mocked(core.getBooleanInput).mockReturnValue(false)

    await runWithTracing()

    expect(exec.exec).toHaveBeenCalled()
    const [tool, args] = vi.mocked(exec.exec).mock.calls[0]
    expect(tool).toBe('qlty')
    expect(args.filter(arg => arg === 'src/main.ts').length).toBe(1)
    expect(args).toContain('src/utils.ts')
  })

  it('should pass along total-parts-count', async () => {
    getInputSpy.mockImplementation((name: string) => {
      if (name === 'total-parts-count') return '44'

      return ''
    })

    await runWithTracing()

    expect(exec.exec).toHaveBeenCalled()
    const [, args] = vi.mocked(exec.exec).mock.calls[0]

    expect(args).toContain('--total-parts-count')
    expect(args).toContain('44')
  })

  it('should pass not define total-parts-count if input is not provided', async () => {
    getInputSpy.mockImplementation((name: string) => {
      if (name === 'total-parts-count') return ''

      return ''
    })

    await runWithTracing()

    expect(exec.exec).toHaveBeenCalled()
    const [_, args] = vi.mocked(exec.exec).mock.calls[0]

    expect(args).not.toContain('--total-parts-count')
  })
})
