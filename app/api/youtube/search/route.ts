import { NextResponse } from 'next/server';
import yts from 'yt-search';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!q) {
    return NextResponse.json({ items: [] });
  }

  // If API key is provided, use the official YouTube API
  if (apiKey && apiKey !== 'YOUR_YOUTUBE_API_KEY') {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=12&q=${encodeURIComponent(q)}&key=${apiKey}`
      );
      
      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
      
      const errorData = await response.json();
      if (errorData.error?.errors?.[0]?.reason === 'quotaExceeded') {
        console.warn('YouTube API quota exceeded, falling back to yt-search');
      } else {
        console.error('YouTube API error:', errorData);
      }
    } catch (error) {
      console.error('Error fetching YouTube search from official API:', error);
    }
  }

  // Fallback to yt-search (no key required)
  try {
    const results = await yts(q);
    const items = results.videos.slice(0, 12).map((video) => ({
      id: { videoId: video.videoId },
      snippet: {
        title: video.title,
        channelTitle: video.author.name,
        thumbnails: {
          medium: { url: video.thumbnail },
          high: { url: video.image }
        }
      }
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error fetching YouTube search from yt-search:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
