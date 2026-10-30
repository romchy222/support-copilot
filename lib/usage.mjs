// Standard text rates verified 2026-10-30. An estimate, never a billing statement.
export function estimateUsage(model, usage) {
    if (!usage)
        return { cost_usd: null, estimated_paid_cost_usd: null };
    if (model !== 'gemini-3.5-flash-lite')
        return { cost_usd: null, estimated_paid_cost_usd: null };
    const input = usage.promptTokenCount || 0, output = (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0);
    return { cost_usd: null, estimated_paid_cost_usd: Number(((input * .30 + output * 2.50) / 1000000).toFixed(8)), free_tier_cost_usd: 0, pricing_date: '2026-10-30', pricing_source: 'https://ai.google.dev/gemini-api/docs/pricing' };
}
