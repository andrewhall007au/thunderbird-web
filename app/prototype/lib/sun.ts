/**
 * Sunrise/sunset calculation using standard solar position algorithm.
 * Returns light hours for a given lat/lon and date.
 */

function toRadians(deg: number): number {
  return deg * Math.PI / 180;
}

function toDegrees(rad: number): number {
  return rad * 180 / Math.PI;
}

/**
 * Calculate sunrise and sunset times for a given location and date.
 * Uses the NOAA solar position algorithm (simplified).
 */
export function calculateLightHours(
  lat: number,
  lng: number,
  date: Date
): { sunrise: string; sunset: string; duration: string } {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );

  // Solar declination
  const declination = toRadians(
    -23.44 * Math.cos(toRadians((360 / 365) * (dayOfYear + 10)))
  );

  // Hour angle at sunrise/sunset
  const latRad = toRadians(lat);
  const cosHourAngle = (Math.cos(toRadians(90.833)) - Math.sin(latRad) * Math.sin(declination))
    / (Math.cos(latRad) * Math.cos(declination));

  // Clamp for polar day/night
  if (cosHourAngle < -1) {
    return { sunrise: '--:--', sunset: '--:--', duration: '24h00m' }; // Midnight sun
  }
  if (cosHourAngle > 1) {
    return { sunrise: '--:--', sunset: '--:--', duration: '0h00m' }; // Polar night
  }

  const hourAngle = toDegrees(Math.acos(cosHourAngle));

  // Equation of time (minutes)
  const B = toRadians((360 / 365) * (dayOfYear - 81));
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  // Solar noon in minutes from midnight UTC
  const solarNoonUTC = 720 - 4 * lng - eot;

  const sunriseUTC = solarNoonUTC - 4 * hourAngle;
  const sunsetUTC = solarNoonUTC + 4 * hourAngle;

  // Convert to local time using the date's timezone offset
  const tzOffsetMin = -date.getTimezoneOffset();

  const formatTime = (minutesUTC: number): string => {
    let mins = minutesUTC + tzOffsetMin;
    if (mins < 0) mins += 1440;
    if (mins >= 1440) mins -= 1440;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const durationMinutes = (sunsetUTC - sunriseUTC);
  const durationH = Math.floor(durationMinutes / 60);
  const durationM = Math.round(durationMinutes % 60);

  return {
    sunrise: formatTime(sunriseUTC),
    sunset: formatTime(sunsetUTC),
    duration: `${durationH}h${String(durationM).padStart(2, '0')}m`
  };
}
