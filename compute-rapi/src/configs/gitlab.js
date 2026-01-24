// gitSettings

const gitCloneCredentials = {
  username: process.env.GIT_USERNAME,
  accessToken: process.env.GIT_ACCESS_TOKEN,
};

const gitHeaders = {
  headers: {
    'Content-Type': 'application/json',
    'PRIVATE-TOKEN': process.env.GIT_ACCESS_TOKEN,
  },
};

const defaultBranch = 'dev';
const defaultBranchRef = 'dev';

const defaultBranches = ['dev', 'staging', 'main'];

const protectedBranchesPermissions = {
  dev: [{ access_level: 30 }],
  staging: [{ access_level: 40 }],
  main: [{ access_level: 40 }],
};

const defaultVariables = {
  frontend: {
    DOCKER_TOKEN: {
      key: 'DOCKER_TOKEN',
      value: process.env.GIT_ENV_DOCKER_TOKEN,
      masked: true,
      _protected: true,
      variableType: 'env_var',
    },
  },
  restAPI: {
    DOCKER_TOKEN: {
      key: 'DOCKER_TOKEN',
      value: process.env.GIT_ENV_DOCKER_TOKEN,
      masked: true,
      _protected: true,
      variableType: 'env_var',
    },
  },
  devOps: {
    DOCKER_TOKEN: {
      key: 'DOCKER_TOKEN',
      value: process.env.GIT_ENV_DOCKER_TOKEN,
      masked: true,
      _protected: true,
      variableType: 'env_var',
    },
    PRIVATE_KEY: {
      key: 'PRIVATE_KEY',
      value: process.env.GIT_ENV_PRIVATE_KEY,
      masked: false,
      _protected: true,
      variableType: 'file',
    },
    SERVER_IP: {
      key: 'SERVER_IP',
      value: process.env.GIT_ENV_SERVER_IP,
      masked: true,
      _protected: true,
      variableType: 'env_var',
    },
    SERVER_PORT: {
      key: 'SERVER_PORT',
      value: process.env.GIT_ENV_SERVER_PORT,
      masked: false,
      _protected: true,
      variableType: 'env_var',
    },
    SERVER_USER: {
      key: 'SERVER_USER',
      value: process.env.GIT_ENV_SERVER_USER,
      masked: false,
      _protected: true,
      variableType: 'env_var',
    },
  },
};

const GITLAB_HOST = process.env.GITLAB_URL || process.env.GIT_HOST || 'https://git.pullstream.com';

module.exports = {
  gitCloneCredentials,
  gitHeaders,
  defaultBranch,
  defaultBranchRef,
  defaultBranches,
  protectedBranchesPermissions,
  defaultVariables,
  GITLAB_HOST,
};
