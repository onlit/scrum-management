const BASE_URL = 'https://pm.pullstream.com/api';
const PROJECT_ID = 'f599f9fd-cac2-4c5e-b39f-20fde85e1b1f';

const RESOURCES = {
  Umer: '4ba84c35-05ba-4e62-98cd-0b14824a52a6',
  Touseef: '37bed1cd-b999-4501-9fb7-7697df0d4747',
  Abdullah: '320b0e24-c4e2-400a-bed0-e48f42587aff',
  Hamza: '7c5eafb5-a524-4b1f-b99e-d206db462ea3',
};

const TASK_STATUSES = {
  TODO: 'f323b003-f15e-4d5f-8125-98183735faea',
  IN_PROGRESS: 'a3a16b09-a669-4592-ac20-9b5969912cab',
  BLOCKED: 'c70d0ca5-9997-41fb-a8df-1e3f7feca4b2',
  TESTING: '44fc34a3-6ffc-4eba-af98-7ab58018db1b',
  FAILED_TESTING: '46276100-a07d-4e28-89a6-5fa172111c73',
  DONE: '4cc2307c-b3da-4590-adeb-b1458f96e333',
  DEPLOYED: 'ecf4cac6-7dd0-4fe6-9cc0-9aba5eb09295',
  DEFERRED: 'c10cbc21-ce67-4cf0-a7e6-5e8fb06681e9',
};

const SPRINTS = {
  SPRINT_1: 'a6860db6-d458-4eed-99b6-c2ae558457ba',
  SPRINT_2: 'a1ac537b-1c73-4d3c-b639-e00909110a37',
  SPRINT_3: 'aab5ccfe-a89c-48e8-a923-46c6893f275e',
  SPRINT_4: '373612a4-55f3-479f-b400-d468602e0df0',
};

const DURATION_UNIT = 'Minutes';

module.exports = {
  BASE_URL,
  PROJECT_ID,
  RESOURCES,
  TASK_STATUSES,
  SPRINTS,
  DURATION_UNIT,
};
