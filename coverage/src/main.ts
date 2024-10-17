import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: 'https://76f58a921c9d8561646a586e7d9df772@o4506826106929152.ingest.us.sentry.io/4506826142646272',
  tracesSampleRate: 1.0
})

import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as github from '@actions/github'
import { exec } from '@actions/exec'
import os from 'os'
import fs from 'fs'
import path from 'path'

class CoverageUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CoverageUploadError'
  }
}

export async function runWithTracing(): Promise<void> {
  return await Sentry.startSpan(
    {
      op: 'execute',
      name: 'qlty-action/coverage'
    },
    async () => {
      Sentry.setTag('provider', 'github')
      Sentry.setTag(
        'repository.full_name',
        process.env.GITHUB_REPOSITORY || 'unknown'
      )
      Sentry.setContext('CI', {
        run_id: process.env.GITHUB_RUN_ID,
        run_url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      })

      run()
        .then(() => {
          Sentry.close(2000).then(function () {
            process.exit(0)
          })
        })
        .catch(error => {
          core.setFailed(`Action failed with error: ${error.name}`)
          Sentry.addBreadcrumb({
            category: 'qlty-coverage.log',
            level: 'log',
            type: 'error',
            message: error.message
          })
          Sentry.captureException(error)
          Sentry.close(2000).then(function () {
            process.exit(1)
          })
        })
    }
  )
}

async function run(): Promise<void> {
  const coverageToken = core.getInput('coverage-token', { required: true })
  core.setSecret(coverageToken)

  const platform = os.platform()
  const arch = os.arch()
  const context = github.context

  let platformArch

  if (platform === 'linux' && arch === 'x64') {
    platformArch = 'x86_64-unknown-linux-gnu'
  } else if (platform === 'darwin' && arch === 'x64') {
    platformArch = 'x86_64-apple-darwin'
  } else if (platform === 'darwin' && arch === 'arm64') {
    platformArch = 'aarch64-apple-darwin'
  } else {
    core.setFailed(`Unsupported platform/architecture: ${platform}/${arch}`)
    return
  }

  const downloadUrl = `https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-${platformArch}.tar.xz`

  const downloadedPath = await tc.downloadTool(downloadUrl)
  const extractedFolder = await tc.extractTar(downloadedPath, undefined, 'x')

  const cachedPath = await tc.cacheDir(
    extractedFolder,
    'qlty',
    'latest'
  )
  const binPath = `${cachedPath}/qlty-${platformArch}`
  core.addPath(binPath)

  const files = core.getInput('files', { required: true }).split(' ')
  const printCoverage = core.getBooleanInput('print-coverage')
  const printJsonCoverage = core.getBooleanInput('print-json-coverage')
  const addPrefix = core.getInput('add-prefix')
  const stripPrefix = core.getInput('strip-prefix')
  const skipErrors = core.getBooleanInput('skip-errors')
  const tag = core.getInput('tag')

  let uploadArgs = ['coverage', 'publish']

  if (printCoverage) {
    uploadArgs.push('--print')
  }

  if (printJsonCoverage) {
    uploadArgs.push('--json')
  }

  if (addPrefix) {
    uploadArgs.push('--transform-add-prefix', addPrefix)
  }

  if (stripPrefix) {
    uploadArgs.push('--transform-strip-prefix', stripPrefix)
  }

  if (tag) {
    uploadArgs.push('--tag', tag)
  }

  // Github doesn't provide the head's sha for PRs, so we need to extract it from the event's payload
  // https://github.com/orgs/community/discussions/26325
  // https://www.kenmuse.com/blog/the-many-shas-of-a-github-pull-request/
  if (context.payload.pull_request) {
    uploadArgs.push(
      '--override-commit-sha',
      context.payload.pull_request.head.sha
    )
    uploadArgs.push('--override-branch', context.payload.pull_request.head.ref)
  }

  uploadArgs = uploadArgs.concat(files)

  writeQltyConfig()
  let qlytOutput = ''
  try {
    await exec('qlty', uploadArgs, {
      env: {
        ...process.env,
        QLTY_COVERAGE_TOKEN: coverageToken
      },
      listeners: {
        stdout: (data: Buffer) => {
          qlytOutput += data.toString()
        },
        stderr: (data: Buffer) => {
          qlytOutput += data.toString()
        }
      }
    })
  } catch {
    if (skipErrors) {
      core.warning('Error uploading coverage, skipping due to skip-errors')
    } else {
      throw new CoverageUploadError(qlytOutput)
    }
  }
}

function writeQltyConfig() {
  if (!fs.existsSync('.qlty')) {
    fs.mkdirSync('.qlty')
  }

  fs.writeFileSync(path.join('.qlty', 'qlty.toml'), 'config_version = "0"')
}
