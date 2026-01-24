/**
 * CREATED BY: Hamza Lachi
 * CREATOR EMAIL: hamza@pullstream.com
 * CREATION DATE: 9/3/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains the gitOperations functions for us to use they aren't tied to compute they are generic functions we can use to create or do any operations like for example creating repository.
 *
 * REVISION 1:
 * REVISED BY: Hamza Lachi
 * REVISION DATE: 9/03/2024
 * REVISION REASON: Fixed lots of issues after code review by Mr Umer.
 */

const {
  gitCloneCredentials,
  gitHeaders,
  defaultBranch,
  defaultBranchRef,
  defaultBranches,
  protectedBranchesPermissions,
  defaultVariables,
} = require('#configs/gitlab.js');
const {
  getGroupDetails,
  createGroup,
  getRepoDetails,
  getRepoCommits,
  createRepo,
  setRepoSettings,
  setRepoTriggers,
  cloneRepo,
  changeBranchGit,
} = require('#utils/shared/gitUtils.js');
const {
  createStandardError,
  withErrorHandling,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY, COMPUTE_GENERATED_APPS_GROUP_ID } = require('#configs/constants.js');
const { logWithTrace } = require('#utils/shared/traceUtils.js');

const initializeGroups = withErrorHandling(
  async ({ groups = [], traceId = null } = {}) => {
    return Promise.all(
      groups.map(async (group) => {
        const parentGroupResp = await getGroupDetails({
          groupID: encodeURIComponent(`${group?.parentGroupID}`),
          gitHeaders,
        });
        if (parentGroupResp?.status !== 200) {
          throw createStandardError(
            ERROR_TYPES.NOT_FOUND,
            `Failed to get "${group?.parentGroupID}" parent group!`,
            {
              severity: ERROR_SEVERITY.MEDIUM,
              context: 'initialize_groups_parent_group',
              details: {
                traceId,
                parentGroupID: group?.parentGroupID,
                status: parentGroupResp?.status,
              },
            }
          );
        }
        let groupResp = await getGroupDetails({
          groupID: encodeURIComponent(`${group?.parentGroupID}/${group?.slug}`),
          gitHeaders,
        });
        if (groupResp?.status !== 200 && groupResp?.status !== 404) {
          throw createStandardError(
            ERROR_TYPES.NOT_FOUND,
            `Failed to get "${group?.name}" group!`,
            {
              severity: ERROR_SEVERITY.MEDIUM,
              context: 'initialize_groups_group',
              details: {
                traceId,
                group: group?.name,
                status: groupResp?.status,
              },
            }
          );
        }
        if (groupResp?.status === 404) {
          groupResp = await createGroup({
            name: group?.name,
            path: group?.slug,
            parentId: parentGroupResp?.data?.id,
            shareWithGroupId: COMPUTE_GENERATED_APPS_GROUP_ID, 
            gitHeaders,
          });

          if (groupResp?.status !== 200 && groupResp?.status !== 201) {
            throw createStandardError(
              ERROR_TYPES.INTERNAL,
              `Failed to create "${group?.name}" group!`,
              {
                severity: ERROR_SEVERITY.HIGH,
                context: 'initialize_groups_create_group',
                details: {
                  traceId,
                  group: group?.name,
                  status: groupResp?.status,
                },
              }
            );
          }
        }
        return groupResp;
      })
    );
  },
  'initialize_groups'
);

const initializeRepos = withErrorHandling(
  async ({ repos = [], traceId = null } = {}) => {
    const devOpsRepoConfig = repos.find(repo => repo.type === 'devOps');
    const otherReposConfig = repos.filter(repo => repo.type !== 'devOps');
    let devOpsRepoResp;

    if (devOpsRepoConfig) {
      devOpsRepoResp = await processRepo(devOpsRepoConfig);
    }

    const otherReposPromises = otherReposConfig.map(async (repo) => {
      const extraVariables = {};
      if (repo.type === 'restAPI' || repo.type === 'frontend') {
        extraVariables.PIPELINE_TRIGGER_TOKEN = {
          key: 'PIPELINE_TRIGGER_TOKEN',
          value: devOpsRepoResp?.data?.triggerToken,
          masked: true,
          _protected: true,
          variableType: 'env_var',
        };
        extraVariables.TARGET_PROJECT_ID = {
          key: 'TARGET_PROJECT_ID',
          value: devOpsRepoResp?.data?.id,
          masked: false,
          _protected: true,
          variableType: 'env_var',
        };
      }
      return processRepo(repo, extraVariables);
    });

    const allResponses = await Promise.all(otherReposPromises);
    if (devOpsRepoResp) {
      allResponses.push(devOpsRepoResp);
    }

    return allResponses;

    async function processRepo(repo, extraVariables = {}) {
      let repoResp = await getRepoDetails({
        repoID: repo?.id,
        gitHeaders,
      });

      if (
        repoResp?.status !== 200 &&
        repoResp?.status !== 404 &&
        !repo?.doNotCreateOrUpdate
      ) {
        throw createStandardError(
          ERROR_TYPES.NOT_FOUND,
          `Failed to get "${repo?.name}" repo!`,
          {
            severity: ERROR_SEVERITY.MEDIUM,
            context: 'initialize_repos_get_repo',
            details: { traceId, repo: repo?.name, status: repoResp?.status },
          }
        );
      }

      if (repoResp?.status === 404 && !repo?.doNotCreateOrUpdate) {
        repoResp = await createRepo({
          name: repo?.name,
          path: repo?.slug,
          namespaceId: repo?.namespaceId,
          defaultBranch: 'dev',
          gitHeaders,
        });
        if (repoResp?.status !== 200 && repoResp?.status !== 201) {
          throw createStandardError(
            ERROR_TYPES.INTERNAL,
            `Failed to create "${repo?.name}" repo!`,
            {
              severity: ERROR_SEVERITY.HIGH,
              context: 'initialize_repos_create_repo',
              details: {
                traceId,
                repo: repo?.name,
                status: repoResp?.status,
              },
            }
          );
        }
      }

      if (!repo?.doNotCreateOrUpdate) {
        await setRepoSettings({
          repoID: repo?.id,
          type: repo?.type,
          gitHeaders,
          defaultBranches,
          protectedBranchesPermissions,
          defaultVariables,
          defaultBranch,
          defaultBranchRef,
          extraVariables, // Pass extra variables here
        });
      }

      if (repo?.clonePath) {
        await cloneRepo({
          repoPath: repoResp?.data?.path_with_namespace,
          location: repo?.clonePath,
          gitCloneCredentials,
        });
        if (repo?.switchToBranch) {
          await changeBranchGit({
            repoPath: repo?.clonePath,
            branch: repo?.switchToBranch,
          });
        }
        repoResp.data.clonePath = repo?.clonePath;
      }

      if (repo?.type === 'devOps' && !repo?.doNotCreateOrUpdate) {
        const triggerToken = await setRepoTriggers({
          repoID: repo?.id,
          gitHeaders,
        });
        repoResp.data.triggerToken = triggerToken?.token;
      }
      return repoResp;
    }
  },
  'initialize_repos'
);

const checkIfRepoIsTaintedByAHuman = withErrorHandling(
  async ({ repoID, traceId = null } = {}) => {
    try {
      const commits = await getRepoCommits({
        repoID,
        gitHeaders,
      });
      if (commits?.status !== 200) {
        throw createStandardError(
          ERROR_TYPES.INTERNAL,
          'Failed to get repo commits!',
          {
            severity: ERROR_SEVERITY.HIGH,
            context: 'check_repo_taint_commits',
            details: { traceId, repoID, status: commits?.status },
          }
        );
      }
      return commits?.data.filter((commit) => commit.author_name !== 'Compute')
        .length;
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
          details: { traceId, repoID, error: error?.message },
          originalError: error,
        }
      );
    }
  },
  'check_repo_taint'
);

module.exports = {
  initializeGroups,
  initializeRepos,
  checkIfRepoIsTaintedByAHuman,
};
