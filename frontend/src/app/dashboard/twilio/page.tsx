import { TwilioDashboard } from '@/components/twilio/TwilioDashboard'
import { ServiceConnectionCheck } from '@/components/ServiceConnectionCheck'

export default function TwilioPage() {
  return (
    <ServiceConnectionCheck
      serviceName="Twilio"
      checkEndpoint="/api/twilio/config"
      settingsPath="/dashboard/settings?tab=integrations"
      documentationUrl="https://www.twilio.com/docs/usage/api"
    >
      <div className="container mx-auto p-6">
        <TwilioDashboard />
      </div>
    </ServiceConnectionCheck>
  )
}