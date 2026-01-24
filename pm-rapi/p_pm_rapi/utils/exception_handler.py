import logging
from rest_framework.views import exception_handler


logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    # Call REST framework's default exception handler first,
    # to get the standard error response.
    response = exception_handler(exc, context)

    # If the response is a 400 (Bad Request), log the details
    if response is not None and response.status_code == 400:
        request = context.get('request')

        logger.error("--- BAD REQUEST DETAILED LOG ---")

        # Log the specific validation errors (e.g., "Field 'x' is required")
        logger.error(f"Errors: {response.data}")

        # Log the payload (be careful with sensitive data like passwords)
        if request:
            try:
                logger.error(f"Payload: {request.data}")
            except Exception:
                logger.error("Could not parse request data")

    return response
