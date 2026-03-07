import axios from 'axios';

export interface GeocodedLocation {
  displayName: string;
  shortName: string;
  city: string | null;
  suburb: string | null;
  country: string | null;
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodedLocation> {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat: latitude,
        lon: longitude,
        format: 'json',
      },
      headers: {
        'User-Agent': 'NamaComplianceApp/1.0',
      },
      timeout: 5000,
    });

    const data = response.data ?? {};
    const address = data.address ?? {};

    const city = address.city ?? address.town ?? address.village ?? address.county ?? null;
    const suburb = address.suburb ?? address.neighbourhood ?? null;
    const country = address.country ?? null;
    const shortName = [suburb ?? city, country].filter(Boolean).join(', ');

    return {
      displayName: data.display_name ?? '',
      shortName: shortName || data.display_name || '',
      city,
      suburb,
      country,
    };
  } catch {
    return {
      displayName: '',
      shortName: '',
      city: null,
      suburb: null,
      country: null,
    };
  }
}
