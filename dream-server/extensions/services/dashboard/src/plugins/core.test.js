import { getSidebarNavItems } from './registry'

describe('core route registry', () => {
  it('keeps CareOps visible and hides consumer knobs in healthcare profile', () => {
    const labels = getSidebarNavItems({
      status: { enterprise: { profile: 'careops' }, gpu: { gpu_count: 1 } },
    }).map(item => item.label)

    expect(labels).toContain('Dashboard')
    expect(labels).toContain('CareOps')
    expect(labels).toContain('Settings')
    expect(labels).not.toContain('Models')
    expect(labels).not.toContain('Extensions')
    expect(labels).not.toContain('Integrations')
  })

  it('leaves model and extension navigation in the standard profile', () => {
    const labels = getSidebarNavItems({
      status: { enterprise: { profile: 'standard' }, gpu: { gpu_count: 1 } },
    }).map(item => item.label)

    expect(labels).toContain('CareOps')
    expect(labels).toContain('Models')
    expect(labels).toContain('Extensions')
  })
})
