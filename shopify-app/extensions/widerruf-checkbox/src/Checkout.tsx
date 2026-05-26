/**
 * Widerrufsverzicht (§ 356 (5) BGB) — Checkout consent gate
 *
 * Renders a required consent checkbox directly above the "Pay now"
 * button on Shopify's hosted checkout. Buyer cannot complete the
 * order until the box is ticked. The consent is mirrored to a cart
 * attribute (widerruf_consent) with an ISO 8601 timestamp, so it
 * appears in the Shopify order details as legal proof.
 *
 * Required because Karinex sells digital goods (license keys) and
 * § 356 (5) BGB requires affirmative consent for the withdrawal
 * right to be waived on contract performance.
 */
import {
  reactExtension,
  BlockStack,
  Checkbox,
  Text,
  useApplyAttributeChange,
  useAttributeValues,
  useBuyerJourneyIntercept,
  useTranslate,
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension(
  'purchase.checkout.actions.render-before',
  () => <WiderrufConsent />,
);

const ATTRIBUTE_KEY = 'widerruf_consent';

function WiderrufConsent() {
  const t = useTranslate();
  const [stored] = useAttributeValues([ATTRIBUTE_KEY]);
  const applyAttribute = useApplyAttributeChange();

  const checked = Boolean(stored && stored.length > 0);

  useBuyerJourneyIntercept(({ canBlockProgress }) => {
    if (!canBlockProgress) return { behavior: 'allow' };
    if (checked) return { behavior: 'allow' };
    return {
      behavior: 'block',
      reason: 'Widerrufsverzicht not confirmed',
      errors: [{ message: t('required') }],
    };
  });

  async function onChange(value: boolean) {
    await applyAttribute({
      type: 'updateAttribute',
      key: ATTRIBUTE_KEY,
      value: value ? `Ja (${new Date().toISOString()})` : '',
    });
  }

  return (
    <BlockStack spacing="tight">
      <Checkbox
        id="kx-widerruf"
        name={ATTRIBUTE_KEY}
        checked={checked}
        onChange={onChange}
        required
      >
        <Text size="small">{t('consent')}</Text>
      </Checkbox>
    </BlockStack>
  );
}
