import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { Deal } from '@/types'

let dealSeq = 1042

export const useDealsStore = defineStore('deals', () => {
  const deals = ref<Deal[]>([
    {
      id: 'DEAL-1001',
      clientName: 'Jasur Rahimov',
      clientPinfl: '31203016740011',
      clientPhone: '+998901234567',
      status: 'active',
      tariffId: 'trf_2',
      tariffName: '6 oy · 8%',
      termMonths: 6,
      amount: 1099000000,
      totalPayable: 1186920000,
      score: 742,
      decision: 'approved',
      agentId: 'emp_002',
      createdAt: '2026-04-12T10:24:00.000Z',
      paymentDay: 5,
      basket: [
        { product: { id: 'prd_2', name: 'Samsung Galaxy S24 128GB', price: '10990000.00', mxikCode: '08471300000000001', categoryId: 'cat_1', merchantId: '', active: true, createdAt: '', packageCode: null, packageName: null }, quantity: 1 },
      ],
    },
    {
      id: 'DEAL-1002',
      clientName: 'Madina Sobirova',
      clientPinfl: '52109026740022',
      clientPhone: '+998937654321',
      status: 'overdue',
      tariffId: 'trf_1',
      tariffName: '3 oy · 5%',
      termMonths: 3,
      amount: 580000000,
      totalPayable: 609000000,
      score: 631,
      decision: 'approved',
      agentId: 'emp_002',
      createdAt: '2026-03-28T14:02:00.000Z',
      paymentDay: 15,
      basket: [
        { product: { id: 'prd_6', name: 'Kir yuvish mashinasi LG 8kg', price: '5800000.00', mxikCode: '08450000000000006', categoryId: 'cat_3', merchantId: '', active: true, createdAt: '', packageCode: null, packageName: null }, quantity: 1 },
      ],
    },
    {
      id: 'DEAL-1003',
      clientName: 'Bekzod Aliyev',
      clientPinfl: '30501996740033',
      clientPhone: '+998901112233',
      status: 'closed',
      tariffId: 'trf_1',
      tariffName: '3 oy · 5%',
      termMonths: 3,
      amount: 420000000,
      totalPayable: 441000000,
      score: 798,
      decision: 'approved',
      agentId: 'emp_001',
      createdAt: '2026-02-09T09:11:00.000Z',
      paymentDay: 1,
      basket: [
        { product: { id: 'prd_5', name: "Oshxona stoli to'plami", price: '4200000.00', mxikCode: '09403000000000005', categoryId: 'cat_2', merchantId: '', active: true, createdAt: '', packageCode: null, packageName: null }, quantity: 1 },
      ],
    },
    {
      id: 'DEAL-1004',
      clientName: 'Nilufar Qodirova',
      clientPinfl: '61204036740044',
      clientPhone: '+998994445566',
      status: 'scoring',
      tariffId: 'trf_3',
      tariffName: '12 oy · 12%',
      termMonths: 12,
      amount: 1899000000,
      totalPayable: 2126880000,
      score: 0,
      decision: 'manual_review',
      agentId: 'emp_001',
      createdAt: '2026-05-15T16:45:00.000Z',
      paymentDay: 20,
      basket: [
        { product: { id: 'prd_3', name: 'MacBook Air M3 8/256GB', price: '18990000.00', mxikCode: '08471300000000003', categoryId: 'cat_1', merchantId: '', active: true, createdAt: '', packageCode: null, packageName: null }, quantity: 1 },
      ],
    },
    {
      id: 'DEAL-1005',
      clientName: 'Otabek Nazarov',
      clientPinfl: '30908016740055',
      clientPhone: '+998712223344',
      status: 'declined',
      tariffId: 'trf_3',
      tariffName: '12 oy · 12%',
      termMonths: 12,
      amount: 3000000000,
      totalPayable: 3360000000,
      score: 412,
      decision: 'declined',
      agentId: 'emp_002',
      createdAt: '2026-05-10T11:30:00.000Z',
      paymentDay: 10,
      basket: [
        { product: { id: 'prd_1', name: 'iPhone 15 Pro 256GB', price: '14990000.00', mxikCode: '08517000000000001', categoryId: 'cat_1', merchantId: '', active: true, createdAt: '', packageCode: null, packageName: null }, quantity: 1 },
        { product: { id: 'prd_2', name: 'Samsung Galaxy S24 128GB', price: '15010000.00', mxikCode: '08471300000000001', categoryId: 'cat_1', merchantId: '', active: true, createdAt: '', packageCode: null, packageName: null }, quantity: 1 },
      ],
    },
    {
      id: 'DEAL-1006',
      clientName: 'Gulnoza Tosheva',
      clientPinfl: '54011026740066',
      clientPhone: '+998907778899',
      status: 'approved',
      tariffId: 'trf_2',
      tariffName: '6 oy · 8%',
      termMonths: 6,
      amount: 690000000,
      totalPayable: 745200000,
      score: 705,
      decision: 'approved',
      agentId: 'emp_001',
      createdAt: '2026-05-16T08:20:00.000Z',
      paymentDay: 25,
      basket: [
        { product: { id: 'prd_7', name: 'Muzlatgich Samsung 380L', price: '6900000.00', mxikCode: '08418100000000007', categoryId: 'cat_3', merchantId: '', active: true, createdAt: '', packageCode: null, packageName: null }, quantity: 1 },
      ],
    },
  ])

  function byId(id: string): Deal | undefined {
    return deals.value.find((d) => d.id === id)
  }

  function forAgent(agentId: string): Deal[] {
    return deals.value.filter((d) => d.agentId === agentId)
  }

  const totalDisbursed = computed(() =>
    deals.value
      .filter((d) => ['active', 'closed', 'overdue'].includes(d.status))
      .reduce((sum, d) => sum + d.amount, 0),
  )

  const activeCount = computed(() => deals.value.filter((d) => d.status === 'active').length)

  const overdueCount = computed(() => deals.value.filter((d) => d.status === 'overdue').length)

  function nextDealId(): string {
    return `DEAL-${++dealSeq}`
  }

  function addDeal(deal: Deal) {
    deals.value.unshift(deal)
  }

  return {
    deals,
    byId,
    forAgent,
    totalDisbursed,
    activeCount,
    overdueCount,
    nextDealId,
    addDeal,
  }
})
