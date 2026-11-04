import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/flows/admin-client";
import { loadAiConfig } from "@/lib/ai/config";
import {
  analyzeFlowInput,
  type AnalyzeFlowInputArgs,
} from "@/lib/flows/input-analyzer";
import { retrieveKnowledge } from "@/lib/ai/knowledge";
import { generateReply } from "@/lib/ai/generate";
import { buildSystemPrompt } from "@/lib/ai/defaults";

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const body = (await req.json()) as Partial<AnalyzeFlowInputArgs> & {
      flowId?: string;
    };

    const adminDb = supabaseAdmin();
    const aiConfig = await loadAiConfig(adminDb, ctx.accountId, {
      requireActive: false,
    }).catch(() => null);

    const text = String(body.text ?? "");
    const analysis = await analyzeFlowInput({
      text,
      promptText: body.promptText,
      varKey: body.varKey,
      validation: body.validation,
      regex: body.regex,
      currentVars: body.currentVars,
      conversationHistory: body.conversationHistory,
      aiConfig,
      allowInterruption: body.allowInterruption !== false,
    });

    let aiResponse: string | null = null;
    if (analysis.intent === "interruption" && aiConfig && aiConfig.isActive) {
      try {
        const knowledge = await retrieveKnowledge(
          adminDb,
          ctx.accountId,
          aiConfig,
          text,
        ).catch(() => []);

        const systemPrompt = buildSystemPrompt({
          userPrompt: aiConfig.systemPrompt,
          mode: "auto_reply",
          knowledge,
        });

        const history = (body.conversationHistory ?? []).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const reply = await generateReply({
          config: aiConfig,
          systemPrompt,
          messages: [...history, { role: "user", content: text }],
        });

        aiResponse = reply.text;
      } catch (err) {
        console.warn("[analyze-input] Error generating AI interruption response:", err);
      }
    }

    return NextResponse.json({
      ...analysis,
      ai_response: aiResponse,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

