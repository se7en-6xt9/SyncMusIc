import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

export async function GET() {
  try {
    const zip = new JSZip();
    const extensionDir = path.join(process.cwd(), 'syncwave-extension');
    
    if (!fs.existsSync(extensionDir)) {
      return NextResponse.json({ error: 'Extension directory not found' }, { status: 404 });
    }

    const files = fs.readdirSync(extensionDir);

    for (const file of files) {
      const filePath = path.join(extensionDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        const content = fs.readFileSync(filePath);
        zip.file(file, content);
      }
    }

    const content = await zip.generateAsync({ type: 'nodebuffer' });

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=syncwave-extension.zip',
      },
    });
  } catch (error) {
    console.error('Error generating zip:', error);
    return NextResponse.json({ error: 'Failed to generate zip' }, { status: 500 });
  }
}
