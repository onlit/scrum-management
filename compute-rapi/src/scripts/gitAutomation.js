/**
 * CREATED BY: Hamza Lachi
 * CREATOR EMAIL: hamza@pullstream.com
 * CREATION DATE: 6/3/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains the gitAutomation functions for us to use in compute when generating code.
 * The functions in this file are all related to compute code generation.
 *
 * REVISION 1:
 * REVISED BY: Hamza Lachi
 * REVISION DATE: 8/03/2024
 * REVISION REASON: Fixed lots of issues after code review by Mr Umer.
 */

const { mkdir } = require('fs').promises;
const { findAndReplace } = require('#utils/shared/fileUtils.js');
const { MAIN_APP_REPO_PATH } = require('#configs/constants.js');
const { deleteDirIfExists } = require('#utils/shared/fileUtils.js');
const {
  changeBranchGit,
  addAllFilesToGit,
  skipCherryPickToGit,
  cherryPickToGit,
  mergeToGit,
  commitToGit,
  pullFromGit,
  pushToGit,
} = require('#utils/shared/gitUtils.js');
const { logStep } = require('#utils/shared/loggingUtils.js');
const {
  initializeGroups,
  initializeRepos,
  checkIfRepoIsTaintedByAHuman,
} = require('#scripts/gitOperations.js');
const getComputeMicroservicePaths = require('#configs/computePaths.js');
const {
  createStandardError,
  withErrorHandling,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { logWithTrace } = require('#utils/shared/traceUtils.js');

// Helper function to conditionally log steps
async function conditionalLogStep(logParams, stepFunction) {
  const { user, instanceId } = logParams;
  if (user && instanceId) {
    return logStep(logParams, stepFunction);
  }
  return stepFunction();
}

const setupMicroserviceRepositories = withErrorHandling(
  async ({
    microserviceName,
    mainGroupID = 'pullstream/microservices',
    devOpsMainGroupID = 'pullstream/microservices/devops',
    user,
    instanceId,
    switchToBranch = '',
    traceId = null,
  } = {}) => {
    try {
      const { microservice, restAPI, mainApp, frontend, devOps } =
        getComputeMicroservicePaths({
          microserviceName,
        });

      const commonLogParams = {
        user,
        instanceId,
      };

      // Creating directories
      await conditionalLogStep(
        { ...commonLogParams, stepCode: 'GU70-1Z2' },
        async () => {
          // restAPI dir
          await deleteDirIfExists(restAPI?.path);
          await mkdir(restAPI?.path, { recursive: true });

          // mainApp dir
          await deleteDirIfExists(mainApp?.path);
          await mkdir(mainApp?.path, { recursive: true });

          // frontend dir
          await deleteDirIfExists(frontend?.path);
          await mkdir(frontend?.path, { recursive: true });

          // devOps dir
          await deleteDirIfExists(devOps?.path);
          await mkdir(devOps?.path, { recursive: true });
        }
      );

      // Checking groups and creating them
      const groups = await conditionalLogStep(
        { ...commonLogParams, stepCode: 'CDNL-R8W' },
        async () => {
          return initializeGroups({
            groups: [
              {
                name: microservice?.name,
                slug: microservice?.slug,
                parentGroupID: mainGroupID,
              },
              {
                name: microservice?.name,
                slug: microservice?.slug,
                parentGroupID: devOpsMainGroupID,
              },
            ],
          });
        }
      );

      // Checking repos and creating them and updating their settings
      const repos = await conditionalLogStep(
        { ...commonLogParams, stepCode: 'OQ5T-Q82' },
        async () => {
          return initializeRepos({
            repos: [
              {
                id: encodeURIComponent(
                  `${mainGroupID}/${microservice?.slug}/${restAPI?.slug}`
                ),
                name: restAPI?.name,
                slug: restAPI?.slug,
                namespaceId: groups[0]?.data?.id,
                type: 'restAPI',
                clonePath: restAPI?.path,
                switchToBranch,
              },
              {
                id: encodeURIComponent(`${mainGroupID}/${MAIN_APP_REPO_PATH}`),
                name: mainApp?.name,
                slug: mainApp?.slug,
                namespaceId: groups[0]?.data?.id,
                type: 'mainApp',
                clonePath: mainApp?.path,
                doNotCreateOrUpdate: true,
                switchToBranch,
              },
              {
                id: encodeURIComponent(
                  `${mainGroupID}/${microservice?.slug}/${frontend?.slug}`
                ),
                name: `${frontend?.name}_NotUsing`,
                slug: frontend?.slug,
                namespaceId: groups[0]?.data?.id,
                type: 'frontend',
                clonePath: frontend?.path,
                switchToBranch,
              },
              {
                id: encodeURIComponent(
                  `${devOpsMainGroupID}/${microservice?.slug}/${devOps?.slug}`
                ),
                name: devOps?.name,
                slug: devOps?.slug,
                namespaceId: groups[1]?.data?.id,
                type: 'devOps',
                clonePath: devOps?.path,
                switchToBranch,
              },
            ],
          });
        }
      );

      return {
        restAPIRepo: repos[0]?.data,
        mainAppRepo: repos[1]?.data,
        frontendRepo: repos[2]?.data,
        devOpsRepo: repos[3]?.data,
      };
    } catch (error) {
      logWithTrace(
        '[Error]: Failed to setup microservice repos',
        { traceId },
        { error: error?.message }
      );
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to setup microservice repos',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'setup_microservice_repositories',
          details: { traceId, error: error?.message },
          originalError: error,
        }
      );
    }
  },
  'setup_microservice_repositories'
);

const commitChanges = withErrorHandling(
  async ({
    path,
    commitMessage,
    branch,
    mergeBranch = '',
    cherryPick = '',
    user,
    instanceId,
    traceId = null,
  } = {}) => {
    try {
      const commonLogParams = {
        user,
        instanceId,
      };

      await conditionalLogStep(
        { ...commonLogParams, stepCode: 'D6N0-VEK' },
        async () => {
          return changeBranchGit({
            repoPath: path,
            branch,
          });
        }
      );

      await conditionalLogStep(
        { ...commonLogParams, stepCode: 'CSXV-74U' },
        async () => {
          if (!mergeBranch || !mergeBranch?.length) {
            await addAllFilesToGit({
              repoPath: path,
            });
          }
        }
      );

      await conditionalLogStep(
        { ...commonLogParams, stepCode: '23QA-WSN' },
        async () => {
          // commit or merge
          if (!mergeBranch || !mergeBranch?.length) {
            await commitToGit({
              repoPath: path,
              commitMessage,
            });
          } else {
            await pullFromGit({
              repoPath: path,
              branch,
            });

            await changeBranchGit({
              repoPath: path,
              branch: mergeBranch,
            });

            await pullFromGit({
              repoPath: path,
              branch: mergeBranch,
            });

            let mResp;

            if (!cherryPick || !cherryPick.length) {
              mResp = await mergeToGit({
                repoPath: path,
                fromBranch: branch,
              });
            } else {
              mResp = await cherryPickToGit({
                repoPath: path,
                commitID: cherryPick,
              });
            }

            if ((mResp ?? '').includes('git cherry-pick --skip')) {
              await skipCherryPickToGit({
                repoPath: path,
              });
            } else if ((mResp ?? '').includes('CONFLICT')) {
              await addAllFilesToGit({
                repoPath: path,
              });

              await commitToGit({
                repoPath: path,
                commitMessage: 'Fixed conflicts!',
              });
            }
          }
        }
      );
    } catch (error) {
      logWithTrace(
        '[Error]: Failed to commit and push changes',
        { traceId },
        { error: error?.message }
      );
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to commit and push changes',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'commit_changes',
          details: { traceId, error: error?.message },
          originalError: error,
        }
      );
    }
  },
  'commit_changes'
);

const pushChanges = withErrorHandling(
  async ({ path, branch, user, instanceId, traceId = null } = {}) => {
    try {
      const commonLogParams = {
        user,
        instanceId,
      };

      await conditionalLogStep(
        { ...commonLogParams, stepCode: 'D6N0-VEK' },
        async () => {
          return changeBranchGit({
            repoPath: path,
            branch,
          });
        }
      );

      await conditionalLogStep(
        { ...commonLogParams, stepCode: '23QA-WSN' },
        async () => {
          return pushToGit({
            repoPath: path,
            branch,
          });
        }
      );
    } catch (error) {
      logWithTrace(
        '[Error]: Failed to push changes',
        { traceId },
        { error: error?.message }
      );
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to push changes',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'push_changes',
          details: { traceId, error: error?.message },
          originalError: error,
        }
      );
    }
  },
  'push_changes'
);

const checkIfAnyRepoIsTaintedByAHuman = withErrorHandling(
  async ({
    restAPIRepoID,
    frontendRepoID,
    devOpsRepoID,
    traceId = null,
  } = {}) => {
    try {
      const restAPITaint = await checkIfRepoIsTaintedByAHuman({
        repoID: restAPIRepoID,
      });

      const frontendTaint = await checkIfRepoIsTaintedByAHuman({
        repoID: frontendRepoID,
      });

      const devOpsTaint = await checkIfRepoIsTaintedByAHuman({
        repoID: devOpsRepoID,
      });

      return restAPITaint || frontendTaint || devOpsTaint;
    } catch (error) {
      logWithTrace(
        '[Error]: Failed to check if repo is tainted by human or not',
        { traceId },
        { error: error?.message }
      );
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to check if repo is tainted by human or not',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'check_repo_taint',
          details: { traceId, error: error?.message },
          originalError: error,
        }
      );
    }
  },
  'check_repo_taint'
);

const changePipelineMode = withErrorHandling(
  async ({
    fromBranch,
    branch,
    path,
    user,
    instanceId,
    devOps = false,
    commit = true,
    traceId = null,
  } = {}) => {
    try {
      const fromMode = fromBranch === 'main' ? 'prod' : fromBranch;
      const mode = branch === 'main' ? 'prod' : branch;

      // change branch
      await changeBranchGit({
        repoPath: path,
        branch,
      });

      // .gitlab-ci.yml
      await findAndReplace(
        `${path}/.gitlab-ci.yml`,
        `${fromMode}-amd64`,
        `${mode}-amd64`
      );
      await findAndReplace(
        `${path}/.gitlab-ci.yml`,
        `Dockerfile.${fromMode}`,
        `Dockerfile.${mode}`
      );

      // deploy.sh
      if (devOps) {
        await findAndReplace(`${path}/deploy.sh`, `/${fromMode}/`, `/${mode}/`);
      }

      if (!commit) return;

      await commitChanges({
        path,
        commitMessage: '- Changed the mode',
        branch,
        user,
        instanceId,
      });
    } catch (error) {
      logWithTrace(
        '[Error]: Failed to change the pipeline mode',
        { traceId },
        { error: error?.message }
      );
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to change the pipeline mode',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'change_pipeline_mode',
          details: { traceId, error: error?.message },
          originalError: error,
        }
      );
    }
  },
  'change_pipeline_mode'
);
/**
 * Processes repositories with a mergeBranch by changing the pipeline mode.
 * @param {Array} repos - The list of repositories.
 */
async function processRepositoriesWithMergeBranch(repos) {
  const reposWithMergeBranch = repos.filter((repo) => repo?.mergeBranch);

  for (const repo of reposWithMergeBranch) {
    // await changePipelineMode({
    //   ...repo,
    //   fromBranch: repo.branch,
    //   branch: repo.mergeBranch,
    // });
  }
}

/**
 * Pushes changes for all repositories, adjusting the branch if mergeBranch exists.
 * @param {Array} repos - The list of repositories.
 */
async function pushChangesForRepositories(repos) {
  for (const repo of repos) {
    const updatedRepo = repo.mergeBranch
      ? { ...repo, branch: repo.mergeBranch }
      : repo;
    await pushChanges(updatedRepo);
  }
}

async function commitAndPushChanges(repos) {
  for (const repo of repos) {
    await commitChanges(repo);
  }
  await processRepositoriesWithMergeBranch(repos);
  await pushChangesForRepositories(repos);
}

module.exports = {
  setupMicroserviceRepositories,
  commitChanges,
  pushChanges,
  checkIfAnyRepoIsTaintedByAHuman,
  changePipelineMode,
  processRepositoriesWithMergeBranch,
  pushChangesForRepositories,
  commitAndPushChanges,
};
