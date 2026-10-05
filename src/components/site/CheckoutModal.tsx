import { pixConfig, type PlanId } from "@/config/pix";
import { PlanCheckoutModal } from "@/components/site/PlanCheckoutModal";

// Checkout da página inicial: usa a mesma janela Pix (com cupom) do fluxo pago.
export function CheckoutModal({ planId, onClose }: { planId: PlanId | null; onClose: () => void }) {
  const plan = planId
    ? {
        id: planId,
        name: pixConfig[planId].label,
        price: pixConfig[planId].amount,
        pix_payload: pixConfig[planId].payload,
      }
    : null;
  return <PlanCheckoutModal plan={plan} onClose={onClose} />;
}
