import Link from 'next/link'
import { 
  Zap, Satellite, CloudRain, Shield, Bell, 
  MapPin, Thermometer, Wind, Droplets, Mountain
} from 'lucide-react'

function Hero() {
  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-thunder-950 via-thunder-900 to-storm-950" />
      
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Zap className="w-16 h-16 text-lightning-400" />
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Weather Forecasts That
            <span className="block text-storm-400">Actually Reach You</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-thunder-300 max-w-3xl mx-auto mb-4">
            SMS is prioritised on satellite networks. While apps timeout, your forecast arrives.
          </p>
          
          <div className="flex flex-col gap-2 text-thunder-200 max-w-xl mx-auto mb-8 text-left sm:text-center">
            <p className="flex items-center gap-2 justify-center">
              <span className="text-storm-400">✓</span> Guaranteed delivery via Telstra satellite SMS
            </p>
            <p className="flex items-center gap-2 justify-center">
              <span className="text-storm-400">✓</span> No app to load, no data connection needed
            </p>
            <p className="flex items-center gap-2 justify-center">
              <span className="text-storm-400">✓</span> 7-day forecasts for every camp on your route
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="btn-primary text-lg px-8 py-4">
              Get Started
            </Link>
            <Link href="/how-it-works" className="btn-secondary text-lg px-8 py-4">
              See How It Works
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-8 text-thunder-400 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-storm-500" />
              <span>BOM Official Data</span>
            </div>
            <div className="flex items-center gap-2">
              <Satellite className="w-5 h-5 text-storm-500" />
              <span>Works Offline</span>
            </div>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-storm-500" />
              <span>SafeCheck Alerts</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Features() {
  const features = [
    {
      icon: Thermometer,
      title: 'Elevation-Specific',
      description: 'Separate forecasts for camp (840m) and peak (1149m). Temperature adjusted using 6.5°C/1000m lapse rate.'
    },
    {
      icon: CloudRain,
      title: 'Freezing Level & Cloud Base',
      description: 'Know exactly where the snow line is and if you\'ll be hiking in cloud.'
    },
    {
      icon: Shield,
      title: 'Danger Ratings',
      description: 'D=0 to D=4 ratings with factors: Ice, Blind, Wind, Precip. Know which days are summit days.'
    },
    {
      icon: Bell,
      title: 'BOM Warnings',
      description: 'Real-time BOM weather warnings pushed to your device within 15 minutes.'
    },
    {
      icon: Zap,
      title: 'Civil Twilight',
      description: '"Light 0512-2103 (15h51m)" — plan your hiking hours precisely.'
    },
    {
      icon: MapPin,
      title: 'SafeCheck Alerts',
      description: 'Your contacts get automatic alerts when you check in at each camp.'
    }
  ]

  return (
    <section className="py-20 bg-thunder-900/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Better Than Generic Weather Apps
          </h2>
          <p className="text-xl text-thunder-300 max-w-2xl mx-auto">
            Purpose-built for alpine hikers
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div key={i} className="card p-6">
              <feature.icon className="w-10 h-10 text-storm-500 mb-4" />
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-thunder-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function TrailPreviews() {
  const trails = [
    {
      id: 'western-arthurs',
      name: 'Western Arthurs',
      location: 'Southwest Tasmania',
      difficulty: 'Expert',
      duration: '10-12 days',
      description: 'A challenging alpine traverse through Tasmania\'s remote Southwest wilderness.',
    },
    {
      id: 'overland-track',
      name: 'Overland Track',
      location: 'Cradle Mountain-Lake St Clair',
      difficulty: 'Moderate-Hard',
      duration: '6 days',
      description: 'Tasmania\'s most famous multi-day hike through stunning alpine scenery.',
    },
  ]

  return (
    <section className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Supported Trails
          </h2>
          <p className="text-xl text-thunder-300">
            More trails coming soon
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {trails.map((trail) => (
            <Link 
              key={trail.id}
              href={`/trails/${trail.id}`}
              className="card overflow-hidden group hover:border-storm-500/50 transition-colors"
            >
              <div className="h-48 bg-gradient-to-br from-thunder-800 to-thunder-700 flex items-center justify-center">
                <Mountain className="w-16 h-16 text-thunder-500 group-hover:text-storm-500 transition-colors" />
              </div>
              
              <div className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-2xl font-bold group-hover:text-storm-400 transition-colors">
                    {trail.name}
                  </h3>
                  <span className="text-sm text-thunder-400">{trail.difficulty}</span>
                </div>
                
                <p className="text-thunder-400 text-sm mb-4">
                  {trail.location} • {trail.duration}
                </p>
                
                <p className="text-thunder-300">
                  {trail.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function SMSPreview() {
  const sampleSMS = `[1/2] ZONE1-South (Primary)
Light 05:12-21:03

Camp 850m - TODAY HOURLY
Hr|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D
06|8|15%|0-1|0|12|20|40%|18|22|
09|12|20%|0-2|0|15|25|50%|16|20|
12|16|25%|1-3|0|18|30|60%|14|18|!
15|18|30%|2-5|0|22|35|70%|12|16|!

Camps: LAKEF LAKEC

Peak 1098m - TODAY HOURLY  
Hr|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D
06|5|15%|0-1|0|18|28|45%|18|22|
09|9|20%|0-2|0|22|32|55%|16|20|!
12|13|25%|1-3|0|28|42|65%|14|18|!!
15|15|30%|2-5|0|32|48|75%|12|16|!!

Peaks: FEDER PRECI`

  return (
    <section className="py-20 bg-thunder-900/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Professional Forecasts,
              <span className="block text-storm-400">SMS-Optimized</span>
            </h2>
            <p className="text-xl text-thunder-300 mb-6">
              Every message is carefully formatted to maximize information 
              while minimizing SMS segments.
            </p>
            
            <ul className="space-y-3 text-thunder-200">
              <li className="flex items-start gap-3">
                <span className="text-storm-400 font-bold font-mono">Camp/Peak</span>
                <span>Elevation-adjusted temperatures</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-storm-400 font-bold font-mono">CB FL</span>
                <span>Cloud base & freezing level (×100m)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-storm-400 font-bold font-mono">! !!</span>
                <span>Danger indicators (wind, ice, visibility)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-storm-400 font-bold font-mono">%Rn %Cd</span>
                <span>Rain chance & cloud cover</span>
              </li>
            </ul>
          </div>
          
          <div>
            <div className="sms-preview text-thunder-200 text-xs leading-relaxed">
              {sampleSMS}
            </div>
            <p className="text-thunder-500 text-sm mt-4">
              Sample morning forecast (6 AM delivery)
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Zap className="w-12 h-12 text-lightning-400 mx-auto mb-6" />
        <h2 className="text-3xl md:text-4xl font-bold mb-6">
          Beta Launching January 2026
        </h2>
        <p className="text-xl text-thunder-300 mb-8">
          Be among the first to get forecasts that actually arrive in the backcountry.
        </p>
        
        <Link href="/register" className="btn-primary text-xl px-10 py-5">
          Get Started
        </Link>
        
        <p className="text-thunder-500 text-sm mt-6">
          Works with iPhone 14+ satellite SMS or Garmin/Zoleo devices.
        </p>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <>
      <Hero />
      <Features />
      <TrailPreviews />
      <SMSPreview />
      <CTA />
    </>
  )
}
