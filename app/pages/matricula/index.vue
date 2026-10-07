<template>
  <div class="min-h-[100dvh] bg-muted/20">
    <AppHeader title="Matrículas" subtitle="Registro y seguimiento de matrículas" />
    <main class="mx-auto max-w-[1500px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 class="text-3xl font-semibold tracking-tight">Matrículas</h1>
          <p class="mt-1 text-muted-foreground">Consulta y seguimiento de las matrículas registradas.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UiButton v-if="canExport" variant="outline" class="gap-2" as-child><a :href="exportUrl">
              <Download class="size-4" /> Exportar Excel
            </a></UiButton>
          <UiButton class="gap-2" as-child>
            <NuxtLink to="/matricula/nuevo">
              <Plus class="size-4" /> Nueva matrícula
            </NuxtLink>
          </UiButton>
        </div>
      </section>
      <UiCard>
        <UiCardHeader class="gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
          <div>
            <UiCardTitle>Matrículas</UiCardTitle>
            <UiCardDescription>{{ pagination.total }} matrículas encontradas</UiCardDescription>
          </div>
          <div class="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
            <UiInput v-model="holderName" placeholder="Nombre del titular" aria-label="Nombre del titular" />
            <UiInput v-model="holderDni" placeholder="DNI del titular" aria-label="DNI del titular" />
            <UiInput v-if="canFilterAdvisor" v-model="advisorName" placeholder="Nombre del asesor" aria-label="Nombre del asesor" />
            <UiSelect v-model="status"><UiSelectTrigger class="w-full" aria-label="Estado"><UiSelectValue placeholder="Todos los estados" /></UiSelectTrigger><UiSelectContent><UiSelectItem value="revision">En revisión</UiSelectItem><UiSelectItem value="firmado">Firmado</UiSelectItem><UiSelectItem value="anulado">Anulado</UiSelectItem></UiSelectContent></UiSelect>
          </div>
        </UiCardHeader>
        <UiCardContent class="p-0">
          <div v-if="loading" class="space-y-3 p-6">
            <UiSkeleton v-for="row in 5" :key="row" class="h-12 w-full" />
          </div>
          <UiAlert v-else-if="error" variant="destructive" class="m-6">
            <UiAlertDescription>{{ error }}</UiAlertDescription>
          </UiAlert>
          <div v-else-if="!contracts.length"
            class="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <div class="mb-4 grid size-12 place-items-center rounded-full bg-muted">
              <FileCheck2 class="size-5 text-muted-foreground" />
            </div>
            <p class="font-medium">No hay matrículas para mostrar</p>
          </div>
          <UiTable v-else>
            <UiTableHeader>
              <UiTableRow>
                <UiTableHead>Matrícula</UiTableHead>
                <UiTableHead>Titular</UiTableHead>
                <UiTableHead class="hidden md:table-cell">DNI</UiTableHead>
                <UiTableHead v-if="user?.role?.name === 'admin'" class="hidden lg:table-cell">Asesor</UiTableHead>
                <UiTableHead>Programa</UiTableHead>
                <UiTableHead>Plan</UiTableHead>
                <UiTableHead class="text-right">Valor</UiTableHead>
                <UiTableHead>Estado</UiTableHead>
                <UiTableHead class="hidden sm:table-cell">Registro</UiTableHead>
                <UiTableHead class="text-right">Acciones</UiTableHead>
              </UiTableRow>
            </UiTableHeader>
            <UiTableBody>
              <UiTableRow v-for="row in contracts" :key="row.id">
                <UiTableCell class="font-semibold text-primary">{{ row.contractNumber }}</UiTableCell>
                <UiTableCell>
                  <div class="max-w-52 truncate font-medium uppercase">{{ row.holderName }}</div>
                  <div class="text-xs text-muted-foreground md:hidden">{{ row.holderDni }}</div>
                </UiTableCell>
                <UiTableCell class="hidden md:table-cell">{{ row.holderDni }}</UiTableCell>
                <UiTableCell v-if="user?.role?.name === 'admin'"
                  class="hidden max-w-36 truncate text-muted-foreground lg:table-cell">{{ row.advisor.name }}
                </UiTableCell>
                <UiTableCell>{{ row.program }}</UiTableCell>
                <UiTableCell><span v-if="row.plan"
                    :class="['inline-flex rounded-md border px-2 py-0.5 text-xs font-medium', planClass(row.plan)]">{{
                      row.plan }}</span><span v-else>N/A</span></UiTableCell>
                <UiTableCell class="whitespace-nowrap text-right font-medium">{{ formatCurrency(row.programValue) }}
                </UiTableCell>
                <UiTableCell>
                  <UiBadge :variant="statusVariant(row)">{{ statusLabel(row) }}</UiBadge>
                </UiTableCell>
                <UiTableCell class="hidden whitespace-nowrap text-muted-foreground sm:table-cell">{{
                  formatDate(row.registeredAt) }}</UiTableCell>
                <UiTableCell>
                  <div class="flex justify-end gap-1">
                    <UiButton size="icon" title="Ver detalle" aria-label="Ver detalle" @click="openDetail(row)">
                      <Eye class="size-4" />
                    </UiButton>
                    <UiButton size="icon" :title="!canEdit ? 'Editar matrícula: sin permisos' : isContractLocked(row) ? 'Matrícula firmada: edición bloqueada' : 'Editar matrícula'"
                      aria-label="Editar matrícula" :disabled="!canEdit || isContractLocked(row)">
                      <Pencil class="size-4" />
                    </UiButton>
                    <UiButton size="icon" title="Generar recibo: disponible próximamente" aria-label="Generar recibo"
                      disabled>
                      <FilePlus2 class="size-4" />
                    </UiButton>
                    <UiButton size="icon"
                      :title="row.receiptCount ? 'Ver recibo: disponible próximamente' : 'Ver recibo: no existe un recibo registrado'"
                      aria-label="Ver recibo" disabled>
                      <FileCheck2 class="size-4" />
                    </UiButton>
                  </div>
                </UiTableCell>
              </UiTableRow>
            </UiTableBody>
          </UiTable>
        </UiCardContent>
        <UiCardFooter v-if="!loading && pagination.totalPages > 1"
          class="flex-col gap-4 border-t sm:flex-row sm:justify-between">
          <p class="text-sm text-muted-foreground">Mostrando página <span class="font-semibold text-foreground">{{
            pagination.page }}</span> de {{ pagination.totalPages }}</p>
          <nav aria-label="Paginación de matrículas" class="flex items-center gap-1">
            <UiButton variant="outline" size="icon" class="size-8" :disabled="page <= 1" aria-label="Primera página"
              title="Primera página" @click="goToPage(1)">«</UiButton>
            <UiButton variant="outline" size="icon" class="size-8" :disabled="page <= 1" aria-label="Página anterior"
              title="Página anterior" @click="goToPage(page - 1)">
              <ChevronLeft class="size-4" />
            </UiButton><template v-for="(item, index) in pageItems" :key="`${item}-${index}`"><span
                v-if="item === 'ellipsis'" class="grid size-8 place-items-center text-sm text-muted-foreground">…</span>
              <UiButton v-else :variant="item === page ? 'default' : 'outline'" size="icon" class="size-8"
                :aria-current="item === page ? 'page' : undefined" :aria-label="`Página ${item}`"
                @click="goToPage(item)">{{ item }}</UiButton>
            </template>
            <UiButton variant="outline" size="icon" class="size-8" :disabled="page >= pagination.totalPages"
              aria-label="Página siguiente" title="Página siguiente" @click="goToPage(page + 1)">
              <ChevronRight class="size-4" />
            </UiButton>
            <UiButton variant="outline" size="icon" class="size-8" :disabled="page >= pagination.totalPages"
              aria-label="Última página" title="Última página" @click="goToPage(pagination.totalPages)">»</UiButton>
          </nav>
        </UiCardFooter>
      </UiCard>
    </main>
    <MatriculaContractDetailDialog v-model:open="detailOpen" :contract="selectedContract" :loading="detailLoading"
      :error="detailError" :action-loading="detailActionLoading"
      @accept="acceptContract" @public-view="openPublicView" @pdf="openContractPdf" />
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { ChevronLeft, ChevronRight, Download, Eye, FileCheck2, FilePlus2, Pencil, Plus } from '@lucide/vue'

interface ContractRow { 
  id: string; 
  contractNumber: string; 
  holderName: string; 
  holderDni: string; 
  program: string; 
  plan: string | null; 
  programValue: string; 
  status: 'REVISION' | 'FIRMADO' | 'ANULADO';
  signedAt: string | null;
  registeredAt: string; 
  advisor: { 
    name: string; 
    username: string 
  }; 
  receiptCount: number; 
  latestReceiptId: string | null 
}

interface ContractsResponse { 
  success: boolean; 
  data: ContractRow[]; 
  pagination: { 
    page: number; 
    limit: number; 
    total: number; 
    totalPages: number 
  }; 
  role: string | null 
}

interface ReceiptDetail { 
  id: string; 
  registeredRole: string | null; 
  amount: string | null; 
  concepts: string | null; 
  otherConcept: string | null; 
  paymentMethod: string | null; 
  operationNumber: string | null; 
  bank: string | null; 
  transactionDate: string | null; 
  registeredAt: string 
}

interface ContractDetail extends ContractRow { 
  updatedAt: string; 
  contractDepartment: string | null; 
  contractProvince: string | null; 
  contractDistrict: string | null; 
  holderBirthDate: string; 
  holderEmail: string; 
  holderAddress: string; 
  holderDepartment: string | null; 
  holderProvince: string | null; 
  holderDistrict: string | null; 
  holderPhone: string; 
  beneficiary1Name: string | null; 
  beneficiary1BirthDate: string | null; 
  beneficiary1Dni: string | null; 
  beneficiary1Email: string | null; 
  beneficiary1Phone: string | null; 
  beneficiary2Name: string | null; 
  beneficiary2BirthDate: string | null; 
  beneficiary2Dni: string | null; 
  beneficiary2Email: string | null; 
  beneficiary2Phone: string | null; 
  currentSituation: string; 
  housingType: string; 
  dataAuthorization: boolean; 
  strategy: string; 
  paymentStartDate: string | null; 
  modality: string | null; 
  cashPayment: boolean; 
  financedPayment: boolean; 
  initialPayment: string | null; 
  balance: string | null; 
  installmentCount: number | null; 
  installmentValue: string | null; 
  otherPayment: string | null; 
  notes: string | null; 
  testimonials: boolean; 
  dataUsage: boolean | null; 
  signedIp: string | null;
  receipts: ReceiptDetail[] 
}

definePageMeta({ 
  middleware: 'auth', 
  ssr: false, 
  alias: ['/matriculas'] 
})

const { user, verifyToken, csrfHeaders } = useAuth(); 
const route = useRoute()

const holderName = ref(typeof route.query.holderName === 'string' ? route.query.holderName : '');
const holderDni = ref(typeof route.query.holderDni === 'string' ? route.query.holderDni : '');
const advisorName = ref('');
const status = ref(typeof route.query.status === 'string' ? route.query.status : '');
const expedientStatus = route.query.expedientStatus === 'sin_expediente' ? 'sin_expediente' : '';
const page = ref(1); 
const loading = ref(true); 
const error = ref(''); 
const contracts = ref<ContractRow[]>([]); 
const pagination = ref<ContractsResponse['pagination']>({ 
  page: 1, 
  limit: 15, 
  total: 0, 
  totalPages: 0 
}); 

const detailOpen = ref(false); 
const detailLoading = ref(false); 
const detailError = ref(''); 
const detailActionLoading = ref(false); 
const selectedContract = ref<ContractDetail | null>(null)

const canExport = computed(() => ['admin', 'asesor', 'supervisor', 'asistente_comercial', 'verificador'].includes(user.value?.role?.name || ''));
const canEdit = computed(() => true); 
const canFilterAdvisor = computed(() => user.value?.role?.name !== 'asesor')
const isContractLocked = (row?: ContractRow) => !row || row.status !== 'REVISION' || Boolean(row.signedAt)

const exportUrl = computed(() => {
  const params = new URLSearchParams()
  if (holderName.value) params.set('holderName', holderName.value)
  if (holderDni.value) params.set('holderDni', holderDni.value)
  if (canFilterAdvisor.value && advisorName.value) params.set('advisorName', advisorName.value)
  if (status.value) params.set('status', status.value)
  if (expedientStatus) params.set('expedientStatus', expedientStatus)
  params.set('format', 'xlsx')
  const query = params.toString()
  return `/api/contracts/export${query ? `?${query}` : ''}`
})

const loadContracts = async () => { 
  loading.value = true; 
  error.value = ''; 
  try { 
    const response = await $fetch<ContractsResponse>('/api/contracts', { 
      query: { 
        page: page.value, 
        holderName: holderName.value || undefined,
        holderDni: holderDni.value || undefined,
        advisorName: canFilterAdvisor.value ? advisorName.value || undefined : undefined,
        status: status.value || undefined,
        expedientStatus: expedientStatus || undefined
      } 
      }); 
    contracts.value = response.data; 
    pagination.value = response.pagination 
  } catch { 
    error.value = 'No pudimos cargar las matrículas.' 
  } finally { 
    loading.value = false 
  } 
}

const submitSearch = async () => { 
  page.value = 1; 
  await loadContracts() 
}; 

const debouncedLoadContracts = useDebounceFn(() => submitSearch(), 350)

const goToPage = async (nextPage: number) => { 
  if (nextPage < 1 || nextPage > pagination.value.totalPages || nextPage === page.value) 
  return; 
  page.value = nextPage; 
  await loadContracts() 
}

const pageItems = computed<(number | 'ellipsis')[]>(() => { 
  const total = pagination.value.totalPages; 
  const current = page.value; 
  if (total <= 7) 
  return Array.from({ length: total }, (_, index) => index + 1); 

const items: (number | 'ellipsis')[] = [1]; 

if (current > 4) items.push('ellipsis'); 

for (let index = Math.max(2, current - 1); index <= Math.min(total - 1, current + 1); index++) items.push(index); 

if (current < total - 3) items.push('ellipsis'); 
  items.push(total); 
  return items 
})

const formatDate = (value: string) => new Intl.DateTimeFormat('es-PE', { 
  dateStyle: 'short' 
}).format(new Date(value)); 

const formatCurrency = (value: string) => new Intl.NumberFormat('es-PE', { 
  style: 'currency', 
  currency: 'PEN' }).format(Number(value))

const openDetail = async (row: ContractRow) => { 
  detailOpen.value = true; 
  detailLoading.value = true; 
  detailError.value = ''; 
  selectedContract.value = null; 
  try { 
    const response = await $fetch<{ 
      success: boolean; 
      data?: ContractDetail 
    }>(`/api/contracts/${row.id}`, { 
      credentials: 'include' 
    }); 
    if (!response.success || !response.data) 
    throw new Error('Detalle inválido'); 
    selectedContract.value = response.data 
  } catch { 
    detailError.value = 'No pudimos cargar el detalle de este contrato.' 
  } finally { 
    detailLoading.value = false 
  } 
}

const acceptContract = async () => { 
  if (!selectedContract.value) return; 
  detailActionLoading.value = true; 
  detailError.value = ''; 
  try { 
    const response = await $fetch<{ data: Pick<ContractDetail, 'status' | 'signedAt' | 'signedIp'> }>(`/api/contracts/${selectedContract.value.id}/accept`, {
      method: 'POST', 
      headers: await csrfHeaders(), 
      credentials: 'include' }); 
    Object.assign(selectedContract.value, response.data)
    await loadContracts()
  } catch (
    error: any) { 
      detailError.value = error?.data?.statusMessage || 'No pudimos aceptar el contrato.' 
  } finally { 
    detailActionLoading.value = false 
  } 
}

const openPublicView = async () => { 
  if (!selectedContract.value) return; 
  try { 
    const response = await $fetch<{ url: string }>(`/api/contracts/${selectedContract.value.id}/public-link`, { 
      credentials: 'include' 
    }); 
    window.open(response.url, '_blank', 'noopener,noreferrer') 
  } catch (error: any) { 
    detailError.value = error?.data?.statusMessage || 'No pudimos abrir la vista pública.' 
  } 
}

const openContractPdf = () => { 
  if (selectedContract.value) 
  window.open(`/api/contracts/${selectedContract.value.id}/pdf`, '_blank', 'noopener,noreferrer') 
}

const handleEditAction = (event: MouseEvent) => { 
  const button = (event.target as HTMLElement).closest('button[aria-label="Editar matrícula"]') as HTMLButtonElement | null; 
  if (!button || button.disabled) 
  return; 

  const row = button.closest('tr'); 
  const rows = Array.from(button.closest('tbody')?.querySelectorAll('tr') || []); 
  const contract = contracts.value[rows.indexOf(row as HTMLTableRowElement)]; 
  if (contract) navigateTo(`/matricula/${contract.id}`) 
}

const handleReceiptAction = (event: MouseEvent) => { 
  const button = (event.target as HTMLElement).closest('button[aria-label="Ver recibo"]') as HTMLButtonElement | null; 
  if (!button || button.disabled) return; 
  const row = button.closest('tr'); 
  const rows = Array.from(button.closest('tbody')?.querySelectorAll('tr') || []); 
  const contract = contracts.value[rows.indexOf(row as HTMLTableRowElement)]; 
  if (contract?.latestReceiptId) navigateTo(`/recibo/${contract.latestReceiptId}`) 
}

const handleGenerateReceipt = (event: MouseEvent) => { 
  const button = (event.target as HTMLElement).closest('button[aria-label="Generar recibo"]') as HTMLButtonElement | null; 
  if (!button || button.disabled) return; 

  const row = button.closest('tr'); 
  const rows = Array.from(button.closest('tbody')?.querySelectorAll('tr') || []); 
  const contract = contracts.value[rows.indexOf(row as HTMLTableRowElement)]; 

  if (contract) navigateTo(`/recibo/nuevo/${contract.id}`) 
}

watch(contracts, async (rows) => { 
  await nextTick(); 
  
  const receiptRole = ['admin', 'asesor'].includes(user.value?.role?.name || '');

  document.querySelectorAll<HTMLButtonElement>('button[aria-label="Editar matrícula"]')
    .forEach((button, index) => {
      button.disabled = !canEdit.value || isContractLocked(rows[index])
    }); 

  document.querySelectorAll<HTMLButtonElement>('button[aria-label="Ver recibo"]')
    .forEach((button, index) => { 
      button.disabled = !receiptRole || !rows[index]?.receiptCount 
    }); 
  
})

const statusLabel = (row: ContractRow) => row.status === 'ANULADO' ? 'Anulado' : row.status === 'FIRMADO' || row.signedAt ? 'Firmado' : 'En revisión';
const statusVariant = (row: ContractRow): 'default' | 'outline' | 'destructive' => row.status === 'ANULADO' ? 'destructive' : row.status === 'FIRMADO' || row.signedAt ? 'default' : 'outline';

const planClass = (plan: string | null) => ({ 
  Light: 'bg-amber-100 text-amber-800 border-amber-200', 
  Elite: 'bg-emerald-100 text-emerald-800 border-emerald-200', 
  Premium: 'bg-rose-100 text-rose-800 border-rose-200' 
}[plan || ''] || 'bg-muted text-muted-foreground')

onMounted(async () => { 
  document.addEventListener('click', handleEditAction); 
  document.addEventListener('click', handleReceiptAction); 
  document.addEventListener('click', handleGenerateReceipt); 
  if (!user.value) await verifyToken(); 
  await loadContracts() 
})

watch([holderName, holderDni, advisorName, status], () => debouncedLoadContracts())

onBeforeUnmount(() => { 
  document.removeEventListener('click', handleEditAction); 
  document.removeEventListener('click', handleReceiptAction); 
  document.removeEventListener('click', handleGenerateReceipt) 
})
</script>
