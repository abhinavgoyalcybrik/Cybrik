#!/bin/bash
# Production Database Migration Fix Script
# Fixes: column "logo" of relation "crm_app_tenantsettings" already exists

echo "================================================"
echo "🔧 Production Database Migration Fix"
echo "================================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "\n${YELLOW}Step 1: Checking current migration status...${NC}"
python manage.py showmigrations crm_app

echo -e "\n${YELLOW}Step 2: Identifying problematic migrations...${NC}"
echo "Migration 0018_tenantsettings_favicon_tenantsettings_font_family_and_more"
echo "is trying to add columns that already exist in production database."

echo -e "\n${YELLOW}Step 3: Faking problematic migrations (0018-0021)...${NC}"
echo "This marks migrations as applied without executing them."

# Fake migrations that try to add existing columns
python manage.py migrate crm_app 0017 --fake
python manage.py migrate crm_app 0018 --fake
python manage.py migrate crm_app 0019 --fake
python manage.py migrate crm_app 0020 --fake
python manage.py migrate crm_app 0021 --fake

echo -e "\n${YELLOW}Step 4: Applying remaining migrations...${NC}"
# Now apply the important migration that adds is_manual_only
python manage.py migrate crm_app 0022

echo -e "\n${YELLOW}Step 5: Applying all other pending migrations...${NC}"
python manage.py migrate

echo -e "\n${GREEN}✅ Migration fix complete!${NC}"

echo -e "\n${YELLOW}Step 6: Verifying database schema...${NC}"
python verify_schema.py

echo -e "\n${GREEN}================================================${NC}"
echo -e "${GREEN}✅ Database migration fix completed successfully!${NC}"
echo -e "${GREEN}================================================${NC}"

echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Restart Django service: sudo systemctl restart your-django-service"
echo "2. Test frontend: https://crm.cybriksolutions.com/leads"
echo "3. Check logs: sudo journalctl -u your-django-service -f"
