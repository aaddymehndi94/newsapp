# Fixtures

These files are **fake, synthetic** editions for developing and testing the site renderer. The events, people, quotes and figures in them are invented. Source and image URLs are placeholders (`example.com`, `picsum.photos`, `example.invalid`). Never publish them as news. Each file carries `"fixture": true` (not part of the pipeline contract); when any loaded edition has it, every built page shows a "Sample edition" banner.

Each edition has 20 stories and 4 lead stories (ranks 1-4).

- `2026-11-23-pm.json` lists the lead stories inside their sections too and uses the original section order, to test that the renderer de-duplicates and follows the data's order.
- `2026-11-24-am.json` follows the pipeline's real contract: `sections[].storyIds` exclude the lead stories, and sections run india, world, bengaluru, business, science-tech, health-environment, sports.

## Edge cases

| Case | `2026-11-23-pm.json` | `2026-11-24-am.json` |
| --- | --- | --- |
| No `image` key | `sensex-ends-lower-on-profit-booking` | `gold-prices-ease-after-three-day-rally` |
| Broken image URL (`example.invalid`) | `bellandur-lake-froth-restoration` | `chennai-northeast-monsoon-waterlogging` |
| `perspectives` | `states-dispute-gst-compensation-formula` | `labour-codes-rollout-states-split` |
| `video` | `india-australia-second-test-day-three` | `india-australia-second-test-day-four` |
| `developing: true` | `cyclone-landfall-odisha-coast` | `odisha-cyclone-relief-operations` |
| `background: ""`, no `whyItMatters` | `delhi-air-quality-severe-grade`, `sensex-ends-lower-on-profit-booking`, `western-ghats-tahr-count` | `census-enumerator-training-begins`, `gold-prices-ease-after-three-day-rally` |
| `*italic*` in body | `isro-test-flight-crew-module-recovery` | `hyderabad-quantum-lab-error-correction-result` |
| Markdown link in body | `rbi-holds-repo-rate` | `geneva-shipping-levy-talks-adjourn` |
| Very long headline | `uk-rail-strike-ballot-opens` | `pacific-islands-sea-level-fund-announced-at-suva-summit` |
| No `dateline` | `assam-tea-wage-agreement` | `brazil-port-strike-ends` |

Other variations: some sources omit `leaning`, and a few images use `kind: "wikimedia"`. The evening edition has 3 World and 3 Bengaluru stories; the morning edition has the 4 / 2 split.
