/**
 * Realtor.com listing extractor — Task 33
 *
 * Reads from the __NEXT_DATA__ hydration payload.
 * Photo fix: Realtor.com appends size params — we strip & use highest-res.
 */
import { injectCaptureButton, type ListingData } from '../utils/overlay.js';

function fixPhotoUrl(url: string): string {
  // Strip Realtor.com image resizing params (e.g. ?w=640&q=75) for full-res
  try {
    const u = new URL(url);
    u.search = '';
    return u.toString();
  } catch {
    return url;
  }
}

function extractRealtor(): ListingData | null {
  // ── Next.js hydration ────────────────────────────────────────────────────
  try {
    const el = document.getElementById('__NEXT_DATA__');
    if (el) {
      const data = JSON.parse(el.textContent ?? '{}');
      const listing =
        data?.props?.pageProps?.initialProps?.propertyDetails ??
        data?.props?.pageProps?.listing ??
        data?.props?.pageProps?.propertyDetails;

      if (listing) {
        const loc    = listing.location?.address ?? listing.address ?? {};
        const details = listing.description ?? listing;

        return {
          source:       'realtor',
          mlsNumber:    listing.source?.listing_id ?? listing.mls?.listing_id,
          address:      loc.line ?? loc.street ?? '',
          city:         loc.city ?? '',
          state:        loc.state_code ?? loc.state ?? '',
          zip:          loc.postal_code ?? '',
          price:        listing.list_price != null
                          ? Math.round(listing.list_price * 100)
                          : undefined,
          beds:         details.beds ?? details.beds_min,
          baths:        details.baths_consolidated ?? details.baths,
          sqft:         details.sqft ?? details.sqft_min,
          lotSqft:      details.lot_sqft,
          yearBuilt:    details.year_built,
          propertyType: details.type?.toLowerCase(),
          status:       listing.status?.toLowerCase(),
          daysOnMarket: listing.list_date
                          ? Math.floor((Date.now() - new Date(listing.list_date).getTime()) / 86400000)
                          : undefined,
          description:  details.text ?? listing.description?.text,
          photoUrls:    (listing.photos ?? listing.primary_photo
                          ? [listing.primary_photo, ...(listing.photos ?? [])]
                          : []
                        )
                          .filter(Boolean)
                          .slice(0, 10)
                          .map((p: any) => fixPhotoUrl(p?.href ?? p?.url ?? String(p))),
          agentName:    listing.advertisers?.[0]?.name ?? listing.agent?.full_name,
          agentPhone:   listing.advertisers?.[0]?.office?.phones?.[0]?.number,
          listingUrl:   window.location.href,
        };
      }
    }
  } catch { /* fall through to DOM */ }

  // ── DOM fallback ──────────────────────────────────────────────────────────
  const priceEl = document.querySelector('[data-testid="list-price"]') ??
                  document.querySelector('.price-container');
  const addrEl  = document.querySelector('[data-testid="address"]') ??
                  document.querySelector('h1.listing-title');

  if (!addrEl) return null;

  const addrText  = addrEl.textContent?.trim() ?? '';
  const addrMatch = addrText.match(/^(.+),\s*(.+),\s*([A-Z]{2})\s*(\d{5})/);

  return {
    source:     'realtor',
    address:    addrMatch?.[1] ?? addrText,
    city:       addrMatch?.[2] ?? '',
    state:      addrMatch?.[3] ?? '',
    zip:        addrMatch?.[4] ?? '',
    price:      priceEl?.textContent
                  ? parseInt(priceEl.textContent.replace(/[^0-9]/g, ''), 10) * 100
                  : undefined,
    listingUrl: window.location.href,
    photoUrls:  Array.from(document.querySelectorAll('img[data-testid="listing-photo"]'))
                    .slice(0, 10)
                    .map((img) => fixPhotoUrl((img as HTMLImageElement).src)),
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => injectCaptureButton(extractRealtor));
} else {
  injectCaptureButton(extractRealtor);
}
