# LLMPriceWatch Context

## Glossary
- **Blended text price index**: `0.8 * inputPricePer1M + 0.2 * outputPricePer1M`, representing a read-heavy text workload.
- **Embedding price index**: the model's input or embedding token price per 1M tokens.
- **Cheaper equivalent**: a model with the same modality, lower price index, same-or-better curated quality band when both have coverage, and satisfying active provider/context filters.
- **Official override**: a manually curated row from provider pricing docs that takes precedence over OpenRouter catalogue pricing.
- **Curated quality**: a manually maintained quality band and score used for comparable cost-per-quality views.
- **Daily cached**: OpenRouter catalogue reads and Claude explanation generation are cached with `cacheLife("days")`.
