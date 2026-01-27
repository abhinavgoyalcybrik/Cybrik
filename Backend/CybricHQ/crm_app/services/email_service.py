import logging
from django.conf import settings
from django.core.mail import send_mail
from .ai_analyzer import CallAnalyzer

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.analyzer = CallAnalyzer()

    def generate_follow_up_email(self, applicant_name, interest_level, concerns, key_points):
        """
        Generate personalized follow-up email content using AI or templates
        """
        if not applicant_name:
            applicant_name = "there"

        subject = "Your application to CybricHQ"
        body = ""

        if interest_level == 'high':
            subject = "Next Steps for your CybricHQ Application 🚀"
            body = f"""Hi {applicant_name},

It was great connecting with you! We're thrilled to hear about your interest in our programs.

Based on our conversation, I think you'd be a fantastic fit. We discussed:
{self._format_points(key_points)}

I know you had some questions about:
{self._format_points(concerns)}

I'd love to help you move forward. The next step is to submit your documents.

Best regards,
Admissions Team
"""
        elif interest_level == 'medium':
            subject = "Information about CybricHQ Programs"
            body = f"""Hi {applicant_name},

Thanks for your time today. I hope I was able to answer your questions about CybricHQ.

Here's a quick recap of what we discussed:
{self._format_points(key_points)}

If you're ready to apply or have more questions, just reply to this email!

Best,
Admissions Team
"""
        else:
            subject = "Thank you for contacting CybricHQ"
            body = f"""Hi {applicant_name},

Thank you for speaking with us today.

If you decide to pursue your studies with us in the future, please don't hesitate to reach out.

Best,
Admissions Team
"""
        
        return subject, body

    def _format_points(self, points):
        if not points:
            return ""
        return "\n".join([f"- {point}" for point in points])

    def send_follow_up(self, applicant, analysis_result):
        """
        Send follow-up email based on analysis
        """
        try:
            if not applicant.email:
                logger.warning(f"No email for applicant {applicant.id}")
                return False

            interest = analysis_result.get('interest_level', 'medium')
            concerns = analysis_result.get('concerns', [])
            key_points = analysis_result.get('key_points', [])

            subject, body = self.generate_follow_up_email(
                applicant.first_name, 
                interest, 
                concerns, 
                key_points
            )

            # In production, use send_mail
            # send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [applicant.email])
            
            logger.info(f"Generated email for {applicant.email}: {subject}")

            
            return True
        except Exception as e:
            logger.error(f"Error sending email to {applicant.email}: {e}")
            return False
