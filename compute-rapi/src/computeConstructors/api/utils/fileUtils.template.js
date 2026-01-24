/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file includes functions for file and directory operations such as deletion, copying, and modification. It supports both synchronous and asynchronous operations for handling files, with additional functionalities for conditional operations like deleting directories if they exist and logging during directory creation.
 *
 *
 */
const fs = require('fs');
const path = require('path');
const {
  rm,
  cp,
  access,
  mkdir,
  readdir,
  unlink,
  readFile,
  writeFile,
  stat,
} = require('fs/promises');
const { logStep } = require('#utils/loggingUtils.js');
const { getCurrentUtcDateInDDMMYYYY } = require('#utils/dateUtils.js');
const { getUserNameOrEmail } = require('#utils/stringUtils.js');
const { logEvent } = require('#utils/loggingUtils.js');
const { createStandardError } = require('#utils/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');

async function ensureDirExists(dirPath) {
  try {
    const isArray = Array.isArray(dirPath);
    const pathToCheck = isArray ? path.join(...dirPath) : dirPath;
    await access(pathToCheck);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      try {
        await mkdir(dirPath, { recursive: true });
      } catch (mkdirError) {
        logEvent(
          `[FILE_UTILS_ERROR] Error creating directory: ${mkdirError.message}`
        );
        throw createStandardError(
          ERROR_TYPES.INTERNAL,
          'Error creating directory',
          {
            severity: ERROR_SEVERITY.MEDIUM,
            context: 'ensure_dir_exists',
            originalError: mkdirError,
          }
        );
      }
    } else {
      logEvent(`[FILE_UTILS_ERROR] Error checking directory: ${error.message}`);
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Error checking directory',
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'ensure_dir_exists',
          originalError: error,
        }
      );
    }
  }
}

async function copyFolder(src, dest) {
  try {
    await cp(src, dest, { recursive: true });
  } catch (err) {
    logEvent(`[FILE_UTILS_ERROR] Error while copying folder: ${err.message}`);
    throw createStandardError(
      ERROR_TYPES.INTERNAL,
      'Error while copying folder',
      {
        severity: ERROR_SEVERITY.MEDIUM,
        context: 'copy_folder',
        originalError: err,
      }
    );
  }
}

async function copyFile(srcPath, destPath, replacements = {}) {
  // Read the content from the source file
  let data = await readFile(srcPath, 'utf-8');

  // Apply each replacement in the replacements object
  for (const [search, replaceWith] of Object.entries(replacements)) {
    const regex = new RegExp(search, 'g');
    data = data.replace(regex, replaceWith);
  }

  // Write the modified content to the destination file
  await writeFile(destPath, data, 'utf-8');
}

function addCreatorMeta({ path, user } = {}) {
  modifyFile(path, (fileContent) => {
    // Use the getCreatorName function to get the creator name
    const creatorName = getUserNameOrEmail(user);
    return fileContent
      .replaceAll('Umer Lachi', creatorName)
      .replaceAll('umer@pullstream.com', user?.email)
      .replaceAll('25/08/2025', getCurrentUtcDateInDDMMYYYY());
  });
}

async function createFileFromTemplate({
  destinationPathSegments,
  templatePathSegments,
  templateReplacements = {},
  user,
} = {}) {
  const newPath = path.join(...destinationPathSegments);
  const templatePath = path.join(...templatePathSegments);

  await ensureDirExists(path.join(...destinationPathSegments.slice(0, -1)));

  await copyFile(templatePath, newPath, templateReplacements);

  addCreatorMeta({ path: newPath, user });
}

async function deleteFile(filePath) {
  try {
    // Check if the file exists
    await access(filePath);
    // Delete the file
    await rm(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logEvent(`[FILE_UTILS_ERROR] ${filePath}: ${error.message}`);
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        `Failed to delete file: ${filePath}`,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'delete_file',
          originalError: error,
        }
      );
    }
  }
}

function deleteFileSync(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

async function deleteDir(dirPath) {
  await rm(dirPath, { recursive: true, force: true });
}

async function deleteDirContents(dirPath) {
  const files = await readdir(dirPath);

  for (const file of files) {
    // Skip the .git directory
    if (file === '.git') {
      continue;
    }

    const fullPath = path.join(dirPath, file);
    const fileStat = await stat(fullPath);

    if (fileStat.isDirectory()) {
      // Recursively delete the directory
      await deleteDir(fullPath);
    } else {
      // Delete the file
      await unlink(fullPath);
    }
  }
}

async function findAndReplace(path, search, replaceWith = '') {
  // Read the content from the source file
  let data = await readFile(path, 'utf-8'); // added encoding to read it as string

  // If a search string is provided, replace it recursively in the content
  if (search !== null) {
    const regex = new RegExp(search, 'g');
    data = data.replace(regex, replaceWith);
  }

  // Write the modified content to the destination file
  await writeFile(path, data, 'utf-8'); // added encoding for consistency
}

async function deleteDirContentsIfExists(dirPath) {
  try {
    await access(dirPath); // Check if the directory exists
    await deleteDirContents(dirPath); // Delete the directory contents
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logEvent(`[FILE_UTILS_ERROR] ${dirPath}: ${error.message}`);
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        `Failed to delete directory contents: ${dirPath}`,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'delete_dir_contents_if_exists',
          originalError: error,
        }
      );
    }
  }
}

async function deleteDirIfExists(dirPath) {
  try {
    await access(dirPath); // Check if the directory exists
    await deleteDir(dirPath); // Delete the directory and its contents
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logEvent(`[FILE_UTILS_ERROR] ${dirPath}: ${error.message}`);
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        `Failed to delete directory: ${dirPath}`,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'delete_dir_if_exists',
          originalError: error,
        }
      );
    }
  }
}

async function createDirWithLog(directory, description) {
  await logStep(description, async () => {
    return mkdir(directory, { recursive: true });
  });
}

function readFileSync(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeFileSync(filePath, fileContent) {
  return fs.writeFileSync(filePath, fileContent, 'utf8');
}

function modifyFile(filePath, modifyCallback) {
  let fileContent = readFileSync(filePath, 'utf8');
  fileContent = modifyCallback(fileContent);
  writeFileSync(filePath, fileContent);
}

async function cleanAndPrepareDir(dirPath) {
  await ensureDirExists(dirPath);
  await deleteDirContentsIfExists(dirPath);
}

async function modifyFileAsync(filePath, modifyCallback) {
  try {
    let fileContent = await readFile(filePath, 'utf8');

    // Apply the modification callback to the content
    fileContent = await modifyCallback(fileContent);

    // Write the modified content back to the file asynchronously
    await writeFile(filePath, fileContent);
  } catch (error) {
    logEvent(`[FILE_UTILS_ERROR] Error modifying file: ${error}`);
    throw createStandardError(ERROR_TYPES.INTERNAL, 'Error modifying file', {
      severity: ERROR_SEVERITY.MEDIUM,
      context: 'modify_file_async',
      originalError: error,
    });
  }
}

async function copyMultipleFiles(filesToCopy) {
  for (const { src, dest, replacements } of filesToCopy) {
    await copyFile(src, dest, replacements);
  }
}

module.exports = {
  createFileFromTemplate,
  findAndReplace,
  ensureDirExists,
  deleteFile,
  deleteFileSync,
  deleteDir,
  copyFile,
  deleteDirIfExists,
  deleteDirContentsIfExists,
  createDirWithLog,
  readFileSync,
  writeFileSync,
  modifyFile,
  addCreatorMeta,
  copyFolder,
  cleanAndPrepareDir,
  copyMultipleFiles,
};
