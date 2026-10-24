<script setup lang="ts">
interface ReceiptDocumentData {
  amount: string | null
  concepts: string | null
  bank: string | null
  operationNumber: string | null
  registeredAt: string
  registeredRole: string | null
  paymentMethod: string | null
  contract: {
    contractNumber: string
    holderName: string
    holderDni: string
    holderAddress: string | null
    holderPhone: string | null
    programValue: string
  }
  user?: { name: string | null } | null
}

const props = defineProps<{ receipt: ReceiptDocumentData }>()
const root = ref<HTMLElement | null>(null)

const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'long' }).format(new Date(value))
  : '—'

const formatCurrency = (value: string | null) => value
  ? new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value))
  : '—'

defineExpose({ getRoot: () => root.value })
</script>

<template>
  <article ref="root" class="receipt-page overflow-hidden rounded-xl border-2 border-primary bg-white shadow-sm">
    <header class="flex items-center justify-between bg-primary px-6 py-5 text-primary-foreground">
      <img src="/assets/images/logoBlanco.webp" alt="Brighton" class="h-14 w-auto object-contain" />
      <div class="text-right">
        <h1 class="text-xl font-bold">RECIBO DE PAGO</h1>
        <p class="text-sm text-primary-foreground/80">Contrato: {{ props.receipt.contract.contractNumber }}</p>
      </div>
    </header>
    <div class="space-y-6 p-6">
      <section class="grid gap-3 sm:grid-cols-12">
        <div class="field sm:col-span-8"><b>NOMBRE:</b> {{ props.receipt.contract.holderName }}</div>
        <div class="field sm:col-span-4"><b>DNI:</b> {{ props.receipt.contract.holderDni }}</div>
        <div class="field sm:col-span-8"><b>DIRECCIÓN:</b> {{ props.receipt.contract.holderAddress }}</div>
        <div class="field sm:col-span-4"><b>CELULAR:</b> {{ props.receipt.contract.holderPhone }}</div>
        <div class="field sm:col-span-4"><b>FECHA:</b> {{ formatDate(props.receipt.registeredAt) }}</div>
      </section>
      <section>
        <h2 class="section-title">Por concepto de</h2>
        <p class="px-3 py-2 font-semibold uppercase">{{ props.receipt.concepts || '—' }}</p>
      </section>
      <section>
        <h2 class="section-title">Detalle del pago</h2>
        <div class="grid gap-3 px-3 py-3 sm:grid-cols-4">
          <div><b>Monto:</b><br />{{ formatCurrency(props.receipt.amount) }}</div>
          <div><b>Medio:</b><br />{{ props.receipt.paymentMethod || '—' }}</div>
          <div><b>Banco:</b><br />{{ props.receipt.bank || 'N/A' }}</div>
          <div><b>Operación:</b><br />{{ props.receipt.operationNumber || '---' }}</div>
        </div>
      </section>
      <section class="terms">
        <p><strong>CONDICIONES GENERALES DE CUMPLIMIENTO</strong></p>
        <p>Mediante el presente Contrato, las Partes se obligan a celebrar un contrato de compra venta de un
          Programa Integral de inglés, en virtud del cual LA VENDEDORA brindará el programa integral y El/la
          Cliente/Comprador/a se compromete a adquirir dicho servicio bajo las condiciones aquí pactadas.</p>
        <p>El Contrato definitivo deberá ser suscrito en un plazo máximo de 48 horas a partir de la firma del
          presente documento, momento en el cual El/la Cliente/Comprador/a deberá abonar la cuota inicial de acuerdo
          con el cronograma de pagos o el monto total si se trata de una compra al contado.</p>
        <p>El precio total del Programa es de <strong>{{ formatCurrency(props.receipt.contract.programValue) }}</strong>,
          monto que será abonado en moneda nacional. El/la Cliente/Comprador/a podrá optar por pagar al contado o
          mediante financiamiento pactado con LA VENDEDORA.</p>
        <p>La cuota inicial o el total será cancelado a través de depósito en cuenta, transferencia bancaria, etc.
          al momento de la firma del contrato definitivo.</p>
        <p>Considerando que los cupos son limitados, LA VENDEDORA se obliga frente a El/La Comprador(a), por un
          plazo de 48 horas (2 días calendario), a no ofrecer la vacante del Programa a terceros ni celebrar
          acuerdos que afecten su disponibilidad.</p>
        <p>El/La Compradora entrega a LA VENDEDORA la suma de <strong>{{ formatCurrency(props.receipt.amount) }}</strong>,
          en calidad de separación de vacante; este monto será imputado al Precio de Compra en caso se suscriba el
          contrato definitivo dentro del plazo establecido.</p>
        <p>Si El/la Cliente/Comprador/a no suscribe el contrato ni realiza el pago correspondiente dentro del plazo
          pactado, la separación quedará a favor de LA VENDEDORA, sin derecho a devolución alguna.</p>
        <p>En señal de conformidad, las Partes firman el presente documento en la ciudad de Arequipa.</p>
        <p>EL/LA CLIENTE/COMPRADOR/A &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; LA VENDEDORA</p>
      </section>
    </div>
    <footer class="flex justify-between border-t bg-muted/30 px-6 py-2 text-xs text-muted-foreground">
      <span>Registrado por: {{ props.receipt.user?.name || '—' }} ({{ props.receipt.registeredRole || '—' }})</span>
      <span>Fecha de impresión: {{ new Date().toLocaleString('es-PE') }}</span>
    </footer>
  </article>
</template>

<style scoped>
.section-title {
  background: var(--primary);
  color: white;
  padding: .35rem .75rem;
  font-size: .8rem;
  font-weight: 700;
  text-transform: uppercase;
}

.field {
  border-bottom: 1px solid var(--border);
  padding: .5rem .25rem;
  font-size: .9rem;
}

.terms {
  border-top: 1px solid var(--border);
  color: var(--muted-foreground);
  font-size: .7rem;
  line-height: 1.35;
  text-align: justify;
}

@media screen {
  .receipt-page {
    background: hsl(var(--card));
    color: hsl(var(--card-foreground));
  }
}

@media print {
  .receipt-page {
    border: 1px solid #000 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  .section-title,
  header {
    background: #004aad !important;
    color: white !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
