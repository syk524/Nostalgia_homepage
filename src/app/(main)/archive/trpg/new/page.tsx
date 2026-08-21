import { NewSessionForm } from './new-session-form'

// No admin check here — archive/layout.tsx already gates every /archive/*
// route.
export default function NewSessionPage() {
  return <NewSessionForm />
}
