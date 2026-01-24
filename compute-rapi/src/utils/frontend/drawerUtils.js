const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const {
  getInternalBulkCreateSubmenusURL,
  getInternalMenusPublishURL,
} = require('#configs/routes.js');
const { convertToSlug } = require('#utils/shared/stringUtils.js');
const { resolveModelSlug } = require('#utils/api/commonUtils.js');
const { logWithTrace } = require('#utils/shared/traceUtils.js');

// /**
//  * Ensures the "Form Flows" node exists in the payload, creating it if necessary.
//  * @param {Object} payload - The payload object containing children.
//  * @returns {Object} - The "Form Flows" node.
//  */
// function getOrCreateFormFlowsNode(payload) {
//   let formFlowsNode = payload?.children?.find(
//     (child) => child.label === 'Form Flows'
//   );

//   if (!formFlowsNode) {
//     formFlowsNode = {
//       id: uuidv4(),
//       href: '',
//       label: 'Form Flows',
//       children: [],
//     };
//     payload?.children.unshift(formFlowsNode); // Add "Form Flows" as the first child.
//   }

//   return formFlowsNode;
// }

// /**
//  * Processes models to check for "useFormFlow" and adds them to the "Form Flows" node.
//  * @param {Object} payload - The payload object containing children.
//  * @param {Array} models - List of models to process.
//  * @param {string} microserviceSlug - The slug of the microservice used in the URL.
//  */
// function addModelsToFormFlows(payload, models, microserviceSlug) {
//   // Filter models with useFormFlow enabled before processing
//   const formFlowModels = models.filter((model) => model?.useFormFlow);

//   if (formFlowModels.length === 0) {
//     return; // Exit early if no models require Form Flows
//   }

//   const formFlowsNode = getOrCreateFormFlowsNode(payload);

//   // Add all form flow models to the Form Flows node in one operation
//   formFlowsNode.children.push(
//     ...formFlowModels.map((model) => ({
//       id: model?.id,
//       href: `/${microserviceSlug}/ff/${convertModelNameToSlug(model?.name)}`,
//       label: `${model?.label ?? toStartCase(model?.name)} Create`,
//       children: [],
//     }))
//   );
// }

/**
 * Creates a "Form Flows" menu item under the main microservice menu,
 * and adds submenus for each model with `useFormFlow: true`.
 * Uses the bulk-create-menus API.
 * @param {object} microservice - The microservice object (must have id and name).
 * @param {Array<object>} models - List of models for the microservice.
 */
async function addFormFlowsToMenu(microservice, models, context) {
  // Validate input
  if (!microservice?.id || !microservice?.name) {
    logWithTrace(
      'addFormFlowsToMenu: Invalid microservice data provided (requires id and name).',
      context,
      { microservice }
    );
    return;
  }

  // Filter models that use Form Flow
  const formFlowModels = models?.filter((model) => model?.useFormFlow) ?? [];

  if (formFlowModels.length === 0) {
    logWithTrace(
      `addFormFlowsToMenu: No models with 'useFormFlow: true' found for microservice ${microservice.name}. No Form Flow menus created.`,
      context,
      { microservice }
    );
    return; // Nothing to do
  }

  logWithTrace(
    `addFormFlowsToMenu: Found ${formFlowModels.length} form flow models for ${microservice.name}. Preparing menus...`,
    context,
    { microservice }
  );

  const formFlowsMenuId = uuidv4();
  logWithTrace(
    `addFormFlowsToMenu: Generated Form Flows menu ID: ${formFlowsMenuId} for microservice ${microservice.id}`,
    context,
    { microservice }
  );

  const microserviceSlug = convertToSlug(microservice.name);

  // Prepare the sub_menus array
  const sub_menus = formFlowModels.map((model, index) => {
    const modelSlug = resolveModelSlug(model);
    const label = `${model.label ?? model.name}`; // Consistent label format
    const href = `/${microserviceSlug}/ff/${modelSlug}`; // Consistent href format

    return {
      order: index + 1, // Simple ordering
      category: 'Compute', // Category from example payload
      label,
      href,
      is_published: true,
      is_group: true,
    };
  });

  // Construct the payload for the bulk API
  const payload = {
    microserviceId: microservice.id,
    menus: [
      {
        // This 'menu' object defines the "Form Flows" parent menu itself
        menu: {
          id: formFlowsMenuId,
          order: 2,
          is_published: true,
          is_group: true,
          category: 'Compute',
          label: 'Form Flows',
        },
        // These 'sub_menus' will be children of the "Form Flows" menu defined above
        sub_menus,
      },
    ],
  };

  // Make the API call
  try {
    logWithTrace('Sending request to BULK_CREATE_MENU_URL', context);
    // console.log('Payload:', JSON.stringify(payload, null, 2)); // Uncomment for deep debugging

    const response = await axios.post(
      getInternalBulkCreateSubmenusURL(),
      payload
    );

    logWithTrace(
      `addFormFlowsToMenu: Successfully created/updated Form Flow menus for microservice ${microservice.name}.`,
      context,
      { microservice }
    );
    if (process.env.NODE_ENV === 'development') {
      logWithTrace(
        `[MENU_API] Created ${response.data?.length || 0} menu items`,
        context
      );
    }
    return response.data; // Return the API response
  } catch (error) {
    const errorStatus = error.response?.status;
    logWithTrace(
      `addFormFlowsToMenu: Error creating Form Flow menus for microservice ${microservice.name}: ${error.message}`,
      context,
      { error: error?.response?.data ?? error?.message }
    );
    if (errorStatus) {
      logWithTrace(`addFormFlowsToMenu: Status Code: ${errorStatus}`, context);
    }
    logWithTrace('addFormFlowsToMenu" Failed Request Payload:', context, {
      payload,
    });
    // Consider how to handle failures - maybe throw, maybe return null/error indicator
    return null;
  }
}

async function modifyDrawerLinksFile(microservice, models, context) {
  try {
    await addFormFlowsToMenu(microservice, models, context);

    const { data } = await axios.post(getInternalMenusPublishURL(), {
      microserviceId: microservice.id,
      isPublished: true,
    });

    logWithTrace(
      '[MENU_PUBLISH_SUCCESS] Successfully published menu',
      context,
      data
    );
  } catch (error) {
    logWithTrace('modifyDrawerLinksFile', context, {
      error: error?.response?.data ?? error?.message,
    });
  }
}

async function removeMicroserviceFromDrawer(microservice, context) {
  try {
    const { data } = await axios.post(getInternalMenusPublishURL(), {
      microserviceId: microservice.id,
      isPublished: false,
    });

    logWithTrace(
      '[MENU_DELETE_SUCCESS] Successfully deleted menu',
      context,
      data
    );
  } catch (error) {
    logWithTrace('[MENU_DELETE_ERROR] Failed to delete menu', context, {
      error: error?.response?.data ?? error?.message,
    });
  }
}

module.exports = {
  modifyDrawerLinksFile,
  removeMicroserviceFromDrawer,
};
