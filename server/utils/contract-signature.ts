type ContractSignatureFields = {
  signedAccept?: boolean | null
  signedAt?: Date | string | null
  status?: string | null
}

/** FIRMADO is retained only to recognize records created before signature was separated from status. */
export const isContractSigned = (contract: ContractSignatureFields): boolean =>
  Boolean(contract.signedAccept || contract.signedAt || contract.status === 'FIRMADO')
