import { NextResponse } from 'next/server'
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account'

export async function GET(req: Request) {
  try {
    const ctx = await requireRole('admin')

    const metaAppId = process.env.META_APP_ID
    if (!metaAppId) {
      return NextResponse.json(
        { error: 'META_APP_ID is not configured in server environment (.env.local)' },
        { status: 400 },
      )
    }

    const { searchParams } = new URL(req.url)
    const host = req.headers.get('host') || 'localhost:3000'
    const protocol = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
    const origin = `${protocol}://${host}`
    const redirectUri = `${origin}/api/channels/meta/oauth/callback`

    const stateObj = {
      accountId: ctx.accountId,
      userId: ctx.userId,
      ts: Date.now(),
    }
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64url')

    const scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_metadata',
      'pages_messaging',
      'instagram_basic',
      'instagram_manage_messages',
      'instagram_manage_comments',
    ].join(',')

    const oauthUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth')
    oauthUrl.searchParams.set('client_id', metaAppId)
    oauthUrl.searchParams.set('redirect_uri', redirectUri)
    oauthUrl.searchParams.set('state', state)
    oauthUrl.searchParams.set('scope', scopes)
    oauthUrl.searchParams.set('response_type', 'code')

    return NextResponse.redirect(oauthUrl.toString())
  } catch (err) {
    return toErrorResponse(err)
  }
}
