import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import fs from 'fs'

// Load .env.local manually
const envFile = fs.readFileSync('.env.local', 'utf8')
const env = {}
for (const line of envFile.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const idx = trimmed.indexOf('=')
  if (idx > -1) {
    const key = trimmed.slice(0, idx).trim()
    let val = trimmed.slice(idx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY
const encryptionKey = env.ENCRYPTION_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing supabase credentials')
  process.exit(1)
}

function decrypt(encryptedText) {
  const parts = encryptedText.split(':')
  if (parts.length === 3) {
    const [ivHex, ctHex, tagHex] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'hex'), iv)
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    let decrypted = decipher.update(ctHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }
  return null
}

const db = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  const { data: conns, error } = await db.from('meta_channel_connections').select('*')
  if (error || !conns) {
    console.error('Error fetching connections:', error)
    return
  }

  console.log(`Found ${conns.length} connection(s):`)
  for (const c of conns) {
    console.log(`ID: ${c.id}, Channel: ${c.channel}, Page: ${c.page_name} (${c.page_id})`)
    const token = decrypt(c.encrypted_access_token)
    if (!token) {
      console.log('  Failed to decrypt token')
      continue
    }
    console.log(`  Token: ${token.slice(0, 15)}... (len: ${token.length})`)

    // Let's test calling Meta with this token!
    // 1. Check who this token belongs to
    const meRes = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${encodeURIComponent(token)}`)
    const meData = await meRes.json()
    console.log(`  Token belongs to:`, JSON.stringify(meData))

    // 2. Test /me/conversations?fields=participants{id,name}
    const convRes = await fetch(`https://graph.facebook.com/v27.0/me/conversations?fields=participants{id,name}&access_token=${encodeURIComponent(token)}`)
    const convData = await convRes.json()
    console.log(`  /me/conversations status: ${convRes.status}, data count: ${convData.data?.length || 0}`)
    if (convData.data) {
      for (const t of convData.data) {
        console.log(`    Thread ID: ${t.id}, Participants:`, JSON.stringify(t.participants?.data))
      }
    } else {
      console.log(`    Error:`, JSON.stringify(convData))
    }

    // 3. Test direct PSID lookup
    const psid = '29455809944015118'
    const psidRes = await fetch(`https://graph.facebook.com/${psid}?fields=first_name,last_name,profile_pic&access_token=${encodeURIComponent(token)}`)
    const psidData = await psidRes.json()
    console.log(`  Direct PSID lookup status: ${psidRes.status}:`, JSON.stringify(psidData))
  }
}

run().catch(console.error)
