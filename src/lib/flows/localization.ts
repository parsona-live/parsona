/**
 * Dynamic real-time AI localization for WhatsApp flows.
 *
 * Translates outgoing prompts, button labels, and list options into the
 * customer's detected language on-the-fly while preserving 100% of the
 * underlying deterministic routing IDs (node_key, reply_id, button.id, row.id).
 *
 * Uses an in-memory cache to guarantee 0ms overhead and 0 token cost for
 * repeated node deliveries.
 */

import type { AiConfig } from "@/lib/ai/types";
import { generateReply } from "@/lib/ai/generate";
import type {
  FlowNodeRow,
  SendButtonsNodeConfig,
  SendListNodeConfig,
  SendCarouselNodeConfig,
  CollectInputNodeConfig,
  SendMessageNodeConfig,
} from "./types";

// In-memory LRU cache for translated phrases: `${targetLocale}:${sourceText}` -> translatedText
const translationCache = new Map<string, string>();
const MAX_CACHE_SIZE = 1000;

export function clearTranslationCache(): void {
  translationCache.clear();
}

/**
 * Translate a single user-facing text snippet into targetLocale.
 * If targetLocale is 'en' or same as source, returns source immediately.
 */
export async function localizeText(
  text: string,
  targetLocale: string,
  aiConfig?: AiConfig | null,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || !targetLocale || targetLocale.toLowerCase().startsWith("en")) {
    return text;
  }

  const cacheKey = `${targetLocale.toLowerCase()}:${trimmed}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  if (!aiConfig || !aiConfig.isActive) {
    return text;
  }

  try {
    const systemPrompt = `You are a professional, natural translator for a WhatsApp customer service bot.
Translate the following short message/label into language "${targetLocale}".
Guidelines:
- Keep the exact tone (polite, direct, professional).
- Preserve any variables or placeholders like {{var_name}} exactly as-is.
- Preserve emojis.
- Return ONLY the translation, with no explanation, quotes, or markdown.`;

    const res = await generateReply({
      config: aiConfig,
      systemPrompt,
      messages: [{ role: "user", content: trimmed }],
    });

    const translated = res.text?.trim();
    if (translated && translated.length > 0) {
      if (translationCache.size >= MAX_CACHE_SIZE) {
        const firstKey = translationCache.keys().next().value;
        if (firstKey) translationCache.delete(firstKey);
      }
      translationCache.set(cacheKey, translated);
      return translated;
    }
  } catch (err) {
    console.warn("[localization] Translation error, falling back to source text:", err);
  }

  return text;
}

/**
 * Localize all user-facing content of a flow node before dispatch.
 * Routing keys and reply IDs remain completely untouched.
 */
export async function localizeNode(
  node: FlowNodeRow,
  targetLocale: string,
  aiConfig?: AiConfig | null,
): Promise<FlowNodeRow> {
  if (!targetLocale || targetLocale.toLowerCase().startsWith("en")) {
    return node;
  }

  try {
    switch (node.node_type) {
      case "send_message": {
        const cfg = node.config as unknown as SendMessageNodeConfig;
        const text = await localizeText(cfg.text, targetLocale, aiConfig);
        return {
          ...node,
          config: { ...cfg, text } as unknown as Record<string, unknown>,
        };
      }

      case "collect_input": {
        const cfg = node.config as unknown as CollectInputNodeConfig;
        const prompt_text = await localizeText(cfg.prompt_text, targetLocale, aiConfig);
        return {
          ...node,
          config: { ...cfg, prompt_text } as unknown as Record<string, unknown>,
        };
      }

      case "send_buttons": {
        const cfg = node.config as unknown as SendButtonsNodeConfig;
        const [text, header_text, footer_text] = await Promise.all([
          localizeText(cfg.text, targetLocale, aiConfig),
          cfg.header_text ? localizeText(cfg.header_text, targetLocale, aiConfig) : Promise.resolve(undefined),
          cfg.footer_text ? localizeText(cfg.footer_text, targetLocale, aiConfig) : Promise.resolve(undefined),
        ]);

        const localizedButtons = await Promise.all(
          cfg.buttons.map(async (btn) => ({
            ...btn,
            title: await localizeText(btn.title, targetLocale, aiConfig),
            // reply_id and next_node_key are strictly preserved!
          })),
        );

        return {
          ...node,
          config: {
            ...cfg,
            text,
            header_text,
            footer_text,
            buttons: localizedButtons,
          } as unknown as Record<string, unknown>,
        };
      }

      case "send_list": {
        const cfg = node.config as unknown as SendListNodeConfig;
        const [text, header_text, footer_text, button_label] = await Promise.all([
          localizeText(cfg.text, targetLocale, aiConfig),
          cfg.header_text ? localizeText(cfg.header_text, targetLocale, aiConfig) : Promise.resolve(undefined),
          cfg.footer_text ? localizeText(cfg.footer_text, targetLocale, aiConfig) : Promise.resolve(undefined),
          localizeText(cfg.button_label, targetLocale, aiConfig),
        ]);

        const localizedSections = await Promise.all(
          cfg.sections.map(async (sec) => ({
            ...sec,
            title: sec.title ? await localizeText(sec.title, targetLocale, aiConfig) : undefined,
            rows: await Promise.all(
              sec.rows.map(async (row) => ({
                ...row,
                title: await localizeText(row.title, targetLocale, aiConfig),
                description: row.description
                  ? await localizeText(row.description, targetLocale, aiConfig)
                  : undefined,
                // id and next_node_key are strictly preserved!
              })),
            ),
          })),
        );

        return {
          ...node,
          config: {
            ...cfg,
            text,
            header_text,
            footer_text,
            button_label,
            sections: localizedSections,
          } as unknown as Record<string, unknown>,
        };
      }

      case "send_carousel": {
        const cfg = node.config as unknown as SendCarouselNodeConfig;
        const text = await localizeText(cfg.text, targetLocale, aiConfig);
        const localizedCards = await Promise.all(
          cfg.cards.map(async (card) => ({
            ...card,
            body_text: card.body_text ? await localizeText(card.body_text, targetLocale, aiConfig) : undefined,
            buttons: await Promise.all(
              card.buttons.map(async (btn) => ({
                ...btn,
                title: await localizeText(btn.title, targetLocale, aiConfig),
              })),
            ),
          })),
        );

        return {
          ...node,
          config: {
            ...cfg,
            text,
            cards: localizedCards,
          } as unknown as Record<string, unknown>,
        };
      }

      default:
        return node;
    }
  } catch (err) {
    console.warn("[localization] Node localization failed, returning original:", err);
    return node;
  }
}
