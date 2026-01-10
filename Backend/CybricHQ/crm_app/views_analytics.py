from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count, Sum, Q
from django.db.models.functions import TruncDate, TruncWeek
from django.utils import timezone
from django.utils.dateparse import parse_date
from datetime import timedelta
from .models import Lead, Applicant, Application, CallRecord

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_time_series(request):
    """
    Returns daily counts for Leads and Applicants.
    Supports ?start=YYYY-MM-DD&end=YYYY-MM-DD
    """
    end_date = parse_date(request.query_params.get("end")) or timezone.now().date()
    start_date = parse_date(request.query_params.get("start")) or (end_date - timedelta(days=30))

    # Leads over time
    leads_daily = Lead.objects.filter(received_at__date__range=[start_date, end_date])\
        .annotate(date=TruncDate('received_at'))\
        .values('date')\
        .annotate(count=Count('id'))\
        .order_by('date')

    # Applicants over time
    applicants_daily = Applicant.objects.filter(created_at__date__range=[start_date, end_date])\
        .annotate(date=TruncDate('created_at'))\
        .values('date')\
        .annotate(count=Count('id'))\
        .order_by('date')

    return Response({
        "leads": list(leads_daily),
        "applicants": list(applicants_daily)
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_funnel(request):
    """
    Returns counts for the conversion funnel.
    Supports ?start=YYYY-MM-DD&end=YYYY-MM-DD
    """
    start_str = request.query_params.get("start")
    end_str = request.query_params.get("end")
    
    # Base filters
    lead_filters = {}
    app_filters = {}
    application_filters = {}
    
    if start_str:
        start = parse_date(start_str)
        if start:
            lead_filters["received_at__date__gte"] = start
            app_filters["created_at__date__gte"] = start
            application_filters["created_at__date__gte"] = start
            
    if end_str:
        end = parse_date(end_str)
        if end:
            lead_filters["received_at__date__lte"] = end
            app_filters["created_at__date__lte"] = end
            application_filters["created_at__date__lte"] = end

    leads_count = Lead.objects.filter(**lead_filters).count()
    
    # Active Leads: Leads with high interest or good quality score from AI
    # We need to filter leads that have associated call records meeting criteria
    # Note: This might need more complex filtering if we want to respect date range for the *call* or the *lead*
    # For now, we filter leads created in range, and check if they EVER became active
    active_leads_query = Lead.objects.filter(**lead_filters).filter(
        Q(call_records__ai_quality_score__gte=60) | 
        Q(call_records__ai_analysis_result__interest_level__in=['high', 'medium'])
    ).distinct()
    active_leads_count = active_leads_query.count()

    applicants_count = Applicant.objects.filter(**app_filters).count()
    applications_count = Application.objects.filter(**application_filters).count()
    accepted_count = Application.objects.filter(status="accepted", **application_filters).count()

    return Response({
        "funnel": [
            {"stage": "Total Leads", "count": leads_count},
            {"stage": "Active Leads", "count": active_leads_count},
            {"stage": "Applicants", "count": applicants_count},
            {"stage": "Applications", "count": applications_count},
            {"stage": "Accepted", "count": accepted_count},
        ]
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_llm_usage(request):
    """
    Returns aggregated LLM usage stats from CallRecords (ElevenLabs).
    Supports ?start=YYYY-MM-DD&end=YYYY-MM-DD
    """
    start_str = request.query_params.get("start")
    end_str = request.query_params.get("end")
    
    filters = {"provider": "elevenlabs"}
    if start_str:
        start = parse_date(start_str)
        if start:
            filters["created_at__date__gte"] = start
    if end_str:
        end = parse_date(end_str)
        if end:
            filters["created_at__date__lte"] = end

    calls = CallRecord.objects.filter(**filters)
    
    total_calls = calls.count()
    total_seconds = calls.aggregate(sum=Sum('duration_seconds'))['sum'] or 0
    total_minutes = round(total_seconds / 60, 2)
    
    # Use stored cost if available, otherwise fallback to calculation
    # But since we backfilled, we should rely on stored cost for consistency
    total_cost = calls.aggregate(sum=Sum('cost'))['sum'] or 0.0

    return Response({
        "total_calls": total_calls,
        "total_minutes": total_minutes,
        "estimated_cost_usd": total_cost
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_applications_status(request):
    """
    Returns distribution of application statuses.
    Supports ?start=YYYY-MM-DD&end=YYYY-MM-DD
    """
    start_str = request.query_params.get("start")
    end_str = request.query_params.get("end")
    filters = {}
    if start_str:
        start = parse_date(start_str)
        if start:
            filters["created_at__date__gte"] = start
    if end_str:
        end = parse_date(end_str)
        if end:
            filters["created_at__date__lte"] = end

    status_counts = Application.objects.filter(**filters).values('status').annotate(count=Count('id')).order_by('-count')
    return Response(list(status_counts))

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_cost_time_series(request):
    """
    Returns daily estimated cost for ElevenLabs calls.
    Supports ?start=YYYY-MM-DD&end=YYYY-MM-DD
    """
    end_date = parse_date(request.query_params.get("end")) or timezone.now().date()
    start_date = parse_date(request.query_params.get("start")) or (end_date - timedelta(days=30))
    
    daily_usage = CallRecord.objects.filter(
        provider="elevenlabs", 
        created_at__date__range=[start_date, end_date]
    ).annotate(date=TruncDate('created_at'))\
     .values('date')\
     .annotate(
         total_seconds=Sum('duration_seconds'),
         total_cost=Sum('cost')
     )\
     .order_by('date')
     
    data = []
    for entry in daily_usage:
        seconds = entry['total_seconds'] or 0
        minutes = round(seconds / 60, 2)
        cost = entry['total_cost'] or 0.0
        data.append({
            "date": entry['date'],
            "cost": cost,
            "minutes": minutes
        })
        
    return Response(data)
