'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Building2,
  Calendar,
  Clock,
  Globe,
  Mail,
  MapPin,
  Phone,
  Save,
  Sparkles,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { BusinessProfileData } from '@/app/api/business-profile/route'

export function BusinessProfileForm() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<BusinessProfileData>({
    business_name: '',
    tagline: '',
    category: '',
    description: '',
    website_url: '',
    support_email: '',
    support_phone: '',
    operating_hours: '',
    address: '',
    booking_url: '',
    sync_to_ai: true,
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/business-profile')
        const data = await res.json()
        if (!cancelled && data.profile) {
          setProfile((prev) => ({ ...prev, ...data.profile }))
        }
      } catch {
        toast.error('Failed to load business profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/business-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to save business profile')
        return
      }
      toast.success('Business profile updated successfully!')
    } catch {
      toast.error('Failed to save business profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* 1. Identity & Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Company Identity</CardTitle>
          </div>
          <CardDescription>
            Basic details about your business used across WhatsApp messages, CRM, and AI replies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="business_name">Business Name</Label>
              <Input
                id="business_name"
                placeholder="e.g. Yash Automations"
                value={profile.business_name}
                onChange={(e) =>
                  setProfile({ ...profile, business_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category / Industry</Label>
              <Input
                id="category"
                placeholder="e.g. Healthcare, Consulting, Salon, Real Estate"
                value={profile.category}
                onChange={(e) =>
                  setProfile({ ...profile, category: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tagline">Short Tagline</Label>
            <Input
              id="tagline"
              placeholder="e.g. Smart WhatsApp Automation & CRM Solutions"
              value={profile.tagline}
              onChange={(e) =>
                setProfile({ ...profile, tagline: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">About Your Business / Key Offerings</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Describe what services or products your company provides, specialties, and guarantees..."
              value={profile.description}
              onChange={(e) =>
                setProfile({ ...profile, description: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website_url" className="flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-muted-foreground" /> Website URL
            </Label>
            <Input
              id="website_url"
              placeholder="https://yourbusiness.com"
              value={profile.website_url}
              onChange={(e) =>
                setProfile({ ...profile, website_url: e.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Appointments & Booking */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle>Appointments & Scheduling</CardTitle>
          </div>
          <CardDescription>
            Connect your appointment booking link. When customers ask to book or schedule, your WhatsApp Flows and AI will share this link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="booking_url">Online Booking Link (Cal.com / Calendly / Custom URL)</Label>
            <Input
              id="booking_url"
              placeholder="https://cal.com/your-business or https://calendly.com/your-business"
              value={profile.booking_url}
              onChange={(e) =>
                setProfile({ ...profile, booking_url: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Tip: In WhatsApp Flows, you can send this directly via buttons or message templates.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 3. Contact & Hours */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle>Operating Hours & Support Contact</CardTitle>
          </div>
          <CardDescription>
            Help your AI and team accurately answer customer inquiries regarding availability and office location.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="operating_hours" className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" /> Working / Operating Hours
              </Label>
              <Input
                id="operating_hours"
                placeholder="e.g. Mon - Sat: 9:00 AM - 7:00 PM IST"
                value={profile.operating_hours}
                onChange={(e) =>
                  setProfile({ ...profile, operating_hours: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support_phone" className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-muted-foreground" /> Support Phone / WhatsApp
              </Label>
              <Input
                id="support_phone"
                placeholder="+91 98765 43210"
                value={profile.support_phone}
                onChange={(e) =>
                  setProfile({ ...profile, support_phone: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="support_email" className="flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-muted-foreground" /> Support Email
              </Label>
              <Input
                id="support_email"
                type="email"
                placeholder="support@yourbusiness.com"
                value={profile.support_email}
                onChange={(e) =>
                  setProfile({ ...profile, support_email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-muted-foreground" /> Office / Store Address
              </Label>
              <Input
                id="address"
                placeholder="e.g. 102 Business Tower, MG Road, Mumbai"
                value={profile.address}
                onChange={(e) =>
                  setProfile({ ...profile, address: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. AI Sync */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <Label htmlFor="sync_ai" className="font-semibold cursor-pointer">
                  Auto-Sync with AI Assistant
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                When enabled, your business name, operating hours, about summary, and appointment link are automatically injected into the AI system prompt so the bot accurately answers questions on WhatsApp.
              </p>
            </div>
            <Switch
              id="sync_ai"
              checked={profile.sync_to_ai}
              onCheckedChange={(checked) =>
                setProfile({ ...profile, sync_to_ai: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={saving} className="min-w-32">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> Save Profile
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

