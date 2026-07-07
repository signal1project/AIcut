/**
 * Redfin listing extractor — Task 34 (built from scratch — no AiToEarn upstream)
 *
 * Redfin does NOT use Next.js — data is in a Flux/Redux store embedded as
 * a window.__reactInitialState__ or in inline <script> tags.
 * This extractor uses multiple strategies in priority order.
 */
import { injectCaptureButton, type ListingData } from '../utils/overlay.js';

function extractRedfin(): ListingData | null {
  // Strategy 1: window.__reactInitialState__ (present on most property pages)
  try {
    const state = (window as any).__reactInitialState__;
    if (state) {
      const pd = state.propertyDetails ?? state.propertyDetailsStore;
      if (pd) {
        const info    = pd.mainHouseInfo ?? pd;
        const address = info.addressInfo ?? pd.addressInfo ?? {};
        const basic   = info.basicInfo   ?? pd.basicInfo   ?? {};

        return {
          source:       'redfin',
          mlsNumber:    basic.mlsId,
          address:      address.streetAddress ?? address.formattedStreetLine ?? '',
          city:         address.city ?? '',
          state:        address.state ?? address.stateCode ?? '',
          zip:          address.zip ?? address.postalCode ?? '',
          price:        basic.price != null ? Math.round(basic.price * 100) : undefined,
          beds:         basic.beds,
          baths:        basic.baths,
          sqft:         basic.sqFt,
          lotSqft:      basic.lotSqFt,
          yearBuilt:    basic.yearBuilt,
          propertyType: basic.propertyType?.toLowerCase(),
          status:       basic.status?.toLowerCase(),
          daysOnMarket: basic.daysOnMarket,
          description:  pd.publicRemarks ?? pd.description ?? info.description,
          photoUrls:    (pd.photos ?? []).slice(0, 10)
                          .map((p: any) => p.url ?? p.photoUrl ?? p),
          agentName:    pd.listingAgent?.name,
          agentPhone:   pd.listingAgent?.phone,
          agentEmail:   pd.listingAgent?.email,
          listingUrl:   window.location.href,
        };
      }
    }
  } catch { /* try next strategy */ }

  // Strategy 2: Search for inline JSON script tag (Redfin embeds server data)
  try {
    const scripts = Array.from(document.querySelectorAll('script:not([src])'));
    for (const script of scripts) {
      const text = script.textContent ?? '';
      // Look for the property data blob Redfin embeds
      const match = text.match(/window\.__REDUX_STATE__\s*=\s*(\{.+\});?\s*$/m);
      if (match) {
        const state = JSON.parse(match[1]);
        const pd = state?.propertyDetails ?? state?.pdp?.propertyDetails;
        if (pd?.addressInfo) {
          const addr = pd.addressInfo;
          const basic = pd.mainHouseInfo?.basicInfo ?? pd.basicInfo ?? {};
          return {
            source:       'redfin',
            mlsNumber:    basic.mlsId,
            address:      addr.streetAddress ?? addr.formattedStreetLine ?? '',
            city:         addr.city ?? '',
            state:        addr.state ?? '',
            zip:          addr.zip ?? '',
            price:        basic.price != null ? Math.round(basic.price * 100) : undefined,
            beds:         basic.beds,
            baths:        basic.baths,
            sqft:         basic.sqFt,
            lotSqft:      basic.lotSqFt,
            yearBuilt:    basic.yearBuilt,
            propertyType: basic.propertyType?.toLowerCase(),
            status:       basic.status?.toLowerCase(),
            daysOnMarket: basic.daysOnMarket,
            photoUrls:    (pd.photos ?? []).slice(0, 10).map((p: any) => p.url ?? p),
            listingUrl:   window.location.href,
          };
        }
      }
    }
  } catch { /* fall through to DOM */ }

  // Strategy 3: DOM fallback
  const priceEl  = document.querySelector('[data-rf-test-id="abp-price"]') ??
                   document.querySelector('.statsValue');
  const addrEl   = document.querySelector('[data-rf-test-id="abp-streetLine"]') ??
                   document.querySelector('h1.street-address');
  const cityEl   = document.querySelector('[data-rf-test-id="abp-cityStateZip"]');

  if (!addrEl) return null;

  const cityText  = cityEl?.textContent?.trim() ?? '';
  const cityMatch = cityText.match(/^(.+),\s*([A-Z]{2})\s*(\d{5})/);

  return {
    source:     'redfin',
    address:    addrEl.textContent?.trim() ?? '',
    city:       cityMatch?.[1] ?? '',
    state:      cityMatch?.[2] ?? '',
    zip:        cityMatch?.[3] ?? '',
    price:      priceEl?.textContent
                  ? parseInt(priceEl.textContent.replace(/[^0-9]/g, ''), 10) * 100
                  : undefined,
    listingUrl: window.location.href,
    photoUrls:  Array.from(document.querySelectorAll('img.widenPhoto, img[alt*="Photo"]'))
                    .slice(0, 10)
                    .map((img) => (img as HTMLImageElement).src),
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => injectCaptureButton(extractRedfin));
} else {
  injectCaptureButton(extractRedfin);
}
