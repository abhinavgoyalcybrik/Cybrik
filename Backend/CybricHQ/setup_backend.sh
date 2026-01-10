#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting Backend Setup..."

# 1. Update and Install System Deps
echo "📦 Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y python3-venv python3-full

# 2. Setup Virtual Environment
echo "🐍 Setting up Python Virtual Environment..."
cd ~/cybrik
if [ ! -d "Backend/venv" ]; then
    python3 -m venv Backend/venv
    echo "   - Created new venv"
else
    echo "   - venv already exists"
fi

# 3. Install Python Dependencies
echo "⬇️ Installing Python requirements..."
source Backend/venv/bin/activate
pip install --upgrade pip
pip install -r Backend/CybricHQ/requirements.txt
pip install gunicorn

# 4. Create Systemd Service
echo "⚙️ Creating Systemd Service..."
SERVICE_FILE="/etc/systemd/system/ielts-backend.service"

sudo bash -c "cat > $SERVICE_FILE" <<EOF
[Unit]
Description=gunicorn daemon for CybricHQ Backend
After=network.target

[Service]
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/cybrik/Backend/CybricHQ
ExecStart=/home/deploy/cybrik/Backend/venv/bin/gunicorn --access-logfile - --workers 3 --bind 0.0.0.0:8000 CybricHQ.wsgi:application

[Install]
WantedBy=multi-user.target
EOF

echo "   - Service file created at $SERVICE_FILE"

# 5. Start Service
echo "🔥 Starting Backend Service..."
sudo systemctl daemon-reload
sudo systemctl enable ielts-backend
sudo systemctl restart ielts-backend

# 6. Verify
echo "✅ Checking Status..."
sleep 2
if systemctl is-active --quiet ielts-backend; then
    echo "🎉 SUCCESS: Backend is running!"
    sudo systemctl status ielts-backend --no-pager
else
    echo "❌ ERROR: Backend failed to start. Check logs:"
    sudo journalctl -u ielts-backend -n 20 --no-pager
    exit 1
fi
