// Placeholder AliExpress integration scaffold
// Implement suppliers, order submission, and status sync here.

export async function submitToAliExpress(orderPayload: unknown) {
  // TODO: implement live API calls, authentication, and mapping
  // For now return a stubbed response
  return {
    success: false,
    message: 'AliExpress integration not implemented',
    data: null
  };
}

export async function getAliExpressOrderStatus(externalId: string) {
  // TODO: query provider for order status
  return { status: 'unknown', externalId };
}
