import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INTERACTIVE_LIMITS,
  sendInteractiveButtons,
  sendInteractiveCarousel,
  sendInteractiveList,
} from "./meta-api";

// All assertions in this file run BEFORE the network call. We stub fetch
// to a never-resolving mock so a test that accidentally falls through to
// the request body would hang (and fail) rather than silently hit
// graph.facebook.com.
const neverFetch = () =>
  new Promise<Response>(() => {
    /* intentionally never resolves */
  });

const BASE_ARGS = {
  phoneNumberId: "test-phone",
  accessToken: "test-token",
  to: "1234567890",
  bodyText: "Body text",
} as const;

describe("sendInteractiveButtons — validation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(neverFetch));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects an empty buttons array", async () => {
    await expect(
      sendInteractiveButtons({ ...BASE_ARGS, buttons: [] }),
    ).rejects.toThrow(/1-3 buttons/);
  });

  it(`rejects more than ${INTERACTIVE_LIMITS.maxButtons} buttons (Meta cap)`, async () => {
    await expect(
      sendInteractiveButtons({
        ...BASE_ARGS,
        buttons: [
          { id: "a", title: "A" },
          { id: "b", title: "B" },
          { id: "c", title: "C" },
          { id: "d", title: "D" },
        ],
      }),
    ).rejects.toThrow(/1-3 buttons/);
  });

  it("rejects a button title longer than 20 chars (Meta cap)", async () => {
    await expect(
      sendInteractiveButtons({
        ...BASE_ARGS,
        buttons: [
          { id: "a", title: "x".repeat(INTERACTIVE_LIMITS.buttonTitleMaxLength + 1) },
        ],
      }),
    ).rejects.toThrow(/exceeds 20 chars/);
  });

  it("rejects a button missing its id", async () => {
    await expect(
      sendInteractiveButtons({
        ...BASE_ARGS,
        buttons: [{ id: "", title: "Choose me" }],
      }),
    ).rejects.toThrow(/missing id/);
  });

  it("rejects an empty body text", async () => {
    await expect(
      sendInteractiveButtons({
        ...BASE_ARGS,
        bodyText: "",
        buttons: [{ id: "a", title: "A" }],
      }),
    ).rejects.toThrow(/requires bodyText/);
  });

  it("rejects a header text over the limit", async () => {
    await expect(
      sendInteractiveButtons({
        ...BASE_ARGS,
        headerText: "x".repeat(INTERACTIVE_LIMITS.headerTextMaxLength + 1),
        buttons: [{ id: "a", title: "A" }],
      }),
    ).rejects.toThrow(/headerText exceeds/);
  });

  it("sends the right payload shape when all inputs are valid", async () => {
    let captured: { url: string; body: unknown; method: string } | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        captured = {
          url,
          method: init.method ?? "GET",
          body: JSON.parse(String(init.body)),
        };
        return new Response(
          JSON.stringify({ messages: [{ id: "wamid.PASS" }] }),
          { status: 200 },
        );
      }),
    );

    const result = await sendInteractiveButtons({
      ...BASE_ARGS,
      headerText: "Hello",
      footerText: "Tap one",
      buttons: [
        { id: "yes", title: "Yes" },
        { id: "no", title: "No" },
      ],
    });

    expect(result).toEqual({ messageId: "wamid.PASS" });
    expect(captured).not.toBeNull();
    expect(captured!.method).toBe("POST");
    expect(captured!.url).toContain("test-phone/messages");
    expect(captured!.body).toMatchObject({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "1234567890",
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Body text" },
        header: { type: "text", text: "Hello" },
        footer: { text: "Tap one" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "yes", title: "Yes" } },
            { type: "reply", reply: { id: "no", title: "No" } },
          ],
        },
      },
    });
  });
});

describe("sendInteractiveList — validation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(neverFetch));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const ROW = { id: "r1", title: "Row 1" };

  it("rejects zero sections", async () => {
    await expect(
      sendInteractiveList({
        ...BASE_ARGS,
        buttonLabel: "Open",
        sections: [],
      }),
    ).rejects.toThrow(/1-10 sections/);
  });

  it(`rejects more than ${INTERACTIVE_LIMITS.maxListRowsTotal} rows total across sections (Meta cap)`, async () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({
      id: `r${i}`,
      title: `Row ${i}`,
    }));
    await expect(
      sendInteractiveList({
        ...BASE_ARGS,
        buttonLabel: "Open",
        sections: [{ rows }],
      }),
    ).rejects.toThrow(/1-10 rows total/);
  });

  it("rejects a row title longer than 24 chars (Meta cap)", async () => {
    await expect(
      sendInteractiveList({
        ...BASE_ARGS,
        buttonLabel: "Open",
        sections: [
          {
            rows: [
              {
                id: "r1",
                title: "x".repeat(INTERACTIVE_LIMITS.listRowTitleMaxLength + 1),
              },
            ],
          },
        ],
      }),
    ).rejects.toThrow(/exceeds 24 chars/);
  });

  it("rejects duplicate row ids across sections", async () => {
    await expect(
      sendInteractiveList({
        ...BASE_ARGS,
        buttonLabel: "Open",
        sections: [
          { rows: [{ id: "dupe", title: "First" }] },
          { rows: [{ id: "dupe", title: "Second" }] },
        ],
      }),
    ).rejects.toThrow(/duplicate row id/);
  });

  it("rejects an empty buttonLabel", async () => {
    await expect(
      sendInteractiveList({
        ...BASE_ARGS,
        buttonLabel: "",
        sections: [{ rows: [ROW] }],
      }),
    ).rejects.toThrow(/requires a buttonLabel/);
  });

  it("sends the right payload shape when valid", async () => {
    let captured: { body: unknown } | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        captured = { body: JSON.parse(String(init.body)) };
        return new Response(
          JSON.stringify({ messages: [{ id: "wamid.LIST" }] }),
          { status: 200 },
        );
      }),
    );

    const result = await sendInteractiveList({
      ...BASE_ARGS,
      buttonLabel: "Open menu",
      sections: [
        {
          title: "Orders",
          rows: [
            { id: "order_1", title: "Order #1", description: "€12" },
            { id: "order_2", title: "Order #2" },
          ],
        },
      ],
    });

    expect(result).toEqual({ messageId: "wamid.LIST" });
    expect(captured).not.toBeNull();
    expect(captured!.body).toMatchObject({
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: "Body text" },
        action: {
          button: "Open menu",
          sections: [
            {
              title: "Orders",
              rows: [
                { id: "order_1", title: "Order #1", description: "€12" },
                { id: "order_2", title: "Order #2" },
              ],
            },
          ],
        },
      },
    });
  });
});

describe("sendInteractiveCarousel — validation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(neverFetch));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const CARDS = [
    {
      headerImageUrl: "https://example.com/item1.png",
      bodyText: "Product 1 description",
      buttons: [{ id: "btn_1", title: "Buy 1" }],
    },
    {
      headerImageUrl: "https://example.com/item2.png",
      bodyText: "Product 2 description",
      buttons: [{ id: "btn_2", title: "Buy 2" }],
    },
  ];

  it("rejects an empty bodyText", async () => {
    await expect(
      sendInteractiveCarousel({ ...BASE_ARGS, bodyText: "", cards: CARDS }),
    ).rejects.toThrow(/requires bodyText/);
  });

  it("rejects fewer than 2 cards", async () => {
    await expect(
      sendInteractiveCarousel({ ...BASE_ARGS, cards: [CARDS[0]] }),
    ).rejects.toThrow(/between 2 and 10 cards/);
  });

  it("rejects more than 10 cards", async () => {
    const elevenCards = Array.from({ length: 11 }, (_, i) => ({
      headerImageUrl: `https://example.com/${i}.png`,
      buttons: [{ id: `b_${i}`, title: `Btn ${i}` }],
    }));
    await expect(
      sendInteractiveCarousel({ ...BASE_ARGS, cards: elevenCards }),
    ).rejects.toThrow(/between 2 and 10 cards/);
  });

  it("rejects a card missing headerImageUrl", async () => {
    await expect(
      sendInteractiveCarousel({
        ...BASE_ARGS,
        cards: [
          { ...CARDS[0], headerImageUrl: "" },
          CARDS[1],
        ],
      }),
    ).rejects.toThrow(/missing a header image URL/);
  });

  it("rejects card bodyText longer than 160 characters", async () => {
    await expect(
      sendInteractiveCarousel({
        ...BASE_ARGS,
        cards: [
          { ...CARDS[0], bodyText: "x".repeat(161) },
          CARDS[1],
        ],
      }),
    ).rejects.toThrow(/body text exceeds 160/);
  });

  it("rejects card with no buttons or more than 2 buttons", async () => {
    await expect(
      sendInteractiveCarousel({
        ...BASE_ARGS,
        cards: [
          { ...CARDS[0], buttons: [] },
          { ...CARDS[1], buttons: [] },
        ],
      }),
    ).rejects.toThrow(/must have between 1 and 2 buttons/);

    await expect(
      sendInteractiveCarousel({
        ...BASE_ARGS,
        cards: [
          {
            ...CARDS[0],
            buttons: [
              { id: "1a", title: "A" },
              { id: "1b", title: "B" },
              { id: "1c", title: "C" },
            ],
          },
          {
            ...CARDS[1],
            buttons: [
              { id: "2a", title: "A" },
              { id: "2b", title: "B" },
              { id: "2c", title: "C" },
            ],
          },
        ],
      }),
    ).rejects.toThrow(/must have between 1 and 2 buttons/);
  });

  it("rejects mismatched button counts across cards", async () => {
    await expect(
      sendInteractiveCarousel({
        ...BASE_ARGS,
        cards: [
          {
            ...CARDS[0],
            buttons: [
              { id: "1a", title: "A" },
              { id: "1b", title: "B" },
            ],
          },
          CARDS[1],
        ],
      }),
    ).rejects.toThrow(/same number of buttons/);
  });

  it("rejects duplicate button IDs across cards", async () => {
    await expect(
      sendInteractiveCarousel({
        ...BASE_ARGS,
        cards: [
          { ...CARDS[0], buttons: [{ id: "dup", title: "A" }] },
          { ...CARDS[1], buttons: [{ id: "dup", title: "B" }] },
        ],
      }),
    ).rejects.toThrow(/Duplicate button ID "dup"/);
  });

  it("rejects button title exceeding 25 characters", async () => {
    await expect(
      sendInteractiveCarousel({
        ...BASE_ARGS,
        cards: [
          { ...CARDS[0], buttons: [{ id: "b1", title: "x".repeat(26) }] },
          CARDS[1],
        ],
      }),
    ).rejects.toThrow(/exceeds 25 characters/);
  });

  it("sends the right payload shape when valid", async () => {
    let captured: { body: unknown } | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        captured = { body: JSON.parse(String(init.body)) };
        return new Response(
          JSON.stringify({ messages: [{ id: "wamid.CAROUSEL" }] }),
          { status: 200 },
        );
      }),
    );

    const result = await sendInteractiveCarousel({
      ...BASE_ARGS,
      cards: CARDS,
      contextMessageId: "context-mid-123",
    });

    expect(result).toEqual({ messageId: "wamid.CAROUSEL" });
    expect(captured).not.toBeNull();
    expect(captured!.body).toMatchObject({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "1234567890",
      type: "interactive",
      context: { message_id: "context-mid-123" },
      interactive: {
        type: "carousel",
        body: { text: "Body text" },
        action: {
          cards: [
            {
              card_index: 0,
              type: "cta_url",
              header: {
                type: "image",
                image: { link: "https://example.com/item1.png" },
              },
              body: { text: "Product 1 description" },
              action: {
                buttons: [
                  {
                    type: "quick_reply",
                    quick_reply: { id: "btn_1", title: "Buy 1" },
                  },
                ],
              },
            },
            {
              card_index: 1,
              type: "cta_url",
              header: {
                type: "image",
                image: { link: "https://example.com/item2.png" },
              },
              body: { text: "Product 2 description" },
              action: {
                buttons: [
                  {
                    type: "quick_reply",
                    quick_reply: { id: "btn_2", title: "Buy 2" },
                  },
                ],
              },
            },
          ],
        },
      },
    });
  });
});
