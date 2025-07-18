import { ZoomMeetingManager } from '@/components/zoom/ZoomMeetingManager'
import { ServiceConnectionCheck } from '@/components/ServiceConnectionCheck'

export default function ZoomPage() {
  return (
    <ServiceConnectionCheck
      serviceName="Zoom"
      checkEndpoint="/api/zoom/auth/status"
      settingsPath="/dashboard/settings?tab=integrations"
      documentationUrl="https://developers.zoom.us/docs/api/"
    >
      <div className="container mx-auto p-6">
        <ZoomMeetingManager />
      </div>
    </ServiceConnectionCheck>
  )
}