import { NextResponse } from 'next/server'
import {
  upsertMetaChannelConnection,
  subscribePageToApp,
} from '@/lib/meta/channels'

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error_description') || searchParams.get('error')

  const host = req.headers.get('host') || 'localhost:3000'
  const protocol = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  const origin = `${protocol}://${host}`
  const redirectUri = `${origin}/api/channels/meta/oauth/callback`

  if (errorParam || !code || !state) {
    const errorMsg = encodeURIComponent(errorParam || 'Authorization code was not returned by Meta')
    return NextResponse.redirect(`${origin}/settings?tab=channels&error=${errorMsg}`)
  }

  try {
    // 1. Decode state
    const rawState = Buffer.from(state, 'base64url').toString('utf8')
    const { accountId, userId } = JSON.parse(rawState)
    if (!accountId || !userId) {
      throw new Error('Invalid OAuth state payload')
    }

    const clientId = process.env.META_APP_ID!
    const clientSecret = process.env.META_APP_SECRET?.split(',')[0].trim()!

    // 2. Exchange code for short-lived user token
    const tokenUrl = new URL(`${GRAPH_BASE}/oauth/access_token`)
    tokenUrl.searchParams.set('client_id', clientId)
    tokenUrl.searchParams.set('client_secret', clientSecret)
    tokenUrl.searchParams.set('redirect_uri', redirectUri)
    tokenUrl.searchParams.set('code', code)

    const tokenRes = await fetch(tokenUrl.toString())
    if (!tokenRes.ok) {
      const errBody = await tokenRes.text()
      throw new Error(`Token exchange failed: ${errBody}`)
    }
    const tokenData = await tokenRes.json()
    const userAccessToken = tokenData.access_token

    // 3. Exchange for long-lived user token
    const longLivedUrl = new URL(`${GRAPH_BASE}/oauth/access_token`)
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longLivedUrl.searchParams.set('client_id', clientId)
    longLivedUrl.searchParams.set('client_secret', clientSecret)
    longLivedUrl.searchParams.set('fb_exchange_token', userAccessToken)

    const longLivedRes = await fetch(longLivedUrl.toString())
    const longLivedData = longLivedRes.ok ? await longLivedRes.json() : tokenData
    const durableUserToken = longLivedData.access_token || userAccessToken

    // 4. Fetch managed Pages and linked Instagram accounts
    const pagesUrl = `${GRAPH_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(durableUserToken)}`
    const pagesRes = await fetch(pagesUrl)
    if (!pagesRes.ok) {
      const errBody = await pagesRes.text()
      throw new Error(`Fetching Facebook Pages failed: ${errBody}`)
    }

    const pagesData = await pagesRes.json()
    const pages: Array<{
      id: string
      name: string
      access_token: string
      instagram_business_account?: { id: string; username?: string }
    }> = pagesData.data || []

    // 5. Connect and subscribe each Page
    for (const page of pages) {
      // Subscribe Page to webhook app
      await subscribePageToApp(page.id, page.access_token)

      // Upsert Facebook Page
      await upsertMetaChannelConnection({
        accountId,
        userId,
        channel: 'facebook',
        pageId: page.id,
        pageName: page.name,
        accessToken: page.access_token,
        instagramBusinessId: page.instagram_business_account?.id ?? null,
        instagramUsername: page.instagram_business_account?.username ?? null,
      })

      // If linked Instagram business account exists, upsert Instagram channel
      if (page.instagram_business_account?.id) {
        await upsertMetaChannelConnection({
          accountId,
          userId,
          channel: 'instagram',
          pageId: page.id,
          pageName: page.name,
          accessToken: page.access_token,
          instagramBusinessId: page.instagram_business_account.id,
          instagramUsername: page.instagram_business_account.username ?? null,
        })
      }
    }

    return NextResponse.redirect(`${origin}/settings?tab=channels&success=connected&count=${pages.length}`)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.redirect(`${origin}/settings?tab=channels&error=${encodeURIComponent(message)}`)
  }
}
