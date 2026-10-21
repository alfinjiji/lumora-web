<?php

return [
    'business_config_approved' => env('BUSINESS_CONFIG_APPROVED', false),
    'require_background_health' => env('REQUIRE_BACKGROUND_HEALTH', false),
    'checkout_enabled' => env('CHECKOUT_ENABLED', false),
    'tax_policy' => env('TAX_POLICY'), 'tax_basis_points' => (int) env('TAX_BASIS_POINTS', 0),
    'review_hours' => (int) env('REVIEW_HOLD_HOURS', 24), 'payment_hours' => (int) env('PAYMENT_HOLD_HOURS', 24), 'manual_hours' => (int) env('MANUAL_REVIEW_HOURS', 48),
    'external_mail_enabled' => env('EXTERNAL_MAIL_ENABLED', false),
    'manual_instructions' => env('MANUAL_PAYMENT_INSTRUCTIONS'), 'manual_payee_name' => env('MANUAL_PAYEE_NAME'), 'manual_destination' => env('MANUAL_PAYMENT_DESTINATION'),
    'razorpay' => ['mode' => env('RAZORPAY_MODE', 'disabled'), 'key_id' => env('RAZORPAY_KEY_ID'), 'key_secret' => env('RAZORPAY_KEY_SECRET'), 'webhook_secret' => env('RAZORPAY_WEBHOOK_SECRET')],
    'proof_scanner' => env('PROOF_SCANNER', 'disabled'), 'clamav_host' => env('CLAMAV_HOST', 'clamav'), 'clamav_port' => (int) env('CLAMAV_PORT', 3310),
    'media_public_disk' => env('MEDIA_PUBLIC_DISK', 'public'),
    'media_private_disk' => env('MEDIA_PRIVATE_DISK', 'local'),
    'timezone' => 'Asia/Kolkata',
];
