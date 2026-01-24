// /**
//  * CREATED BY: Hamza Lachi
//  * CREATOR EMAIL: hamza@pullstream.com
//  * CREATION DATE: 9/3/2024
//  *
//  *
//  * DESCRIPTION:
//  * ------------------
//  * This file contains all of the utils that gitOperations file needs, it contains all the small utility and operations for us to use in bigger operations.
//  *
//  * REVISION 1:
//  * REVISED BY: Hamza Lachi
//  * REVISION DATE: 9/03/2024
//  * REVISION REASON: Fixed lots of issues after code review by Mr Umer.
//  */

const axios = require('axios');
const dotenv = require('dotenv');
const { GIT_HOST_WITHOUT_HTTP_AND_HTTPS } = require('#configs/constants.js');
const { getGroupsURL, getProjectsURL } = require('#configs/routes.js');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { logEvent } = require('#utils/shared/loggingUtils.js');
const { runCommand } = require('#utils/shared/shellUtils.js');

dotenv.config();

async function getGroupDetails({ groupID, gitHeaders } = {}) {
  try {
    logEvent(`Getting group details with the id of: ${groupID}`);
    const resp = await axios.get(getGroupsURL({ query: groupID }), gitHeaders);
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to get group details [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

// Function to share a group with another group
async function shareGroup({
  groupId,
  shareWithGroupId,
  accessLevel = 30, // Developer access level
  gitHeaders
} = {}) {
  try {
    logEvent(`Sharing group ${groupId} with group ${shareWithGroupId}`);
    const resp = await axios.post(
      getGroupsURL({ query: `${groupId}/share` }),
      {
        group_id: shareWithGroupId,
        group_access: accessLevel,
      },
      gitHeaders
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to share group [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}


async function createGroup({ name, path, parentId, shareWithGroupId, gitHeaders } = {}) {
  try {
    logEvent(`Creating group with the name of: ${name}`);
    const resp = await axios.post(
      getGroupsURL(),
      {
        name,
        path,
        parent_id: parentId,
      },
      gitHeaders
    );

    if (resp.status === 201 && shareWithGroupId) {
      const newGroupId = resp.data.id;
      await shareGroup({
        groupId: newGroupId,
        shareWithGroupId,
        gitHeaders,
      });
    }

    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to create group [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function getRepoDetails({ repoID, gitHeaders } = {}) {
  try {
    logEvent(`Getting repo details with the id of: ${repoID}`);
    const resp = await axios.get(getProjectsURL({ query: repoID }), gitHeaders);
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to get repo details [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function createRepo({
  name,
  path,
  namespaceId,
  defaultBranch,
  initializeWithReadme = true,
  gitHeaders,
} = {}) {
  try {
    logEvent(`Creating repo with the name of: ${name}`);
    const resp = await axios.post(
      getProjectsURL(),
      {
        name,
        path,
        namespace_id: namespaceId,
        default_branch: defaultBranch,
        initialize_with_readme: initializeWithReadme,
      },
      gitHeaders
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to create repo [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function deleteRepo({ projectId, gitHeaders } = {}) {
  try {
    logEvent(`Deleting repository with the ID: ${projectId}`);
    const resp = await axios.delete(
      `${getProjectsURL()}/${projectId}`,
      gitHeaders
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to delete repository [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function getRepoCommits({ repoID, gitHeaders } = {}) {
  try {
    logEvent(`Getting repo commits with the id of: ${repoID}`);
    const resp = await axios.get(
      getProjectsURL({ query: `${repoID}/repository/commits?all=true` }),
      gitHeaders
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to get repo commits [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function getRepoBranches({ repoID, gitHeaders } = {}) {
  try {
    logEvent(`Getting repo branches with the id of: ${repoID}`);
    const resp = await axios.get(
      getProjectsURL({ query: `${repoID}/repository/branches` }),
      gitHeaders
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to get repo branches [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function createRepoBranch({ repoID, name, ref, gitHeaders } = {}) {
  try {
    logEvent(`Creating branch with the name of: ${name}`);
    const resp = await axios.post(
      getProjectsURL({ query: `${repoID}/repository/branches` }),
      {
        branch: name,
        ref,
      },
      gitHeaders
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to create repo branch [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function getRepoProtectedBranches({ repoID, gitHeaders } = {}) {
  try {
    logEvent(`Getting repo protected branches with the id of: ${repoID}`);
    const resp = await axios.get(
      getProjectsURL({ query: `${repoID}/protected_branches` }),
      gitHeaders
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to get repo protected branches [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function createRepoProtectedBranch({
  repoID,
  name,
  allowedToMerge = [{ access_level: 40 }], // Only maintainers
  allowedToPush = [{ access_level: 40 }], // Only maintainers,
  gitHeaders,
} = {}) {
  try {
    logEvent(`Creating protected branch with the name of: ${name}`);
    const resp = await axios.post(
      getProjectsURL({ query: `${repoID}/protected_branches` }),
      {
        name,
        allowed_to_merge: allowedToMerge,
        allowed_to_push: allowedToPush,
      },
      gitHeaders
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to create protected repo branch [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function deleteRepoProtectedBranch({ repoID, name, gitHeaders } = {}) {
  try {
    logEvent(`deleting protected branch with the name of: ${name}`);
    const resp = await axios.delete(
      getProjectsURL({ query: `${repoID}/protected_branches/${name}` }),
      gitHeaders
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to delete protected repo branch [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function setDefaultBranch({ repoID, name, gitHeaders } = {}) {
  try {
    logEvent(`Setting default branch to ${name}`);

    // Make a PUT request to update the repository settings
    const resp = await axios.put(
      getProjectsURL({ query: repoID }),
      {
        default_branch: name,
      },
      gitHeaders
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to set default branch [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function getRepoEnvVariables({ repoID, gitHeaders } = {}) {
  try {
    logEvent(`Getting repo environment variables with the id of: ${repoID}`);
    const resp = await axios.get(
      getProjectsURL({ query: `${repoID}/variables` }),
      gitHeaders
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to get repo environment variables [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function createRepoEnvVariable({
  repoID,
  key,
  value,
  description,
  masked,
  _protected,
  variableType,
  gitHeaders,
} = {}) {
  try {
    logEvent(`Creating repo env variable with the key of: ${key}`);
    const resp = await axios.post(
      getProjectsURL({ query: `${repoID}/variables` }),
      {
        key,
        value,
        description,
        masked,
        protected: _protected,
        variable_type: variableType,
      },
      gitHeaders
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to create repo env variable [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function deleteRepoEnvVariable({ repoID, key, gitHeaders } = {}) {
  try {
    logEvent(`deleting env variable with the key of: ${key}`);
    const resp = await axios.delete(
      getProjectsURL({ query: `${repoID}/variables/${key}` }),
      gitHeaders
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to delete repo env variable [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function getRepoTriggers({ repoID, gitHeaders } = {}) {
  try {
    logEvent(`Getting repo ci/cd triggers with the id of: ${repoID}`);
    const resp = await axios.get(
      getProjectsURL({ query: `${repoID}/triggers` }),
      gitHeaders
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to get repo ci/cd triggers [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function createRepoTrigger({ repoID, description, gitHeaders } = {}) {
  try {
    logEvent(`Creating repo ci/cd triggers with the key of: ${repoID}`);
    const resp = await axios.post(
      getProjectsURL({ query: `${repoID}/triggers` }),
      {
        description,
      },
      gitHeaders
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to create repo ci/cd triggers [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function ensureBranchesExist({
  repoID,
  branchesThatMustExists,
  defaultBranchRef,
  gitHeaders,
} = {}) {
  try {
    logEvent(
      `Making sure all branches exists for repo with the id of: ${repoID}`
    );
    const branches = await getRepoBranches({
      repoID,
      gitHeaders,
    });

    if (branches?.status !== 200) {
      logEvent(
        `[GIT_UTILS_ERROR] Failed to get repo branches: ${branches?.status}`
      );
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to get repo branches!',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'git_get_repo_branches',
          details: { status: branches?.status },
        }
      );
    }

    const repoBranchesNames = branches?.data.map((item) => item?.name);
    const branhcesNeedsToBeCreated = branchesThatMustExists.filter(
      (branch) => !repoBranchesNames.includes(branch)
    );

    await Promise.all(
      branhcesNeedsToBeCreated.map(async (branch) =>
        createRepoBranch({
          repoID,
          name: branch,
          ref: defaultBranchRef,
          gitHeaders,
        })
      )
    );
  } catch (error) {
    logEvent(
      `[Error]: Failed to ensure all branches [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function ensureProtectedBranches({
  repoID,
  branchesThatMustBeProtected,
  protectedBranchesPermissions,
  gitHeaders,
} = {}) {
  try {
    logEvent(
      `Making sure all protected branches exists for repo with the id of: ${repoID}`
    );
    const protectedBranches = await getRepoProtectedBranches({
      repoID,
      gitHeaders,
    });

    if (protectedBranches?.status !== 200) {
      logEvent(
        `[GIT_UTILS_ERROR] Failed to get repo protected branches: ${protectedBranches?.status}`
      );
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to get repo protected branches!',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'git_get_protected_branches',
          details: { status: protectedBranches?.status },
        }
      );
    }

    const protectedBranchesNames = protectedBranches?.data.map(
      (item) => item?.name
    );

    const unProtectedBranches = branchesThatMustBeProtected.filter(
      (item) => !protectedBranchesNames.includes(item)
    );
    const alreadyProtectedBranches = branchesThatMustBeProtected.filter(
      (item) => protectedBranchesNames.includes(item)
    );

    await Promise.all(
      unProtectedBranches.map(async (branch) =>
        createRepoProtectedBranch({
          repoID,
          name: branch,
          allowedToMerge: protectedBranchesPermissions[branch],
          allowedToPush: protectedBranchesPermissions[branch],
          gitHeaders,
        })
      )
    );

    await Promise.all(
      alreadyProtectedBranches.map(async (branch) =>
        deleteRepoProtectedBranch({
          repoID,
          name: branch,
          gitHeaders,
        })
      )
    );

    await Promise.all(
      alreadyProtectedBranches.map(async (branch) =>
        createRepoProtectedBranch({
          repoID,
          name: branch,
          allowedToMerge: protectedBranchesPermissions[branch],
          allowedToPush: protectedBranchesPermissions[branch],
          gitHeaders,
        })
      )
    );
  } catch (error) {
    logEvent(
      `[Error]: Failed to ensure all protected branches [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function ensureRepoEnvVariables({
  repoID,
  defaultVariables,
  type,
  gitHeaders,
  extraVariables = {}, // Add this
} = {}) {
  try {
    logEvent(
      `Making sure all env variables exists for repo with the id of: ${repoID}`
    );
    const envVariables = await getRepoEnvVariables({
      repoID,
      gitHeaders,
    });

    if (envVariables?.status !== 200) {
      logEvent(
        `[GIT_UTILS_ERROR] Failed to get repo env variables: ${envVariables?.status}`
      );
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to get repo env variables!',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'git_get_env_variables',
          details: { status: envVariables?.status },
        }
      );
    }

    const variablesToCreate = {
      ...defaultVariables[type],
      ...extraVariables, // Merge extra variables
    };

    const variablesMustBeCreated = Object.keys(variablesToCreate);
    const envVariablesKeys = envVariables?.data.map((item) => item?.key);

    const envVariablesThatDontExists = variablesMustBeCreated.filter(
      (item) => !envVariablesKeys.includes(item)
    );
    const alreadyCreatedEnvVariables = variablesMustBeCreated.filter((item) =>
      envVariablesKeys.includes(item)
    );

    await Promise.all(
      envVariablesThatDontExists.map(async (envVariable) =>
        createRepoEnvVariable({
          repoID,
          gitHeaders,
          ...variablesToCreate[envVariable],
        })
      )
    );

    await Promise.all(
      alreadyCreatedEnvVariables.map(async (envVariable) =>
        deleteRepoEnvVariable({
          repoID,
          key: envVariable,
          gitHeaders,
        })
      )
    );

    await Promise.all(
      alreadyCreatedEnvVariables.map(async (envVariable) =>
        createRepoEnvVariable({
          repoID,
          gitHeaders,
          ...variablesToCreate[envVariable],
        })
      )
    );
  } catch (error) {
    logEvent(
      `[Error]: Failed to ensure all env variables [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function setRepoSettings({
  repoID,
  type,
  gitHeaders,
  defaultBranches,
  protectedBranchesPermissions,
  defaultVariables,
  defaultBranch,
  defaultBranchRef,
  extraVariables = {}, // Add this
} = {}) {
  try {
    logEvent(`Changing repo settings of: ${repoID}`);

    await ensureBranchesExist({
      repoID,
      branchesThatMustExists: defaultBranches,
      defaultBranchRef,
      gitHeaders,
    });

    await ensureProtectedBranches({
      repoID,
      branchesThatMustBeProtected: defaultBranches,
      protectedBranchesPermissions,
      gitHeaders,
    });

    await ensureRepoEnvVariables({
      repoID,
      defaultVariables,
      type,
      gitHeaders,
      extraVariables, // Pass it down
    });

    // set default branch
    const setDefaultBranchResp = await setDefaultBranch({
      repoID,
      name: defaultBranch,
      gitHeaders,
    });

    if (
      setDefaultBranchResp?.status !== 200 &&
      setDefaultBranchResp?.status !== 201
    ) {
      logEvent(
        `[GIT_UTILS_ERROR] Failed to set default branch: ${setDefaultBranchResp?.status}`
      );
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to set default branch!',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'git_set_default_branch',
          details: { status: setDefaultBranchResp?.status },
        }
      );
    }

    // env variables
  } catch (error) {
    logEvent(
      `[Error]: Failed to change repo settings [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function setRepoTriggers({ repoID, gitHeaders } = {}) {
  try {
    logEvent(`Setting triggers of: ${repoID}`);

    // triggers
    const triggers = await getRepoTriggers({
      repoID,
      gitHeaders,
    });

    if (triggers?.status !== 200) {
      logEvent(
        `[GIT_UTILS_ERROR] Failed to get repo triggers: ${triggers?.status}`
      );
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to get repo triggers!',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'git_get_repo_triggers',
          details: { status: triggers?.status },
        }
      );
    }

    let computeTrigger = triggers?.data.find(
      (item) => item.description === 'Compute Trigger'
    );

    if (!computeTrigger) {
      const computeTriggerResp = await createRepoTrigger({
        repoID,
        description: 'Compute Trigger',
        gitHeaders,
      });

      if (
        computeTriggerResp?.status !== 200 &&
        computeTriggerResp?.status !== 201
      ) {
        logEvent(
          `[GIT_UTILS_ERROR] Failed to create repo triggers: ${computeTriggerResp?.status}`
        );
        throw createStandardError(
          ERROR_TYPES.INTERNAL,
          'Failed to create repo triggers!',
          {
            severity: ERROR_SEVERITY.HIGH,
            context: 'git_create_repo_triggers',
            details: { status: computeTriggerResp?.status },
          }
        );
      }
      computeTrigger = computeTriggerResp?.data;
    }

    return computeTrigger;
  } catch (error) {
    logEvent(
      `[Error]: Failed to set repo triggers [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function cloneRepo({ repoPath, location, gitCloneCredentials } = {}) {
  try {
    if (
      !gitCloneCredentials?.username ||
      !gitCloneCredentials?.accessToken ||
      !GIT_HOST_WITHOUT_HTTP_AND_HTTPS ||
      !GIT_HOST_WITHOUT_HTTP_AND_HTTPS.length
    ) {
      logEvent(
        `[GIT_UTILS_ERROR] Git clone credentials not setup: ${!GIT_HOST_WITHOUT_HTTP_AND_HTTPS?.length}`
      );
      throw createStandardError(
        ERROR_TYPES.BAD_REQUEST,
        'Please setup git clone credentials first!',
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'git_clone_setup',
          details: { hasGitHost: !!GIT_HOST_WITHOUT_HTTP_AND_HTTPS?.length },
        }
      );
    }
    await runCommand('git', [
      'clone',
      `https://${gitCloneCredentials?.username}:${gitCloneCredentials?.accessToken}@${GIT_HOST_WITHOUT_HTTP_AND_HTTPS}/${repoPath}`,
      location,
    ]);
  } catch (error) {
    logEvent(
      `[Error]: Failed to clone repo [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function changeBranchGit({ repoPath, branch } = {}) {
  try {
    await runCommand('git', ['checkout', branch], { cwd: repoPath });
  } catch (error) {
    logEvent(
      `[Error]: Failed to change branch git [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function addAllFilesToGit({ repoPath } = {}) {
  try {
    await runCommand('git', ['add', '.'], { cwd: repoPath });
  } catch (error) {
    logEvent(
      `[Error]: Failed to add all files to git [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function skipCherryPickToGit({ repoPath } = {}) {
  try {
    const resp = await runCommand(
      'git',
      ['cherry-pick', '--skip'],
      { cwd: repoPath },
      true
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to skip cherry-pick to git [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.stdoutData;
  }
}

async function cherryPickToGit({ repoPath, commitID } = {}) {
  try {
    const resp = await runCommand(
      'git',
      ['cherry-pick', '--strategy-option', 'theirs', commitID],
      { cwd: repoPath },
      true
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to cherry-pick to git [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.stdoutData;
  }
}

async function mergeToGit({ repoPath, fromBranch } = {}) {
  try {
    const resp = await runCommand(
      'git',
      ['merge', '--strategy-option', 'theirs', fromBranch],
      { cwd: repoPath },
      true
    );
    return resp;
  } catch (error) {
    logEvent(
      `[Error]: Failed to merge to git [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.stdoutData;
  }
}

async function commitToGit({ repoPath, commitMessage } = {}) {
  try {
    await runCommand('git', ['commit', '-m', commitMessage], { cwd: repoPath });
  } catch (error) {
    logEvent(
      `[Error]: Failed to commit to git [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function pullFromGit({ repoPath, branch } = {}) {
  try {
    await runCommand('git', ['pull', 'origin', branch], { cwd: repoPath });
  } catch (error) {
    logEvent(
      `[Error]: Failed to pull from git [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

async function pushToGit({ repoPath, branch } = {}) {
  try {
    await runCommand('git', ['push', 'origin', branch], { cwd: repoPath });
  } catch (error) {
    logEvent(
      `[Error]: Failed to push to git [Reason]: ${
        error?.message || 'Git API request failed'
      }`
    );
    return error?.response;
  }
}

module.exports = {
  getGroupDetails,
  createGroup,
  getRepoDetails,
  createRepo,
  deleteRepo,
  getRepoCommits,
  setRepoSettings,
  setRepoTriggers,
  cloneRepo,
  changeBranchGit,
  addAllFilesToGit,
  skipCherryPickToGit,
  cherryPickToGit,
  mergeToGit,
  commitToGit,
  pullFromGit,
  pushToGit,
};
