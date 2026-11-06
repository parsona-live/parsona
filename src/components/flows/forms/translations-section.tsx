"use client";

import { useState } from "react";
import { Globe, Trash2, Check, Sparkles, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BuilderNode } from "../shared";

interface TranslationsSectionProps {
  node: BuilderNode;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
}

const LANGUAGE_LABELS: Record<string, { name: string; flag: string }> = {
  hinglish: { name: "Hinglish (Conversational)", flag: "🇮🇳" },
  hi: { name: "Hindi (हिंदी)", flag: "🇮🇳" },
  es: { name: "Spanish (Español)", flag: "🇪🇸" },
  ta: { name: "Tamil (தமிழ்)", flag: "🇮🇳" },
  te: { name: "Telugu (తెలుగు)", flag: "🇮🇳" },
  bn: { name: "Bengali (বাংলা)", flag: "🇮🇳" },
  mr: { name: "Marathi (मराठी)", flag: "🇮🇳" },
  gu: { name: "Gujarati (ગુજરાતી)", flag: "🇮🇳" },
  kn: { name: "Kannada (ಕನ್ನಡ)", flag: "🇮🇳" },
  pt: { name: "Portuguese", flag: "🇧🇷" },
  fr: { name: "French", flag: "🇫🇷" },
  ar: { name: "Arabic", flag: "🇦🇪" },
};

export function TranslationsSection({ node, onUpdateConfig }: TranslationsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const cfg = (node.config || {}) as Record<string, any>;
  const translations = (cfg.translations || {}) as Record<string, any>;
  const locales = Object.keys(translations);

  const [selectedLocale, setSelectedLocale] = useState<string>(locales[0] || "hinglish");
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Active translation object for the selected locale
  const activeTranslation = (translations[selectedLocale] || {}) as Record<string, any>;

  // Form states for active locale
  const [formText, setFormText] = useState<string>(
    activeTranslation.text ?? activeTranslation.prompt_text ?? activeTranslation.caption ?? activeTranslation.message ?? ""
  );
  const [formInvalidMsg, setFormInvalidMsg] = useState<string>(activeTranslation.invalid_message ?? "");
  const [formHeaderText, setFormHeaderText] = useState<string>(activeTranslation.header_text ?? "");
  const [formFooterText, setFormFooterText] = useState<string>(activeTranslation.footer_text ?? "");

  const handleSelectLocale = (loc: string) => {
    setSelectedLocale(loc);
    const item = translations[loc] || {};
    setFormText(item.text ?? item.prompt_text ?? item.caption ?? item.message ?? "");
    setFormInvalidMsg(item.invalid_message ?? "");
    setFormHeaderText(item.header_text ?? "");
    setFormFooterText(item.footer_text ?? "");
    setSavedSuccess(false);
  };

  const handleAddLanguage = (loc: string) => {
    const existing = translations[loc] || {};
    const updated = {
      ...translations,
      [loc]: {
        ...existing,
        ...(node.node_type === "collect_input" || node.node_type === "input_flow"
          ? { prompt_text: existing.prompt_text || "" }
          : node.node_type === "send_media"
          ? { caption: existing.caption || "" }
          : node.node_type === "handoff" || node.node_type === "agent_handover"
          ? { message: existing.message || "" }
          : { text: existing.text || "" }),
      },
    };
    onUpdateConfig({ translations: updated });
    handleSelectLocale(loc);
    if (!isOpen) setIsOpen(true);
  };

  const handleSaveTranslation = () => {
    if (!selectedLocale) return;

    const currentLocObj = translations[selectedLocale] || {};
    const isInputNode = node.node_type === "collect_input" || node.node_type === "input_flow";
    const isMediaNode = node.node_type === "send_media";
    const isHandoffNode = node.node_type === "handoff" || node.node_type === "agent_handover";

    const updatedLocObj: Record<string, unknown> = {
      ...currentLocObj,
      ...(isInputNode
        ? { prompt_text: formText, invalid_message: formInvalidMsg || undefined }
        : isMediaNode
        ? { caption: formText }
        : isHandoffNode
        ? { message: formText }
        : {
            text: formText,
            header_text: formHeaderText || undefined,
            footer_text: formFooterText || undefined,
          }),
    };

    onUpdateConfig({
      translations: {
        ...translations,
        [selectedLocale]: updatedLocObj,
      },
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleDeleteTranslation = (localeToDelete: string) => {
    const updated = { ...translations };
    delete updated[localeToDelete];

    onUpdateConfig({ translations: updated });

    const remaining = Object.keys(updated);
    if (remaining.length > 0) {
      handleSelectLocale(remaining[0]);
    }
  };

  const isInputNode = node.node_type === "collect_input" || node.node_type === "input_flow";
  const isMediaNode = node.node_type === "send_media";
  const isHandoffNode = node.node_type === "handoff" || node.node_type === "agent_handover";

  // Check what available languages aren't added yet
  const availableToAdd = Object.keys(LANGUAGE_LABELS).filter((k) => !locales.includes(k));

  return (
    <div className="rounded-lg border border-border/70 bg-card/60 p-3 text-xs transition-colors">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between font-medium text-foreground hover:opacity-90"
      >
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <span>Multi-Lingual Translations</span>
          {locales.length > 0 ? (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
              {locales.length} saved
            </Badge>
          ) : (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground font-normal">
              Self-Learning
            </Badge>
          )}
        </div>
        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3 pt-2 border-t border-border/50">
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">💡 Auto-Learning: </span>
            When a customer speaks in <strong>Hindi</strong> or <strong>Hinglish</strong>, the AI automatically translates this node and caches it below. All future customers speaking that language receive the saved message with <strong>0ms latency</strong> and <strong>0 token cost</strong>.
          </div>

          {/* Locale Selector & Add Language */}
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <div className="flex flex-wrap gap-1.5">
              {locales.map((loc) => {
                const meta = LANGUAGE_LABELS[loc] || { name: loc, flag: "🌐" };
                const isSelected = loc === selectedLocale;
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => handleSelectLocale(loc)}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-medium shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    <span>{meta.flag}</span>
                    <span>{meta.name}</span>
                  </button>
                );
              })}
            </div>

            {availableToAdd.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  type="button"
                  className="inline-flex items-center gap-1 h-6 px-2 text-[10px] text-primary hover:text-primary hover:bg-muted/80 rounded transition-colors cursor-pointer select-none font-medium"
                >
                  <Plus className="h-3 w-3 mr-0.5" />
                  Add Language
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 text-xs max-h-56 overflow-y-auto">
                  {availableToAdd.map((k) => (
                    <DropdownMenuItem key={k} onClick={() => handleAddLanguage(k)} className="cursor-pointer gap-2">
                      <span>{LANGUAGE_LABELS[k].flag}</span>
                      <span>{LANGUAGE_LABELS[k].name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {locales.length === 0 ? (
            <div className="rounded border border-dashed border-border/80 bg-muted/40 p-3 text-center text-muted-foreground text-[11px]">
              <Sparkles className="mx-auto mb-1 h-4 w-4 text-primary/70" />
              No translations cached yet. The first customer message in Hindi or Hinglish will auto-populate this, or click <strong>&quot;+ Add Language&quot;</strong> above to write one manually.
            </div>
          ) : (
            <div className="space-y-2.5">
              {selectedLocale && (
                <div className="rounded-md border border-border/60 bg-background/50 p-2.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                      <span>{LANGUAGE_LABELS[selectedLocale]?.flag || "🌐"}</span>
                      <span>{LANGUAGE_LABELS[selectedLocale]?.name || selectedLocale} Content</span>
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTranslation(selectedLocale)}
                      className="h-6 px-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-[10px]"
                      title="Clear this translation cache"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  </div>

                  {/* Header text if present on the original node */}
                  {Boolean(cfg.header_text) && (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Header Text ({selectedLocale})</Label>
                      <Input
                        value={formHeaderText}
                        onChange={(e) => {
                          setFormHeaderText(e.target.value);
                          setSavedSuccess(false);
                        }}
                        placeholder="Header text translation..."
                        className="text-xs bg-muted/50 h-7"
                      />
                    </div>
                  )}

                  {/* Main text / prompt / caption / message */}
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">
                      {isInputNode
                        ? `Prompt Question (${selectedLocale})`
                        : isMediaNode
                        ? `Media Caption (${selectedLocale})`
                        : isHandoffNode
                        ? `Transfer Message (${selectedLocale})`
                        : `Message Body (${selectedLocale})`}
                    </Label>
                    <Textarea
                      rows={3}
                      value={formText}
                      onChange={(e) => {
                        setFormText(e.target.value);
                        setSavedSuccess(false);
                      }}
                      placeholder="Enter or customize translated text..."
                      className="text-xs bg-muted/50 resize-y"
                    />
                  </div>

                  {/* Invalid / Reprompt message for input nodes if configured */}
                  {isInputNode && (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Invalid Input Retry Message ({selectedLocale})
                      </Label>
                      <Input
                        value={formInvalidMsg}
                        onChange={(e) => {
                          setFormInvalidMsg(e.target.value);
                          setSavedSuccess(false);
                        }}
                        placeholder="e.g. Kripya sahi email address enter karein..."
                        className="text-xs bg-muted/50 h-7"
                      />
                    </div>
                  )}

                  {/* Footer text if present on the original node */}
                  {Boolean(cfg.footer_text) && (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Footer Text ({selectedLocale})</Label>
                      <Input
                        value={formFooterText}
                        onChange={(e) => {
                          setFormFooterText(e.target.value);
                          setSavedSuccess(false);
                        }}
                        placeholder="Footer text translation..."
                        className="text-xs bg-muted/50 h-7"
                      />
                    </div>
                  )}

                  {/* Buttons preview if interactive buttons node */}
                  {Array.isArray(activeTranslation?.buttons) && activeTranslation.buttons.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Localized Button Titles
                      </Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {activeTranslation.buttons.map((b: { reply_id: string; title: string }, bIdx: number) => (
                          <div key={b.reply_id || bIdx} className="rounded bg-muted/60 px-2 py-1 text-[11px]">
                            <span className="text-muted-foreground font-mono text-[9px] block">
                              {b.reply_id}
                            </span>
                            <span className="font-medium text-foreground">{b.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-muted-foreground">
                      Edit here to fine-tune the AI wording.
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveTranslation}
                      className="h-6 text-[11px] px-2.5"
                    >
                      {savedSuccess ? (
                        <>
                          <Check className="h-3 w-3 mr-1 text-green-400" />
                          Saved!
                        </>
                      ) : (
                        "Save Translation"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
