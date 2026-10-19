export async function waitForReceiptAssets(element: HTMLElement) {
  await document.fonts?.ready
  await Promise.all(Array.from(element.querySelectorAll('img')).map(image => image.decode().catch(() => undefined)))
}

export async function downloadReceiptPdf(element: HTMLElement, contractNumber: string) {
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
  const pdfContractNumber = contractNumber.replace(/[^\p{L}\p{N}-]+/gu, '-')

  pdf.addImage(image, 'JPEG', x, margin, imageWidth, imageHeight, undefined, 'FAST')
  pdf.save(`recibo-${pdfContractNumber || 'recibo'}.pdf`)
}
