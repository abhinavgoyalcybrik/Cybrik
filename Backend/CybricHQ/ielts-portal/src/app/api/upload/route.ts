import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'images', 'writing');

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, GIF, or WebP.' }, { status: 400 });
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
        }

        // Create unique filename with timestamp
        const timestamp = Date.now();
        const ext = file.name.split('.').pop() || 'png';
        const filename = `chart_${timestamp}.${ext}`;
        const filepath = path.join(UPLOAD_DIR, filename);

        // Ensure directory exists
        await fs.mkdir(UPLOAD_DIR, { recursive: true });

        // Save file
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await fs.writeFile(filepath, buffer);

        // Return the URL path for use in JSON
        const imageUrl = `/images/writing/${filename}`;

        return NextResponse.json({
            success: true,
            filename,
            imageUrl,
            message: 'Image uploaded successfully',
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }
}
