import { describe, expect, it } from 'vitest'

import {
  validateInteractivePayload,
  interactivePayloadPreviewText,
  type InteractiveButtonsPayload,
  type InteractiveListPayload,
  type InteractiveCarouselPayload,
} from './interactive'

const validButtons: InteractiveButtonsPayload = {
  kind: 'buttons',
  body: 'Choose an option',
  buttons: [
    { id: 'yes', title: 'Yes' },
    { id: 'no', title: 'No' },
  ],
}

const validList: InteractiveListPayload = {
  kind: 'list',
  body: 'Pick a service',
  button_label: 'View menu',
  sections: [
    {
      title: 'Services',
      rows: [
        { id: 'seo', title: 'SEO', description: 'Search optimization' },
        { id: 'ads', title: 'Ads' },
      ],
    },
  ],
}

const validCarousel: InteractiveCarouselPayload = {
  kind: 'carousel',
  body: 'Browse our collection',
  cards: [
    {
      header_image_url: 'https://example.com/item1.jpg',
      body_text: 'Item 1 description',
      buttons: [{ id: 'item_1', title: 'View Item 1' }],
    },
    {
      header_image_url: 'https://example.com/item2.jpg',
      body_text: 'Item 2 description',
      buttons: [{ id: 'item_2', title: 'View Item 2' }],
    },
  ],
}

describe('validateInteractivePayload — buttons', () => {
  it('accepts a well-formed buttons payload', () => {
    expect(validateInteractivePayload(validButtons)).toEqual({ ok: true })
  })

  it('rejects a missing/empty payload', () => {
    expect(validateInteractivePayload(undefined).ok).toBe(false)
    expect(validateInteractivePayload(null).ok).toBe(false)
  })

  it('requires a non-empty body within 1024 chars', () => {
    expect(validateInteractivePayload({ ...validButtons, body: '' }).ok).toBe(false)
    const long = validateInteractivePayload({ ...validButtons, body: 'x'.repeat(1025) })
    expect(long.ok).toBe(false)
  })

  it('requires 1-3 buttons', () => {
    expect(validateInteractivePayload({ ...validButtons, buttons: [] }).ok).toBe(false)
    const four = validateInteractivePayload({
      ...validButtons,
      buttons: [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
        { id: 'c', title: 'C' },
        { id: 'd', title: 'D' },
      ],
    })
    expect(four.ok).toBe(false)
  })

  it('caps button title at 20 chars', () => {
    const res = validateInteractivePayload({
      ...validButtons,
      buttons: [{ id: 'a', title: 'x'.repeat(21) }],
    })
    expect(res.ok).toBe(false)
  })

  it('rejects duplicate button ids', () => {
    const res = validateInteractivePayload({
      ...validButtons,
      buttons: [
        { id: 'dup', title: 'A' },
        { id: 'dup', title: 'B' },
      ],
    })
    expect(res).toEqual({ ok: false, error: 'Duplicate button id "dup".' })
  })

  it('rejects empty button id / title', () => {
    expect(
      validateInteractivePayload({ ...validButtons, buttons: [{ id: '', title: 'A' }] }).ok,
    ).toBe(false)
    expect(
      validateInteractivePayload({ ...validButtons, buttons: [{ id: 'a', title: '' }] }).ok,
    ).toBe(false)
  })
})

describe('validateInteractivePayload — list', () => {
  it('accepts a well-formed list payload', () => {
    expect(validateInteractivePayload(validList)).toEqual({ ok: true })
  })

  it('requires a button label within 20 chars', () => {
    expect(validateInteractivePayload({ ...validList, button_label: '' }).ok).toBe(false)
    expect(
      validateInteractivePayload({ ...validList, button_label: 'x'.repeat(21) }).ok,
    ).toBe(false)
  })

  it('caps total rows at 10 across sections', () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ id: `r${i}`, title: `Row ${i}` }))
    const res = validateInteractivePayload({
      ...validList,
      sections: [{ rows }],
    })
    expect(res.ok).toBe(false)
  })

  it('caps list row title at 24 chars', () => {
    const res = validateInteractivePayload({
      ...validList,
      sections: [{ rows: [{ id: 'r', title: 'x'.repeat(25) }] }],
    })
    expect(res.ok).toBe(false)
  })

  it('rejects duplicate row ids across sections', () => {
    const res = validateInteractivePayload({
      ...validList,
      sections: [
        { rows: [{ id: 'dup', title: 'A' }] },
        { rows: [{ id: 'dup', title: 'B' }] },
      ],
    })
    expect(res.ok).toBe(false)
  })
})

describe('interactivePayloadPreviewText', () => {
  it('returns the trimmed body', () => {
    expect(interactivePayloadPreviewText({ ...validButtons, body: '  Hi  ' })).toBe('Hi')
  })
  it('falls back when body is blank', () => {
    expect(interactivePayloadPreviewText({ ...validButtons, body: '   ' })).toBe('[buttons]')
    expect(interactivePayloadPreviewText({ ...validList, body: '' })).toBe('[list]')
    expect(interactivePayloadPreviewText({ ...validCarousel, body: '' })).toBe('[carousel]')
  })
})

describe('validateInteractivePayload — carousel', () => {
  it('accepts a well-formed carousel payload', () => {
    expect(validateInteractivePayload(validCarousel)).toEqual({ ok: true })
  })

  it('requires a non-empty body within 1024 chars', () => {
    expect(validateInteractivePayload({ ...validCarousel, body: '' }).ok).toBe(false)
    expect(validateInteractivePayload({ ...validCarousel, body: 'x'.repeat(1025) }).ok).toBe(false)
  })

  it('requires between 2 and 10 cards', () => {
    expect(
      validateInteractivePayload({ ...validCarousel, cards: [validCarousel.cards[0]] }).ok,
    ).toBe(false)
    const elevenCards = Array.from({ length: 11 }, (_, i) => ({
      header_image_url: `https://example.com/${i}.jpg`,
      body_text: `Item ${i}`,
      buttons: [{ id: `btn_${i}`, title: `Button ${i}` }],
    }))
    expect(validateInteractivePayload({ ...validCarousel, cards: elevenCards }).ok).toBe(false)
  })

  it('requires each card to have an image_url', () => {
    const res = validateInteractivePayload({
      ...validCarousel,
      cards: [
        { ...validCarousel.cards[0], header_image_url: '' },
        validCarousel.cards[1],
      ],
    })
    expect(res.ok).toBe(false)
  })

  it('caps card body at 160 chars', () => {
    const res = validateInteractivePayload({
      ...validCarousel,
      cards: [
        { ...validCarousel.cards[0], body_text: 'x'.repeat(161) },
        validCarousel.cards[1],
      ],
    })
    expect(res.ok).toBe(false)
  })

  it('requires 1 to 2 buttons per card and caps button title at 25 chars', () => {
    const noButtons = validateInteractivePayload({
      ...validCarousel,
      cards: [
        { ...validCarousel.cards[0], buttons: [] },
        { ...validCarousel.cards[1], buttons: [] },
      ],
    })
    expect(noButtons.ok).toBe(false)

    const threeButtons = validateInteractivePayload({
      ...validCarousel,
      cards: [
        {
          ...validCarousel.cards[0],
          buttons: [
            { id: '1a', title: 'A' },
            { id: '1b', title: 'B' },
            { id: '1c', title: 'C' },
          ],
        },
        {
          ...validCarousel.cards[1],
          buttons: [
            { id: '2a', title: 'A' },
            { id: '2b', title: 'B' },
            { id: '2c', title: 'C' },
          ],
        },
      ],
    })
    expect(threeButtons.ok).toBe(false)

    const longTitle = validateInteractivePayload({
      ...validCarousel,
      cards: [
        { ...validCarousel.cards[0], buttons: [{ id: '1', title: 'x'.repeat(26) }] },
        validCarousel.cards[1],
      ],
    })
    expect(longTitle.ok).toBe(false)
  })

  it('rejects duplicate button ids across cards', () => {
    const res = validateInteractivePayload({
      ...validCarousel,
      cards: [
        { ...validCarousel.cards[0], buttons: [{ id: 'dupe_btn', title: 'Btn 1' }] },
        { ...validCarousel.cards[1], buttons: [{ id: 'dupe_btn', title: 'Btn 2' }] },
      ],
    })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toMatch(/Duplicate button id "dupe_btn"/)
    }
  })

  it('requires identical button counts across all cards', () => {
    const res = validateInteractivePayload({
      ...validCarousel,
      cards: [
        {
          ...validCarousel.cards[0],
          buttons: [
            { id: '1a', title: 'A' },
            { id: '1b', title: 'B' },
          ],
        },
        {
          ...validCarousel.cards[1],
          buttons: [{ id: '2a', title: 'A' }],
        },
      ],
    })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toMatch(/All carousel cards must have the same number of buttons/)
    }
  })
})
