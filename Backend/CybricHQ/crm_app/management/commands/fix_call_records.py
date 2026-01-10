"""
Django management command to fix existing CallRecords.
"""
from django.core.management.base import BaseCommand
from crm_app.models import CallRecord, Applicant, Lead
import json

class Command(BaseCommand):
    help = 'Fix existing CallRecords to extract phone numbers and link to applicants'

    def handle(self, *args, **options):
        fixed_count = 0
        linked_count = 0
        
        # Process all ElevenLabs calls
        for call in CallRecord.objects.filter(provider="elevenlabs"):
            updated = False
            phone = None
            
            # 1. Try to get phone from existing metadata
            if call.metadata and isinstance(call.metadata, dict):
                phone = (
                    call.metadata.get('phone_number') or
                    call.metadata.get('phone') or
                    call.metadata.get('customer_phone') or
                    call.metadata.get('to') or
                    call.metadata.get('from')
                )
                
                # 2. Try nested metadata
                if not phone:
                    inner_meta = call.metadata.get('metadata', {})
                    if isinstance(inner_meta, dict):
                        phone = (
                            inner_meta.get('phone') or
                            inner_meta.get('phone_number') or
                            inner_meta.get('to') or
                            inner_meta.get('from')
                        )

                # 3. Try looking up via Lead ID
                if not phone and 'lead_id' in call.metadata:
                    try:
                        lead_id = call.metadata['lead_id']
                        lead = Lead.objects.filter(id=lead_id).first()
                        if lead and lead.phone:
                            phone = lead.phone
                            self.stdout.write(f"Found phone {phone} from Lead #{lead.id}")
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"Error looking up lead for call {call.id}: {e}"))

            # Update metadata if phone found and not present
            if phone:
                if not call.metadata:
                    call.metadata = {}
                
                if 'phone_number' not in call.metadata:
                    call.metadata['phone_number'] = phone
                    updated = True
                    fixed_count += 1
                    self.stdout.write(self.style.SUCCESS(f'✓ Added phone {phone} to CallRecord #{call.id}'))
            
            # 4. Try to link to applicant if not already linked
            if not call.applicant and phone:
                applicant = Applicant.objects.filter(phone=phone).first()
                if applicant:
                    call.applicant = applicant
                    updated = True
                    linked_count += 1
                    self.stdout.write(self.style.SUCCESS(f'✓ Linked CallRecord #{call.id} to Applicant #{applicant.id}'))
            
            if updated:
                call.save()
        
        self.stdout.write(self.style.SUCCESS(f'\n✅ Done!'))
        self.stdout.write(self.style.SUCCESS(f'   - Fixed {fixed_count} phone numbers'))
        self.stdout.write(self.style.SUCCESS(f'   - Linked {linked_count} applicants'))
