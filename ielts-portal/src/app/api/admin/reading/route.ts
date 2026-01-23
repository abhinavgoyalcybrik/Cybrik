import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// API route to save reading tests JSON
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { testId, testData } = body;

        if (!testId || !testData) {
            return NextResponse.json({ error: 'Missing testId or testData' }, { status: 400 });
        }

        // Path to the JSON file
        const filePath = path.join(process.cwd(), 'public', 'data', 'reading_tests.json');

        // Read existing data
        let existingData: any = { tests: [] };
        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            existingData = JSON.parse(fileContent);
        } catch (e) {
            console.log('Creating new reading_tests.json');
        }

        // Find and update the test
        const testIndex = existingData.tests.findIndex((t: any) => String(t.id) === String(testId));

        if (testIndex >= 0) {
            // Update existing test
            existingData.tests[testIndex] = testData;
        } else {
            // Add new test
            existingData.tests.push(testData);
        }

        // Write back to file
        fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8');

        return NextResponse.json({ success: true, message: 'Test saved successfully' });
    } catch (error: any) {
        console.error('Save error:', error);
        return NextResponse.json({ error: error.message || 'Failed to save' }, { status: 500 });
    }
}

// GET - Read all tests
export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'public', 'data', 'reading_tests.json');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
