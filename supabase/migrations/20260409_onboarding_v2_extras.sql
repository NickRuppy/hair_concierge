-- Add new product categories to user_product_usage CHECK constraint
ALTER TABLE user_product_usage DROP CONSTRAINT IF EXISTS user_product_usage_category_check;
ALTER TABLE user_product_usage ADD CONSTRAINT user_product_usage_category_check
  CHECK (category IN (
    'shampoo','conditioner','leave_in','oil','mask',
    'heat_protectant','serum','scrub','peeling','dry_shampoo',
    'styling_gel','styling_mousse','styling_cream','hairspray',
    'bondbuilder','deep_cleansing_shampoo'
  ));
