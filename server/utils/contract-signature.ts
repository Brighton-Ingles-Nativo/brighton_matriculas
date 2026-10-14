type ContractSignatureFields = {
  signedAccept?: boolean | null
  signedAt?: Date | string | null
  status?: string | null
}

export const isContractSigned = (contract: ContractSignatureFields): boolean =>
  Boolean(contract.signedAccept || contract.signedAt)
