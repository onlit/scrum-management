/**
 * CREATED BY: Claude Code Assistant
 * CREATION DATE: 2025-01-17
 *
 * DESCRIPTION:
 * ------------------
 * Git repository cleanup utilities for removing generated microservice repositories
 * from GitLab and cleaning up local clones.
 */

const path = require('path');
const axios = require('axios');
const {
  createStandardError,
  withErrorHandling,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY, COMPUTE_PATH } = require('#configs/constants.js');
const { GITLAB_HOST } = require('#configs/gitlab.js');
const {
  logWithTrace,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
} = require('#utils/shared/traceUtils.js');
const { deleteDirIfExists } = require('#utils/shared/fileUtils.js');

/**
 * Deletes all container registry tags for a given GitLab repository.
 * @param {Object} params - Parameters
 * @param {string} params.repoPath - GitLab path with namespace (e.g., 'group/repo-name')
 * @param {string} params.gitlabToken - GitLab access token
 * @param {string} params.gitlabUrl - GitLab instance URL
 * @param {Object} params.req - Request object for trace ID context
 */
const deleteContainerRegistryTags = withErrorHandling(
  async ({
    repoPath,
    gitlabToken,
    gitlabUrl = GITLAB_HOST,
    req,
  }) => {
    logOperationStart('deleteContainerRegistryTags', req, { repoPath });
    const encodedPath = encodeURIComponent(repoPath);
    const axiosConfig = {
      headers: { 'Private-Token': gitlabToken },
    };

    try {
      // 1. List all container repositories in the project
      const reposUrl = `${gitlabUrl}/api/v4/projects/${encodedPath}/registry/repositories`;
      const reposResponse = await axios.get(reposUrl, axiosConfig);
      const repositories = reposResponse.data;

      if (!repositories || repositories.length === 0) {
        logWithTrace('No container repositories found for project. Nothing to delete.', req, { repoPath });
        logOperationSuccess('deleteContainerRegistryTags', req, { repoPath, status: 'No repositories found' });
        return;
      }

      logWithTrace(`Found ${repositories.length} container repositories.`, req, { repoPath });

      // 2. Iterate through each repository to delete its tags
      for (const repo of repositories) {
        // 2a. List all tags for the repository
        const tagsUrl = `${gitlabUrl}/api/v4/projects/${encodedPath}/registry/repositories/${repo.id}/tags`;
        const tagsResponse = await axios.get(tagsUrl, axiosConfig);
        const tags = tagsResponse.data;

        if (!tags || tags.length === 0) {
          logWithTrace(`No tags found for repository ${repo.path}.`, req, { repoId: repo.id });
          continue;
        }

        logWithTrace(`Found ${tags.length} tags for repository ${repo.path}. Preparing to delete.`, req, { repoId: repo.id });
        
        // 2b. Create a promise for each tag deletion to run them in parallel
        const deletionPromises = tags.map(tag => {
          const deleteTagUrl = `${gitlabUrl}/api/v4/projects/${encodedPath}/registry/repositories/${repo.id}/tags/${encodeURIComponent(tag.name)}`;
          return axios.delete(deleteTagUrl, axiosConfig);
        });

        // 2c. Execute all deletions
        await Promise.all(deletionPromises);
        logWithTrace(`Successfully deleted ${tags.length} tags for repository ${repo.path}.`, req, { repoId: repo.id });
      }

      logOperationSuccess('deleteContainerRegistryTags', req, { repoPath });

    } catch (error) {
      // If the project has no container registry at all, GitLab returns a 404. This is not an error.
      if (error.response?.status === 404) {
        logWithTrace('Container registry not found for project (this is OK).', req, { repoPath });
        logOperationSuccess('deleteContainerRegistryTags', req, { repoPath, status: 'Registry not found' });
        return;
      }
      logOperationError('deleteContainerRegistryTags', req, error);
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to delete container registry tags',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'container_registry_deletion',
          details: { repoPath, error: error.message },
        }
      );
    }
  },
  'container_registry_deletion'
);

/**
 * Permanently deletes a GitLab repository, strictly following the re-fetch logic.
 * @param {Object} params - Parameters for repository deletion
 * @param {string} params.repoPath - The original GitLab path (e.g., 'group/repo-name')
 * @param {string} params.gitlabToken - GitLab access token
 * @param {string} params.gitlabUrl - GitLab instance URL
 * @param {Object} params.req - Request object for trace ID context
 */
const deleteGitLabRepository = withErrorHandling(
  async ({ repoPath, gitlabToken, gitlabUrl = GITLAB_HOST, req }) => {
    logOperationStart('deleteGitLabRepository', req, { repoPath });
    const encodedPath = encodeURIComponent(repoPath);
    const axiosConfig = { headers: { 'Private-Token': gitlabToken } };

    try {
      // Preliminary Step: Get project details to retrieve its ID.
      logWithTrace('Fetching project ID...', req, { repoPath });
      const projectDetailsResponse = await axios.get(`${gitlabUrl}/api/v4/projects/${encodedPath}`, axiosConfig);
      const projectId = projectDetailsResponse.data.id;
      logWithTrace(`Found project ID: ${projectId}`, req, { repoPath });

      // Step 0: Clean up container registry.
      logWithTrace('Step 0: Cleaning up project container registry...', req, { repoPath });
      await deleteContainerRegistryTags({ repoPath, gitlabToken, gitlabUrl, req });

      // Step 1: Mark the project for deletion using its ID.
      logWithTrace('Step 1: Marking project for deletion...', req, { projectId });
      await axios.delete(`${gitlabUrl}/api/v4/projects/${projectId}`, axiosConfig);
      logWithTrace('Step 1: Project successfully marked for deletion.', req, { projectId });

      // Step 2: Re-fetch the project by ID to get its new `path_with_namespace`.
      logWithTrace('Step 2: Re-fetching project details to get new path...', req, { projectId });
      const refetchedProject = await axios.get(`${gitlabUrl}/api/v4/projects/${projectId}`, axiosConfig);
      const newPathWithNamespace = refetchedProject.data.path_with_namespace;
      if (!newPathWithNamespace) {
        throw new Error('Could not resolve new path_with_namespace after marking for deletion.');
      }
      logWithTrace(`Step 2: Resolved new project path: ${newPathWithNamespace}`, req, { projectId });

      // Step 3: Issue the permanent delete command using the new path.
      const permanentDeleteUrl = `${gitlabUrl}/api/v4/projects/${projectId}?permanently_remove=true&full_path=${encodeURIComponent(newPathWithNamespace)}`;
      logWithTrace('Step 3: Issuing command to permanently delete project...', req, { newPathWithNamespace });
      await axios.delete(permanentDeleteUrl, axiosConfig);
      
      logWithTrace('Step 3: Successfully and permanently deleted GitLab repository.', req, { repoPath });
      logOperationSuccess('deleteGitLabRepository', req, { repoPath });

    } catch (error) {
      logOperationError('deleteGitLabRepository', req, error);
      if (error.response?.status === 404) {
        logWithTrace('Project not found during operation (already deleted). Success.', req, { repoPath });
        logOperationSuccess('deleteGitLabRepository', req, { repoPath, status: 'Already deleted' });
        return;
      }
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to delete GitLab repository',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'gitlab_repository_deletion',
          details: { repoPath, error: error.message, gitlabResponse: error.response?.data },
        }
      );
    }
  },
  'gitlab_repository_deletion'
);

/**
 * Cleans up all GitLab repositories for a microservice
 * @param {Object} params - Cleanup parameters
 * @param {string} params.microserviceName - Name of the microservice
 * @param {string} params.microserviceSlug - Microservice slug
 * @param {string} params.gitlabToken - GitLab access token
 * @param {string} params.gitlabUrl - GitLab instance URL
 * @param {string} params.groupNamespace - GitLab group namespace (e.g., 'pullstream/microservices')
 * @param {Object} params.req - Request object for trace ID context
 */
const cleanupMicroserviceRepositories = withErrorHandling(
  async ({
    microserviceName,
    microserviceSlug,
    gitlabToken,
    gitlabUrl = GITLAB_HOST,
    groupNamespace = 'pullstream/microservices',
    req,
  }) => {
    const repositories = [
      `${groupNamespace}/${microserviceSlug}/${microserviceSlug}-rapi`,
      `${groupNamespace}/${microserviceSlug}/${microserviceSlug}-fe`,
      `${groupNamespace}/devops/${microserviceSlug}/${microserviceSlug}-k8s`,
    ];

    logOperationStart('cleanupMicroserviceRepositories', req, {
      microserviceName,
      microserviceSlug,
      repositoryCount: repositories.length,
    });

    const deletePromises = repositories.map((repoPath) =>
      deleteGitLabRepository({
        repoPath,
        gitlabToken,
        gitlabUrl,
        req,
      }).catch((error) => {
        // Log error but don't fail the entire cleanup process
        logWithTrace('Repository cleanup failed', req, {
          repoPath,
          error: error.message,
        });
      })
    );

    await Promise.all(deletePromises);

    logOperationSuccess('cleanupMicroserviceRepositories', req, {
      microserviceName,
      processedRepositories: repositories.length,
    });
  },
  'microservice_repository_cleanup'
);

/**
 * Removes local git clones of repositories
 * @param {Array} clonePaths - Array of local clone paths to remove
 * @param {Object} req - Request object for trace ID context
 */
const removeLocalClones = withErrorHandling(async (clonePaths, req) => {
  logOperationStart('removeLocalClones', req, {
    clonePathCount: clonePaths.length,
  });

  const removePromises = clonePaths
    .filter((path) => path) // Filter out null/undefined paths
    .map(async (clonePath) => {
      try {
        await deleteDirIfExists(clonePath);
        logWithTrace('Removed local clone', req, { clonePath });
      } catch (error) {
        logOperationError('removeLocalClones', req, error);
        logWithTrace('Failed to remove local clone', req, {
          clonePath,
          error: error.message,
        });
      }
    });

  await Promise.all(removePromises);

  logOperationSuccess('removeLocalClones', req, {
    processedPaths: clonePaths.filter((p) => p).length,
  });
}, 'local_clone_removal');

/**
 * Removes the entire computeOutput directory for a microservice.
 * This is a fallback cleanup that doesn't require successful cloning.
 * @param {string} microserviceSlug - The microservice slug (e.g., 'lists-v2')
 * @param {Object} req - Request object for tracing
 */
const removeComputeOutputDirectory = withErrorHandling(
  async (microserviceSlug, req) => {
    if (!microserviceSlug) {
      logWithTrace('No microservice slug provided for output cleanup', req);
      return;
    }

    const outputDir = path.join(COMPUTE_PATH, microserviceSlug);

    logOperationStart('removeComputeOutputDirectory', req, {
      microserviceSlug,
      outputDir,
    });

    await deleteDirIfExists(outputDir);

    logOperationSuccess('removeComputeOutputDirectory', req, {
      microserviceSlug,
      outputDir,
    });
  },
  'compute_output_directory_removal'
);

module.exports = {
  deleteGitLabRepository,
  cleanupMicroserviceRepositories,
  removeLocalClones,
  removeComputeOutputDirectory,
};
