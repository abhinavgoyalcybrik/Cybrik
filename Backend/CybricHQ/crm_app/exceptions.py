"""
Custom exception handler for better error formatting.
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response


def custom_exception_handler(exc, context):
    """
    Custom exception handler that provides user-friendly error messages.
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    if response is not None:
        # Customize error format for better frontend display
        custom_response_data = {}
        
        if isinstance(response.data, dict):
            # Flatten nested validation errors and make them more readable
            for field, errors in response.data.items():
                if isinstance(errors, list):
                    # Join multiple errors for the same field
                    custom_response_data[field] = ' '.join(str(e) for e in errors)
                else:
                    custom_response_data[field] = str(errors)
        else:
            # Handle non-dict responses
            custom_response_data = {'detail': str(response.data)}
        
        response.data = custom_response_data

    return response
