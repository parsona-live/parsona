import { NextResponse } from 'next/server'
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account'
import {
  listAccountMetaChannels,
  upsertMetaChannelConnection,
  fetchLinkedInstagramAccount,
  subscribePageToApp,
} from '@/lib/meta/channels'

/**
 * GET /api/channels/meta
 * Lists all connected Facebook Pages and Instagram accounts for the current account.
 */
export async function GET() {
  try {
    const ctx = await getCurrentAccount()
    const channels = await listAccountMetaChannels(ctx.accountId)
    return NextResponse.json({ channels })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/channels/meta
 * Manually connect a Facebook Page / Instagram account with Page ID & Access Token.
 */
export async function POST(req: Request) {
  try {
    const ctx = await requireRole('admin')

    const body = await req.json()
    const { pageId, pageName, accessToken, connectInstagram = true } = body

    if (!pageId || !accessToken) {
      return NextResponse.json(
        { error: 'pageId and accessToken are required' },
        { status: 400 },
      )
    }

    // 1. Subscribe Page to Webhooks
    const subResult = await subscribePageToApp(pageId, accessToken)
    if (!subResult.success) {
      return NextResponse.json(
        { error: `Webhook subscription failed: ${subResult.error}` },
        { status: 400 },
      )
    }

    // 2. Check for linked Instagram Business Account
    let igAccount: { id: string; username?: string } | null = null
    if (connectInstagram) {
      igAccount = await fetchLinkedInstagramAccount(pageId, accessToken)
    }

    // 3. Upsert Facebook Page Connection
    const fbConn = await upsertMetaChannelConnection({
      accountId: ctx.accountId,
      userId: ctx.userId,
      channel: 'facebook',
      pageId,
      pageName: pageName || `Page ${pageId}`,
      accessToken,
      instagramBusinessId: igAccount?.id ?? null,
      instagramUsername: igAccount?.username ?? null,
    })

    // 4. If Instagram account exists, upsert Instagram Connection
    let igConn = null
    if (igAccount?.id) {
      igConn = await upsertMetaChannelConnection({
        accountId: ctx.accountId,
        userId: ctx.userId,
        channel: 'instagram',
        pageId,
        pageName: pageName || `Page ${pageId}`,
        accessToken,
        instagramBusinessId: igAccount.id,
        instagramUsername: igAccount.username ?? null,
      })
    }

    return NextResponse.json({
      success: true,
      facebook: fbConn,
      instagram: igConn,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
