import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'public', 'data', 'writing_tests.json');

// GET - Fetch all tests
export async function GET() {
    try {
        const data = await fs.readFile(DATA_PATH, 'utf-8');
        return NextResponse.json(JSON.parse(data));
    } catch (error) {
        return NextResponse.json({ error: 'Failed to read tests' }, { status: 500 });
    }
}

// PUT - Update a test
export async function PUT(request: NextRequest) {
    try {
        const updatedTest = await request.json();
        const data = await fs.readFile(DATA_PATH, 'utf-8');
        const parsed = JSON.parse(data);

        const testIndex = parsed.tests.findIndex((t: { test_id: number }) => t.test_id === updatedTest.test_id);

        if (testIndex === -1) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        parsed.tests[testIndex] = updatedTest;

        await fs.writeFile(DATA_PATH, JSON.stringify(parsed, null, 2));

        return NextResponse.json({ success: true, test: updatedTest });
    } catch (error) {
        console.error('Error updating test:', error);
        return NextResponse.json({ error: 'Failed to update test' }, { status: 500 });
    }
}

// POST - Create a new test
export async function POST(request: NextRequest) {
    try {
        const newTest = await request.json();
        const data = await fs.readFile(DATA_PATH, 'utf-8');
        const parsed = JSON.parse(data);

        // Auto-generate test_id if not provided
        if (!newTest.test_id) {
            const maxId = Math.max(...parsed.tests.map((t: { test_id: number }) => t.test_id), 0);
            newTest.test_id = maxId + 1;
        }

        parsed.tests.push(newTest);

        await fs.writeFile(DATA_PATH, JSON.stringify(parsed, null, 2));

        return NextResponse.json({ success: true, test: newTest });
    } catch (error) {
        console.error('Error creating test:', error);
        return NextResponse.json({ error: 'Failed to create test' }, { status: 500 });
    }
}

// DELETE - Delete a test
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const testId = parseInt(searchParams.get('id') || '0');

        if (!testId) {
            return NextResponse.json({ error: 'Test ID required' }, { status: 400 });
        }

        const data = await fs.readFile(DATA_PATH, 'utf-8');
        const parsed = JSON.parse(data);

        parsed.tests = parsed.tests.filter((t: { test_id: number }) => t.test_id !== testId);

        await fs.writeFile(DATA_PATH, JSON.stringify(parsed, null, 2));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting test:', error);
        return NextResponse.json({ error: 'Failed to delete test' }, { status: 500 });
    }
}
