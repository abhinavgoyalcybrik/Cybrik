import razorpay
from django.conf import settings
from rest_framework.exceptions import ValidationError

class RazorpayService:
    def __init__(self):
        self.client = razorpay.Client(
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
        )

    def create_order(self, amount, currency='INR', receipt=None, notes=None):
        """
        Create an order in Razorpay.
        Amount should be in the smallest currency unit (e.g., paise for INR).
        """
        try:
            data = {
                'amount': int(amount),  # Amount in paise
                'currency': currency,
                'receipt': receipt,
                'notes': notes or {}
            }
            order = self.client.order.create(data=data)
            return order
        except Exception as e:
            raise ValidationError(f"Error creating Razorpay order: {str(e)}")

    def verify_payment_signature(self, payment_id, order_id, signature):
        """
        Verify the payment signature returned by Razorpay.
        """
        try:
            params_dict = {
                'razorpay_order_id': order_id,
                'razorpay_payment_id': payment_id,
                'razorpay_signature': signature
            }
            # verify_payment_signature returns None on success, raises an error on failure
            self.client.utility.verify_payment_signature(params_dict)
            return True
        except Exception as e:
            # You might want to log the error here
            return False
