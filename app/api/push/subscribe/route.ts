import {NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !serviceKey || !anonKey) {
      return NextResponse.json({error: 'Supabase not configured'}, {status: 503})
    }

    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({error: 'unauthorized'}, {status: 401})
    }

    const authClient = createClient(url, anonKey)
    const {data: userData, error: authError} = await authClient.auth.getUser(token)
    if (authError || !userData.user) {
      return NextResponse.json({error: 'unauthorized'}, {status: 401})
    }

    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json({error: 'invalid subscription'}, {status: 400})
    }

    const admin = createClient(url, serviceKey)
    const {error} = await admin.from('push_subscriptions').upsert({
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth
    }, {onConflict: 'endpoint'})
    if (error) throw error
    return NextResponse.json({ok: true})
  } catch (e: any) {
    return NextResponse.json({error: e.message}, {status: 500})
  }
}
