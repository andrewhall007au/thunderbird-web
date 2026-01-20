import { Mail } from 'lucide-react'

export const metadata = {
  title: 'Contact - Thunderbird',
  description: 'Get in touch with the Thunderbird team.',
}

export default function ContactPage() {
  return (
    <div className="py-20">
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Mail className="w-12 h-12 text-orange-500 mx-auto mb-6" />
        <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
        <p className="text-xl text-gray-600 mb-8">
          Questions, feedback, or trail suggestions? We&apos;d love to hear from you.
        </p>
        
        <div className="card p-8">
          <p className="text-gray-600 mb-4">Email us at:</p>
          <a 
            href="mailto:hello@thunderbird.bot" 
            className="text-2xl font-semibold text-orange-500 hover:text-orange-600"
          >
            hello@thunderbird.bot
          </a>
          <p className="text-gray-400 text-sm mt-6">
            We typically respond within 24 hours.
          </p>
        </div>
      </div>
    </div>
  )
}
