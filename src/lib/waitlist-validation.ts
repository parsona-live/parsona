export interface WaitlistFields {
  name: string
  email: string
  phone: string
}

export interface WaitlistValidationErrors {
  name?: string
  email?: string
  phone?: string
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'guerrillamail.com',
  '10minutemail.com',
  'yopmail.com',
  'throwawaymail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'fakeinbox.com',
  'example.com',
  'example.org',
  'test.com',
])

const FAKE_NUMBER_SEQUENCES = new Set([
  '1234567890',
  '0123456789',
  '1234512345',
  '0000000000',
])

/**
 * Normalize a phone number into a canonical comparison key so
 * "98765 43210", "09876543210", and "+91-98765-43210" all match as duplicates.
 */
export function normalizePhoneKey(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '')

  // Indian 10-digit mobile (starts with 6-9) -> 91XXXXXXXXXX
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`
  }

  // Indian 11-digit with leading 0 (09876543210) -> 91XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) {
    return `91${digits.slice(1)}`
  }

  // Indian 12-digit with 91 prefix
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
    return digits
  }

  return digits
}

export function validateWaitlistInput(input: WaitlistFields): {
  valid: boolean
  errors: WaitlistValidationErrors
  normalized: {
    name: string
    email: string
    phone: string
    phoneKey: string
  }
} {
  const errors: WaitlistValidationErrors = {}

  const name = input.name.trim().replace(/\s+/g, ' ')
  const email = input.email.trim().toLowerCase()
  const phone = input.phone.trim()

  // 1. Full Name validation
  if (name.length < 2 || name.length > 100) {
    errors.name = 'Please enter your full name (at least 2 characters).'
  } else if (!/[a-zA-Z\u0900-\u097F]/.test(name) || /^[\d\W_]+$/.test(name)) {
    errors.name = 'Name must contain valid letters, not just numbers or symbols.'
  }

  // 2. Email validation
  const emailParts = email.split('@')
  const domain = emailParts[1] ?? ''
  const tld = domain.split('.').pop() ?? ''

  if (
    !email ||
    email.length > 180 ||
    email.includes('..') ||
    !EMAIL_REGEX.test(email) ||
    tld.length < 2 ||
    !/^[a-z]+$/.test(tld)
  ) {
    errors.email = 'Enter a valid email address (e.g. you@company.com).'
  } else if (DISPOSABLE_DOMAINS.has(domain)) {
    errors.email = 'Please use a real work or personal email address.'
  }

  // 3. Phone / WhatsApp number validation
  const digits = phone.replace(/\D/g, '')
  const hasValidChars = /^[+\d][\d\s().-]*$/.test(phone)

  if (!phone || !hasValidChars) {
    errors.phone = 'Enter a valid WhatsApp number (digits only, optional + country code).'
  } else {
    const isIndian10 = digits.length === 10
    const isIndian11 = digits.length === 11 && digits.startsWith('0')
    const isIndian12 = digits.length === 12 && digits.startsWith('91')

    const indianLocal = isIndian10
      ? digits
      : isIndian11
        ? digits.slice(1)
        : isIndian12
          ? digits.slice(2)
          : null

    if (digits.length < 10 || digits.length > 15) {
      errors.phone = 'Enter a valid 10-digit Indian or international WhatsApp number.'
    } else if (indianLocal !== null) {
      if (!/^[6-9]\d{9}$/.test(indianLocal)) {
        errors.phone = 'Indian mobile numbers must start with 6, 7, 8, or 9.'
      } else if (/^(\d)\1{9}$/.test(indianLocal) || FAKE_NUMBER_SEQUENCES.has(indianLocal)) {
        errors.phone = 'Please enter a real active WhatsApp number.'
      }
    } else {
      // Non-Indian international number: require leading + and reject all-identical digits
      if (!phone.startsWith('+')) {
        errors.phone = 'Include your country code (e.g. +91, +1, +44) for international numbers.'
      } else if (/^(\d)\1{6,}$/.test(digits.slice(-10)) || FAKE_NUMBER_SEQUENCES.has(digits.slice(-10))) {
        errors.phone = 'Please enter a real active WhatsApp number.'
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalized: {
      name,
      email,
      phone,
      phoneKey: normalizePhoneKey(phone),
    },
  }
}

