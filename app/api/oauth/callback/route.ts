// app/api/oauth/callback/route.ts
import { NextResponse } from 'next/server';
import { getOAuth2Client } from '@/app/lib/google';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const oAuth2Client = getOAuth2Client();
  const { tokens } = await oAuth2Client.getToken(code);

  const html = `
    <html>
      <body style="font-family:Arial; padding:24px">
        <h2>Успех!</h2>
        <p>Копирай този <b>refresh_token</b> в своя <code>.env.local</code> под ключа <code>GOOGLE_REFRESH_TOKEN</code>:</p>
        <pre style="white-space:pre-wrap;background:#f6f8fa;padding:12px;border-radius:8px;">
${tokens.refresh_token ?? '(не е върнат – опитай пак, ще поискаме отново съгласие)'}
        </pre>
        <p>След това рестартирай <code>npm run dev</code>.</p>
      </body>
    </html>`;

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
}
