'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Smartphone, Monitor } from 'lucide-react';

// Sample data for preview
const sampleData = {
  name: 'Alex',
  email: 'alex@example.com',
  sms_number: '+1 (555) 123-4567',
  base_url: 'https://thunderbird.bot',
};

export default function WelcomeEmailPreview() {
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop');

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    code { background-color: #18181b; color: #f97316; padding: 2px 8px; border-radius: 4px; font-family: 'SF Mono', Monaco, monospace; font-size: 13px; }
    .forecast-box { background-color: #f4f4f5; border-radius: 8px; padding: 16px; font-family: 'SF Mono', Monaco, monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; color: #3f3f46; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="display: none; max-height: 0; overflow: hidden;">
    Your Thunderbird account is ready! Here's your complete guide to alpine weather forecasts via satellite SMS...
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 40px 40px 30px 40px; text-align: center;">
              <div style="width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 50%; display: inline-block; line-height: 60px; margin-bottom: 16px;">
                <span style="font-size: 32px;">&#9889;</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Welcome to Thunderbird</h1>
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">We have solved hyper-detailed weather forecast access out on the trail.</p>
              <p style="margin: 6px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">No specialised and expensive satellite devices needed.</p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding: 40px;">

              <!-- Greeting -->
              <p style="margin: 0 0 20px 0; color: #18181b; font-size: 16px; line-height: 1.6;">
                Hi ${sampleData.name},
              </p>
              <p style="margin: 0 0 30px 0; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                Your account is ready. You now have <strong style="color: #f97316;">USD $10 in SMS credits</strong> loaded and waiting.
              </p>

              <!-- Value Props -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px;">
                <tr>
                  <td style="padding: 16px; background-color: #fef3c7; border-radius: 12px;">
                    <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px; font-weight: 600;">Why Thunderbird?</h3>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding: 6px 0; color: #78350f; font-size: 14px;">
                          <strong>No device to buy</strong> &mdash; works with iPhone 14+ satellite SMS or your existing sat messenger
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #78350f; font-size: 14px;">
                          <strong>No subscription</strong> &mdash; one-time purchase, credits never expire, top up when you need
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #78350f; font-size: 14px;">
                          <strong>Elevation-specific forecasts</strong> &mdash; temperature adjusted for your exact camp or summit
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- ===================== -->
              <!-- WALKTHROUGH SECTION -->
              <!-- ===================== -->

              <h2 style="margin: 0 0 20px 0; color: #18181b; font-size: 20px; font-weight: 600; border-bottom: 2px solid #f97316; padding-bottom: 8px;">
                Complete Walkthrough: Western Arthurs
              </h2>

              <p style="margin: 0 0 20px 0; color: #3f3f46; font-size: 15px; line-height: 1.6;">
                Let's set you up for a Western Arthurs traverse. This walkthrough shows everything Thunderbird can do.
              </p>

              <!-- Step 1: Create Route -->
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #18181b; font-size: 16px; font-weight: 600;">
                  <span style="background-color: #f97316; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px;">1</span>
                  Create Your Route
                </h3>
                <p style="margin: 0 0 12px 0; color: #3f3f46; font-size: 14px; line-height: 1.6;">
                  Go to <a href="${sampleData.base_url}/create" style="color: #f97316;">thunderbird.bot/create</a> and add your waypoints by:
                </p>
                <ul style="margin: 0 0 12px 0; padding-left: 20px; color: #3f3f46; font-size: 14px; line-height: 1.8;">
                  <li><strong>Selecting a route</strong> from our library (many popular routes covered and growing all the time)</li>
                  <li><strong>Uploading a GPX file</strong> of your planned route</li>
                </ul>
                <p style="margin: 0 0 12px 0; color: #3f3f46; font-size: 14px; line-height: 1.6;">
                  Each waypoint automatically gets a 5-letter SMS code. Don't worry, you don't have to remember them &mdash; just text <code>START</code> to our number and we'll send you all your waypoints again.
                </p>
                <p style="margin: 0 0 8px 0; color: #71717a; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                  Example &mdash; Western Arthurs: Tasmania, Australia
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f5; border-radius: 8px; font-size: 13px;">
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 10px 16px; color: #71717a; font-weight: 600;">Type</td>
                    <td style="padding: 10px 16px; color: #71717a; font-weight: 600;">Location</td>
                    <td style="padding: 10px 16px; color: #71717a; font-weight: 600;">Code</td>
                    <td style="padding: 10px 16px; color: #71717a; font-weight: 600;">Elev</td>
                  </tr>
                  <!-- Camps -->
                  <tr style="border-bottom: 1px solid #e4e4e7; background-color: #fef3c7;">
                    <td colspan="4" style="padding: 6px 16px; color: #92400e; font-weight: 600; font-size: 11px; text-transform: uppercase;">Camps</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #f97316;">Camp</td>
                    <td style="padding: 8px 16px; color: #18181b;">Scotts Peak Dam</td>
                    <td style="padding: 8px 16px;"><code>SCOTT</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">300m</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #f97316;">Camp</td>
                    <td style="padding: 8px 16px; color: #18181b;">Junction Creek</td>
                    <td style="padding: 8px 16px;"><code>JUNCT</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">238m</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #f97316;">Camp</td>
                    <td style="padding: 8px 16px; color: #18181b;">Lake Fortuna</td>
                    <td style="padding: 8px 16px;"><code>LAKEF</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">850m</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #f97316;">Camp</td>
                    <td style="padding: 8px 16px; color: #18181b;">Lake Cygnus</td>
                    <td style="padding: 8px 16px;"><code>LAKEC</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">874m</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #f97316;">Camp</td>
                    <td style="padding: 8px 16px; color: #18181b;">Square Lake</td>
                    <td style="padding: 8px 16px;"><code>SQUAR</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">871m</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #f97316;">Camp</td>
                    <td style="padding: 8px 16px; color: #18181b;">Lake Oberon</td>
                    <td style="padding: 8px 16px;"><code>LAKEO</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">863m</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #f97316;">Camp</td>
                    <td style="padding: 8px 16px; color: #18181b;">High Moor</td>
                    <td style="padding: 8px 16px;"><code>HIGHM</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">850m</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #f97316;">Camp</td>
                    <td style="padding: 8px 16px; color: #18181b;">Haven Lake</td>
                    <td style="padding: 8px 16px;"><code>LAKEH</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">832m</td>
                  </tr>
                  <!-- Peak Group: Northern -->
                  <tr style="border-bottom: 1px solid #e4e4e7; background-color: #dbeafe;">
                    <td colspan="4" style="padding: 6px 16px; color: #1e40af; font-weight: 600; font-size: 11px; text-transform: uppercase;">Peaks &mdash; Northern Group</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #3b82f6;">Peak</td>
                    <td style="padding: 8px 16px; color: #18181b;">Mt Hesperus</td>
                    <td style="padding: 8px 16px;"><code>HESPE</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">1098m</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #3b82f6;">Peak</td>
                    <td style="padding: 8px 16px; color: #18181b;">Capella Crags</td>
                    <td style="padding: 8px 16px;"><code>CAPEL</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">1000m</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #3b82f6;">Peak</td>
                    <td style="padding: 8px 16px; color: #18181b;">Mt Hayes</td>
                    <td style="padding: 8px 16px;"><code>HAYES</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">1119m</td>
                  </tr>
                  <!-- Peak Group: Central -->
                  <tr style="border-bottom: 1px solid #e4e4e7; background-color: #dbeafe;">
                    <td colspan="4" style="padding: 6px 16px; color: #1e40af; font-weight: 600; font-size: 11px; text-transform: uppercase;">Peaks &mdash; Central Group</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #3b82f6;">Peak</td>
                    <td style="padding: 8px 16px; color: #18181b;">Procyon Peak</td>
                    <td style="padding: 8px 16px;"><code>PROCY</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">1136m</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #3b82f6;">Peak</td>
                    <td style="padding: 8px 16px; color: #18181b;">Mt Orion</td>
                    <td style="padding: 8px 16px;"><code>ORION</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">1151m</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #3b82f6;">Peak</td>
                    <td style="padding: 8px 16px; color: #18181b;">Mt Sirius</td>
                    <td style="padding: 8px 16px;"><code>SIRIU</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">1151m</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #3b82f6;">Peak</td>
                    <td style="padding: 8px 16px; color: #18181b;">Mt Pegasus</td>
                    <td style="padding: 8px 16px;"><code>PEGAS</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">1063m</td>
                  </tr>
                  <!-- Peak Group: Southern -->
                  <tr style="border-bottom: 1px solid #e4e4e7; background-color: #dbeafe;">
                    <td colspan="4" style="padding: 6px 16px; color: #1e40af; font-weight: 600; font-size: 11px; text-transform: uppercase;">Peaks &mdash; Southern Group</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #3b82f6;">Peak</td>
                    <td style="padding: 8px 16px; color: #18181b;">Mt Capricorn</td>
                    <td style="padding: 8px 16px;"><code>CAPRI</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">1037m</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #3b82f6;">Peak</td>
                    <td style="padding: 8px 16px; color: #18181b;">Mt Columba</td>
                    <td style="padding: 8px 16px;"><code>COLUM</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">1000m</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 16px; color: #3b82f6;">Peak</td>
                    <td style="padding: 8px 16px; color: #18181b;">Mt Taurus</td>
                    <td style="padding: 8px 16px;"><code>TAURU</code></td>
                    <td style="padding: 8px 16px; color: #52525b;">1011m</td>
                  </tr>
                </table>
              </div>

              <!-- Step 2: Camp vs Peak -->
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #18181b; font-size: 16px; font-weight: 600;">
                  <span style="background-color: #f97316; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px;">2</span>
                  Camps vs Peaks: Different Data
                </h3>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="padding: 12px; background-color: #fef3c7; border-radius: 8px 8px 0 0; border-bottom: 2px solid #fcd34d;">
                      <strong style="color: #92400e;">Camps</strong>
                      <span style="color: #78350f; font-size: 13px;"> &mdash; overnight conditions</span>
                      <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #78350f; font-size: 13px;">
                        <li>Evening temperatures for cooking/tent setup</li>
                        <li>Overnight lows for sleeping bag choice</li>
                        <li>Morning conditions for departure planning</li>
                      </ul>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px; background-color: #dbeafe; border-radius: 0 0 8px 8px;">
                      <strong style="color: #1e40af;">Peaks</strong>
                      <span style="color: #1e3a8a; font-size: 13px;"> &mdash; summit window</span>
                      <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #1e3a8a; font-size: 13px;">
                        <li>Best time to summit (wind, visibility)</li>
                        <li>Cloud base &mdash; will you be in cloud?</li>
                        <li>Freezing level &mdash; ice on exposed rock?</li>
                      </ul>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Step 3: Text START -->
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #18181b; font-size: 16px; font-weight: 600;">
                  <span style="background-color: #f97316; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px;">3</span>
                  Text START to Get Going
                </h3>
                <p style="margin: 0 0 12px 0; color: #3f3f46; font-size: 14px; line-height: 1.6;">
                  Text <code>START</code> to our designated number (found in your account dashboard). You'll receive a quick-start SMS with your waypoints and available commands.
                </p>
                <p style="margin: 0 0 12px 0; color: #3f3f46; font-size: 14px; line-height: 1.6;">
                  From there, you can request weather forecasts for any waypoint on your route, or for any GPS coordinates. For example, get a 7-day forecast for all peaks:
                </p>
                <div style="background-color: #18181b; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                  <code style="background: transparent; color: #f97316; font-size: 18px;">PEAKS</code>
                </div>
                <p style="margin: 0 0 16px 0; color: #52525b; font-size: 13px;">
                  Here's an example 7-day peak forecast for the Western Arthurs:
                </p>
                <div class="forecast-box" style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; font-family: 'SF Mono', Monaco, monospace; font-size: 11px; line-height: 1.5; white-space: pre; color: #3f3f46; overflow-x: auto;">[1/3] WA PEAKS 7-DAY
Thu 16 Jan 2026
════════════════════════════
       Tmp  %Rn Prec Wind  Wd FL
Peak   Lo-Hi    mm   Avg/Gst
────────────────────────────
HESPE  2-10 35% R1-4 30/48 W  18
CAPEL  1-9  38% R1-5 32/50 W  18
HAYES  1-9  40% R2-5 32/52 W  18
PROCY  0-8  42% R2-6 34/54 W  17
ORION  0-8  45% R2-6 35/55 SW 17
SIRIU  0-8  45% R2-6 35/55 SW 17
PEGAS  1-9  42% R2-5 32/52 W  18
CAPRI  1-9  40% R2-5 30/50 SW 18
COLUM  2-10 38% R1-4 28/48 SW 18
TAURU  2-10 35% R1-4 28/45 SW 18

[2/3] Fri 17 Jan
────────────────────────────
HESPE  3-11 30% R1-3 28/45 W  19
...

Best window: Thu AM - lower wind</div>
              </div>

              <!-- Step 4: GPS Coordinates -->
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #18181b; font-size: 16px; font-weight: 600;">
                  <span style="background-color: #f97316; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px;">4</span>
                  Forecast Any GPS Location
                </h3>
                <p style="margin: 0 0 12px 0; color: #3f3f46; font-size: 14px; line-height: 1.6;">
                  Need a forecast somewhere not on your route? Send coordinates directly:
                </p>
                <div style="background-color: #18181b; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                  <code style="background: transparent; color: #f97316; font-size: 16px;">CAST12 -43.14, 146.27</code>
                </div>
                <p style="margin: 0 0 16px 0; color: #52525b; font-size: 13px;">
                  Perfect for unplanned bivvys, emergency camps, or checking conditions at a col you're approaching.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="padding: 12px; background-color: #f0fdf4; border-radius: 8px; border-left: 3px solid #22c55e;">
                      <strong style="color: #166534; font-size: 13px;">Finding coordinates on iPhone (works offline)</strong>
                      <p style="margin: 8px 0 0 0; color: #15803d; font-size: 13px; line-height: 1.5;">
                        GPS works without cell service. Open the built-in <strong>Compass</strong> app &mdash; your coordinates are shown at the bottom. Or use hiking apps like Gaia GPS or AllTrails with offline maps downloaded.
                      </p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Step 5: 7-Day Overview -->
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #18181b; font-size: 16px; font-weight: 600;">
                  <span style="background-color: #f97316; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px;">5</span>
                  7-Day Route Overview
                </h3>
                <p style="margin: 0 0 12px 0; color: #3f3f46; font-size: 14px; line-height: 1.6;">
                  Get a week-long forecast for all camps on your route at once:
                </p>
                <div style="background-color: #18181b; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                  <code style="background: transparent; color: #f97316; font-size: 18px;">CAST7 WARTS</code>
                </div>
                <p style="margin: 0; color: #52525b; font-size: 13px;">
                  Shows conditions at each camp for the next 7 days &mdash; perfect for planning your traverse timing.
                </p>
              </div>

              <!-- Step 6: SMS Segment Credits -->
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #18181b; font-size: 16px; font-weight: 600;">
                  <span style="background-color: #f97316; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px;">6</span>
                  SMS Segment Credits
                </h3>
                <p style="margin: 0 0 12px 0; color: #3f3f46; font-size: 14px; line-height: 1.6;">
                  Your credit balance is measured in SMS segments. Third-party terrestrial network costs differ by country, so segment pricing varies by region:
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f5; border-radius: 8px; font-size: 13px; margin-bottom: 16px;">
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 10px 16px; color: #71717a; font-weight: 600;">Region</td>
                    <td style="padding: 10px 16px; color: #71717a; font-weight: 600; text-align: center;">$10</td>
                    <td style="padding: 10px 16px; color: #71717a; font-weight: 600; text-align: center;">$25 <span style="color: #22c55e; font-size: 11px;">+10%</span></td>
                    <td style="padding: 10px 16px; color: #71717a; font-weight: 600; text-align: center;">$50 <span style="color: #22c55e; font-size: 11px;">+20%</span></td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #18181b;">US / Canada</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">100</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">275</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">600</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #18181b;">Australia, UK, Europe, Japan</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">66</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">182</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">396</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 16px; color: #18181b;">New Zealand, South Africa</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">50</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">138</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">300</td>
                  </tr>
                </table>
                <p style="margin: 0 0 8px 0; color: #71717a; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                  Cost per Segment
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f5; border-radius: 8px; font-size: 13px; margin-bottom: 16px;">
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 10px 16px; color: #71717a; font-weight: 600;">Region</td>
                    <td style="padding: 10px 16px; color: #71717a; font-weight: 600; text-align: center;">$10</td>
                    <td style="padding: 10px 16px; color: #71717a; font-weight: 600; text-align: center;">$25</td>
                    <td style="padding: 10px 16px; color: #71717a; font-weight: 600; text-align: center;">$50</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #18181b;">US / Canada</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">$0.100</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">$0.091</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">$0.083</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #18181b;">Australia, UK, Europe, Japan</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">$0.152</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">$0.137</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">$0.126</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 16px; color: #18181b;">New Zealand, South Africa</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">$0.200</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">$0.181</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">$0.167</td>
                  </tr>
                </table>

                <p style="margin: 0 0 8px 0; color: #71717a; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                  Typical 5-Day Trip Usage
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f5; border-radius: 8px; font-size: 13px; margin-bottom: 12px;">
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 10px 16px; color: #71717a; font-weight: 600;">Command</td>
                    <td style="padding: 10px 16px; color: #71717a; font-weight: 600; text-align: center;">Segments</td>
                    <td style="padding: 10px 16px; color: #71717a; font-weight: 600; text-align: right;">Usage</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #18181b;">CAST7 (7-day camps)</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">14</td>
                    <td style="padding: 8px 16px; color: #52525b; text-align: right;">Once at start</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #18181b;">PEAKS7 (7-day peaks)</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">10</td>
                    <td style="padding: 8px 16px; color: #52525b; text-align: right;">Once at start</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #18181b;">CAST12 camp (daily)</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">3</td>
                    <td style="padding: 8px 16px; color: #52525b; text-align: right;">5 days = 15 seg</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 8px 16px; color: #18181b;">CAST12 peak (daily)</td>
                    <td style="padding: 8px 16px; color: #18181b; text-align: center;">3</td>
                    <td style="padding: 8px 16px; color: #52525b; text-align: right;">5 days = 15 seg</td>
                  </tr>
                  <tr style="background-color: #fef3c7;">
                    <td style="padding: 10px 16px; color: #92400e; font-weight: 600;">Total for 5-day trip</td>
                    <td style="padding: 10px 16px; color: #92400e; font-weight: 600; text-align: center;"></td>
                    <td style="padding: 10px 16px; color: #92400e; font-weight: 600; text-align: right;">~54 segments</td>
                  </tr>
                </table>
                <p style="margin: 0; color: #52525b; font-size: 13px;">
                  Your $10 starting credit covers a typical 5-day trip with segments to spare. Buy in bulk for better value &mdash; $50 gives you 20% bonus segments. Use <code>BAL</code> anytime to check your remaining balance.
                </p>
              </div>

              <!-- All Commands Reference -->
              <h2 style="margin: 30px 0 20px 0; color: #18181b; font-size: 20px; font-weight: 600; border-bottom: 2px solid #f97316; padding-bottom: 8px;">
                All SMS Commands
              </h2>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px;">
                <tr>
                  <td style="padding: 12px 16px; background-color: #f4f4f5; border-radius: 8px 8px 0 0; border-bottom: 1px solid #e4e4e7;">
                    <code>CAST12 LAKEO</code>
                    <span style="color: #52525b; font-size: 13px; display: block; margin-top: 4px;">12-hour detailed forecast for a waypoint</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; background-color: #fafafa; border-bottom: 1px solid #e4e4e7;">
                    <code>CAST7 LAKEO</code>
                    <span style="color: #52525b; font-size: 13px; display: block; margin-top: 4px;">7-day daily forecast for a waypoint</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; background-color: #f4f4f5; border-bottom: 1px solid #e4e4e7;">
                    <code>CAST7 WARTS</code>
                    <span style="color: #52525b; font-size: 13px; display: block; margin-top: 4px;">7-day overview for all camps on route</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; background-color: #fafafa; border-bottom: 1px solid #e4e4e7;">
                    <code>CAST12 -43.14, 146.27</code>
                    <span style="color: #52525b; font-size: 13px; display: block; margin-top: 4px;">12-hour forecast for GPS coordinates</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; background-color: #f4f4f5; border-bottom: 1px solid #e4e4e7;">
                    <code>BAL</code>
                    <span style="color: #52525b; font-size: 13px; display: block; margin-top: 4px;">Check your credit balance</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; background-color: #fafafa; border-radius: 0 0 8px 8px;">
                    <code>HELP</code>
                    <span style="color: #52525b; font-size: 13px; display: block; margin-top: 4px;">List all available commands</span>
                  </td>
                </tr>
              </table>

              <!-- Top Up Section -->
              <h2 style="margin: 30px 0 20px 0; color: #18181b; font-size: 20px; font-weight: 600; border-bottom: 2px solid #f97316; padding-bottom: 8px;">
                Top Up Credits From the Trail
              </h2>

              <p style="margin: 0 0 16px 0; color: #3f3f46; font-size: 14px; line-height: 1.6;">
                Running low on credits? Top up via SMS &mdash; no internet needed. When you request a forecast with low balance, we'll text you:
              </p>

              <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 16px; font-family: monospace; font-size: 13px; color: #3f3f46;">
                Balance low: $2.50 remaining.<br>
                Reply YES$10, YES$25, or YES$50 to top up.
              </div>

              <p style="margin: 0 0 20px 0; color: #52525b; font-size: 13px; line-height: 1.6;">
                Reply with your choice and we'll charge your saved card instantly. Credits are added immediately &mdash; continue getting forecasts without interruption.
              </p>

              <!-- Account Section -->
              <h2 style="margin: 30px 0 20px 0; color: #18181b; font-size: 20px; font-weight: 600; border-bottom: 2px solid #f97316; padding-bottom: 8px;">
                Your Account
              </h2>

              <p style="margin: 0 0 16px 0; color: #3f3f46; font-size: 14px; line-height: 1.6;">
                Log in at <a href="${sampleData.base_url}/login" style="color: #f97316;">thunderbird.bot/login</a> to:
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 12px 16px; background-color: #f4f4f5; border-radius: 8px; margin-bottom: 8px;">
                    <strong style="color: #18181b;">Manage Routes</strong>
                    <span style="color: #52525b; font-size: 13px; display: block; margin-top: 4px;">Create new routes, edit waypoints, delete old trips</span>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 12px 16px; background-color: #f4f4f5; border-radius: 8px;">
                    <strong style="color: #18181b;">Check Balance & Top Up</strong>
                    <span style="color: #52525b; font-size: 13px; display: block; margin-top: 4px;">See credit balance, purchase history, add more credits</span>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 12px 16px; background-color: #f4f4f5; border-radius: 8px;">
                    <strong style="color: #18181b;">Unit Preferences</strong>
                    <span style="color: #52525b; font-size: 13px; display: block; margin-top: 4px;">Switch between metric (Celsius, meters) and imperial (Fahrenheit, feet)</span>
                  </td>
                </tr>
              </table>

              <!-- Account Info Box -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #18181b; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 16px 0; color: #ffffff; font-size: 16px; font-weight: 600;">
                      Your Account Details
                    </h3>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding: 8px 0; color: #a1a1aa; font-size: 14px;">Email</td>
                        <td style="padding: 8px 0; color: #ffffff; font-size: 14px; text-align: right;">${sampleData.email}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #a1a1aa; font-size: 14px;">Credit Balance</td>
                        <td style="padding: 8px 0; color: #f97316; font-size: 14px; font-weight: 600; text-align: right;">USD $10.00</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #a1a1aa; font-size: 14px;">SMS Number</td>
                        <td style="padding: 8px 0; color: #ffffff; font-size: 14px; text-align: right;">In your account dashboard</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding: 10px 0 20px 0;">
                    <a href="${sampleData.base_url}/create" style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Create Your First Route
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #71717a; font-size: 14px; text-align: center; line-height: 1.6;">
                Questions? Reply to this email or visit <a href="${sampleData.base_url}/help" style="color: #f97316;">our help center</a>.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #18181b; padding: 30px 40px; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #a1a1aa; font-size: 14px;">
                Safe travels on the trail!
              </p>
              <p style="margin: 0; color: #71717a; font-size: 12px;">
                Thunderbird &bull; Professional Alpine Forecasts via Satellite SMS
              </p>
              <p style="margin: 16px 0 0 0;">
                <a href="${sampleData.base_url}/account" style="color: #f97316; text-decoration: none; font-size: 12px; margin: 0 10px;">Account</a>
                <a href="${sampleData.base_url}/help" style="color: #f97316; text-decoration: none; font-size: 12px; margin: 0 10px;">Help</a>
                <a href="${sampleData.base_url}/terms" style="color: #f97316; text-decoration: none; font-size: 12px; margin: 0 10px;">Terms</a>
              </p>
            </td>
          </tr>

        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px;">
          <tr>
            <td style="padding: 20px; text-align: center;">
              <p style="margin: 0; color: #a1a1aa; font-size: 11px; line-height: 1.5;">
                You're receiving this because you purchased Thunderbird.<br>
                <a href="${sampleData.base_url}/unsubscribe?email=${sampleData.email}" style="color: #71717a;">Unsubscribe</a> from marketing emails.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return (
    <div className="min-h-screen bg-zinc-100">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-zinc-500 hover:text-zinc-700">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-orange-500" />
                <h1 className="font-semibold text-zinc-900">Welcome Email Preview</h1>
              </div>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-lg">
              <button
                onClick={() => setView('desktop')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'desktop'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                <Monitor className="w-4 h-4" />
                Desktop
              </button>
              <button
                onClick={() => setView('mobile')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'mobile'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                Mobile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Email preview */}
      <div className="py-8 px-4">
        <div className="flex justify-center">
          {view === 'desktop' ? (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ width: 700 }}>
              <div className="bg-zinc-800 px-4 py-2 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-zinc-400 text-sm">noreply@thunderbird.bot</span>
                </div>
              </div>
              <div className="border-b border-zinc-200 px-4 py-3">
                <div className="text-sm text-zinc-500">From: <span className="text-zinc-900">Thunderbird &lt;noreply@thunderbird.bot&gt;</span></div>
                <div className="text-sm text-zinc-500">To: <span className="text-zinc-900">{sampleData.email}</span></div>
                <div className="text-sm text-zinc-500">Subject: <span className="text-zinc-900 font-medium">Welcome to Thunderbird - Your Complete Guide</span></div>
              </div>
              <iframe
                srcDoc={emailHtml}
                className="w-full border-0"
                style={{ height: 2400 }}
                title="Email Preview"
              />
            </div>
          ) : (
            <div className="bg-zinc-900 rounded-[40px] p-3 shadow-2xl">
              <div className="w-[375px] bg-white rounded-[32px] overflow-hidden">
                <div className="bg-zinc-100 px-4 py-2 border-b border-zinc-200">
                  <div className="text-xs text-zinc-500">From: Thunderbird</div>
                  <div className="text-sm font-medium text-zinc-900 truncate">Welcome to Thunderbird - Your Complete Guide</div>
                </div>
                <iframe
                  srcDoc={emailHtml}
                  className="w-full border-0"
                  style={{ height: 700 }}
                  title="Mobile Email Preview"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info footer */}
      <div className="text-center pb-8">
        <p className="text-sm text-zinc-500">
          This email is sent automatically after successful payment.
        </p>
      </div>
    </div>
  );
}
