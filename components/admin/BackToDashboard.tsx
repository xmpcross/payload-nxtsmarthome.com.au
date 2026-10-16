'use client'
// Top-left sidebar button, above the collection list: a labeled one-click way back to /admin from
// deep inside a collection or document, next to Payload's own small (unlabeled) logo link.
import { Button } from '@payloadcms/ui'

export function BackToDashboard() {
  return (
    <Button el="link" to="/admin" buttonStyle="pill" size="small">
      Dashboard
    </Button>
  )
}
