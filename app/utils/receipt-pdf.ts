export async function waitForReceiptAssets(element: HTMLElement) {
  await document.fonts?.ready
  await Promise.all(Array.from(element.querySelectorAll('img')).map(image => image.decode().catch(() => undefined)))
}

export async function createReceiptPdf(element: HTMLElement): Promise<Blob> {
  await waitForReceiptAssets(element)

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf')
  ])
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
    windowWidth: 1024,
    onclone: (_document, clonedElement) => {
      clonedElement.style.width = '848px'
      clonedElement.style.maxWidth = 'none'
      clonedElement.style.opacity = '1'
      if (clonedElement.parentElement) clonedElement.parentElement.style.opacity = '1'
    }
  })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const margin = 10
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const availableWidth = pageWidth - margin * 2
  const availableHeight = pageHeight - margin * 2
  const scale = Math.min(availableWidth / canvas.width, availableHeight / canvas.height)
  const imageWidth = canvas.width * scale
  const imageHeight = canvas.height * scale
  const x = (pageWidth - imageWidth) / 2
  const image = canvas.toDataURL('image/jpeg', 0.96)
  pdf.addImage(image, 'JPEG', x, margin, imageWidth, imageHeight, undefined, 'FAST')
  return pdf.output('blob')
}

export async function downloadReceiptPdf(element: HTMLElement, contractNumber: string) {
  const blob = await createReceiptPdf(element)
  const pdfContractNumber = contractNumber.replace(/[^\p{L}\p{N}-]+/gu, '-')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `recibo-${pdfContractNumber || 'recibo'}.pdf`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
