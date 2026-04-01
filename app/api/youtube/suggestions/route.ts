import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json([]);
  }

  try {
    const response = await fetch(
      `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(q)}`
    );
    const text = await response.text();
    
    // The response is in a format like window.google.ac.h(["query",[["suggestion1",0],["suggestion2",0]]])
    // We need to extract the suggestions array
    const match = text.match(/\["([^"]+)",\[(.*)\]\]/);
    if (match && match[2]) {
      const suggestionsRaw = JSON.parse(`[${match[2]}]`);
      const suggestions = suggestionsRaw.map((s: any) => s[0]);
      return NextResponse.json(suggestions);
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error('Error fetching YouTube suggestions:', error);
    return NextResponse.json([], { status: 500 });
  }
}
