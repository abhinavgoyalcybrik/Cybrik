@echo off
setlocal

:: Set the path to the evaluator directory
set "EVALUATOR_DIR=d:\cybrik server\Cybrik\ielts_ai_evaluator\ielts_ai_evaluator"

:: Check if directory exists
if not exist "%EVALUATOR_DIR%" (
    echo Error: Evaluator directory not found at %EVALUATOR_DIR%
    pause
    exit /b 1
)

:: Navigate to the directory
cd /d "%EVALUATOR_DIR%"

:: Check if virtual environment exists (optional, assuming user has python environment set up)
:: You might need to activate a specific venv here if required. e.g. call venv\Scripts\activate

echo Starting IELTS AI Evaluator on port 8001...
echo Press Ctrl+C to stop.

:: Run uvicorn
:: Using main_api:app as seen in the file checks
uvicorn main_api:app --reload --port 8001

endlocal
