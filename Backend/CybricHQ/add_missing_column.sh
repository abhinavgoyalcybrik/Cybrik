#!/bin/bash
# Add missing columns to production database

echo "================================================"
echo "🔧 Adding Missing Database Columns"
echo "================================================"

echo -e "\n${YELLOW}Adding missing columns to crm_app_lead table...${NC}"

# Connect to database and add the columns
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

-- Add walked_in_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'crm_app_lead'
                   AND column_name = 'walked_in_at') THEN
        ALTER TABLE crm_app_lead ADD COLUMN walked_in_at TIMESTAMP NULL;
        RAISE NOTICE 'Added walked_in_at column to crm_app_lead';
    ELSE
        RAISE NOTICE 'walked_in_at column already exists';
    END IF;
END $$;

-- Add receptionist_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'crm_app_lead'
                   AND column_name = 'receptionist_id') THEN
        ALTER TABLE crm_app_lead ADD COLUMN receptionist_id INTEGER REFERENCES auth_user(id);
        RAISE NOTICE 'Added receptionist_id column to crm_app_lead';
    ELSE
        RAISE NOTICE 'receptionist_id column already exists';
    END IF;
END $$;
EOF

echo -e "\n${YELLOW}Verifying columns were added...${NC}"
python verify_schema.py

echo -e "\n${GREEN}✅ Column addition complete!${NC}"

echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Restart Django service: sudo systemctl restart your-django-service"
echo "2. Test frontend: https://crm.cybriksolutions.com/leads"
