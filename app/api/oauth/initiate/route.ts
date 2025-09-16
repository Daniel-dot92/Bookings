// app/api/oauth/initiate/route.ts
import { NextResponse } from 'next/server';
import { getOAuth2Client } from '@/app/lib/google';

export async function GET() {
  const oAuth2Client = getOAuth2Client();
  const scopes = ['https://www.googleapis.com/auth/calendar'];

  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline', // нужно, за да получим refresh_token
    prompt: 'consent',      // принуждава показване и връщане на refresh_token при нужда
    scope: scopes,
  });

  return NextResponse.redirect(url);
}
