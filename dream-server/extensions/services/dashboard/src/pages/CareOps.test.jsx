import { fireEvent, screen, within } from '@testing-library/react'
import { render } from '../test/test-utils'
import CareOps from './CareOps' // eslint-disable-line no-unused-vars

const careopsPayload = {
  profile: {
    id: 'healthcare-enterprise',
    name: 'DreamServer CareOps',
    normalUserKnobs: {
      modelSwitching: false,
      extensionStore: false,
      rawServicePorts: false,
    },
  },
  summary: {
    totalOpen: 3,
    dueToday: 2,
    readyForReview: 1,
    blocked: 1,
  },
  controls: [
    { id: 'identity', name: 'Hospital identity', state: 'planned', mode: 'OIDC/SAML plus SCIM' },
    { id: 'ai-gateway', name: 'AI gateway', state: 'ready', mode: 'single policy path' },
  ],
  modules: [
    {
      id: 'prior-auth',
      name: 'Prior Authorization',
      queue: 'Prior Auth',
      stage: 'pilot-ready',
      ownerRole: 'Authorization specialist',
      enabled: true,
      metrics: { open: 2, dueToday: 1, readyForReview: 1 },
    },
    {
      id: 'denials',
      name: 'Denials and Appeals',
      queue: 'Denials',
      stage: 'design-ready',
      ownerRole: 'Revenue cycle analyst',
      enabled: true,
      metrics: { open: 1, dueToday: 1, readyForReview: 0 },
    },
  ],
  queueItems: [
    {
      id: 'PA-1042',
      moduleId: 'prior-auth',
      patientRef: 'PX-2048',
      serviceLine: 'Orthopedics',
      requestType: 'MRI knee without contrast',
      status: 'ready_for_review',
      priority: 'high',
      dueInHours: 6,
      evidenceCount: 7,
      missingInfo: [],
      nextAction: 'Coordinator review',
    },
    {
      id: 'DN-883',
      moduleId: 'denials',
      patientRef: 'PX-1180',
      serviceLine: 'Cardiology',
      requestType: 'Appeal packet',
      status: 'drafting',
      priority: 'medium',
      dueInHours: 30,
      evidenceCount: 5,
      missingInfo: ['signed plan note'],
      nextAction: 'Assemble cited appeal draft',
    },
  ],
  auditEvents: [
    {
      id: 'AUD-9001',
      workItemId: 'PA-1042',
      action: 'packet_drafted',
      policy: 'human_review_required',
      result: 'allowed',
    },
  ],
}

describe('CareOps', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(careopsPayload) })
    ))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders staff workflow queues instead of model or extension controls', async () => {
    render(<CareOps />)

    expect(await screen.findByRole('heading', { name: 'CareOps' })).toBeInTheDocument()
    expect(screen.getByText('Local PHI workflow surface')).toBeInTheDocument()
    expect(screen.getByText('Prior Authorization')).toBeInTheDocument()
    expect(screen.getByText('MRI knee without contrast')).toBeInTheDocument()
    expect(screen.queryByText(/model switching/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/extension store/i)).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/careops')
  })

  it('filters the queue by enabled module', async () => {
    render(<CareOps />)

    await screen.findByText('MRI knee without contrast')
    fireEvent.click(screen.getByRole('button', { name: 'Denials' }))

    expect(screen.getByText('Appeal packet')).toBeInTheDocument()
    expect(screen.queryByText('MRI knee without contrast')).not.toBeInTheDocument()
  })

  it('shows audit policy outcomes', async () => {
    render(<CareOps />)

    const auditPanel = await screen.findByText('Audit Tail')
    const section = auditPanel.closest('section')
    expect(within(section).getByText('PA-1042')).toBeInTheDocument()
    expect(within(section).getByText('packet drafted')).toBeInTheDocument()
    expect(within(section).getByText('human_review_required')).toBeInTheDocument()
  })
})
