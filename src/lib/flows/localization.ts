/**
 * Dynamic real-time AI localization for WhatsApp flows with self-learning persistent caching.
 *
 * Translates outgoing prompts, button labels, and list options into the
 * customer's detected language on-the-fly while preserving 100% of the
 * underlying deterministic routing IDs (node_key, reply_id, button.id, row.id).
 *
 * First-time translations for a node in a language (e.g. 'hinglish' or 'hi') are
 * persisted into flow_nodes.config.translations so subsequent visits for ANY customer
 * have 0ms latency and 0 AI token cost.
 */

import type { AiConfig } from "@/lib/ai/types";
import { generateReply } from "@/lib/ai/generate";
import { logAiUsage } from "@/lib/ai/usage";
import type {
  FlowNodeRow,
  SendButtonsNodeConfig,
  SendListNodeConfig,
  SendCarouselNodeConfig,
  CollectInputNodeConfig,
  SendMessageNodeConfig,
  SendMediaNodeConfig,
  RequestAddressNodeConfig,
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
  db?: any,
  accountId?: string,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || !targetLocale || targetLocale.toLowerCase().startsWith("en")) {
    return text;
  }

  const normalizedLocale = targetLocale.toLowerCase().trim();
  const cacheKey = `${normalizedLocale}:${trimmed}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  if (!aiConfig || !aiConfig.isActive) {
    return text;
  }

  try {
    let systemPrompt: string;

    if (normalizedLocale === "hinglish") {
      systemPrompt = `You are a professional, natural translator for a WhatsApp customer service bot.
Translate the following short message/label into natural Hinglish (conversational Hindi written in English/Latin alphabet, e.g. "Main aapko details share kar deta hoon").
Guidelines:
- Use natural, polite, friendly conversational Romanized Hindi (Hinglish).
- NEVER use Devanagari script for Hinglish. Use only English/Latin alphabet letters.
- Preserve variables or placeholders like {{var_name}} or {{contact.name}} exactly as-is.
- Preserve emojis.
- Return ONLY the translation, with no explanation, quotes, or markdown.`;
    } else if (normalizedLocale === "hi" || normalizedLocale.startsWith("hi-")) {
      systemPrompt = `You are a professional, natural translator for a WhatsApp customer service bot.
Translate the following short message/label into Hindi (हिंदी) in Devanagari script.
Guidelines:
- Keep the tone polite, professional, and clear.
- Preserve variables or placeholders like {{var_name}} or {{contact.name}} exactly as-is.
- Preserve emojis.
- Return ONLY the translation, with no explanation, quotes, or markdown.`;
    } else {
      systemPrompt = `You are a professional, natural translator for a WhatsApp customer service bot.
Translate the following short message/label into language "${targetLocale}".
Guidelines:
- Keep the exact tone (polite, direct, professional).
- Preserve variables or placeholders like {{var_name}} or {{contact.name}} exactly as-is.
- Preserve emojis.
- Return ONLY the translation, with no explanation, quotes, or markdown.`;
    }

    const res = await generateReply({
      config: aiConfig,
      systemPrompt,
      messages: [{ role: "user", content: trimmed }],
    });

    // Log AI token usage to ai_usage_log so it reflects in the usage dashboard
    if (res.usage && db && accountId) {
      void logAiUsage(db, {
        accountId,
        conversationId: null,
        mode: "auto_reply",
        provider: aiConfig.provider,
        model: aiConfig.model,
        usage: res.usage,
      });
    }

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
 * Apply saved translation from node.config.translations[targetLocale] without calling AI.
 */
export function applySavedTranslation(
  node: FlowNodeRow,
  saved: Record<string, unknown>,
): FlowNodeRow {
  // Deep clone to guarantee the original English node.config is never mutated in memory
  const cfg = JSON.parse(JSON.stringify(node.config || {}));

  switch (node.node_type) {
    case "send_message": {
      if (typeof saved.text === "string") cfg.text = saved.text;
      if (typeof saved.header_text === "string") cfg.header_text = saved.header_text;
      break;
    }
    case "collect_input":
    case "input_flow": {
      if (typeof saved.prompt_text === "string") cfg.prompt_text = saved.prompt_text;
      if (typeof saved.invalid_message === "string") cfg.invalid_message = saved.invalid_message;
      break;
    }
    case "send_buttons": {
      const bCfg = cfg as unknown as SendButtonsNodeConfig;
      if (typeof saved.text === "string") bCfg.text = saved.text;
      if (typeof saved.header_text === "string") bCfg.header_text = saved.header_text;
      if (typeof saved.footer_text === "string") bCfg.footer_text = saved.footer_text;
      if (Array.isArray(saved.buttons) && Array.isArray(bCfg.buttons)) {
        bCfg.buttons = bCfg.buttons.map((btn) => {
          const match = (saved.buttons as Array<{ reply_id: string; title: string }>).find(
            (s) => s.reply_id === btn.reply_id,
          );
          return match ? { ...btn, title: match.title } : btn;
        });
      }
      break;
    }
    case "send_list": {
      const lCfg = cfg as unknown as SendListNodeConfig;
      if (typeof saved.text === "string") lCfg.text = saved.text;
      if (typeof saved.header_text === "string") lCfg.header_text = saved.header_text;
      if (typeof saved.footer_text === "string") lCfg.footer_text = saved.footer_text;
      if (typeof saved.button_label === "string") lCfg.button_label = saved.button_label;
      if (Array.isArray(saved.sections) && Array.isArray(lCfg.sections)) {
        lCfg.sections = lCfg.sections.map((sec, sIdx) => {
          const savedSec = (saved.sections as Array<{ title?: string; rows?: Array<{ reply_id: string; title: string; description?: string }> }>)[sIdx];
          const newRows = sec.rows?.map((row) => {
            const matchRow = savedSec?.rows?.find((r) => r.reply_id === row.reply_id);
            return matchRow
              ? {
                  ...row,
                  title: matchRow.title ?? row.title,
                  description: matchRow.description ?? row.description,
                }
              : row;
          });
          return {
            ...sec,
            title: savedSec?.title ?? sec.title,
            rows: newRows ?? sec.rows,
          };
        });
      }
      break;
    }
    case "send_carousel": {
      const cCfg = cfg as unknown as SendCarouselNodeConfig;
      if (typeof saved.text === "string") cCfg.text = saved.text;
      if (Array.isArray(saved.cards) && Array.isArray(cCfg.cards)) {
        cCfg.cards = cCfg.cards.map((card, cIdx) => {
          const savedCard = (saved.cards as Array<{ body_text?: string; buttons?: Array<{ reply_id: string; title: string }> }>)[cIdx];
          const newButtons = card.buttons?.map((btn) => {
            const matchBtn = savedCard?.buttons?.find((b) => b.reply_id === btn.reply_id);
            return matchBtn ? { ...btn, title: matchBtn.title } : btn;
          });
          return {
            ...card,
            body_text: savedCard?.body_text ?? card.body_text,
            buttons: newButtons ?? card.buttons,
          };
        });
      }
      break;
    }
    case "send_media": {
      if (typeof saved.caption === "string") cfg.caption = saved.caption;
      break;
    }
    case "request_address": {
      if (typeof saved.text === "string") cfg.text = saved.text;
      if (typeof saved.header_text === "string") cfg.header_text = saved.header_text;
      if (typeof saved.footer_text === "string") cfg.footer_text = saved.footer_text;
      break;
    }
    case "handoff":
    case "agent_handover": {
      if (typeof saved.message === "string") cfg.message = saved.message;
      if (typeof saved.note === "string") cfg.note = saved.note;
      break;
    }
  }

  return { ...node, config: cfg };
}

/**
 * Persist translated node config to Supabase asynchronously.
 */
export async function persistNodeTranslation(
  db: any,
  nodeId: string,
  updatedConfig: Record<string, unknown>,
): Promise<void> {
  if (!db || !nodeId) return;
  try {
    await db
      .from("flow_nodes")
      .update({ config: updatedConfig })
      .eq("id", nodeId);
  } catch (err) {
    console.warn("[localization] Failed to persist node translation to database:", err);
  }
}

/**
 * Localize all user-facing content of a flow node before dispatch.
 * Routing keys and reply IDs remain completely untouched.
 *
 * Checks node.config.translations[targetLocale] first for 0ms instant cached delivery.
 * If not found, calls AI translation and persists the result to node.config.translations.
 */
export async function localizeNode(
  node: FlowNodeRow,
  targetLocale: string,
  aiConfig?: AiConfig | null,
  db?: any,
  accountId?: string,
): Promise<FlowNodeRow> {
  if (!targetLocale || targetLocale.toLowerCase().startsWith("en")) {
    return node;
  }

  const normalizedLocale = targetLocale.toLowerCase().trim();
  const currentConfig = (node.config || {}) as Record<string, unknown>;
  const existingTranslations = (currentConfig.translations as Record<string, unknown>) || {};

  // 1. Check if translation is already cached in node config
  const savedTranslation = existingTranslations[normalizedLocale];
  if (savedTranslation && typeof savedTranslation === "object") {
    return applySavedTranslation(node, savedTranslation as Record<string, unknown>);
  }

  // 2. If no AI config, we cannot translate -> return original
  if (!aiConfig || !aiConfig.isActive) {
    return node;
  }

  try {
    let localizedNode = node;
    let newTranslationRecord: Record<string, unknown> | null = null;

    switch (node.node_type) {
      case "send_message": {
        const cfg = node.config as unknown as SendMessageNodeConfig;
        const text = await localizeText(cfg.text, normalizedLocale, aiConfig, db, accountId);
        const header_text = cfg.header_text
          ? await localizeText(cfg.header_text, normalizedLocale, aiConfig, db, accountId)
          : undefined;

        newTranslationRecord = { text, header_text };
        localizedNode = {
          ...node,
          config: { ...cfg, text, header_text } as unknown as Record<string, unknown>,
        };
        break;
      }

      case "collect_input":
      case "input_flow": {
        const cfg = node.config as unknown as CollectInputNodeConfig;
        const prompt_text = await localizeText(cfg.prompt_text, normalizedLocale, aiConfig, db, accountId);
        const invalid_message = cfg.invalid_message
          ? await localizeText(cfg.invalid_message, normalizedLocale, aiConfig, db, accountId)
          : undefined;

        newTranslationRecord = { prompt_text, invalid_message };
        localizedNode = {
          ...node,
          config: { ...cfg, prompt_text, invalid_message } as unknown as Record<string, unknown>,
        };
        break;
      }

      case "send_buttons": {
        const cfg = node.config as unknown as SendButtonsNodeConfig;
        const [text, header_text, footer_text] = await Promise.all([
          localizeText(cfg.text, normalizedLocale, aiConfig, db, accountId),
          cfg.header_text ? localizeText(cfg.header_text, normalizedLocale, aiConfig, db, accountId) : Promise.resolve(undefined),
          cfg.footer_text ? localizeText(cfg.footer_text, normalizedLocale, aiConfig, db, accountId) : Promise.resolve(undefined),
        ]);

        const localizedButtons = await Promise.all(
          cfg.buttons.map(async (btn) => {
            const rawTitle = await localizeText(btn.title, normalizedLocale, aiConfig, db, accountId);
            // WhatsApp has a strict 20-character limit on quick reply buttons
            const title = rawTitle.length > 20 ? rawTitle.slice(0, 20) : rawTitle;
            return {
              ...btn,
              title,
              // reply_id and next_node_key are strictly preserved!
            };
          }),
        );

        newTranslationRecord = {
          text,
          header_text,
          footer_text,
          buttons: localizedButtons.map((b) => ({ reply_id: b.reply_id, title: b.title })),
        };

        localizedNode = {
          ...node,
          config: {
            ...cfg,
            text,
            header_text,
            footer_text,
            buttons: localizedButtons,
          } as unknown as Record<string, unknown>,
        };
        break;
      }

      case "send_list": {
        const cfg = node.config as unknown as SendListNodeConfig;
        const [text, header_text, footer_text, button_label] = await Promise.all([
          localizeText(cfg.text, normalizedLocale, aiConfig, db, accountId),
          cfg.header_text ? localizeText(cfg.header_text, normalizedLocale, aiConfig, db, accountId) : Promise.resolve(undefined),
          cfg.footer_text ? localizeText(cfg.footer_text, normalizedLocale, aiConfig, db, accountId) : Promise.resolve(undefined),
          localizeText(cfg.button_label, normalizedLocale, aiConfig, db, accountId),
        ]);

        const localizedSections = await Promise.all(
          cfg.sections.map(async (sec) => ({
            ...sec,
            title: sec.title ? await localizeText(sec.title, normalizedLocale, aiConfig, db, accountId) : undefined,
            rows: await Promise.all(
              sec.rows.map(async (row) => ({
                ...row,
                title: await localizeText(row.title, normalizedLocale, aiConfig, db, accountId),
                description: row.description
                  ? await localizeText(row.description, normalizedLocale, aiConfig, db, accountId)
                  : undefined,
              })),
            ),
          })),
        );

        newTranslationRecord = {
          text,
          header_text,
          footer_text,
          button_label: button_label.length > 20 ? button_label.slice(0, 20) : button_label,
          sections: localizedSections.map((s) => ({
            title: s.title,
            rows: s.rows.map((r) => ({
              reply_id: r.reply_id,
              title: r.title.length > 24 ? r.title.slice(0, 24) : r.title,
              description: r.description ? (r.description.length > 72 ? r.description.slice(0, 72) : r.description) : undefined,
            })),
          })),
        };

        localizedNode = {
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
        break;
      }

      case "send_carousel": {
        const cfg = node.config as unknown as SendCarouselNodeConfig;
        const text = await localizeText(cfg.text, normalizedLocale, aiConfig, db, accountId);
        const localizedCards = await Promise.all(
          cfg.cards.map(async (card) => ({
            ...card,
            body_text: card.body_text ? await localizeText(card.body_text, normalizedLocale, aiConfig, db, accountId) : undefined,
            buttons: await Promise.all(
              card.buttons.map(async (btn) => {
                const title = await localizeText(btn.title, normalizedLocale, aiConfig, db, accountId);
                return {
                  ...btn,
                  title: title.length > 20 ? title.slice(0, 20) : title,
                };
              }),
            ),
          })),
        );

        newTranslationRecord = {
          text,
          cards: localizedCards.map((c) => ({
            body_text: c.body_text,
            buttons: c.buttons.map((b) => ({ reply_id: b.reply_id, title: b.title })),
          })),
        };

        localizedNode = {
          ...node,
          config: {
            ...cfg,
            text,
            cards: localizedCards,
          } as unknown as Record<string, unknown>,
        };
        break;
      }

      case "send_media": {
        const cfg = node.config as unknown as SendMediaNodeConfig;
        const caption = cfg.caption ? await localizeText(cfg.caption, normalizedLocale, aiConfig, db, accountId) : undefined;
        newTranslationRecord = { caption };
        localizedNode = {
          ...node,
          config: { ...cfg, caption } as unknown as Record<string, unknown>,
        };
        break;
      }

      case "request_address": {
        const cfg = node.config as unknown as RequestAddressNodeConfig;
        const [text, header_text, footer_text] = await Promise.all([
          localizeText(cfg.text, normalizedLocale, aiConfig, db, accountId),
          cfg.header_text ? localizeText(cfg.header_text, normalizedLocale, aiConfig, db, accountId) : Promise.resolve(undefined),
          cfg.footer_text ? localizeText(cfg.footer_text, normalizedLocale, aiConfig, db, accountId) : Promise.resolve(undefined),
        ]);
        newTranslationRecord = { text, header_text, footer_text };
        localizedNode = {
          ...node,
          config: { ...cfg, text, header_text, footer_text } as unknown as Record<string, unknown>,
        };
        break;
      }

      case "handoff":
      case "agent_handover": {
        const cfg = node.config as { message?: string; note?: string; assign_to?: string };
        const message = cfg.message
          ? await localizeText(cfg.message, normalizedLocale, aiConfig, db, accountId)
          : undefined;
        const note = cfg.note
          ? await localizeText(cfg.note, normalizedLocale, aiConfig, db, accountId)
          : undefined;

        newTranslationRecord = { message, note };
        localizedNode = {
          ...node,
          config: { ...cfg, message, note } as unknown as Record<string, unknown>,
        };
        break;
      }

      default:
        return node;
    }

    // 3. Save new translation into node config and persist to DB
    // CRITICAL: Preserve the original English config (currentConfig) at the root level!
    // The root properties (text, prompt_text, header_text, buttons, etc.) MUST stay in English.
    // Translations must ONLY be stored inside the `translations[locale]` nested object.
    if (newTranslationRecord && node.id) {
      const persistedConfig = {
        ...currentConfig, // Keeps the original root English text completely untouched!
        translations: {
          ...existingTranslations,
          [normalizedLocale]: newTranslationRecord,
        },
      };

      // The original node in memory and in DB retains its root English copy + translations map
      node.config = persistedConfig;

      // The localized node returned for immediate dispatch has the translated text, plus the translations map
      localizedNode = {
        ...localizedNode,
        config: {
          ...localizedNode.config,
          translations: persistedConfig.translations,
        },
      };

      // Asynchronously update flow_nodes table in DB with the original English text + updated translations
      if (db) {
        void persistNodeTranslation(db, node.id, persistedConfig);
      }
    }

    return localizedNode;
  } catch (err) {
    console.warn("[localization] Node localization failed, returning original:", err);
    return node;
  }
}
