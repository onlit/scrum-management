/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module provides the core functionality for integrating with the external
 * Automata service. It acts as a bridge between events in this application
 * and automated workflows defined in the Automata system.
 *
 * The primary function, `findWorkflowAndTrigger`, orchestrates the entire process:
 *
 * 1.  **Workflow Discovery:** It queries a central system service to determine if an
 *     automated workflow is associated with a specific data model and client.
 *
 * 2.  **Payload Construction:** It prepares a detailed JSON payload containing all
 *     relevant data from the application's model instance.
 *
 * 3.  **Workflow Triggering:** It calls the `triggerAutomata` helper function to
 *     initiate the workflow in the Automata system.
 *
 * 4.  **State Persistence:** Upon successful triggering, it updates the original
 *     model instance with the workflow ID and the new session ID returned by
 *     the Automata service, saving this state back to the database using Prisma.
 *
 * This allows other parts of the application to trigger complex, automated
 * processes simply by calling a single function after a model is created or updated.
 */

const axios = require('axios');
const { MS_NAME } = require('#configs/constants.js');
const {
  getAutomataTriggerURL,
  getAutomataConnectionWithAModelURL,
} = require('#configs/routes.js');

/**
 * Triggers a workflow in the Automata system.
 * This function catches its own errors and logs them, returning null on failure.
 *
 * @param {string} accessToken - The authorization token.
 * @param {string} workflow - The ID of the workflow to trigger.
 * @param {string} [workflowInstance=""] - The optional instance ID of the workflow.
 * @param {boolean} [manual=false] - Flag for manual triggering.
 * @param {object} [payload={}] - The data payload for the workflow.
 * @returns {Promise<object|null>} The JSON response from the Automata service on success, or null on failure.
 */
async function triggerAutomata(
  accessToken,
  workflow,
  workflowInstance = '',
  manual = false,
  payload = {}
) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers.Authorization = accessToken;
  }

  const body = {
    workflow_id: workflow,
    instance_id: workflowInstance,
    payload,
    manual,
  };

  try {
    const response = await axios.post(getAutomataTriggerURL(), body, {
      headers,
    });
    return response.data;
  } catch (error) {
    let errorMessage = `Failed to trigger Automata workflow '${workflow}'.`;
    if (error.response) {
      errorMessage += ` Status: ${error.response.status}`;
    } else if (error.request) {
      errorMessage += ' No response received from server.';
    } else {
      errorMessage += ` Error: ${error.message}`;
    }
    console.error(errorMessage);
    return null; // Return null to indicate failure
  }
}

/**
 * Finds a workflow configuration and then securely triggers it.
 * Errors are logged internally and the function will not throw.
 *
 * @param {object} prisma - The Prisma client instance.
 * @param {object} instance - The Prisma model instance that triggered the action. Must contain an 'id' property.
 * @param {string} modelName - The name of the model (e.g., "workInquiry").
 * @param {string} clientId - The ID of the client associated with the request.
 * @param {object} [custom={}] - Custom data to be added to the payload.
 * @param {string} [accessToken=null] - The authorization token.
 * @returns {Promise<void>}
 */
async function findWorkflowAndTrigger(
  prisma,
  instance,
  modelName,
  clientId,
  custom = {},
  accessToken = null
) {
  const headers = {};
  if (accessToken) {
    headers.Authorization = accessToken;
  }

  const discoveryUrl = getAutomataConnectionWithAModelURL({
    query: `${MS_NAME}/${modelName}/`,
  });

  try {
    // 1. Find the workflow configuration
    const response = await axios.get(discoveryUrl, {
      params: { client: clientId },
      headers,
    });
    const { automata: workflowId } = response.data || {};

    if (!workflowId) {
      console.log(
        `No workflow found for model '${modelName}' and client '${clientId}'.`
      );
      return;
    }

    // 2. Prepare the payload
    const payload = { ...instance, ...custom };

    // 3. Trigger the Automata workflow
    const automataResponse = await triggerAutomata(
      accessToken,
      workflowId,
      '',
      false,
      payload
    );

    if (!automataResponse) {
      console.error(
        `Automata trigger failed for instance ${instance.id}. The process will not be saved.`
      );
      return;
    }

    const { instance: newWorkflowInstance } = automataResponse;

    // Robustness: Ensure the response contains the expected 'instance' property.
    if (!newWorkflowInstance) {
      console.error(
        `Automata response for workflow '${workflowId}' did not contain an 'instance' property. State will not be saved.`
      );
      return;
    }

    // 4. Persist the state
    await prisma[modelName].updateMany({
      where: { id: instance.id },
      data: {
        workflowId,
        workflowInstanceId: newWorkflowInstance,
      },
    });

    console.log(
      `Successfully triggered and saved workflow '${workflowId}' for ${modelName} instance '${instance.id}'.`
    );
  } catch (error) {
    // This catch block handles errors during the workflow discovery (the first axios.get call).
    let errorMessage = `Failed to find workflow for model '${modelName}' and client '${clientId}'.`;
    const requestUrl = error.config?.url || discoveryUrl; // Safely access the URL
    if (error.response) {
      errorMessage += ` Status: ${error.response.status}, URL: ${requestUrl}`;
    } else {
      errorMessage += ` Error: ${error.message}`;
    }
    console.error(errorMessage);
  }
}

module.exports = {
  findWorkflowAndTrigger,
  triggerAutomata,
};
