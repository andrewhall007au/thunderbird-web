'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Smartphone, Monitor, Globe } from 'lucide-react';

// Phone numbers by region
const SMS_NUMBERS = {
  us: '+1 (866) 280-1940',  // US/Canada
  au: '+61 468 092 783',    // Australia/NZ/rest of world
};

// Countries that use the US number
const US_NUMBER_COUNTRIES = ['United States', 'Canada'];

// Supported countries (from beta application)
const COUNTRIES = [
  'Australia',
  'United States',
  'Canada',
  'New Zealand',
  'United Kingdom',
  'Germany',
  'France',
  'Japan',
  'South Korea',
];

// Determine which number to show based on country
const getSmsNumber = (country: string) => {
  return US_NUMBER_COUNTRIES.includes(country) ? SMS_NUMBERS.us : SMS_NUMBERS.au;
};

export default function WelcomeEmailPreview() {
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop');
  const [country, setCountry] = useState('Australia');

  const smsNumber = getSmsNumber(country);

  // Sample data for preview
  const sampleData = {
    name: 'Alex',
    email: 'alex@example.com',
    password: 'xK9mPq2vL4nR',
    country: country,
    base_url: 'https://thunderbird.bot',
    credit_amount: 50,
    is_beta: true,
  };

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; }
    a { color: #f97316; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .header { text-align: center; padding: 48px 40px 32px; border-bottom: 1px solid #f3f4f6; }
    .logo { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 24px; }
    .logo-icon { width: 32px; height: 32px; }
    .logo-text { font-size: 20px; font-weight: 700; color: #18181b; }
    .beta-badge { display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
    .headline { font-size: 28px; font-weight: 700; color: #18181b; margin: 0 0 8px; }
    .subhead { font-size: 16px; color: #6b7280; margin: 0; }
    .content { padding: 40px; }
    .greeting { font-size: 16px; color: #374151; line-height: 1.6; margin: 0 0 24px; }
    .credit-box { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px; }
    .credit-amount { font-size: 36px; font-weight: 700; color: white; margin: 0; }
    .credit-label { font-size: 14px; color: rgba(255,255,255,0.9); margin: 4px 0 0; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 13px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-size: 14px; color: #6b7280; }
    .info-value { font-size: 14px; color: #18181b; font-weight: 500; font-family: 'SF Mono', Monaco, 'Courier New', monospace; }
    .step { display: flex; gap: 16px; margin-bottom: 20px; }
    .step-num { width: 28px; height: 28px; background: #18181b; color: white; border-radius: 50%; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .step-content { flex: 1; }
    .step-title { font-size: 15px; font-weight: 600; color: #18181b; margin: 0 0 4px; }
    .step-desc { font-size: 14px; color: #6b7280; margin: 0; line-height: 1.5; }
    .command-box { background: #18181b; border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
    .command { font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 16px; color: #f97316; margin: 0; }
    .sms-preview { background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 16px 0; font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 12px; color: #374151; line-height: 1.6; white-space: pre-wrap; }
    .cta-button { display: block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white !important; text-decoration: none; font-size: 16px; font-weight: 600; padding: 16px 32px; border-radius: 12px; text-align: center; margin: 32px 0; }
    .cta-button:hover { background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); }
    .divider { height: 1px; background: #f3f4f6; margin: 32px 0; }
    .commands-grid { display: grid; gap: 8px; }
    .cmd-row { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
    .cmd-row:last-child { border-bottom: none; }
    .cmd-code { font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 13px; color: #f97316; background: #fef3c7; padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
    .cmd-desc { font-size: 13px; color: #6b7280; }
    .footer { background: #f9fafb; padding: 32px 40px; text-align: center; border-top: 1px solid #f3f4f6; }
    .footer-text { font-size: 13px; color: #9ca3af; margin: 0 0 16px; line-height: 1.5; }
    .footer-links { margin: 0; }
    .footer-links a { color: #6b7280; text-decoration: none; margin: 0 12px; font-size: 13px; }
    .footer-links a:hover { color: #f97316; }
    .highlight { background: #fef3c7; padding: 2px 6px; border-radius: 4px; }
    .tip-box { background: #f0fdf4; border-left: 3px solid #22c55e; padding: 16px; border-radius: 0 8px 8px 0; margin: 16px 0; }
    .tip-title { font-size: 13px; font-weight: 600; color: #166534; margin: 0 0 4px; }
    .tip-text { font-size: 13px; color: #15803d; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <!-- Header -->
      <div class="header">
        <div class="logo">
          <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2.5">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span class="logo-text">Thunderbird</span>
        </div>
        ${sampleData.is_beta ? '<div class="beta-badge">Beta Tester</div>' : ''}
        <h1 class="headline">Welcome aboard!</h1>
        <p class="subhead">Your account is ready. Let's get you set up.</p>
      </div>

      <!-- Content -->
      <div class="content">
        <p class="greeting">Hi ${sampleData.name},</p>

        <!-- Credit Box -->
        <div class="credit-box">
          <p class="credit-amount">$${sampleData.credit_amount} USD</p>
          <p class="credit-label">SMS credits loaded${sampleData.is_beta ? ' (Beta bonus!)' : ''}</p>
        </div>

        <!-- Account Details -->
        <div class="section">
          <p class="section-title">Your Account</p>
          <div class="info-row">
            <span class="info-label">Username</span>
            <span class="info-value">${sampleData.email}</span>
          </div>
        </div>

        <!-- SMS Number -->
        <div class="section">
          <p class="section-title">Text Forecast Commands To</p>
          <div style="background: #18181b; border-radius: 12px; padding: 20px; text-align: center;">
            <p style="font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 24px; font-weight: 600; color: #f97316; margin: 0; letter-spacing: 1px;">${smsNumber}</p>
            <p style="font-size: 14px; color: #ffffff; font-weight: 500; margin: 12px 0 0; background: rgba(249,115,22,0.8); padding: 8px 12px; border-radius: 6px; display: inline-block;">Save as "Thunderbird Weather" in your contacts</p>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Option A: GPS -->
        <div class="section">
          <p class="section-title">Option A: Any GPS Location</p>
          <p style="font-size: 14px; color: #6b7280; margin: 0 0 16px;">No setup required — text <span class="highlight">CAST</span> + coordinates from anywhere.</p>

          <div class="sms-preview"><span style="color: #22c55e;">You:</span> CAST -43.1234, 146.5678

<span style="color: #f97316;">Thunderbird:</span>
CAST -43.12,146.57 1240m
Light 06:15-20:45 (14h30m)

06h 4-8 Rn15% 0-1mm W12-18 Cld45% CB14 FL18
09h 8-12 Rn20% 0-2mm W15-22 Cld38% CB16 FL20
12h 10-14 Rn10% 0-1mm W18-25 Cld25% CB18 FL22
15h 8-12 Rn25% 1-3mm W20-28 Cld55% CB15 FL20
18h 5-9 Rn35% 2-5mm W15-22 Cld65% CB12 FL18

<span style="color: #9ca3af; font-size: 11px;">Rn=Rain W=Wind Cld=Cloud CB=CloudBase(x100m) FL=Freeze(x100m)</span></div>
        </div>

        <div class="tip-box">
          <p class="tip-title">Works offline via satellite</p>
          <p class="tip-text">iPhone 14+ can send SMS with no cell coverage. Find your coordinates in the Compass app.</p>
        </div>

        <div class="divider"></div>

        <!-- Option B: Pre-loaded Routes -->
        <div class="section">
          <p class="section-title">Option B: Pre-loaded Routes</p>
          <p style="font-size: 14px; color: #6b7280; margin: 0 0 16px;">Set up named waypoints for quick access on the trail.</p>

          <div class="step">
            <div class="step-num">1</div>
            <div class="step-content">
              <p class="step-title">Create a route</p>
              <p class="step-desc">Go to <a href="${sampleData.base_url}/create">thunderbird.bot/create</a> — select from our library or upload your own GPX file.</p>
            </div>
          </div>

          <div class="step">
            <div class="step-num">2</div>
            <div class="step-content">
              <p class="step-title">Text START</p>
              <p class="step-desc">Send <span class="highlight">START</span> to <strong style="color: #f97316;">${smsNumber}</strong> — we'll show your trails. Reply with the number to select one.</p>
            </div>
          </div>

          <div class="step">
            <div class="step-num">3</div>
            <div class="step-content">
              <p class="step-title">Get forecasts</p>
              <p class="step-desc">Text <span class="highlight">CAST7 CAMPS</span>, <span class="highlight">CAST7 PEAKS</span>, or <span class="highlight">CAST LAKEO</span> for a specific waypoint.</p>
            </div>
          </div>
        </div>

        <!-- Example -->
        <div class="section">
          <p class="section-title">Example: Waypoint Forecast</p>
          <div class="sms-preview"><span style="color: #22c55e;">You:</span> CAST LAKEO

<span style="color: #f97316;">Thunderbird:</span>
CAST LAKEO 1050m
Light 06:15-20:45 (14h30m)

06h 4-8 Rn15% 0-1mm W12-18 Cld45% CB14 FL18
09h 8-12 Rn20% 0-2mm W15-22 Cld38% CB16 FL20
12h 10-14 Rn10% 0-1mm W18-25 Cld25% CB18 FL22
15h 8-12 Rn25% 1-3mm W20-28 Cld55% CB15 FL20
18h 5-9 Rn35% 2-5mm W15-22 Cld65% CB12 FL18</div>
        </div>

        <div class="divider"></div>

        <!-- Commands Reference -->
        <div class="section">
          <p class="section-title">GPS Commands</p>
          <div class="commands-grid">
            <div class="cmd-row">
              <span class="cmd-code">CAST -43.1, 146.2</span>
              <span class="cmd-desc">12-hour forecast for coordinates</span>
            </div>
            <div class="cmd-row">
              <span class="cmd-code">CAST7 -43.1, 146.2</span>
              <span class="cmd-desc">7-day forecast for coordinates</span>
            </div>
          </div>
        </div>

        <div class="section">
          <p class="section-title">Route Commands</p>
          <div class="commands-grid">
            <div class="cmd-row">
              <span class="cmd-code">START</span>
              <span class="cmd-desc">Select your active trail</span>
            </div>
            <div class="cmd-row">
              <span class="cmd-code">ROUTE</span>
              <span class="cmd-desc">List waypoint codes</span>
            </div>
            <div class="cmd-row">
              <span class="cmd-code">CAST7 CAMPS</span>
              <span class="cmd-desc">7-day forecast for all camps</span>
            </div>
            <div class="cmd-row">
              <span class="cmd-code">CAST7 PEAKS</span>
              <span class="cmd-desc">7-day forecast for all peaks</span>
            </div>
            <div class="cmd-row">
              <span class="cmd-code">CAST LAKEO</span>
              <span class="cmd-desc">12-hour forecast for waypoint</span>
            </div>
            <div class="cmd-row">
              <span class="cmd-code">CAST7 LAKEO</span>
              <span class="cmd-desc">7-day forecast for waypoint</span>
            </div>
          </div>
        </div>

        <div class="section">
          <p class="section-title">Account</p>
          <div class="commands-grid">
            <div class="cmd-row">
              <span class="cmd-code">BAL</span>
              <span class="cmd-desc">Check your credit balance</span>
            </div>
            <div class="cmd-row">
              <span class="cmd-code">HELP</span>
              <span class="cmd-desc">List all commands</span>
            </div>
          </div>
        </div>

        <a href="${sampleData.base_url}/create" class="cta-button">Create Your First Route</a>

        <p style="text-align: center; font-size: 14px; color: #6b7280; margin: 0;">
          Questions? Just reply to this email.
        </p>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p class="footer-text">
          Safe travels on the trail!<br>
          <strong style="color: #18181b;">The Thunderbird Team</strong>
        </p>
        <p class="footer-links">
          <a href="${sampleData.base_url}/account">Account</a>
          <a href="${sampleData.base_url}/faq">FAQ</a>
          <a href="${sampleData.base_url}/terms">Terms</a>
          <a href="${sampleData.base_url}/privacy">Privacy</a>
        </p>
      </div>
    </div>
  </div>
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

            <div className="flex items-center gap-4">
              {/* Country selector */}
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-zinc-400" />
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="bg-zinc-100 border-0 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
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
                <div className="text-sm text-zinc-500">Subject: <span className="text-zinc-900 font-medium">{sampleData.is_beta ? 'Welcome to Thunderbird Beta!' : 'Welcome to Thunderbird'}</span></div>
              </div>
              <iframe
                srcDoc={emailHtml}
                className="w-full border-0"
                style={{ height: 1400 }}
                title="Email Preview"
              />
            </div>
          ) : (
            <div className="bg-zinc-900 rounded-[40px] p-3 shadow-2xl">
              <div className="w-[375px] bg-white rounded-[32px] overflow-hidden">
                <div className="bg-zinc-100 px-4 py-2 border-b border-zinc-200">
                  <div className="text-xs text-zinc-500">From: Thunderbird</div>
                  <div className="text-sm font-medium text-zinc-900 truncate">{sampleData.is_beta ? 'Welcome to Thunderbird Beta!' : 'Welcome to Thunderbird'}</div>
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
      <div className="text-center pb-8 space-y-2">
        <p className="text-sm text-zinc-500">
          {sampleData.is_beta
            ? 'This email is sent to approved beta testers.'
            : 'This email is sent automatically after successful payment.'}
        </p>
        <p className="text-xs text-zinc-400">
          Showing <span className="font-medium text-orange-500">{smsNumber}</span> for users in {country}
          {US_NUMBER_COUNTRIES.includes(country) ? ' (US number)' : ' (AU number)'}
        </p>
      </div>
    </div>
  );
}
