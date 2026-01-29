#!/bin/bash
# Add missing is_manual_only column to production database

echo "================================================"
echo "🔧 Adding Missing is_manual_only Column"
echo "================================================"

echo -e "\n${YELLOW}Adding is_manual_only column to crm_app_lead table...${NC}"

# Connect to database and add the column
python manage.py dbshell << 'EOF'
-- Add is_manual_only column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'crm_app_lead'
                   AND column_name = 'is_manual_only') THEN
        ALTER TABLE crm_app_lead ADD COLUMN is_manual_only BOOLEAN NOT NULL DEFAULT FALSE;
        RAISE NOTICE 'Added is_manual_only column to crm_app_lead';
    ELSE
        RAISE NOTICE 'is_manual_only column already exists';
    END IF;
END $$;
EOF

echo -e "\n${YELLOW}Verifying column was added...${NC}"
python verify_schema.py

echo -e "\n${GREEN}✅ Column addition complete!${NC}"

echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Restart Django service: sudo systemctl restart your-django-service"
echo "2. Test frontend: https://crm.cybriksolutions.com/leads"
