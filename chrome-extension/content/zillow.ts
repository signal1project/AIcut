/**
 * Zillow listing extractor — Task 32
 *
 * Reads listing data from Zillow's Next.js __NEXT_DATA__ hydration payload
 * (most reliable source — avoids scraping brittle DOM classes).
 * Falls back to DOM extraction if payload is unavailable.
 */
import { injectCaptureButton, type ListingData } from '../utils/overlay.js';

function parsePriceCents(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Math.round(raw * 100);
  if (typeof raw === 'string') {
    const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    return isNaN(n) ? undefined : n * 100;
  }
  return undefined;
}

function extractZillow(): ListingData | null {
  // ── Try Next.js hydration data first ──────────────────────────────────────
  try {
    const el = document.getElementById('__NEXT_DATA__');
    if (el) {
      const data = JSON.parse(el.textContent ?? '{}');
      // Navigate to property details (path varies by page type)
      const props =
        data?.props?.pageProps?.gdpClientCache ??
        data?.props?.pageProps?.initialData?.building ??
        data?.props?.pageProps?.initialReduxState?.gdp?.propertyDetails;

      if (props) {
        // gdpClientCache is a map keyed by URL; grab first value
        const detail = typeof props === 'object' && !Array.isArray(props)
          ? (Object.values(props)[0] as any)?.property ?? Object.values(props)[0]
          : props;

        if (detail?.address) {
          return {
            source:       'zillow',
            mlsNumber:    detail.mlsid ?? detail.zestimate?.mlsNumber,
            address:      detail.address?.streetAddress ?? detail.address,
            city:         detail.address?.city ?? '',
            state:        detail.address?.state ?? '',
            zip:          detail.address?.zipcode ?? '',
            price:        parsePriceCents(detail.price ?? detail.zestimate?.amount),
            beds:         detail.bedrooms ?? detail.beds,
            baths:        detail.bathrooms ?? detail.baths,
            sqft:         detail.livingArea ?? detail.floorSize,
            lotSqft:      detail.lotSize,
            yearBuilt:    detail.yearBuilt,
            propertyType: detail.homeType?.toLowerCase(),
            status:       detail.homeStatus?.toLowerCase(),
            daysOnMarket: detail.daysOnZillow,
            description:  detail.description,
            photoUrls:    (detail.photos ?? detail.images ?? [])
                            .slice(0, 10)
                            .map((p: any) => p.url ?? p.mixedSources?.jpeg?.[0]?.url ?? p),
            agentName:    detail.attributionInfo?.agentName,
            agentPhone:   detail.attributionInfo?.agentPhoneNumber,
            listingUrl:   window.location.href,
          };
        }
      }
    }
  } catch { /* fall through to DOM */ }

  // ── DOM fallback ──────────────────────────────────────────────────────────
  const priceEl   = document.querySelector('[data-testid="price"]');
  const addrEl    = document.querySelector('[data-testid="home-details-summary-headline"]') ??
                    document.querySelector('h1');
  const bedsEl    = document.querySelector('[data-testid="bed-bath-item"]:first-child');
  const bathsEl   = document.querySelector('[data-testid="bed-bath-item"]:last-child');
  const sqftEl    = document.querySelector('[data-testid="floor-space"]');

  if (!addrEl) return null;

  // Parse "123 Main St, City, ST 12345"
  const addrText = addrEl.textContent?.trim() ?? '';
  const addrMatch = addrText.match(/^(.+),\s*(.+),\s*([A-Z]{2})\s*(\d{5})/);

  return {
    source:    'zillow',
    address:   addrMatch?.[1] ?? addrText,
    city:      addrMatch?.[2] ?? '',
    state:     addrMatch?.[3] ?? '',
    zip:       addrMatch?.[4] ?? '',
    price:     parsePriceCents(priceEl?.textContent),
    beds:      parseFloat(bedsEl?.textContent ?? '') || undefined,
    baths:     parseFloat(bathsEl?.textContent ?? '') || undefined,
    sqft:      parseInt(sqftEl?.textContent?.replace(/[^0-9]/g, '') ?? '', 10) || undefined,
    listingUrl: window.location.href,
    photoUrls: Array.from(document.querySelectorAll('img[src*="photos.zillowstatic"]'))
                    .slice(0, 10)
                    .map((img) => (img as HTMLImageElement).src),
  };
}

// Inject capture button once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => injectCaptureButton(extractZillow));
} else {
  injectCaptureButton(extractZillow);
}
