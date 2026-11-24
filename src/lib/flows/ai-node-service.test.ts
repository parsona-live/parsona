import { describe, expect, it } from 'vitest';
import { extractJsonFromText } from './ai-node-service';

describe('extractJsonFromText', () => {
  it('parses direct JSON string', () => {
    const raw = '{"branch": "interested", "confidence": 0.95}';
    expect(extractJsonFromText(raw)).toEqual({ branch: 'interested', confidence: 0.95 });
  });

  it('parses JSON wrapped in markdown code fences', () => {
    const raw = `Here is the result:
\`\`\`json
{
  "extracted": {
    "date": "2026-11-25",
    "service": "consultation"
  },
  "missing_fields": []
}
\`\`\`
Hope that helps!`;
    const parsed = extractJsonFromText(raw);
    expect(parsed.extracted.date).toBe('2026-11-25');
    expect(parsed.extracted.service).toBe('consultation');
    expect(parsed.missing_fields).toEqual([]);
  });

  it('finds braces even when markdown fences are omitted but text surrounds JSON', () => {
    const raw = `Evaluation outcome:
{ "decision": "trigger", "confidence": 0.88 }
Confirmed.`;
    expect(extractJsonFromText(raw)).toEqual({ decision: 'trigger', confidence: 0.88 });
  });

  it('throws on unparseable JSON', () => {
    expect(() => extractJsonFromText('No json here at all')).toThrow();
  });
});
