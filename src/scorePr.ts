import * as core from '@actions/core'

import {FilesCoverage} from './coverage'
import {formatAverageTable, formatFilesTable, toPercent} from './format'
import {context} from '@actions/github'
import {octokit} from './client'

const TITLE = `# ☂️ Python Coverage`

export async function publishMessage(pr: number, message: string): Promise {
  const body = TITLE.concat(message)
  core.summary.addRaw(body).write()

  try {
    core.info(`Attempting to list comments for PR #${pr} in ${context.repo.owner}/${context.repo.repo}`)
    const comments = await octokit.rest.issues.listComments({
      ...context.repo,
      issue_number: pr
    })
    core.info(`Successfully retrieved ${comments.data.length} comments`)

    const exist = comments.data.find((comment: (typeof comments.data)[number]) => {
      return comment.body?.startsWith(TITLE)
    })

    if (exist) {
      core.info(`Found existing comment (ID: ${exist.id}), attempting to update`)
      await octokit.rest.issues.updateComment({
        ...context.repo,
        issue_number: pr,
        comment_id: exist.id,
        body
      })
      core.info('Successfully updated comment')
    } else {
      core.info('No existing comment found, attempting to create new comment')
      await octokit.rest.issues.createComment({
        ...context.repo,
        issue_number: pr,
        body
      })
      core.info('Successfully created comment')
    }
  } catch (error) {
    core.error(`Failed to publish comment: ${error}`)
    if (error instanceof Error) {
      core.error(`Error name: ${error.name}`)
      core.error(`Error message: ${error.message}`)
      core.error(`Error stack: ${error.stack}`)
    }
    // Log context info for debugging
    core.info(`Context repo: ${JSON.stringify(context.repo)}`)
    core.info(`PR number: ${pr}`)
    core.info(`Event name: ${context.eventName}`)
    throw error
  }
}

export function scorePr(filesCover: FilesCoverage): boolean {
  let message = ''
  let passOverall = true

  core.startGroup('Results')
  const {coverTable: avgCoverTable, pass: passTotal} = formatAverageTable(filesCover.averageCover)
  message = message.concat(`\n## Overall Coverage\n${avgCoverTable}`)
  passOverall = passOverall && passTotal
  const coverAll = toPercent(filesCover.averageCover.ratio)
  passTotal ? core.info(`Average coverage ${coverAll} ✅`) : core.error(`Average coverage ${coverAll} ❌`)

  if (filesCover.newCover?.length) {
    const {coverTable, pass: passNew} = formatFilesTable(filesCover.newCover)
    passOverall = passOverall && passNew
    message = message.concat(`\n## New Files\n${coverTable}`)
    passNew ? core.info('New files coverage ✅') : core.error('New Files coverage ❌')
  } else {
    message = message.concat(`\n## New Files\nNo new covered files...`)
    core.info('No covered new files in this PR ')
  }

  if (filesCover.modifiedCover?.length) {
    const {coverTable, pass: passModified} = formatFilesTable(filesCover.modifiedCover)
    passOverall = passOverall && passModified
    message = message.concat(`\n## Modified Files\n${coverTable}`)
    passModified ? core.info('Modified files coverage ✅') : core.error('Modified Files coverage ❌')
  } else {
    message = message.concat(`\n## Modified Files\nNo covered modified files...`)
    core.info('No covered modified files in this PR ')
  }
  const sha = context.payload.pull_request?.head.sha.slice(0, 7)
  const action = '[action](https://github.com/marketplace/actions/python-coverage)'
  message = message.concat(`\n\n\n> **updated for commit: \`${sha}\` by ${action}🐍**`)
  message = `\n> current status: ${passOverall ? '✅' : '❌'}`.concat(message)
  publishMessage(context.issue.number, message)
  core.endGroup()

  return passOverall
}
