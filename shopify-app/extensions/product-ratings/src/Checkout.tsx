/**
 * Product ratings on checkout cart lines
 *
 * Renders a star rating and review count under each cart line item
 * on Shopify's hosted checkout, matching the social proof signal
 * shown on the storefront product cards.
 *
 * Data source: `reviews.rating` (Shopify rating metafield type
 * → { value, scale_min, scale_max }) and `reviews.rating_count`
 * (number). Same metafields the storefront uses via
 * snippets/schema-product-smart.liquid.
 */
import {
  reactExtension,
  InlineLayout,
  Text,
  useAppMetafields,
  useTarget,
  useTranslate,
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension(
  'purchase.checkout.cart-line-item.render-after',
  () => <ProductRating />,
);

type RatingMetafieldValue = {
  value: string;
  scale_min?: string;
  scale_max?: string;
};

function ProductRating() {
  const t = useTranslate();
  const cartLine = useTarget() as any;
  const metafields = useAppMetafields();

  const productId: string | undefined =
    cartLine?.merchandise?.product?.id;
  if (!productId) return null;

  const ratingField = metafields.find(
    (m) =>
      m.target?.type === 'product' &&
      m.target?.id === productId &&
      m.metafield?.namespace === 'reviews' &&
      m.metafield?.key === 'rating',
  );
  const countField = metafields.find(
    (m) =>
      m.target?.type === 'product' &&
      m.target?.id === productId &&
      m.metafield?.namespace === 'reviews' &&
      m.metafield?.key === 'rating_count',
  );

  if (!ratingField || ratingField.metafield?.value == null) return null;

  let ratingValue = 0;
  try {
    const parsed = JSON.parse(
      String(ratingField.metafield.value),
    ) as RatingMetafieldValue;
    ratingValue = Number(parsed.value);
  } catch {
    ratingValue = Number(ratingField.metafield.value);
  }
  if (!Number.isFinite(ratingValue) || ratingValue <= 0) return null;

  const ratingCount = countField?.metafield?.value
    ? Number(countField.metafield.value)
    : 0;
  const stars = renderStars(ratingValue);
  const display = ratingValue.toFixed(1).replace('.', ',');

  return (
    <InlineLayout
      spacing="extraTight"
      blockAlignment="center"
      columns={['auto', 'auto', 'fill']}
    >
      <Text size="small" emphasis="bold">
        {stars}
      </Text>
      <Text size="small" emphasis="bold">
        {display}
      </Text>
      {ratingCount > 0 ? (
        <Text size="small" appearance="subdued">
          {' '}
          ({ratingCount.toLocaleString('de-DE')} {t('reviews')})
        </Text>
      ) : null}
    </InlineLayout>
  );
}

function renderStars(value: number): string {
  const full = Math.floor(value);
  const half = value - full >= 0.5 ? 1 : 0;
  const empty = Math.max(0, 5 - full - half);
  return '★'.repeat(full) + (half ? '⯨' : '') + '☆'.repeat(empty);
}
