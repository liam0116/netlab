import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView, meta: { title: 'Dashboard' } },
    // Static paths rank above /learn/:chapter, so this does not clash with the tutorial chapters.
    { path: '/learn/raid', name: 'raid', component: () => import('@/views/RaidView.vue'), meta: { title: 'RAID' } },
    { path: '/reference/devices', name: 'devices', component: () => import('@/views/DeviceGuideView.vue'), meta: { title: 'Device Guide' } },
    { path: '/learn', name: 'learn', component: () => import('@/views/TutorialView.vue'), meta: { title: 'Learn' } },
    {
      path: '/learn/:chapter',
      name: 'learn-chapter',
      component: () => import('@/views/TutorialView.vue'),
      meta: { title: 'Learn' },
    },
    {
      path: '/tools/subnet',
      name: 'subnet',
      component: () => import('@/views/SubnetCalculatorView.vue'),
      meta: { title: 'Subnet Calculator' },
    },
    {
      path: '/tools/cidr',
      name: 'cidr',
      component: () => import('@/views/CidrConverterView.vue'),
      meta: { title: 'CIDR Converter' },
    },
    {
      path: '/tools/binary',
      name: 'binary',
      component: () => import('@/views/BinaryCalculatorView.vue'),
      meta: { title: 'Binary Calculator' },
    },
    {
      path: '/tools/same-subnet',
      name: 'same-subnet',
      component: () => import('@/views/SameSubnetView.vue'),
      meta: { title: 'Same Subnet Checker' },
    },
    {
      path: '/tools/gateway',
      name: 'gateway',
      component: () => import('@/views/GatewayValidatorView.vue'),
      meta: { title: 'Gateway Validator' },
    },
    {
      path: '/reference/ports',
      name: 'ports',
      component: () => import('@/views/PortReferenceView.vue'),
      meta: { title: 'Port Reference' },
    },
    {
      path: '/reference/linux',
      name: 'linux',
      component: () => import('@/views/LinuxCommandsView.vue'),
      meta: { title: 'Linux Commands' },
    },
    {
      path: '/reference/troubleshooting',
      name: 'troubleshooting',
      component: () => import('@/views/TroubleshootingView.vue'),
      meta: { title: 'Troubleshooting' },
    },
    {
      path: '/lab/packet',
      name: 'packet',
      component: () => import('@/views/PacketSimulatorView.vue'),
      meta: { title: 'Packet Simulator' },
    },
    {
      path: '/lab/network',
      name: 'network',
      component: () => import('@/views/NetworkSimulatorView.vue'),
      meta: { title: 'Network Simulator' },
    },
    {
      path: '/tools/ip-planner',
      name: 'ip-planner',
      component: () => import('@/views/IPPlannerView.vue'),
      props: { mode: 'tool' },
      meta: { title: 'IP Planner' },
    },
    // Same editor, bound to the current project's plan instead of the stand-alone calculator.
    { path: '/project/ip-plan', name: 'ip-plan', component: () => import('@/views/IPPlannerView.vue'), props: { mode: 'project' }, meta: { title: 'IP Plan' } },
    { path: '/project/rack', name: 'rack', component: () => import('@/views/RackView.vue'), meta: { title: 'Rack Elevation' } },
    { path: '/project/cabling', name: 'cabling', component: () => import('@/views/CablingView.vue'), meta: { title: 'Cabling' } },
    { path: '/project/flows', name: 'flows', component: () => import('@/views/ServiceFlowsView.vue'), meta: { title: 'Service Flows' } },
    { path: '/project/flowcharts', name: 'flowcharts', component: () => import('@/views/FlowchartsView.vue'), meta: { title: 'Flowcharts' } },
    { path: '/service/maintenance', name: 'maintenance', component: () => import('@/views/MaintenanceView.vue'), meta: { title: 'Maintenance' } },
    // v1.3.0 had work orders under Project.
    { path: '/project/maintenance', redirect: '/service/maintenance' },
    { path: '/tools/cable-labels', name: 'cable-labels', component: () => import('@/views/CableLabelsView.vue'), meta: { title: 'Cable Labels' } },
    { path: '/tools/calculators', name: 'calculators', component: () => import('@/views/CalculatorsView.vue'), meta: { title: 'Field Calculators' } },
    { path: '/project/config', name: 'config', component: () => import('@/views/ConfigGeneratorView.vue'), meta: { title: 'Config Generator' } },
    { path: '/project/report', name: 'report', component: () => import('@/views/ReportView.vue'), meta: { title: 'Handover Report' } },
    { path: '/project', name: 'project', component: () => import('@/views/ProjectView.vue'), meta: { title: 'Projects' } },
    {
      path: '/features/:id',
      name: 'feature',
      component: () => import('@/views/FeatureInfoView.vue'),
      meta: { title: 'Feature' },
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
  ],
  // Back / forward restores the old position; links with #anchor (e.g. /reference/devices#nas-12bay)
  // scroll to that element below the sticky header; everything else starts at the top.
  scrollBehavior: (to, _from, saved) => {
    if (saved) return saved
    if (to.hash) return { el: to.hash, top: 72 }
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : 'Not Found'
  document.title = `${title} · Server Engineer Network Lab`
})

export default router
