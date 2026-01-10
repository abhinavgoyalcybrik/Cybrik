from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from .models import Lead, Applicant, Application

class GlobalSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip().rstrip("/")
        if not query or len(query) < 2:
            return Response([])

        results = []

        # Search Leads
        leads = Lead.objects.filter(
            Q(name__icontains=query) | 
            Q(email__icontains=query) | 
            Q(phone__icontains=query) |
            Q(id__icontains=query)  # Added ID search
        )[:5]
        for lead in leads:
            results.append({
                "type": "Lead",
                "id": lead.id,
                "title": lead.name or "Unknown Lead",
                "subtitle": f"{lead.email or ''} {lead.phone or ''}".strip(),
                "link": f"/leads?id={lead.id}"
            })

        # Search Applicants
        applicants = Applicant.objects.filter(
            Q(first_name__icontains=query) | 
            Q(last_name__icontains=query) | 
            Q(email__icontains=query) | 
            Q(phone__icontains=query) |
            Q(id__icontains=query) # Added ID search
        )[:5]
        for app in applicants:
            results.append({
                "type": "Applicant",
                "id": app.id,
                "title": f"{app.first_name} {app.last_name}",
                "subtitle": f"{app.email or ''} {app.phone or ''}".strip(),
                "link": f"/applicants/{app.id}"
            })

        # Search Applications
        applications = Application.objects.filter(
            Q(applicant__first_name__icontains=query) |
            Q(applicant__last_name__icontains=query) |
            Q(program__icontains=query) |
            Q(id__icontains=query) # Added ID search
        )[:5]
        for application in applications:
            results.append({
                "type": "Application",
                "id": application.id,
                "title": f"App #{application.id}: {application.program}",
                "subtitle": f"{application.applicant.first_name} {application.applicant.last_name} - {application.status}",
                "link": f"/applications/{application.id}"
            })

        return Response(results)
