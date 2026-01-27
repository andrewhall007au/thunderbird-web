'use client'

import { useState, useEffect } from 'react'
import { MapPin } from 'lucide-react'

interface GeoData {
  deviceMessage: string
  trails: string[]
}

const geoData: Record<string, GeoData> = {
  AU: {
    deviceMessage: 'Works with your iPhone 14+ or Watch Ultra 3 via Telstra Starlink. No cell coverage needed.',
    trails: ['Overland Track', 'Cape to Cape', 'Larapinta Trail', 'Western Arthurs', 'Great Ocean Walk'],
  },
  US: {
    deviceMessage: 'Works with your iPhone 14+ via Apple Satellite or T-Mobile Starlink. No cell coverage needed.',
    trails: ['Pacific Crest Trail', 'John Muir Trail', 'Appalachian Trail', 'Continental Divide Trail', 'Wonderland Trail'],
  },
  CA: {
    deviceMessage: 'Works with your iPhone 14+ via Apple Satellite. No cell coverage needed.',
    trails: ['Great Divide Trail', 'West Coast Trail', 'Bruce Trail', 'Chilkoot Trail', 'Skyline Trail'],
  },
  JP: {
    deviceMessage: 'Works with your iPhone 14+ or Watch Ultra 3 via Apple Satellite. No cell coverage needed.',
    trails: ['Kumano Kodo', 'Nakasendo', 'Mount Fuji', 'Japan Alps', 'Daisetsuzan'],
  },
  NZ: {
    deviceMessage: 'Works with your iPhone 14+ or Watch Ultra 3 via One NZ Starlink. No cell coverage needed.',
    trails: ['Milford Track', 'Routeburn Track', 'Abel Tasman', 'Tongariro Crossing', 'Kepler Track'],
  },
  GB: {
    deviceMessage: 'Satellite SMS coming soon to the UK. Join the waitlist for early access.',
    trails: ['West Highland Way', 'Coast to Coast', 'Pennine Way', 'South West Coast Path'],
  },
  DE: {
    deviceMessage: 'Satellite SMS coming soon to Germany. Join the waitlist for early access.',
    trails: ['Tour du Mont Blanc', 'Haute Route', 'E5 Alpine Crossing', 'Zugspitze'],
  },
  FR: {
    deviceMessage: 'Satellite SMS coming soon to France. Join the waitlist for early access.',
    trails: ['Tour du Mont Blanc', 'GR20', 'Haute Route', 'GR10 Pyrenees'],
  },
  CH: {
    deviceMessage: 'Works with Salt Mobile via Starlink (beta). No cell coverage needed.',
    trails: ['Haute Route', 'Tour du Mont Blanc', 'Via Alpina', 'Eiger Trail'],
  },
  IT: {
    deviceMessage: 'Satellite SMS coming soon to Italy. Join the waitlist for early access.',
    trails: ['Alta Via 1', 'Alta Via 2', 'Tour du Mont Blanc', 'Cinque Terre'],
  },
  ZA: {
    deviceMessage: 'Satellite SMS coming soon to South Africa. Join the waitlist for early access.',
    trails: ['Drakensberg Grand Traverse', 'Otter Trail', 'Fish River Canyon', 'Rim of Africa'],
  },
}

// Default for countries not in our list
const defaultGeoData: GeoData = {
  deviceMessage: 'Get weather forecasts via satellite SMS. No cell coverage needed.',
  trails: ['any trail worldwide', 'your own GPX file', 'any GPS coordinates'],
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : null
}

export default function GeoBanner() {
  const [displayText, setDisplayText] = useState('')
  const [messageIndex, setMessageIndex] = useState(0)
  const [isTyping, setIsTyping] = useState(true)
  const [messages, setMessages] = useState<string[]>([])

  // Get country from cookie on mount
  useEffect(() => {
    const geo = getCookie('geo-country')
    const data = geo && geoData[geo] ? geoData[geo] : defaultGeoData

    // Build messages array: alternate device message with each trail
    const msgs: string[] = []

    data.trails.forEach(trail => {
      // Add device message before each trail
      msgs.push(data.deviceMessage)
      msgs.push(`Weather for ${trail} — or upload any GPX`)
    })

    setMessages(msgs)
  }, [])

  // Typing animation
  useEffect(() => {
    if (messages.length === 0) return

    const currentMessage = messages[messageIndex]

    if (isTyping) {
      if (displayText.length < currentMessage.length) {
        const timeout = setTimeout(() => {
          setDisplayText(currentMessage.slice(0, displayText.length + 1))
        }, 50) // Typing speed
        return () => clearTimeout(timeout)
      } else {
        // Finished typing, pause then start deleting
        const timeout = setTimeout(() => {
          setIsTyping(false)
        }, 2500) // Pause at full message
        return () => clearTimeout(timeout)
      }
    } else {
      if (displayText.length > 0) {
        const timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1))
        }, 30) // Deleting speed (faster)
        return () => clearTimeout(timeout)
      } else {
        // Finished deleting, move to next message
        setMessageIndex((prev) => (prev + 1) % messages.length)
        setIsTyping(true)
      }
    }
  }, [displayText, isTyping, messageIndex, messages])

  if (messages.length === 0) {
    return null // Don't render until we have messages
  }

  return (
    <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white py-2.5 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-sm">
        <MapPin className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium min-h-[1.25rem]">
          {displayText}
          <span className="animate-pulse">|</span>
        </span>
      </div>
    </div>
  )
}
