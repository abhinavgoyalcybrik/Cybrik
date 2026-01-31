#!/bin/bash
# Force restart production Django server

echo "🔄 Restarting Django with cache clearing..."

# Navigate to project directory
cd ~/cybrik/Backend/CybricHQ || cd /var/www/cybrik/Backend/CybricHQ || exit

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Clear Python cache files
echo "🗑️ Clearing Python cache..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
find . -name "*.pyc" -delete 2>/dev/null
find . -name "*.pyo" -delete 2>/dev/null

# Restart all possible services
echo "🔄 Restarting services..."

# Try gunicorn
if systemctl is-active --quiet gunicorn; then
    sudo systemctl restart gunicorn
    echo "✅ Restarted gunicorn"
fi

# Try uwsgi
if systemctl is-active --quiet uwsgi; then
    sudo systemctl restart uwsgi
    echo "✅ Restarted uwsgi"
fi

# Try supervisor
if command -v supervisorctl &> /dev/null; then
    sudo supervisorctl restart cybrik 2>/dev/null && echo "✅ Restarted via supervisor" || true
    sudo supervisorctl restart all 2>/dev/null && echo "✅ Restarted all supervisor processes" || true
fi

# Try docker
if command -v docker-compose &> /dev/null; then
    docker-compose restart backend 2>/dev/null && echo "✅ Restarted docker backend" || true
fi

echo ""
echo "✅ Restart complete!"
echo ""
echo "🧪 Testing API endpoint..."
sleep 2
curl -s https://api.cybriksolutions.com/api/reports/summary/ | head -20

echo ""
echo "📊 Check status with:"
echo "  sudo systemctl status gunicorn"
echo "  sudo journalctl -u gunicorn -f --lines=50"
